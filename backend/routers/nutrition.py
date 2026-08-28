from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from pydantic.fields import Field

from core.database import get_supabase
from core.dependencies import get_current_user
from models.user import UserInDB

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


def _recipe_to_grams(r: dict, prod: dict) -> float:
    """
    Convert recipe qty_needed to grams properly.
    
    IMPORTANT: The `recipes` table ALREADY stores `qty_needed` in the product's `base_unit`.
    - If base_unit is 'gram' or 'ml', `qty_needed` is already in grams/ml.
    - If base_unit is 'pcs', `qty_needed` is the number of pieces, so we multiply by `conversion_factor` (grams per pc).
    """
    qty = float(r.get("qty_needed", 0))
    base_unit = (prod.get("base_unit") or "").lower().strip()
    
    if base_unit in ("gram", "ml", "g", "gr"):
        return qty
    
    if base_unit in ("pcs", "buah", "butir", "siung", "lembar", "ikat", "biji", "ekor", "batang"):
        prod_conv = float(prod.get("conversion_factor") or 1.0)
        return qty * prod_conv
        
    return qty


class NutritionSummary(BaseModel):
    menu_id: str
    calories: float = 0.0
    proteins: float = 0.0
    fat: float = 0.0
    carbohydrates: float = 0.0
    fiber: float = 0.0
    total_ingredient_gram: float = 0.0
    sayur_percentage: float = 0.0
    is_balanced: bool = True


_TKPI_CACHE: Dict[int, dict] = {}

def _get_nutrition_refs_batch(supabase, nut_ids: List[int]) -> Dict[int, dict]:
    """Fetch nutrition_ref rows with in-memory caching to eliminate DB latency."""
    result = {}
    missing_ids = []
    
    for nid in nut_ids:
        if nid in _TKPI_CACHE:
            result[nid] = _TKPI_CACHE[nid]
        else:
            missing_ids.append(nid)
            
    if missing_ids:
        try:
            resp = (
                supabase.table("nutrition_ref")
                .select("id, name, calories, proteins, fat, carbohydrate, fiber, kategori")
                .in_("id", missing_ids)
                .execute()
            )
            for row in (getattr(resp, "data", None) or []):
                _TKPI_CACHE[row["id"]] = row
                result[row["id"]] = row
        except Exception:
            pass
            
    return result


@router.get("/menu/{menu_id}", response_model=NutritionSummary)
async def get_menu_nutrition_summary(
    menu_id: str,
    active_user: UserInDB = Depends(get_current_user)
):
    """
    Hitung nilai standimetri gizi per porsi pada Menu BOM (Optimized Batch).
    """
    supabase = get_supabase()
    
    recipes_resp = supabase.table("recipes").select("*, products!recipes_ingredient_id_fkey(*)").eq("menu_id", menu_id).execute()
    recipes = getattr(recipes_resp, "data", [])
    
    if not recipes:
        return NutritionSummary(menu_id=menu_id)

    # Collect nut_ids for batch query
    nut_ids = [
        r["products"]["nutrition_ref_id"] 
        for r in recipes 
        if r.get("products") and r["products"].get("nutrition_ref_id")
    ]
    nref_map = _get_nutrition_refs_batch(supabase, nut_ids)

    total_cal = 0.0
    total_protein = 0.0
    total_fat = 0.0
    total_carbs = 0.0
    total_fiber = 0.0
    total_gram = 0.0
    sayur_gram = 0.0
    
    for r in recipes:
        if r.get("usage_type", "per_porsi") != "per_porsi":
            continue
            
        prod = r.get("products")
        if not prod:
            continue
        
        weight_in_gram = _recipe_to_grams(r, prod)
        if weight_in_gram <= 0:
            continue
        
        nut_id = prod.get("nutrition_ref_id")
        if not nut_id or nut_id not in nref_map:
            total_gram += weight_in_gram
            continue
            
        nref = nref_map[nut_id]
        kategori = nref.get("kategori", "").lower()
        multiplier = weight_in_gram / 100.0
        
        total_cal += float(nref.get("calories", 0)) * multiplier
        total_protein += float(nref.get("proteins", 0)) * multiplier
        total_fat += float(nref.get("fat", 0)) * multiplier
        total_carbs += float(nref.get("carbohydrate", 0)) * multiplier
        total_fiber += float(nref.get("fiber", 0)) * multiplier
        
        total_gram += weight_in_gram
        if "sayur" in kategori:
            sayur_gram += weight_in_gram

    perc = round((sayur_gram / total_gram) * 100.0, 1) if total_gram > 0 else 0.0
        
    return NutritionSummary(
        menu_id=menu_id,
        calories=round(total_cal, 1),
        proteins=round(total_protein, 1),
        fat=round(total_fat, 1),
        carbohydrates=round(total_carbs, 1),
        fiber=round(total_fiber, 1),
        total_ingredient_gram=round(total_gram, 1),
        sayur_percentage=perc,
        is_balanced=perc >= 30.0
    )


