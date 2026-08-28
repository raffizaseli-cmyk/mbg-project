from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Any, Dict, Optional, List
from core.database import get_supabase
from models.user import UserInDB
from core.dependencies import get_current_user, require_role

router = APIRouter(prefix="/ingredients", tags=["ingredients"])

# ─── NUTRITION REF (DATABASE NUTRISI) ENDPOINTS ───────────────────────────────

@router.get("/master", response_model=Any, dependencies=[Depends(get_current_user)])
def get_master_ingredients(
    search: Optional[str] = Query(None, description="Cari berdasarkan nama atau kategori"),
    kategori: Optional[str] = Query(None, description="Filter berdasarkan kategori"),
    limit: int = Query(100, ge=1, le=1000, description="Jumlah baris per halaman"),
    offset: int = Query(0, ge=0, description="Offset untuk pagination"),
    supabase = Depends(get_supabase)
):
    """Fetch master nutrition data with pagination and optional search/filter."""
    try:
        query = supabase.table("nutrition_ref").select("*", count="exact")

        if search and search.strip():
            clean_search = search.strip().replace(",", " ")
            words = [w.strip() for w in clean_search.split() if w.strip()]
            for word in words:
                query = query.or_(f"name.ilike.%{word}%,kategori.ilike.%{word}%")

        if kategori and kategori.strip().lower() != "semua":
            query = query.eq("kategori", kategori.strip().lower())

        response = query.order("name", desc=False).range(offset, offset + limit - 1).execute()
        data = getattr(response, "data", None) or []

        # Fallback: if search gave 0 results, try searching just by the first word
        if not data and search and search.strip():
            clean_search = search.strip().replace(",", " ")
            words = [w.strip() for w in clean_search.split() if w.strip()]
            if len(words) > 1:
                first_word = words[0]
                q_fb = supabase.table("nutrition_ref").select("*", count="exact")
                q_fb = q_fb.or_(f"name.ilike.%{first_word}%,kategori.ilike.%{first_word}%")
                if kategori and kategori.strip().lower() != "semua":
                    q_fb = q_fb.eq("kategori", kategori.strip().lower())
                fb_resp = q_fb.order("name", desc=False).range(0, limit - 1).execute()
                data = getattr(fb_resp, "data", None) or []

        # Relevance re-ranking: prioritize items matching name over category
        if data and search and search.strip():
            term = search.strip().lower()
            def relevance_rank(item):
                n = (item.get("name") or "").lower()
                k = (item.get("kategori") or "").lower()
                if n.startswith(term):
                    return (0, len(n), n)
                elif f" {term}" in n or f"-{term}" in n:
                    return (1, len(n), n)
                elif term in n:
                    return (2, len(n), n)
                elif term in k:
                    return (3, len(k), n)
                return (4, len(n), n)

            data = sorted(data, key=relevance_rank)

        total = getattr(response, "count", None)
        if total is None:
            total = len(data)

        return {
            "data": data,
            "count": total,
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Gagal mengambil data nutrition_ref: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data nutrition_ref: {str(e)}"
        )


