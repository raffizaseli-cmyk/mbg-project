"""
Product management endpoints.
"""

from decimal import Decimal
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.product import ProductCreate, ProductResponse, ProductUpdate, StockAdjustRequest, StockManualAdjustRequest
from models.user import UserInDB
from utils.unit_converter import get_base_unit, to_base, to_display

router = APIRouter(prefix="/products", tags=["products"])


def _enrich_product(p: dict) -> dict:
    """Add computed display fields to a product dict."""
    factor = float(p.get("conversion_factor") or 1)
    stock_qty = float(p.get("stock_qty") or 0)
    stock_min = float(p.get("stock_min") or 0)
    p["stock_qty_display"] = round(stock_qty / factor, 3) if factor else stock_qty
    p["stock_min_display"] = round(stock_min / factor, 3) if factor else stock_min
    # Ensure defaults
    if not p.get("base_unit"):
        p["base_unit"] = "gram"
    if not p.get("display_unit"):
        p["display_unit"] = p.get("unit", "pcs")
    if not p.get("conversion_factor"):
        p["conversion_factor"] = 1
        
    # Extract nutrition ref fields if present (from join query)
    ref = p.get("nutrition_ref") or {}
    if isinstance(ref, list):
        ref = ref[0] if ref else {}
    
    p["nutrition_ref_kategori"] = ref.get("kategori")
    cust = ref.get("custom_nutrients") or {}
    p["nutrition_ref_kondisi"] = cust.get("kondisi")
    
    return p


@router.get("", response_model=Dict[str, Any])
def list_products(
    category: str = Query(""),
    search: str = Query(""),
    is_active: bool = Query(True),
    current_user: UserInDB = Depends(get_current_user),
):
    """List products."""
    supabase = get_supabase()
    query = supabase.table("products").select("*, nutrition_ref(id, name, calories, proteins, fat, carbohydrate, fiber, kategori, custom_nutrients)").eq("tenant_id", current_user.tenant_id)

    if is_active:
        query = query.eq("is_active", True)

    if category:
        query = query.eq("category", category)

    response = query.execute()
    data = getattr(response, "data", None) or []

    if search:
        data = [p for p in data if search.lower() in p.get("name", "").lower()]

    enriched = [_enrich_product(p) for p in data]

    return {
        "success": True,
        "data": [ProductResponse(**p) for p in enriched],
        "total": len(enriched),
    }


