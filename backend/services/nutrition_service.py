import logging
import json
import re
from typing import Optional, Dict, Any, Tuple
import httpx
from core.config import settings

logger = logging.getLogger(__name__)

def inject_agent_prediction_to_unit_weights(supabase_client, nutrition_ref_id: Any, unit_name: str, estimated_gram: float):
    """
    Menyuntikkan hasil tebakan AI (Agen Lapis 2) langsung ke Master Data Referensi Satuan.
    Menggunakan UPSERT agar otomatis meng-update jika satuan sudah pernah dicatat.
    """
    try:
        # Bersihkan data agar konsisten
        clean_unit = str(unit_name).strip().lower()
        
        # 1. Dapatkan/buat master_ingredients UUID berdasarkan nutrition_ref_id (integer)
        master_res = supabase_client.table("master_ingredients").select("id").eq("nutrition_ref_id", int(nutrition_ref_id)).execute()
        if master_res.data:
            ingredient_uuid = master_res.data[0]["id"]
        else:
            # Query detail dari nutrition_ref
            ref_res = supabase_client.table("nutrition_ref").select("name, kategori").eq("id", int(nutrition_ref_id)).execute()
            if not ref_res.data:
                logger.error(f"🚨 [AGENT ERROR] nutrition_ref dengan ID {nutrition_ref_id} tidak ditemukan.")
                return None
            
            ref_name = ref_res.data[0]["name"]
            ref_cat = ref_res.data[0].get("kategori", "lainnya") or "lainnya"
            slug = re.sub(r"[^a-z0-9]+", "-", ref_name.lower()).strip("-")
            
            new_master = {
                "common_name": ref_name,
                "nutrition_ref_id": int(nutrition_ref_id),
                "category": ref_cat,
                "is_primary": True,
                "is_active": True,
                "slug": slug,
                "aliases": []
            }
            ins_res = supabase_client.table("master_ingredients").insert(new_master).execute()
            if not ins_res.data:
                logger.error(f"🚨 [AGENT ERROR] Gagal membuat master_ingredient baru untuk TKPI {nutrition_ref_id}")
                return None
            ingredient_uuid = ins_res.data[0]["id"]

        payload = {
            "ingredient_id": ingredient_uuid,
            "unit": clean_unit,
            "weight_gram": float(estimated_gram),
            "source": "ai_agent"
        }
        
        # Eksekusi Upsert ke Supabase
        # on_conflict memastikan tidak ada duplikat berdasarkan Constraint Unique
        response = supabase_client.table("ingredient_unit_weights").upsert(
            payload, 
            on_conflict="ingredient_id, unit"
        ).execute()
        
        return getattr(response, "data", None)
    except Exception as e:
        logger.error(f"🚨 [AGENT ERROR] Gagal menyuntikkan tebakan referensi satuan: {str(e)}")
        return None

# Prompt AI untuk Menebak Gizi dan Konversi Gram (Bila satuan nyeleneh)
NUTRITION_PROMPT = """Berikan estimasi tabel gizi dan berat bahan makanan berikut yang akan digunakan dalam dapur katering.
Nama Bahan: {material_name}
Satuan Kasar: {satuan}

Return WAJIB JSON murni tanpa markdown:
{{
  "name": "Nama Makanan Baku (Contoh: Bawang Merah, Daging Sapi, dsb)",
  "kategori": "sayur" | "lauk hewani" | "lauk nabati" | "karbohidrat" | "buah" | "bumbu" | "lainnya",
  "calories_per_100g": 0.0,
  "proteins_per_100g": 0.0,
  "fat_per_100g": 0.0,
  "carbohydrate_per_100g": 0.0,
  "fiber_per_100g": 0.0,
  "estimated_gram_per_unit": 100.0,
  "reasoning": "Sebutkan darimana asumsi berat 1 {satuan} {material_name} berasal secara singkat."
}}

ATURAN WAJIB:
- Jika satuan adalah "siung", "ikat", "lembar", "pack", "buah", "biji", perkirakan berat rata-ratanya di Indonesia pada 'estimated_gram_per_unit'.
- Jika satuan adalah "pcs/buah/ekor", perkirakan. Jika "kg/liter", isi estimated_gram_per_unit = 1000.
"""

class NutritionService:
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_ocr_model  # Pakai flash untuk kehematan as general text
        self.api_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

    def guess_and_create_nutrition(self, supabase, material_name: str, satuan: str) -> Optional[Dict[str, Any]]:
        """
        Hit Gemini AI and returns dict with nutrition and gram conversion.
        Insert it to nutrition_ref if successful.
        """
        if not self.api_key:
            logger.error("GEMINI_API_KEY tidak dikonfigurasi")
            return None

        prompt = NUTRITION_PROMPT.format(material_name=material_name, satuan=satuan)

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024,
            },
        }

        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(self.api_url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            text = re.sub(r"```json\s*", "", text)
            text = re.sub(r"```\s*", "", text)
            ai_data = json.loads(text.strip())
            
            # Insert ke nutrition_ref
            insert_resp = supabase.table("nutrition_ref").insert({
                "name": ai_data.get("name", material_name),
                "calories": float(ai_data.get("calories_per_100g", 0)),
                "proteins": float(ai_data.get("proteins_per_100g", 0)),
                "fat": float(ai_data.get("fat_per_100g", 0)),
                "carbohydrate": float(ai_data.get("carbohydrate_per_100g", 0)),
                "fiber": float(ai_data.get("fiber_per_100g", 0)),
                "kategori": ai_data.get("kategori", "lainnya")
            }).execute()
            
            inserted = getattr(insert_resp, "data", [])
            if inserted:
                ai_data["nutrition_ref_id"] = inserted[0]["id"]
                return ai_data
                
            return None
            
        except Exception as e:
            logger.error(f"Gemini AI Nutrition Error / Parse: {e}")
            return None

    def map_and_link_product(self, supabase, product_id: str, product_name: str, satuan: str, tenant_id: str):
        """
        Fuzzy search nutrition_ref, if not found hit AI, then alter products.nutrition_ref_id
        And if AI found a valid estimated_gram_per_unit, update products.conversion_factor too!
        """
        # Trigram matching (Butuh extension pg_trgm yang aktif di db)
        query = supabase.rpc("match_nutrition_trgm", {"search_term": product_name}).execute()
        matches = getattr(query, "data", [])
        
        nutrition_id = None
        conversion_to_update = None
        
        if matches and float(matches[0].get("similarity", 0)) > 0.4:
            nutrition_id = matches[0]["id"]
        else:
            # Panggil Gemini!
            ai_res = self.guess_and_create_nutrition(supabase, product_name, satuan)
            if ai_res:
                nutrition_id = ai_res.get("nutrition_ref_id")
                # Kita ubah conversion_factor
                conversion_to_update = ai_res.get("estimated_gram_per_unit")

        # Update table products dengan foreign key baru saja, TAPI jangan update conversion factor lagi
        if nutrition_id:
            update_payload = {"nutrition_ref_id": nutrition_id}
            supabase.table("products").update(update_payload).eq("id", product_id).eq("tenant_id", tenant_id).execute()

            # 🎯 Ujung tombak dialihkan ke Master Data!
            if conversion_to_update and float(conversion_to_update) > 0:
                inject_agent_prediction_to_unit_weights(
                    supabase_client=supabase, 
                    nutrition_ref_id=nutrition_id, 
                    unit_name=satuan, 
                    estimated_gram=conversion_to_update
                )
        
        return nutrition_id

nutrition_svc = NutritionService()