@router.post("/master", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def create_master_ingredient(
    payload: Dict[str, Any],
    supabase = Depends(get_supabase)
):
    """
    Create a new standard nutrition reference in nutrition_ref.
    
    Supports both simple and complete TKPI data:
    - Simple: name, calories, proteins, fat, carbohydrate, fiber, kategori
    - Complete: + sodium, potassium, data_source, custom_nutrients (JSONB)
    """
    try:
        data = {
            "name": payload.get("name", "").strip(),
            "calories": float(payload.get("calories") or 0.0),
            "proteins": float(payload.get("proteins") or 0.0),
            "fat": float(payload.get("fat") or 0.0),
            "carbohydrate": float(payload.get("carbohydrate") or 0.0),
            "fiber": float(payload.get("fiber") or 0.0),
            "kategori": payload.get("kategori", "lainnya").strip().lower()
        }
        
        # Optional: Additional nutrients (TKPI fields)
        if "sodium" in payload:
            data["sodium"] = float(payload.get("sodium") or 0.0)
        if "potassium" in payload:
            data["potassium"] = float(payload.get("potassium") or 0.0)
        
        # Optional: Data source tracking
        if "data_source" in payload:
            data["data_source"] = payload.get("data_source", "MANUAL").strip()
        
        # Optional: Micronutrients & metadata (JSONB)
        if "custom_nutrients" in payload:
            data["custom_nutrients"] = payload.get("custom_nutrients")
        
        if not data["name"]:
            raise HTTPException(status_code=422, detail="Nama bahan wajib diisi")
            
        res = supabase.table("nutrition_ref").insert(data).execute()
        return res.data[0] if res.data else {}
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Check if it's a UNIQUE constraint violation
        if "unique" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Bahan dengan nama '{payload.get('name')}' sudah ada. Gunakan PUT untuk update."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal membuat data gizi standard: {str(e)}"
        )


@router.put("/master/{id}", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def update_master_ingredient(
    id: str,
    payload: Dict[str, Any],
    supabase = Depends(get_supabase)
):
    """
    Update an existing standard nutrition reference.
    
    Supports updating:
    - Makronutrien: calories, proteins, fat, carbohydrate, fiber
    - Makronutrien tambahan: sodium, potassium
    - Metadata: kategori, data_source
    - Mikronutrien: custom_nutrients (JSONB)
    """
    try:
        data = {}
        if "name" in payload:
            data["name"] = payload["name"].strip()
            if not data["name"]:
                raise HTTPException(status_code=422, detail="Nama bahan tidak boleh kosong")
        if "calories" in payload: data["calories"] = float(payload["calories"] or 0.0)
        if "proteins" in payload: data["proteins"] = float(payload["proteins"] or 0.0)
        if "fat" in payload: data["fat"] = float(payload["fat"] or 0.0)
        if "carbohydrate" in payload: data["carbohydrate"] = float(payload["carbohydrate"] or 0.0)
        if "fiber" in payload: data["fiber"] = float(payload["fiber"] or 0.0)
        if "sodium" in payload: data["sodium"] = float(payload.get("sodium") or 0.0)
        if "potassium" in payload: data["potassium"] = float(payload.get("potassium") or 0.0)
        if "kategori" in payload: data["kategori"] = payload["kategori"].strip().lower()
        if "data_source" in payload: data["data_source"] = payload["data_source"].strip()
        if "custom_nutrients" in payload: data["custom_nutrients"] = payload["custom_nutrients"]

        res = supabase.table("nutrition_ref").update(data).eq("id", id).execute()
        return res.data[0] if res.data else {}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memperbarui data gizi: {str(e)}"
        )