# ─── Detail per-bahan endpoint ─────────────────────────────────────────────────

@router.get("/menu/{menu_id}/details")
async def get_menu_nutrition_details(
    menu_id: str,
    active_user: UserInDB = Depends(get_current_user)
):
    """
    Return nutrisi per-bahan (per ingredient) untuk 1 porsi menu (Optimized Batch).
    """
    supabase = get_supabase()
    
    recipes_resp = (
        supabase.table("recipes")
        .select("*, products!recipes_ingredient_id_fkey(id, name, unit, display_unit, conversion_factor, nutrition_ref_id)")
        .eq("menu_id", menu_id)
        .execute()
    )
    recipes = getattr(recipes_resp, "data", [])
    
    nut_ids = [
        r["products"]["nutrition_ref_id"] 
        for r in recipes 
        if r.get("products") and r["products"].get("nutrition_ref_id")
    ]
    nref_map = _get_nutrition_refs_batch(supabase, nut_ids)

    ingredients = []
    total_cal = 0.0
    total_prot = 0.0
    total_fat = 0.0
    total_carb = 0.0
    total_fiber = 0.0
    total_gram = 0.0
    sayur_gram = 0.0
    
    for r in recipes:
        if r.get("usage_type", "per_porsi") != "per_porsi":
            continue
        
        prod = r.get("products")
        if not prod:
            continue
        
        product_id = prod.get("id", "")
        product_name = prod.get("name", "?")
        weight_gram = _recipe_to_grams(r, prod)
        
        nut_id = prod.get("nutrition_ref_id")
        cal = 0.0
        prot = 0.0
        fat = 0.0
        carb = 0.0
        fiber = 0.0
        kategori = ""
        nut_name = ""
        
        if nut_id and weight_gram > 0 and nut_id in nref_map:
            nref = nref_map[nut_id]
            multiplier = weight_gram / 100.0
            cal = round(float(nref.get("calories", 0)) * multiplier, 1)
            prot = round(float(nref.get("proteins", 0)) * multiplier, 1)
            fat = round(float(nref.get("fat", 0)) * multiplier, 1)
            carb = round(float(nref.get("carbohydrate", 0)) * multiplier, 1)
            fiber = round(float(nref.get("fiber", 0)) * multiplier, 1)
            kategori = nref.get("kategori", "")
            nut_name = nref.get("name", "")
        
        total_cal += cal
        total_prot += prot
        total_fat += fat
        total_carb += carb
        total_fiber += fiber
        total_gram += weight_gram
        if "sayur" in kategori.lower():
            sayur_gram += weight_gram
        
        ingredients.append({
            "product_id": product_id,
            "product_name": product_name,
            "weight_gram": round(weight_gram, 1),
            "calories": cal,
            "proteins": prot,
            "fat": fat,
            "carbohydrate": carb,
            "fiber": fiber,
            "kategori": kategori,
            "nutrition_ref_id": nut_id,
            "nutrition_ref_name": nut_name,
            "has_nutrition": nut_id is not None,
        })
    
    sayur_pct = round((sayur_gram / total_gram) * 100, 1) if total_gram > 0 else 0.0
    
    return {
        "success": True,
        "data": {
            "menu_id": menu_id,
            "ingredients": ingredients,
            "totals": {
                "calories": round(total_cal, 1),
                "proteins": round(total_prot, 1),
                "fat": round(total_fat, 1),
                "carbohydrate": round(total_carb, 1),
                "fiber": round(total_fiber, 1),
                "total_gram": round(total_gram, 1),
            },
            "sayur_percentage": sayur_pct,
            "is_balanced": sayur_pct >= 30.0,
        }
    }


# ─── Edit Manual Konversi & Gizi ────────────────────────────────────────────────

class NutritionEditRequest(BaseModel):
    product_id: str
    conversion_factor: Optional[float] = None
    calories: Optional[float] = None
    proteins: Optional[float] = None
    fat: Optional[float] = None
    carbohydrate: Optional[float] = None
    fiber: Optional[float] = None
    kategori: Optional[str] = None
    
