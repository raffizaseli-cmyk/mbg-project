"""
backend/services/gram_converter.py
AI-powered "Timbangan Digital Virtual" — converts portion descriptions to grams using Gemini.

Usage:
  converter = GramConverterService()
  grams = await converter.convert("3 iris timun")   # → 15
  nutrition = await converter.calculate_nutrition("timun", "3 iris", tenant_id, supabase)
"""

import json
import logging
import re
from typing import Any, Dict, Optional

from core.config import settings

logger = logging.getLogger(__name__)

# ─── System Prompt (hemat token, akurat, yield factor) ──────────────────────
SYSTEM_INSTRUCTION = """Kamu adalah asisten ahli gizi katering Indonesia (MBG).
Tugasmu adalah mengonversi satuan porsi makanan menjadi berat dalam GRAM/ML.
Perhatikan Yield Factor (PenyusutanMentah->Matang). Contoh: 80g Ayam Goreng butuh ~112g Ayam Mentah (faktor 1.4).
Bahan yang cair (susu, kuah) gunakan ML/Liter yang setara (misal 1 gelas = 200ml).

ATURAN KETAT:
1. Jika input ambigu, gunakan estimasi standar porsi katering.
2. Jika input adalah makanan matang, hitung estimasi berat Mentah (Raw) berdasarkan knowledge penyusutan/mekar standar masakan Indonesia. Nasi matang 100g itu berasal dari beras mentah ~40g (mekar).
3. Jika input adalah mentah, maka mentah dan matang nilainya sama atau sesuai logika normal.
4. Kamu HARUS mematuhi output format yang diminta oleh user prompt."""