@router.delete("/master/{id}", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def delete_master_ingredient(
    id: str,
    supabase = Depends(get_supabase)
):
    """Delete a standard nutrition reference."""
    try:
        res = supabase.table("nutrition_ref").delete().eq("id", id).execute()
        return {"success": True, "message": "Berhasil menghapus bahan gizi referensi."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghapus data gizi: {str(e)}"
        )


# ─── INGREDIENT MAPPINGS ENDPOINTS ───────────────────────────────────────────

@router.get("/mappings", response_model=Any, dependencies=[Depends(get_current_user)])
def get_ingredient_mappings(
    supabase = Depends(get_supabase)
):
    """Fetch product-to-nutrition mappings (products that have nutrition_ref_id set)."""
    try:
        res = (
            supabase.table("products")
            .select("id, name, slug, nutrition_ref_id, base_unit, conversion_factor")
            .not_.is_("nutrition_ref_id", "null")
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data mappings: {str(e)}"
        )


@router.get("/master-ingredients", response_model=Any, dependencies=[Depends(get_current_user)])
def get_master_ingredients_list(
    supabase = Depends(get_supabase)
):
    """Fetch kitchen products and active master ingredients for use in Referensi Satuan."""
    try:
        # Fetch kitchen products (the real active kitchen ingredients: Beras, Telur, Minyak, etc.)
        prod_res = (
            supabase.table("products")
            .select("id, name, category, nutrition_ref_id")
            .order("name", desc=False)
            .execute()
        )
        prod_data = getattr(prod_res, "data", None) or []

        result = []
        seen_names = set()

        for p in prod_data:
            name = (p.get("name") or "").strip()
            if not name or name.lower() in seen_names:
                continue
            seen_names.add(name.lower())
            result.append({
                "id": p["id"],
                "common_name": name,
                "nutrition_ref_id": p.get("nutrition_ref_id"),
                "category": p.get("category", "bahan_baku")
            })

        # If kitchen products is empty, fallback to master_ingredients (non-raw TKPI items)
        if len(result) == 0:
            master_res = (
                supabase.table("master_ingredients")
                .select("id, common_name, category, nutrition_ref_id")
                .order("common_name", desc=False)
                .limit(50)
                .execute()
            )
            master_data = getattr(master_res, "data", None) or []
            for m in master_data:
                name = (m.get("common_name") or "").strip()
                if not name or name.lower() in seen_names:
                    continue
                seen_names.add(name.lower())
                result.append({
                    "id": m["id"],
                    "common_name": name,
                    "nutrition_ref_id": m.get("nutrition_ref_id"),
                    "category": m.get("category", "lainnya")
                })

        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data master_ingredients: {str(e)}"
        )


@router.post("/master-ingredients", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def create_master_ingredient_entry(
    payload: Dict[str, Any],
    supabase = Depends(get_supabase)
):
    """
    Create a new master_ingredients entry for use in Referensi Satuan.
    Allows creating ingredients without nutrition_ref_id (will be linked later).
    Returns existing entry if name already exists (case-insensitive dedup).
    """
    import re
    common_name = (payload.get("common_name") or "").strip()
    if not common_name:
        raise HTTPException(status_code=422, detail="Nama bahan (common_name) wajib diisi.")

    try:
        # Check if already exists (case-insensitive)
        existing = (
            supabase.table("master_ingredients")
            .select("id, common_name")
            .ilike("common_name", common_name)
            .limit(1)
            .execute()
        )
        if getattr(existing, "data", None):
            return existing.data[0]

        # Create new entry
        slug = re.sub(r"[^a-z0-9]+", "-", common_name.lower()).strip("-")
        new_entry = {
            "common_name": common_name,
            "category": payload.get("category", "lainnya"),
            "is_primary": True,
            "is_active": True,
            "slug": slug,
            "aliases": [],
        }
        if payload.get("nutrition_ref_id"):
            new_entry["nutrition_ref_id"] = int(payload.get("nutrition_ref_id"))

        res = supabase.table("master_ingredients").insert(new_entry).execute()
        if not getattr(res, "data", None):
            raise HTTPException(status_code=500, detail="Gagal membuat master ingredient baru.")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal membuat master ingredient: {str(e)}"
        )


@router.get("/ingredient-mappings", response_model=Any, dependencies=[Depends(get_current_user)])
def get_ai_ingredient_mappings(
    supabase = Depends(get_supabase)
):
    """Fetch ingredient mapping results with nutrition data from nutrition_ref."""
    try:
        res = (
            supabase.table("ingredient_mapping")
            .select("id, nutrition_ref_id, nama_tkpi, kategori_induk, keyword_nota, konversi_satuan, source, nutrition_ref(calories, proteins, fat, carbohydrate, fiber, kategori)")
            .order("nama_tkpi", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data ingredient_mapping: {str(e)}"
        )


# ─── REFERENSI SATUAN (INGREDIENT UNIT WEIGHTS) ENDPOINTS ──────────────────────

@router.get("/unit-weights", response_model=Any, dependencies=[Depends(get_current_user)])
def get_unit_weights(
    supabase = Depends(get_supabase)
):
    """Fetch all unit weights mappings with master_ingredients names and nutrition_ref_id."""
    try:
        res = supabase.table("ingredient_unit_weights").select("*, master_ingredients(common_name, nutrition_ref_id)").execute()
        data = res.data or []
        for item in data:
            if item.get("master_ingredients") and item["master_ingredients"].get("nutrition_ref_id"):
                item["nutrition_ref_id"] = item["master_ingredients"]["nutrition_ref_id"]
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data referensi satuan: {str(e)}"
        )