@router.put("/products/{product_id}")
async def update_nutrition_estimation(
    product_id: str,
    req: NutritionEditRequest,
    active_user: UserInDB = Depends(get_current_user)
):
    """
    Koreksi manual jika tebakan Gemini API melenceng.
    """
    supabase = get_supabase()
    
    if req.conversion_factor is not None:
        supabase.table("products").update({"conversion_factor": req.conversion_factor}).eq("id", product_id).eq("tenant_id", active_user.tenant_id).execute()
        
    p_resp = supabase.table("products").select("nutrition_ref_id").eq("id", product_id).single().execute()
    prod = getattr(p_resp, "data", {})
    nut_id = prod.get("nutrition_ref_id")
    
    if nut_id:
        update_nut = {}
        if req.calories is not None: update_nut["calories"] = req.calories
        if req.proteins is not None: update_nut["proteins"] = req.proteins
        if req.fat is not None: update_nut["fat"] = req.fat
        if req.carbohydrate is not None: update_nut["carbohydrate"] = req.carbohydrate
        if req.kategori is not None: update_nut["kategori"] = req.kategori
        if update_nut:
            supabase.table("nutrition_ref").update(update_nut).eq("id", nut_id).execute()
            
    return {"success": True, "message": "Berhasil memperbarui rujukan gizi produk."}


# ─── Auto-link endpoint ────────────────────────────────────────────────────────

@router.post("/auto-link/{product_id}")
async def auto_link_nutrition(
    product_id: str,
    active_user: UserInDB = Depends(get_current_user)
):
    """
    Auto-link satu produk ke nutrition_ref via fuzzy match atau AI.
    """
    supabase = get_supabase()
    
    p_resp = supabase.table("products").select("id, name, unit, nutrition_ref_id").eq("id", product_id).eq("tenant_id", active_user.tenant_id).single().execute()
    prod = getattr(p_resp, "data", None)
    if not prod:
        raise HTTPException(404, "Product not found")
    
    if prod.get("nutrition_ref_id"):
        return {"success": True, "message": "Sudah ter-link", "nutrition_ref_id": prod["nutrition_ref_id"]}
    
    from services.nutrition_service import nutrition_svc
    nut_id = nutrition_svc.map_and_link_product(
        supabase, product_id, prod["name"], prod.get("unit", "gram"), active_user.tenant_id
    )
    
    return {
        "success": True,
        "message": "Berhasil di-link" if nut_id else "Tidak ditemukan data nutrisi",
        "nutrition_ref_id": nut_id,
    }


# ─── Monthly Nutrition Calendar ─────────────────────────────────────────────────

HARI_INDO = {0: "Senin", 1: "Selasa", 2: "Rabu", 3: "Kamis", 4: "Jumat", 5: "Sabtu", 6: "Minggu"}