@router.post("", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def create_product(
    body: ProductCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Create new product."""
    supabase = get_supabase()

    # Determine display/base unit and conversion factor
    disp_unit = body.display_unit or body.unit or "pcs"
    base, factor = get_base_unit(disp_unit)

    # Convert user input (display) to base unit
    stock_qty_base = to_base(float(body.stock_qty), disp_unit, factor)
    stock_min_base = to_base(float(body.stock_min), disp_unit, factor)

    # ─── Check for duplicate name within tenant ─────────────────────
    existing = (
        supabase.table("products")
        .select("id, name, is_active, stock_qty")
        .eq("tenant_id", current_user.tenant_id)
        .ilike("name", body.name.strip())
        .limit(1)
        .execute()
    )
    existing_rows = getattr(existing, "data", None) or []
    if existing_rows:
        ext_prod = existing_rows[0]
        if ext_prod.get("is_active"):
            raise HTTPException(
                status_code=409,
                detail=f"Produk '{body.name}' sudah ada. Gunakan produk yang sudah ada atau ubah nama.",
            )
        else:
            # Reaktivasi produk yang di-soft-delete
            current_inactive_stock = float(ext_prod.get("stock_qty") or 0)
            final_stock = current_inactive_stock + stock_qty_base
            
            response = (
                supabase.table("products")
                .update(
                    {
                        "is_active": True,
                        "sku": body.sku,
                        "category": body.category,
                        "unit": disp_unit,
                        "base_unit": base,
                        "display_unit": disp_unit,
                        "conversion_factor": factor,
                        "harga": float(body.harga),
                        "sell_price": float(body.sell_price),
                        "stock_qty": final_stock,
                        "stock_min": stock_min_base,
                    }
                )
                .eq("id", ext_prod["id"])
                .execute()
            )
            data = getattr(response, "data", None) or []
            if not data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to reactivate product",
                )
            
            product_id = ext_prod["id"]

            if body.harga > 0:
                supabase.table("price_history").insert(
                    {
                        "tenant_id": current_user.tenant_id,
                        "product_id": product_id,
                        "price_type": "harga",
                        "new_price": float(body.harga),
                        "effective_date": "today()",
                    }
                ).execute()

            if body.stock_qty > 0:
                supabase.table("stock_history").insert(
                    {
                        "tenant_id": current_user.tenant_id,
                        "product_id": product_id,
                        "change_qty": float(stock_qty_base),
                        "balance_after": final_stock,
                        "reason": "adjustment",
                        "notes": "Reaktivasi produk + Stok awal",
                    }
                ).execute()

            if body.category == "bahan_baku":
                try:
                    from services.nutrition_service import nutrition_svc
                    nutrition_svc.map_and_link_product(
                        supabase, product_id, body.name, disp_unit, current_user.tenant_id
                    )
                except Exception:
                    pass

            return {"success": True, "data": ProductResponse(**data[0])}

    response = (
        supabase.table("products")
        .insert(
            {
                "tenant_id": current_user.tenant_id,
                "name": body.name.strip(),
                "sku": body.sku,
                "category": body.category,
                "unit": disp_unit,
                "base_unit": base,
                "display_unit": disp_unit,
                "conversion_factor": factor,
                "harga": float(body.harga),
                "sell_price": float(body.sell_price),
                "stock_qty": stock_qty_base,
                "stock_min": stock_min_base,
                "is_active": True,
            }
        )
        .execute()
    )

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create product",
        )

    product_id = data[0]["id"]

    # Insert price history
    if body.harga > 0:
        supabase.table("price_history").insert(
            {
                "tenant_id": current_user.tenant_id,
                "product_id": product_id,
                "price_type": "harga",
                "new_price": float(body.harga),
                "effective_date": "today()",
            }
        ).execute()

    # Insert stock history untuk stok awal
    if body.stock_qty > 0:
        supabase.table("stock_history").insert(
            {
                "tenant_id": current_user.tenant_id,
                "product_id": product_id,
                "change_qty": float(body.stock_qty),
                "balance_after": float(body.stock_qty),
                "reason": "adjustment",
                "notes": "Stok awal",
            }
        ).execute()

    # Auto-link ke nutrition_ref jika bahan_baku
    if body.category == "bahan_baku":
        try:
            from services.nutrition_service import nutrition_svc
            nutrition_svc.map_and_link_product(
                supabase, product_id, body.name, disp_unit, current_user.tenant_id
            )
        except Exception:
            pass  # Non-blocking, nutrition link is best-effort

    return {"success": True, "data": ProductResponse(**data[0])}


@router.put("/{product_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def update_product(
    product_id: str,
    body: ProductUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update product."""
    supabase = get_supabase()

    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.sku is not None:
        update_data["sku"] = body.sku
    if body.category is not None:
        update_data["category"] = body.category
    if body.unit is not None:
        update_data["unit"] = body.unit
    if body.harga is not None:
        update_data["harga"] = float(body.harga)
    if body.sell_price is not None:
        update_data["sell_price"] = float(body.sell_price)
    if body.stock_min is not None:
        # Fetch the product to get its conversion factor
        prod_resp = supabase.table("products").select("conversion_factor").eq("id", product_id).single().execute()
        prod = getattr(prod_resp, "data", None) or {}
        factor = float(prod.get("conversion_factor") or 1)
        update_data["stock_min"] = float(body.stock_min) * factor
    if "nutrition_ref_id" in body.model_fields_set:
        update_data["nutrition_ref_id"] = body.nutrition_ref_id

    response = (
        supabase.table("products")
        .update(update_data)
        .eq("id", product_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    prod_data = data[0]
    # Safely fetch nutrition_ref if linked
    if prod_data.get("nutrition_ref_id"):
        try:
            nut_resp = (
                supabase.table("nutrition_ref")
                .select("id, name, calories, proteins, fat, carbohydrate, fiber, kategori, custom_nutrients")
                .eq("id", prod_data["nutrition_ref_id"])
                .single()
                .execute()
            )
            if getattr(nut_resp, "data", None):
                prod_data["nutrition_ref"] = nut_resp.data
        except Exception:
            pass
    else:
        prod_data["nutrition_ref"] = None

    # Track price change
    if body.harga is not None:
        supabase.table("price_history").insert(
            {
                "tenant_id": current_user.tenant_id,
                "product_id": product_id,
                "price_type": "harga",
                "new_price": float(body.harga),
                "changed_by": current_user.id,
            }
        ).execute()

    enriched = _enrich_product(prod_data)
    return {"success": True, "data": ProductResponse(**enriched)}


@router.delete("/{product_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))])
def delete_product(
    product_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Soft delete product."""
    supabase = get_supabase()

    supabase.table("products").update({"is_active": False}).eq("id", product_id).eq(
        "tenant_id", current_user.tenant_id
    ).execute()

    return {"success": True, "message": "Product deleted"}


# ─── GET /products/projection ────────────────────────────────────────────────

@router.get("/projection", response_model=Dict[str, Any])
def get_stock_projection(
    days: int = Query(default=7, ge=1, le=90),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Proyeksi stok {days} hari ke depan.
    Sumber: menu minggu ini (via BOM) → fallback rata-rata 7 hari terakhir.
    """
    import math
    from datetime import date, timedelta
    from services.recipe_service import recipe_service

    supabase = get_supabase()
    tid = current_user.tenant_id
    today = date.today()
    monday = today - timedelta(days=today.weekday())

    # ── Ambil semua produk aktif ──────────────────────────────────────────
    prod_resp = (
        supabase.table("products")
        .select("id, name, unit, base_unit, display_unit, conversion_factor, stock_qty, stock_min, harga")
        .eq("tenant_id", tid)
        .eq("is_active", True)
        .neq("category", "produk_jadi")
        .neq("category", "komponen")
        .execute()
    )
    products = getattr(prod_resp, "data", None) or []
    prod_map = {p["id"]: p for p in products}

    # ── Coba dapatkan menu di rentang target hari ─────────────────────────
    target_dates = [today + timedelta(days=i) for i in range(days)]
    query_pairs = {}
    for d in target_dates:
        ws = (d - timedelta(days=d.weekday())).isoformat()
        dow = d.weekday() + 1
        if ws not in query_pairs:
            query_pairs[ws] = []
        query_pairs[ws].append(dow)

    unique_ws = list(query_pairs.keys())
    
    menu_resp = (
        supabase.table("mbg_weekly_menus")
        .select("week_start, day_of_week, menu_id")
        .eq("tenant_id", tid)
        .in_("week_start", unique_ws)
        .execute()
    )
    all_menus = getattr(menu_resp, "data", None) or []
    
    scheduled_menu_ids = []
    valid_days_count = 0
    for m in all_menus:
        ws = m.get("week_start")
        dow = m.get("day_of_week")
        if ws in query_pairs and dow in query_pairs[ws] and m.get("menu_id"):
            scheduled_menu_ids.append(m["menu_id"])
            valid_days_count += 1

    # Total porsi / hari dari sekolah
    school_resp = (
        supabase.table("schools")
        .select("default_portions")
        .eq("tenant_id", tid)
        .eq("is_active", True)
        .execute()
    )
    total_portions = sum(
        int(s.get("default_portions") or 0)
        for s in (getattr(school_resp, "data", None) or [])
    )

    # Kumpulkan kebutuhan bahan aktual
    period_usage_base: Dict[str, float] = {}  # product_id -> total qty needed for period
    daily_usage: Dict[str, float] = {}       # product_id -> rata-rata hari aktif
    based_on_menu = False

    if scheduled_menu_ids and total_portions > 0:
        based_on_menu = True
        unique_mids = list(set(scheduled_menu_ids))
        
        # Ambil resep
        recipe_resp = (
            supabase.table("recipes")
            .select("*")
            .in_("menu_id", unique_mids)
            .execute()
        )
        recipes = getattr(recipe_resp, "data", None) or []

        # Hitung kemunculan tiap menu
        menu_counts = {}
        for mid in scheduled_menu_ids:
            menu_counts[mid] = menu_counts.get(mid, 0) + 1

        for mid, count in menu_counts.items():
            m_recipes = [r for r in recipes if r["menu_id"] == mid]
            # Hitung untuk `total_portions` porsi per hari
            flat_for_run = recipe_service._flatten_recipes(m_recipes, total_portions, supabase)
            
            # Akumulasi ke total periode
            for iid, qty_base in flat_for_run.items():
                period_usage_base[iid] = period_usage_base.get(iid, 0) + float(qty_base) * count

        # Pemakaian per hari dikalkulasikan sebagai Rata-Rata Kalender
        # Bermanfaat agar remaining_days memprediksi HARI KALENDER BUKAN HARI KERJA
        use_days_for_avg = days
        for iid, total_base in period_usage_base.items():
            daily_usage[iid] = total_base / use_days_for_avg

    if not based_on_menu:
        # Fallback: rata-rata pemakaian 7 hari terakhir
        start7 = (today - timedelta(days=7)).isoformat()
        hist_resp = (
            supabase.table("stock_history")
            .select("product_id, change_qty, reason")
            .eq("tenant_id", tid)
            .gte("created_at", start7)
            .execute()
        )
        for row in (getattr(hist_resp, "data", None) or []):
            if row.get("reason") in ("production", "mbg_production", "serah"):
                delta = abs(float(row.get("change_qty") or 0))
                pid = row["product_id"]
                daily_usage[pid] = daily_usage.get(pid, 0) + delta / 7
                
        # Konversi daily usage menjadi periode 
        for pid, daily in daily_usage.items():
            period_usage_base[pid] = daily * days

    # ── Susun hasil proyeksi ──────────────────────────────────────────────
    # Build per-day usage map: {product_id: {date_str: qty_base}}
    per_day_usage: Dict[str, Dict[str, float]] = {}
    
    if based_on_menu and total_portions > 0:
        for m in all_menus:
            ws = m.get("week_start")
            dow = m.get("day_of_week")
            mid = m.get("menu_id")
            if not mid or ws not in query_pairs or dow not in query_pairs[ws]:
                continue
            
            # Calculate actual date for this menu entry
            ws_date = date.fromisoformat(ws)
            actual_date = ws_date + timedelta(days=dow - 1)
            if actual_date < today:
                continue  # Skip past days
            
            date_str = actual_date.isoformat()
            
            m_recipes = [r for r in recipes if r["menu_id"] == mid]
            flat = recipe_service._flatten_recipes(m_recipes, total_portions, supabase)
            
            for iid, qty_base in flat.items():
                if iid not in per_day_usage:
                    per_day_usage[iid] = {}
                per_day_usage[iid][date_str] = per_day_usage[iid].get(date_str, 0) + float(qty_base)

    items_out = []
    for p in products:
        pid = p["id"]
        factor = float(p.get("conversion_factor") or 1)
        
        stock_base = float(p.get("stock_qty") or 0)
        stock_min_base = float(p.get("stock_min") or 0)
        stock_disp = stock_base / factor if factor else stock_base
        stock_min_disp = stock_min_base / factor if factor else stock_min_base
        
        usage_base = daily_usage.get(pid, 0)
        needed_period_base = period_usage_base.get(pid, 0)
        
        usage_disp = usage_base / factor if factor else usage_base
        needed_period_disp = needed_period_base / factor if factor else needed_period_base

        # Calculate days_remaining using sequential per-day deduction
        if based_on_menu and pid in per_day_usage:
            remaining = stock_base
            days_rem = 0
            sorted_dates = sorted(per_day_usage[pid].keys())
            for d_str in sorted_dates:
                day_need = per_day_usage[pid][d_str]
                if remaining >= day_need:
                    remaining -= day_need
                    days_rem += 1
                else:
                    # Partially covers this day
                    if day_need > 0:
                        days_rem += remaining / day_need
                    remaining = 0
                    break
            # If stock covers all scheduled days, estimate beyond
            if remaining > 0 and usage_disp > 0:
                days_rem += remaining / factor / usage_disp if factor else remaining / usage_disp
        elif usage_disp > 0:
            days_rem = stock_disp / usage_disp
        else:
            # No usage data — if stock is 0, mark as 0 days, otherwise unknown (large)
            days_rem = 0 if stock_disp <= 0 else 999

        sufficient = stock_disp >= needed_period_disp
        shortage_disp = max(needed_period_disp - stock_disp, 0)

        if stock_disp <= 0:
            stat = "habis"
        elif not sufficient and needed_period_disp > 0:
            stat = "kritis"
        elif days_rem <= 7:
            stat = "menipis"
        else:
            stat = "aman"

        disp_unit = p.get("display_unit") or p.get("unit", "pcs")
        
        # Build per-day breakdown for this product
        day_breakdown = []
        if based_on_menu and pid in per_day_usage:
            running_stock = stock_base
            for d_str in sorted(per_day_usage[pid].keys()):
                day_need = per_day_usage[pid][d_str]
                day_need_disp = day_need / factor if factor else day_need
                enough = running_stock >= day_need
                running_stock = max(running_stock - day_need, 0)
                day_breakdown.append({
                    "date": d_str,
                    "needed": round(day_need_disp, 2),
                    "stock_after": round(running_stock / factor if factor else running_stock, 2),
                    "sufficient": enough,
                })

        items_out.append({
            "product_id": pid,
            "name": p["name"],
            "unit": disp_unit,
            "stock_qty": stock_base,
            "stock_qty_display": round(stock_disp, 3),
            "stock_min_display": round(stock_min_disp, 3),
            "daily_usage": round(usage_disp, 4),
            "days_remaining": round(min(days_rem, 999), 1),
            "needed_for_period": round(needed_period_disp, 3),
            "sufficient": sufficient,
            "shortage": round(shortage_disp, 3),
            "status": stat,
            "harga": p.get("harga"),
            "display_unit": disp_unit,
            "day_breakdown": day_breakdown,
        })

    # Sort: kritis/habis dulu
    order = {"habis": 0, "kritis": 1, "menipis": 2, "aman": 3}
    items_out.sort(key=lambda x: (order.get(x["status"], 4), -x.get("needed_for_period", 0)))

    summary = {
        "total_items": len(items_out),
        "sufficient_count": sum(1 for i in items_out if i["status"] == "aman"),
        "warning_count": sum(1 for i in items_out if i["status"] == "menipis"),
        "critical_count": sum(1 for i in items_out if i["status"] in ("kritis", "habis")),
    }

    return {
        "success": True,
        "data": {
            "projection_days": days,
            "based_on_menu": based_on_menu,
            "items": items_out,
            "summary": summary,
        },
    }



@router.get("/low-stock", response_model=Dict[str, Any])
def get_low_stock_products(current_user: UserInDB = Depends(get_current_user)):
    """Get products with low stock."""
    supabase = get_supabase()

    # Query semua produk
    response = (
        supabase.table("products")
        .select("*")
        .eq("tenant_id", current_user.tenant_id)
        .eq("is_active", True)
        .neq("category", "produk_jadi")
        .neq("category", "komponen")
        .execute()
    )

    data = getattr(response, "data", None) or []

    # Filter yang stock_qty <= stock_min
    low_stock = [p for p in data if Decimal(str(p["stock_qty"])) <= Decimal(str(p["stock_min"]))]

    return {
        "success": True,
        "data": [ProductResponse(**p) for p in low_stock],
        "total": len(low_stock),
    }


@router.post("/{product_id}/adjust-stock", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def adjust_stock(
    product_id: str,
    body: StockAdjustRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """Adjust product stock."""
    supabase = get_supabase()

    # Get current product
    product_resp = (
        supabase.table("products")
        .select("stock_qty, conversion_factor")
        .eq("id", product_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )

    product_data = getattr(product_resp, "data", None)
    if not product_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    factor = float(product_data.get("conversion_factor") or 1)
    # The input body.change_qty is assumed to be in display unit (e.g., user inputs 5 kg)
    # Convert it to base unit before adding to existing base unit stock
    base_change_qty = Decimal(str(body.change_qty)) * Decimal(str(factor))

    current_qty = Decimal(str(product_data["stock_qty"]))
    new_qty = current_qty + base_change_qty
    if new_qty < 0:
        new_qty = Decimal("0.000")

    # Update product stock (in base units)
    supabase.table("products").update({"stock_qty": float(new_qty)}).eq("id", product_id).execute()

    # Insert stock history (in base units)
    supabase.table("stock_history").insert(
        {
            "tenant_id": current_user.tenant_id,
            "product_id": product_id,
            "change_qty": float(base_change_qty),
            "balance_after": float(new_qty),
            "reason": body.reason,
            "notes": body.notes,
        }
    ).execute()

    # If spoilage/waste, insert cashflow
    if body.reason in ["spoilage", "waste"]:
        supabase.table("cashflow_log").insert(
            {
                "tenant_id": current_user.tenant_id,
                "flow_type": "out",
                "category": f"{body.reason}_loss",
                "amount": 0,  # Placeholder
                "description": f"{body.reason}: {body.notes}",
            }
        ).execute()

    return {"success": True, "data": {"new_stock_qty": float(new_qty)}}


# ─── GET /products/{product_id}/history ──────────────────────────────────────

@router.get("/{product_id}/history", response_model=Dict[str, Any])
def get_product_history(
    product_id: str,
    limit: int = Query(default=50),
    offset: int = Query(default=0),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Riwayat perubahan stok suatu produk.
    Hitung running_balance dari oldest ke newest.
    """
    supabase = get_supabase()
    tid = current_user.tenant_id

    # Cek produk ada + filter tenant
    prod_resp = (
        supabase.table("products")
        .select("id, name, unit, stock_qty")
        .eq("id", product_id)
        .eq("tenant_id", tid)
        .single()
        .execute()
    )
    product = getattr(prod_resp, "data", None)
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")

    # Ambil semua history (untuk hitung running balance), sorted ASC
    hist_resp = (
        supabase.table("stock_history")
        .select("id, change_qty, balance_after, reason, notes, created_at")
        .eq("product_id", product_id)
        .eq("tenant_id", tid)
        .order("created_at", desc=False)
        .execute()
    )
    all_rows = getattr(hist_resp, "data", None) or []
    total = len(all_rows)

    # Paginated slice
    paged = all_rows[offset: offset + limit]

    # Running balance: jika ada balance_after pakai itu, jika tidak hitung manual
    running = Decimal("0")
    if all_rows:
        try:
            # Seed dari baris paling awal
            running = Decimal(str(all_rows[0].get("balance_after") or 0)) - Decimal(
                str(all_rows[0].get("change_qty") or 0)
            )
        except Exception:
            running = Decimal("0")

    # Rebuild running balance for all_rows up to paged range
    balance_map: dict = {}
    r = Decimal("0")
    for row in all_rows:
        try:
            ba = row.get("balance_after")
            if ba is not None:
                r = Decimal(str(ba))
            else:
                r += Decimal(str(row.get("change_qty") or 0))
        except Exception:
            pass
        balance_map[row["id"]] = r

    history = [
        {
            "id": row.get("id"),
            "change_qty": str(row.get("change_qty", 0)),
            "balance_after": str(row.get("balance_after") or balance_map.get(row["id"], 0)),
            "running_balance": str(balance_map.get(row["id"], 0)),
            "reason": row.get("reason"),
            "notes": row.get("notes"),
            "created_at": row.get("created_at"),
        }
        for row in paged
    ]

    return {
        "success": True,
        "data": {
            "product": product,
            "history": history,
            "total": total,
        },
    }


# ─── POST /products/{product_id}/adjust-stock-manual ─────────────────────────

@router.post(
    "/{product_id}/adjust-stock-manual",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def adjust_stock_manual(
    product_id: str,
    body: StockManualAdjustRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Koreksi stok manual — menerima stok fisik aktual (new_qty), bukan delta.
    Menghitung delta, update produk, insert stock_history & audit_log.
    """
    supabase = get_supabase()
    tid = current_user.tenant_id

    # Ambil produk saat ini
    prod_resp = (
        supabase.table("products")
        .select("id, name, stock_qty, unit, conversion_factor")
        .eq("id", product_id)
        .eq("tenant_id", tid)
        .single()
        .execute()
    )
    prod = getattr(prod_resp, "data", None)
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produk tidak ditemukan")

    factor = float(prod.get("conversion_factor") or 1)

    # old_qty in db is in base units
    old_qty_base = Decimal(str(prod["stock_qty"] or 0))
    # new_qty from frontend is in display units (e.g., 105 kg)
    new_qty_display = Decimal(str(body.new_qty))
    # convert new_qty to base units
    new_qty_base = new_qty_display * Decimal(str(factor))
    
    delta_base = new_qty_base - old_qty_base

    # Update stok produk (in base units)
    supabase.table("products").update({"stock_qty": float(new_qty_base)}).eq("id", product_id).execute()

    # Insert stock_history (in base units)
    supabase.table("stock_history").insert({
        "tenant_id": tid,
        "product_id": product_id,
        "change_qty": float(delta_base),
        "balance_after": float(new_qty_base),
        "reason": "adjustment",
        "notes": f"Koreksi manual: {body.reason}" + (f". {body.notes}" if body.notes else ""),
    }).execute()

    # Insert audit_log
    try:
        supabase.table("audit_log").insert({
            "tenant_id": tid,
            "user_id": current_user.id,
            "action": "stock_adjustment",
            "resource": "products",
            "resource_id": product_id,
            "old_data": {"stock_qty": float(old_qty_base)},
            "new_data": {"stock_qty": float(new_qty_base), "delta": float(delta_base), "reason": body.reason},
        }).execute()
    except Exception:
        pass  # audit_log non-fatal

    return {
        "success": True,
        "data": {
            "product_id": product_id,
            "name": prod["name"],
            "unit": prod["unit"],
            "old_qty": float(old_qty_base / Decimal(str(factor))),
            "new_qty": float(new_qty_display),
            "delta": float(delta_base / Decimal(str(factor))),
        },
    }