@router.post("/unit-weights", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def create_unit_weight(
    payload: Dict[str, Any],
    supabase = Depends(get_supabase)
):
    """Create a new unit-to-gram weight conversion for a master ingredient or nutrition_ref item."""
    try:
        ingredient_id = payload.get("ingredient_id")
        unit = payload.get("unit", "").strip().lower()
        weight_gram = float(payload.get("weight_gram") or 0.0)

        if not ingredient_id or not unit or weight_gram <= 0:
            raise HTTPException(status_code=422, detail="Data input tidak valid. Pastikan berat > 0.")

        # If ingredient_id is a virtual nut_ ID, resolve or auto-create master_ingredients entry
        if str(ingredient_id).startswith("nut_"):
            nut_id = int(str(ingredient_id).replace("nut_", ""))
            m_res = supabase.table("master_ingredients").select("id").eq("nutrition_ref_id", nut_id).execute()
            if m_res.data:
                ingredient_id = m_res.data[0]["id"]
            else:
                ref_res = supabase.table("nutrition_ref").select("name, kategori").eq("id", nut_id).execute()
                if ref_res.data:
                    ref_name = ref_res.data[0]["name"]
                    ref_cat = ref_res.data[0].get("kategori") or "lainnya"
                    import re
                    slug = re.sub(r"[^a-z0-9]+", "-", ref_name.lower()).strip("-")
                    new_m = {
                        "common_name": ref_name,
                        "nutrition_ref_id": nut_id,
                        "category": ref_cat,
                        "is_primary": True,
                        "is_active": True,
                        "slug": slug,
                        "aliases": []
                    }
                    ins_res = supabase.table("master_ingredients").insert(new_m).execute()
                    if ins_res.data:
                        ingredient_id = ins_res.data[0]["id"]
        else:
            # Check if ingredient_id is present in master_ingredients
            m_chk = supabase.table("master_ingredients").select("id").eq("id", ingredient_id).execute()
            if not m_chk.data:
                # If not in master_ingredients, check if ingredient_id is a product ID from products table
                p_res = supabase.table("products").select("*").eq("id", ingredient_id).execute()
                if p_res.data:
                    prod = p_res.data[0]
                    prod_name = prod.get("name", "Bahan").strip()
                    m_name = supabase.table("master_ingredients").select("id").ilike("common_name", prod_name).execute()
                    if m_name.data:
                        ingredient_id = m_name.data[0]["id"]
                    else:
                        import re
                        slug = re.sub(r"[^a-z0-9]+", "-", prod_name.lower()).strip("-")
                        new_m = {
                            "common_name": prod_name,
                            "nutrition_ref_id": prod.get("nutrition_ref_id"),
                            "category": prod.get("category") or "bahan_baku",
                            "is_primary": True,
                            "is_active": True,
                            "slug": slug,
                            "aliases": [prod_name]
                        }
                        ins_res = supabase.table("master_ingredients").insert(new_m).execute()
                        if ins_res.data:
                            ingredient_id = ins_res.data[0]["id"]
                else:
                    raise HTTPException(status_code=400, detail=f"Bahan baku rujukan (ID: {ingredient_id}) tidak ditemukan di database.")

        data = {
            "ingredient_id": ingredient_id,
            "unit": unit,
            "weight_gram": weight_gram
        }

        # Use upsert to handle potential conflict on unique constraint
        res = supabase.table("ingredient_unit_weights").upsert(data, on_conflict="ingredient_id, unit").execute()
        return res.data[0] if res.data else {}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan referensi satuan: {str(e)}"
        )