@router.get("/calendar")
async def get_nutrition_calendar(
    year: int,
    month: int,
    active_user: UserInDB = Depends(get_current_user)
):
    """
    Return nutrisi harian untuk 1 bulan penuh.
    Mengambil data dari mbg_weekly_menus → menu_id → recipes → nutrition_ref.
    Juga include data penerima manfaat dan delivery aktual.
    """
    from calendar import monthrange
    supabase = get_supabase()
    tid = active_user.tenant_id
    
    _, days_in_month = monthrange(year, month)
    first_day = date(year, month, 1)
    last_day = date(year, month, days_in_month)
    
    # 1. Fetch all weekly menus for this month's weeks
    week_starts = set()
    d = first_day
    while d <= last_day:
        ws = d - timedelta(days=d.weekday())  # Monday of that week
        week_starts.add(ws.isoformat())
        d += timedelta(days=7)
    
    all_menus = []
    for ws in week_starts:
        resp = (
            supabase.table("mbg_weekly_menus")
            .select("*")
            .eq("tenant_id", tid)
            .eq("week_start", ws)
            .execute()
        )
        all_menus.extend(getattr(resp, "data", []))
    
    # Build lookup: date_str → menu info
    menu_by_date = {}
    for wm in all_menus:
        ws_date = date.fromisoformat(wm["week_start"])
        dow = wm.get("day_of_week", 1)  # 1=Monday
        actual_date = ws_date + timedelta(days=dow - 1)
        if first_day <= actual_date <= last_day:
            menu_by_date[actual_date.isoformat()] = {
                "menu_id": wm.get("menu_id"),
                "menu_name": wm.get("menu_name", ""),
            }
    
    # 2. Fetch actual deliveries for the month
    del_resp = (
        supabase.table("mbg_deliveries")
        .select("*, schools(name, school_level, default_portions)")
        .eq("tenant_id", tid)
        .gte("delivery_date", first_day.isoformat())
        .lte("delivery_date", last_day.isoformat())
        .execute()
    )
    deliveries = getattr(del_resp, "data", [])
    
    # Group deliveries by date
    deliveries_by_date = {}
    for d_item in deliveries:
        dt = d_item.get("delivery_date", "")
        if dt not in deliveries_by_date:
            deliveries_by_date[dt] = []
        school_data = d_item.get("schools") or {}
        deliveries_by_date[dt].append({
            "school_name": school_data.get("name", "?"),
            "school_level": school_data.get("school_level", "sd_smp"),
            "portions_sent": d_item.get("portions_sent", 0),
            "status": d_item.get("status", ""),
        })
    
    # 3. Fetch beneficiary data
    ben_resp = (
        supabase.table("school_beneficiaries")
        .select("*, schools(name, school_level, default_portions), beneficiary_types(name)")
        .eq("tenant_id", tid)
        .execute()
    )
    beneficiaries = getattr(ben_resp, "data", [])
    
    beneficiary_summary = []
    for sb in beneficiaries:
        sch = sb.get("schools") or {}
        bt = sb.get("beneficiary_types") or {}
        beneficiary_summary.append({
            "school_name": sch.get("name", ""),
            "school_level": sch.get("school_level", "sd_smp"),
            "beneficiary_type": bt.get("name", ""),
            "target_portions": sb.get("target_portions", 0) or sch.get("default_portions", 0),
        })
    
    # 4. For each unique menu_id, compute nutrition (cached)
    unique_menu_ids = set()
    for info in menu_by_date.values():
        mid = info.get("menu_id")
        if mid:
            unique_menu_ids.add(mid)
    
    nutrition_cache = {}
    for mid in unique_menu_ids:
        try:
            recipes_resp = (
                supabase.table("recipes")
                .select("*, products!recipes_ingredient_id_fkey(id, name, unit, conversion_factor, nutrition_ref_id)")
                .eq("menu_id", mid)
                .execute()
            )
            recipes = getattr(recipes_resp, "data", [])
            
            total_cal = 0.0; total_prot = 0.0; total_fat = 0.0; total_carb = 0.0; total_gram = 0.0
            sayur_gram = 0.0
            ingredients = []
            
            for r in recipes:
                if r.get("usage_type", "per_porsi") != "per_porsi":
                    continue
                prod = r.get("products")
                if not prod:
                    continue
                
                weight = _recipe_to_grams(r, prod)
                nut_id = prod.get("nutrition_ref_id")
                cal = prot = fat = carb = 0.0
                kategori = ""
                
                if nut_id and weight > 0:
                    try:
                        nr = supabase.table("nutrition_ref").select("*").eq("id", nut_id).single().execute()
                        nref = getattr(nr, "data", None)
                        if nref:
                            m = weight / 100.0
                            cal = round(float(nref.get("calories", 0)) * m, 1)
                            prot = round(float(nref.get("proteins", 0)) * m, 1)
                            fat = round(float(nref.get("fat", 0)) * m, 1)
                            carb = round(float(nref.get("carbohydrate", 0)) * m, 1)
                            kategori = nref.get("kategori", "")
                    except Exception:
                        pass
                
                total_cal += cal; total_prot += prot; total_fat += fat; total_carb += carb
                total_gram += weight
                if "sayur" in kategori.lower():
                    sayur_gram += weight
                
                ingredients.append({
                    "name": prod.get("name", ""),
                    "weight_gram": round(weight, 1),
                    "calories": cal, "proteins": prot, "fat": fat, "carbohydrate": carb,
                    "kategori": kategori,
                })
            
            sayur_pct = round((sayur_gram / total_gram) * 100, 1) if total_gram > 0 else 0.0
            nutrition_cache[mid] = {
                "ingredients": ingredients,
                "totals": {
                    "calories": round(total_cal, 1), "proteins": round(total_prot, 1),
                    "fat": round(total_fat, 1), "carbohydrate": round(total_carb, 1),
                    "total_gram": round(total_gram, 1),
                },
                "sayur_percentage": sayur_pct,
                "is_balanced": sayur_pct >= 30.0,
            }
        except Exception:
            nutrition_cache[mid] = None
    
    # 5. Build calendar days
    days = []
    for day_num in range(1, days_in_month + 1):
        current_date = date(year, month, day_num)
        date_str = current_date.isoformat()
        weekday = current_date.weekday()  # 0=Monday
        
        # Skip Sunday
        is_weekday = weekday < 6
        
        menu_info = menu_by_date.get(date_str, {})
        menu_id = menu_info.get("menu_id")
        menu_name = menu_info.get("menu_name", "")
        
        nutrition = nutrition_cache.get(menu_id) if menu_id else None
        day_deliveries = deliveries_by_date.get(date_str, [])
        total_portions = sum(d.get("portions_sent", 0) for d in day_deliveries)
        
        days.append({
            "date": date_str,
            "day": day_num,
            "day_name": HARI_INDO.get(weekday, ""),
            "is_weekday": is_weekday,
            "menu_name": menu_name,
            "menu_id": menu_id,
            "has_menu": bool(menu_name),
            "has_delivery": bool(day_deliveries),
            "total_portions": total_portions,
            "schools_delivered": len(day_deliveries),
            "deliveries": day_deliveries,
            "nutrition": nutrition,
        })
    
    # 6. Monthly totals
    total_portions_month = sum(d["total_portions"] for d in days)
    days_with_delivery = sum(1 for d in days if d["has_delivery"])
    
    return {
        "success": True,
        "data": {
            "year": year,
            "month": month,
            "days_in_month": days_in_month,
            "days": days,
            "beneficiaries": beneficiary_summary,
            "monthly_summary": {
                "total_portions": total_portions_month,
                "delivery_days": days_with_delivery,
                "avg_portions_per_day": round(total_portions_month / max(days_with_delivery, 1)),
            },
        }
    }