class GramConverterService:
    """Service untuk konversi satuan porsi → gram menggunakan Gemini AI."""

    def __init__(self):
        self._model = None

    def _get_model(self):
        """Lazy-init Gemini model."""
        if self._model is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.gemini_api_key)
                self._model = genai.GenerativeModel(
                    settings.gemini_text_model,
                    system_instruction=SYSTEM_INSTRUCTION,
                )
            except Exception as e:
                logger.error(f"Gagal init Gemini model: {e}")
                raise
        return self._model

    async def convert_to_grams(self, user_input: str) -> int:
        """
        Legacy: Konversi deskripsi porsi ke gram (hanya matang).
        Sebaiknya gunakan batch_calculate_nutrition untuk fitur lengkap.
        """
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY tidak dikonfigurasi")

        model = self._get_model()
        prompt = f"Berapa estimasi berat matangnya (angka saja) untuk: '{user_input}'"

        try:
            response = model.generate_content(prompt)
            raw = response.text.strip()
            numbers = re.findall(r'\d+', raw)
            if not numbers:
                raise ValueError("Gagal parse AI")
            grams = int(numbers[0])
            return max(1, min(grams, 5000))
        except Exception as e:
            raise

    async def calculate_nutrition(
        self,
        food_name: str,
        portion_desc: str,
        tenant_id: str,
        supabase,
    ) -> Dict[str, Any]:
        """
        Gunakan batch_calculate_nutrition yang memiliki dukungan Yield Factor
        """
        results = await self.batch_calculate_nutrition(
            [{"food_name": food_name, "portion_desc": portion_desc}], 
            tenant_id, 
            supabase
        )
        return results[0] if results else {}

    async def batch_calculate_nutrition(
        self,
        items: list, # List[Dict[str, str]] with keys: food_name, portion_desc
        tenant_id: str,
        supabase,
    ) -> list:
        """
        Batch process multiple ingredients at once to save AI requests.
        Prompt Gemini to return JSON mapping of original inputs to cooked, raw, and unit.
        """
        if not items:
            return []
            
        inputs_dict = {
            f"item_{i}": f"{item['portion_desc']} {item['food_name']}"
            for i, item in enumerate(items)
        }
        
        prompt = (
            "Konversi porsi berikut ke detail berat.\n"
            f"Inputs: {json.dumps(inputs_dict, ensure_ascii=False)}\n"
            "Kembalikan HANYA JSON. Tiap key input harus punya object dengan key 'cooked' (integer berat matang), 'raw' (integer berat mentah), dan 'unit' (string 'gram' atau 'ml').\n"
            "Contoh balasan: {\"item_0\": {\"cooked\": 80, \"raw\": 112, \"unit\": \"gram\"}, \"item_1\": {\"cooked\": 200, \"raw\": 200, \"unit\": \"ml\"}}"
        )
        
        model = self._get_model()
        results = []
        
        try:
            response = model.generate_content(prompt)
            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            if raw.endswith("```"):
                raw = raw[:-3]
                
            ai_data = json.loads(raw.strip())
        except Exception as e:
            logger.error(f"Batch GramConverter error: {e}")
            # Fallback
            ai_data = {k: {"cooked": 1, "raw": 1, "unit": "gram"} for k in inputs_dict.keys()}
            
        for i, item in enumerate(items):
            food_name = item["food_name"]
            portion_desc = item["portion_desc"]
            key = f"item_{i}"
            
            ai_res = ai_data.get(key, {"cooked": 1, "raw": 1, "unit": "gram"})
            if isinstance(ai_res, int) or isinstance(ai_res, float):
                # Fallback if AI gives integer anyway
                ai_res = {"cooked": int(ai_res), "raw": int(ai_res), "unit": "gram"}
                
            estimated_grams = int(ai_res.get("cooked", 1))
            raw_grams = int(ai_res.get("raw", estimated_grams))
            suggested_unit = str(ai_res.get("unit", "gram")).lower()
            
            # Lookup DB per 100g
            nutrition_data = await self._find_nutrition_ref(food_name, supabase)
            
            if not nutrition_data:
                results.append({
                    "food_name": food_name,
                    "portion_desc": portion_desc,
                    "estimated_weight_gram": estimated_grams,
                    "raw_weight_gram": raw_grams,
                    "suggested_unit": suggested_unit,
                    "nutrition_ref_found": False,
                    "message": f"Data nutrisi untuk '{food_name}' tidak ditemukan di database TKPI",
                    "calories": 0, "proteins": 0, "fat": 0, "carbohydrates": 0,
                })
                continue
                
            factor = estimated_grams / 100.0
            results.append({
                "food_name": food_name,
                "nutrition_ref_name": nutrition_data.get("name", ""),
                "portion_desc": portion_desc,
                "estimated_weight_gram": estimated_grams,
                "raw_weight_gram": raw_grams,
                "suggested_unit": suggested_unit,
                "nutrition_ref_found": True,
                "per_100g": {
                    "calories": nutrition_data.get("calories", 0),
                    "proteins": nutrition_data.get("proteins", 0),
                    "fat": nutrition_data.get("fat", 0),
                    "carbohydrates": nutrition_data.get("carbohydrate", 0),
                },
                "total_nutrition": {
                    "calories": round(factor * float(nutrition_data.get("calories", 0) or 0), 2),
                    "proteins": round(factor * float(nutrition_data.get("proteins", 0) or 0), 2),
                    "fat": round(factor * float(nutrition_data.get("fat", 0) or 0), 2),
                    "carbohydrates": round(factor * float(nutrition_data.get("carbohydrate", 0) or 0), 2),
                },
            })
            
        return results

    async def _find_nutrition_ref(self, food_name: str, supabase) -> Optional[dict]:
        """
        Cari nutrition_ref yang cocok dengan food_name.
        Strategi: exact match → nutrition_aliases → partial match → AI TKPI resolver.
        """
        name = food_name.strip()
        lower_name = name.lower()

        # 1. Exact match (case-insensitive)
        try:
            resp = (
                supabase.table("nutrition_ref")
                .select("id, name, calories, proteins, fat, carbohydrates")
                .ilike("name", name)
                .limit(1)
                .execute()
            )
            if resp.data:
                return resp.data[0]
        except Exception as e:
            pass

        # 2. Lookup in nutrition_aliases (Learning DB)
        try:
            alias_resp = (
                supabase.table("nutrition_aliases")
                .select("nutrition_ref_id")
                .ilike("slang_name", name)
                .limit(1)
                .execute()
            )
            if alias_resp.data:
                ref_id = alias_resp.data[0]["nutrition_ref_id"]
                n_resp = supabase.table("nutrition_ref").select("id, name, calories, proteins, fat, carbohydrates").eq("id", ref_id).execute()
                if n_resp.data:
                    return n_resp.data[0]
        except Exception as e:
            pass

        # 3. Partial match with wildcard
        try:
            resp = (
                supabase.table("nutrition_ref")
                .select("id, name, calories, proteins, fat, carbohydrates")
                .ilike("name", f"%{name}%")
                .limit(5)
                .execute()
            )
            if resp.data:
                # Pick the shortest match (most specific)
                best = min(resp.data, key=lambda x: len(x.get("name", "")))
                
                # Auto-learn this mapping safely if there wasn't an alias
                try:
                    supabase.table("nutrition_aliases").insert({
                        "slang_name": lower_name,
                        "nutrition_ref_id": best["id"]
                    }).execute()
                except Exception:
                    pass
                    
                return best
        except Exception as e:
            pass

        # 4. AI-assisted lookup — ask Gemini for the official TKPI name
        try:
            model = self._get_model()
            prompt = (
                f"Apa nama resmi bahan makanan '{name}' dalam Tabel Komposisi Pangan Indonesia (TKPI)? "
                f"Balas HANYA dengan nama resminya saja, tanpa penjelasan. Jika tidak tahu, balas 'TIDAK TAHU'."
            )
            response = model.generate_content(prompt)
            tkpi_name = response.text.strip().strip('"').strip("'")
            
            if tkpi_name and tkpi_name.lower() != name.lower() and tkpi_name.lower() != "tidak tahu":
                resp = (
                    supabase.table("nutrition_ref")
                    .select("id, name, calories, proteins, fat, carbohydrates")
                    .ilike("name", f"%{tkpi_name}%")
                    .limit(3)
                    .execute()
                )
                if resp.data:
                    best = min(resp.data, key=lambda x: len(x.get("name", "")))
                    logger.info(f"AI matched '{name}' -> TKPI '{best['name']}'")
                    
                    # Auto-learn AI finding
                    try:
                        supabase.table("nutrition_aliases").insert({
                            "slang_name": lower_name,
                            "nutrition_ref_id": best["id"]
                        }).execute()
                    except Exception:
                        pass
                        
                    return best
        except Exception as e:
            logger.warning(f"AI TKPI lookup gagal: {e}")

        return None


# Singleton instance
gram_converter = GramConverterService()