@router.put("/unit-weights/{id}", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def update_unit_weight(
    id: str,
    payload: Dict[str, Any],
    supabase = Depends(get_supabase)
):
    """Update a unit-to-gram weight conversion."""
    try:
        data = {}
        if "unit" in payload:
            data["unit"] = payload["unit"].strip().lower()
            if not data["unit"]:
                raise HTTPException(status_code=422, detail="Nama satuan tidak boleh kosong")
        if "weight_gram" in payload:
            data["weight_gram"] = float(payload["weight_gram"] or 0.0)
            if data["weight_gram"] <= 0:
                raise HTTPException(status_code=422, detail="Berat dalam gram harus > 0")

        res = supabase.table("ingredient_unit_weights").update(data).eq("id", id).execute()
        return res.data[0] if res.data else {}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memperbarui referensi satuan: {str(e)}"
        )


@router.delete("/unit-weights/{id}", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def delete_unit_weight(
    id: str,
    supabase = Depends(get_supabase)
):
    """Delete a unit weight mapping."""
    try:
        res = supabase.table("ingredient_unit_weights").delete().eq("id", id).execute()
        return {"success": True, "message": "Berhasil menghapus referensi satuan."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghapus referensi satuan: {str(e)}"
        )


# ─── HIERARCHICAL UNIT CONVERSION CHAINS ENDPOINTS ────────────────────────────

@router.get("/chains/{ingredient_id}", response_model=Any, dependencies=[Depends(get_current_user)])
def get_ingredient_chains(
    ingredient_id: str,
    supabase = Depends(get_supabase)
):
    """
    Fetch all hierarchical unit conversion chains for a master ingredient,
    including real-time graph resolution and validation status.
    """
    try:
        from services.unit_chain_service import unit_chain_service

        chains = []
        try:
            res = (
                supabase.table("ingredient_unit_chains")
                .select("*")
                .eq("ingredient_id", ingredient_id)
                .order("created_at")
                .execute()
            )
            chains = res.data or []
        except Exception:
            # Fallback if table not created yet: empty list
            chains = []

        resolution = unit_chain_service.resolve_all_units(chains)
        return {
            "success": True,
            "ingredient_id": ingredient_id,
            "chains": chains,
            "resolution": resolution,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil rantai konversi satuan: {str(e)}"
        )


@router.post("/chains", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def create_or_update_chain(
    payload: Dict[str, Any],
    supabase = Depends(get_supabase)
):
    """
    Create or update a hierarchical unit conversion chain rule.
    Performs Cycle Detection and auto-syncs pre-calculated weights to ingredient_unit_weights cache.
    """
    try:
        from services.unit_chain_service import unit_chain_service

        ingredient_id = payload.get("ingredient_id")
        from_unit = (payload.get("from_unit") or "").strip().lower()
        to_unit = (payload.get("to_unit") or "").strip().lower()
        from_qty = float(payload.get("from_qty") or 1.0)
        to_qty = float(payload.get("to_qty") or 1.0)
        description = payload.get("description")

        if not ingredient_id or not from_unit or not to_unit:
            raise HTTPException(status_code=422, detail="Satuan asal dan tujuan tidak boleh kosong.")
        if from_unit == to_unit:
            raise HTTPException(status_code=422, detail="Satuan asal dan tujuan tidak boleh sama.")
        if from_qty <= 0 or to_qty <= 0:
            raise HTTPException(status_code=422, detail="Jumlah kuantitas harus lebih besar dari 0.")

        # 1. Fetch existing chains for this ingredient
        existing_chains = []
        try:
            res = supabase.table("ingredient_unit_chains").select("*").eq("ingredient_id", ingredient_id).execute()
            existing_chains = res.data or []
        except Exception:
            existing_chains = []

        # 2. Build candidate chains with new/updated rule
        candidate_chains = [
            c for c in existing_chains
            if not (c.get("from_unit") == from_unit and c.get("to_unit") == to_unit)
        ]
        candidate_chains.append({
            "ingredient_id": ingredient_id,
            "from_qty": from_qty,
            "from_unit": from_unit,
            "to_qty": to_qty,
            "to_unit": to_unit,
            "multiplier": to_qty / from_qty,
            "description": description,
        })

        # 3. Test Graph Resolution & Cycle Detection
        resolution = unit_chain_service.resolve_all_units(candidate_chains)
        if resolution.get("has_cycle"):
            errors_str = ", ".join(resolution.get("errors", []))
            raise HTTPException(
                status_code=422,
                detail=f"Gagal menyimpan: {errors_str}"
            )

        # 4. Save/Upsert into ingredient_unit_chains table
        new_record = {
            "ingredient_id": ingredient_id,
            "from_qty": from_qty,
            "from_unit": from_unit,
            "to_qty": to_qty,
            "to_unit": to_unit,
            "description": description,
        }
        try:
            ins_res = (
                supabase.table("ingredient_unit_chains")
                .upsert(new_record, on_conflict="ingredient_id, from_unit, to_unit")
                .execute()
            )
            saved_data = ins_res.data[0] if ins_res.data else new_record
        except Exception as e:
            saved_data = new_record

        # 5. Sync resolved weights to ingredient_unit_weights (O(1) cache)
        unit_chain_service.sync_to_weights_cache(
            ingredient_id=ingredient_id,
            resolved_units=resolution.get("resolved_units", []),
            supabase=supabase,
        )

        return {
            "success": True,
            "message": "Rantai konversi berhasil disimpan dan bobot satuan telah diperbarui.",
            "data": saved_data,
            "resolution": resolution,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan rantai konversi: {str(e)}"
        )


@router.delete("/chains/{chain_id}", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def delete_chain(
    chain_id: str,
    supabase = Depends(get_supabase)
):
    """
    Delete a hierarchical unit conversion chain rule and refresh the weights cache.
    """
    try:
        from services.unit_chain_service import unit_chain_service

        # 1. Fetch chain to identify ingredient_id
        chain_res = supabase.table("ingredient_unit_chains").select("*").eq("id", chain_id).single().execute()
        chain = getattr(chain_res, "data", None)
        if not chain:
            raise HTTPException(status_code=404, detail="Rantai konversi tidak ditemukan.")

        ingredient_id = chain["ingredient_id"]

        # 2. Delete chain
        supabase.table("ingredient_unit_chains").delete().eq("id", chain_id).execute()

        # 3. Re-calculate remaining chains
        rem_res = supabase.table("ingredient_unit_chains").select("*").eq("ingredient_id", ingredient_id).execute()
        remaining_chains = rem_res.data or []
        resolution = unit_chain_service.resolve_all_units(remaining_chains)

        # 4. Sync updated weights
        unit_chain_service.sync_to_weights_cache(
            ingredient_id=ingredient_id,
            resolved_units=resolution.get("resolved_units", []),
            supabase=supabase,
        )

        return {
            "success": True,
            "message": "Rantai konversi berhasil dihapus dan bobot satuan telah diperbarui.",
            "resolution": resolution,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghapus rantai konversi: {str(e)}"
        )


# ─── PRODUCT ALIASES (MAPPING ALIAS BAHAN) ENDPOINTS ─────────────────────────

@router.get("/aliases", response_model=Any, dependencies=[Depends(get_current_user)])
def get_product_aliases(
    current_user: UserInDB = Depends(get_current_user),
    supabase = Depends(get_supabase)
):
    """Fetch all product aliases for the current tenant, joined with product name."""
    try:
        res = (
            supabase.table("product_aliases")
            .select("*, products(id, name, category, unit, nutrition_ref_id, nutrition_ref(id, name, calories, proteins, fat, carbohydrate, fiber, kategori))")
            .eq("tenant_id", current_user.tenant_id)
            .order("alias_name", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data mapping alias: {str(e)}"
        )


@router.post("/aliases", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "akuntan", "gizi"]))])
def create_product_alias(
    payload: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user),
    supabase = Depends(get_supabase)
):
    """Create or upsert a product alias mapping manually."""
    try:
        product_id = payload.get("product_id")
        alias_name = payload.get("alias_name", "").strip()
        pkg_value = float(payload.get("packaging_value") or 1.0)
        pkg_unit = payload.get("packaging_unit", "pcs").strip().lower()
        from utils.unit_converter import resolve_standard_unit_conversion
        pkg_value, pkg_unit = resolve_standard_unit_conversion(pkg_value, pkg_unit)

        if not product_id or not alias_name:
            raise HTTPException(status_code=422, detail="Produk dan Nama Alias wajib diisi")

        data = {
            "tenant_id": current_user.tenant_id,
            "product_id": product_id,
            "alias_name": alias_name,
            "packaging_value": pkg_value,
            "packaging_unit": pkg_unit,
            "source": "manual",
            "confidence": 1.0
        }

        # Check for existing alias to update or insert (upsert)
        existing = (
            supabase.table("product_aliases")
            .select("id")
            .eq("tenant_id", current_user.tenant_id)
            .ilike("alias_name", alias_name)
            .limit(1)
            .execute()
        )
        existing_data = getattr(existing, "data", None) or []

        if existing_data:
            res = supabase.table("product_aliases").update(data).eq("id", existing_data[0]["id"]).execute()
        else:
            res = supabase.table("product_aliases").insert(data).execute()

        return res.data[0] if res.data else {}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan mapping alias: {str(e)}"
        )