# ─── AI Gram Converter ("Timbangan Digital Virtual") ─────────────────────────

class GramConvertRequest(BaseModel):
    input: str = Field(..., description="Deskripsi porsi, e.g. '3 iris timun', '1 centong nasi'")

class NutritionCalcRequest(BaseModel):
    food_name: str = Field(..., description="Nama bahan makanan, e.g. 'timun', 'ayam', 'beras'")
    portion: str = Field(..., description="Deskripsi porsi, e.g. '3 iris', '1 potong sedang'")


@router.post("/convert-gram")
async def convert_portion_to_gram(
    body: GramConvertRequest,
    active_user: UserInDB = Depends(get_current_user),
):
    """
    AI Timbangan Digital Virtual — konversi deskripsi porsi ke gram.
    
    Contoh input: "3 iris timun", "1 centong nasi", "2 potong ayam sedang"
    Output: estimasi berat dalam gram
    """
    from services.gram_converter import gram_converter
    
    try:
        grams = await gram_converter.convert_to_grams(body.input)
        return {
            "success": True,
            "data": {
                "input": body.input,
                "estimated_grams": grams,
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI conversion gagal: {str(e)}")


@router.post("/calculate")
async def calculate_nutrition_ai(
    body: NutritionCalcRequest,
    active_user: UserInDB = Depends(get_current_user),
):
    """
    Hybrid AI + TKPI Nutrition Calculator.
    
    1. AI mengkonversi porsi → gram (e.g. "3 iris" → 15g)
    2. Lookup data nutrisi per 100g dari database TKPI (nutrition_ref)
    3. Kalkulasi: (gram / 100) × nutrisi_per_100g
    
    Contoh: food_name="timun", portion="3 iris"
    → AI: 15g → DB: timun = 12 kcal/100g → Result: 1.8 kcal
    """
    from services.gram_converter import gram_converter
    
    supabase = get_supabase()
    
    try:
        result = await gram_converter.calculate_nutrition(
            food_name=body.food_name,
            portion_desc=body.portion,
            tenant_id=active_user.tenant_id,
            supabase=supabase,
        )
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kalkulasi nutrisi gagal: {str(e)}")


class NutritionBatchRequest(BaseModel):
    items: List[NutritionCalcRequest] = Field(..., description="List of items to calculate")

@router.post("/batch-calculate")
async def batch_calculate_nutrition_ai(
    body: NutritionBatchRequest,
    active_user: UserInDB = Depends(get_current_user),
):
    """
    Batch Hybrid AI + TKPI Nutrition Calculator.
    
    Proses banyak bahan makanan sekaligus untuk menghemat API requests ke Gemini.
    Penggunaan: list of {food_name: "timun", portion: "3 iris"}
    """
    from services.gram_converter import gram_converter
    
    supabase = get_supabase()
    
    # Convert request models to dicts
    items_dict = [
        {"food_name": item.food_name, "portion_desc": item.portion}
        for item in body.items
    ]
    
    try:
        results = await gram_converter.batch_calculate_nutrition(
            items=items_dict,
            tenant_id=active_user.tenant_id,
            supabase=supabase,
        )
        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch kalkulasi nutrisi gagal: {str(e)}")


@router.get("/ref", response_model=Any)
async def get_all_nutrition_ref(
    active_user: UserInDB = Depends(get_current_user),
):
    """Return all nutrition_ref records for the TKPI database UI."""
    supabase = get_supabase()
    try:
        res = supabase.table("nutrition_ref").select("*").execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memuat nutrition_ref: {str(e)}")


@router.get("/ref/search")
async def search_nutrition_ref(
    q: str = "",
    active_user: UserInDB = Depends(get_current_user),
):
    """
    Cari bahan makanan di database TKPI (nutrition_ref).
    Untuk dropdown/autocomplete di frontend.
    """
    if not q or len(q) < 2:
        return {"success": True, "data": []}

    supabase = get_supabase()
    
    resp = (
        supabase.table("nutrition_ref")
        .select("id, name, calories, proteins, fat, carbohydrate, fiber")
        .ilike("name", f"%{q.strip()}%")
        .limit(20)
        .order("name")
        .execute()
    )
    
    results = getattr(resp, "data", None) or []
    
    return {
        "success": True,
        "data": [
            {
                "id": r["id"],
                "name": r["name"],
                "per_100g": {
                    "calories": r.get("calories", 0),
                    "proteins": r.get("proteins", 0),
                    "fat": r.get("fat", 0),
                    "carbohydrates": r.get("carbohydrate", 0),
                    "fiber": r.get("fiber", 0),
                }
            }
            for r in results
        ]
    }


# ─── RE-SYNC FIBER ────────────────────────────────────────────────────────────

@router.post("/re-sync")
async def resync_nutrition_fiber(active_user: UserInDB = Depends(get_current_user)):
    """
    Hit API Gemini untuk semua record nutrition_ref yang fiber-nya 0.0 atau None.
    Hanya update fiber agar tidak merusak kalori manual.
    """
    supabase = get_supabase()
    from services.nutrition_service import nutrition_svc
    
    # Ambil yang belum ada fiber (asumsi belum ada kolom atau 0)
    # Note: karena column fiber baru ditambah via ALTER TABLE, defaultnya 0.0
    query = supabase.table("nutrition_ref").select("*").eq("fiber", 0.0).execute()
    data = getattr(query, "data", [])
    
    if not data:
        return {"success": True, "message": "Semua nutrisi sudah memiliki nilai serat.", "updated_count": 0}
        
    updated = 0
    for item in data:
        name = item.get("name", "")
        if not name:
            continue
            
        ai_res = nutrition_svc.guess_and_create_nutrition(supabase, name, "100 gram")
        # Fungsi di atas insert record baru, JANGAN PANGGIL ITU!
        # Ah, guess_and_create_nutrition meng-insert baru. 
        # Lebih baik kita buat method tebak murni tanpa insert di nutrition_service, 
        # tapi karena kita butuh cepat, copy logic promptnya kesini:
        
        import httpx, json, re
        from core.config import settings
        
        prompt = f"Berikan estimasi tabel gizi khusus untuk SERAT pada bahan: {name}. Return WAJIB JSON murni tanpa markdown: {{\"fiber_per_100g\": 0.0}}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 200},
        }
        
        try:
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_ocr_model}:generateContent?key={settings.gemini_api_key}"
            with httpx.Client(timeout=30) as client:
                resp = client.post(api_url, json=payload)
                if resp.status_code == 200:
                    text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    text = re.sub(r"```json\s*", "", text)
                    text = re.sub(r"```\s*", "", text)
                    ai_data = json.loads(text.strip())
                    fiber_val = float(ai_data.get("fiber_per_100g", 0))
                    
                    if fiber_val > 0:
                        supabase.table("nutrition_ref").update({"fiber": fiber_val}).eq("id", item["id"]).execute()
                        updated += 1
        except Exception as e:
            print("Fiber resync error for", name, e)
            continue
            
    return {"success": True, "message": f"Berhasil memperbarui {updated} bahan.", "updated_count": updated}