@router.put("/aliases/{id}", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "akuntan", "gizi"]))])
def update_product_alias(
    id: str,
    payload: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user),
    supabase = Depends(get_supabase)
):
    """Update an existing product alias mapping."""
    try:
        # Verify ownership
        existing = (
            supabase.table("product_aliases")
            .select("tenant_id, packaging_value, packaging_unit")
            .eq("id", id)
            .single()
            .execute()
        )
        existing_data = getattr(existing, "data", None)
        if not existing_data or existing_data.get("tenant_id") != current_user.tenant_id:
            raise HTTPException(status_code=404, detail="Mapping alias tidak ditemukan")

        data = {}
        if "product_id" in payload: data["product_id"] = payload["product_id"]
        if "alias_name" in payload:
            data["alias_name"] = payload["alias_name"].strip()
            if not data["alias_name"]:
                raise HTTPException(status_code=422, detail="Nama alias tidak boleh kosong")

        if "packaging_value" in payload or "packaging_unit" in payload:
            from utils.unit_converter import resolve_standard_unit_conversion
            existing_val = float(existing_data.get("packaging_value") or 1.0)
            existing_unit = existing_data.get("packaging_unit") or "pcs"
            pkg_value = float(payload.get("packaging_value", existing_val) or 1.0)
            pkg_unit = payload.get("packaging_unit", existing_unit).strip().lower()
            
            pkg_value, pkg_unit = resolve_standard_unit_conversion(pkg_value, pkg_unit)
            data["packaging_value"] = pkg_value
            data["packaging_unit"] = pkg_unit

        res = supabase.table("product_aliases").update(data).eq("id", id).execute()
        return res.data[0] if res.data else {}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memperbarui mapping alias: {str(e)}"
        )


@router.delete("/aliases/{id}", response_model=Any, dependencies=[Depends(require_role(["owner", "admin", "akuntan", "gizi"]))])
def delete_product_alias(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
    supabase = Depends(get_supabase)
):
    """Delete a product alias mapping."""
    try:
        # Verify ownership
        existing = (
            supabase.table("product_aliases")
            .select("tenant_id")
            .eq("id", id)
            .single()
            .execute()
        )
        existing_data = getattr(existing, "data", None)
        if not existing_data or existing_data.get("tenant_id") != current_user.tenant_id:
            raise HTTPException(status_code=404, detail="Mapping alias tidak ditemukan")

        res = supabase.table("product_aliases").delete().eq("id", id).execute()
        return {"success": True, "message": "Berhasil menghapus mapping alias."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghapus mapping alias: {str(e)}"
        )
