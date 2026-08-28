"""
backend/routers/mbg.py
Endpoints untuk MBG weekly menu management — Modul 6

Routes:
  GET  /mbg/weekly-menus          → list menu 1 minggu (Senin–Sabtu)
  POST /mbg/weekly-menus          → upsert menu 1 hari
  PUT  /mbg/weekly-menus/{date}   → update menu 1 hari
  DELETE /mbg/weekly-menus/{date} → hapus menu 1 hari
  POST /mbg/weekly-menus/validate → cek produk + BOM
  GET  /mbg/weekly-menus/today    → menu hari ini (shortcut bot /serah)
"""

from datetime import date, datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.mbg import (
    BomIngredient,
    ValidateMenuRequest,
    ValidateMenuResponse,
    WeeklyMenuCreate,
    WeeklyMenuEntry,
    WeeklyMenuUpdate,
)
from models.user import UserInDB

router = APIRouter(prefix="/weekly-menus", tags=["mbg-menus"])

# ─── Helper: nama hari Bahasa Indonesia ───

HARI = {1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu"}


def _get_week_start(target: date) -> date:
    """Kembalikan Senin dari minggu yang mengandung target date."""
    return target - timedelta(days=target.weekday())


def _build_week_frame(week_start: date) -> List[Dict[str, Any]]:
    """Bangun frame 6 hari (Senin–Sabtu) sebagai dict kosong."""
    return [
        {
            "date": (week_start + timedelta(days=i)).isoformat(),
            "day_of_week": i + 1,
            "day_name": HARI[i + 1],
        }
        for i in range(6)
    ]


# ─── GET /mbg/weekly-menus ───────────────────────────────────────────────────

@router.get("", response_model=Dict[str, Any])
def get_weekly_menus(
    week_start: str = Query(
        default=None,
        description="Senin awal minggu format YYYY-MM-DD. Default = Senin minggu ini.",
    ),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Kembalikan list 6 hari (Senin–Sabtu) beserta menu masing-masing.
    Hari yang belum diisi memiliki menu_name=null dan is_filled=false.
    """
    supabase = get_supabase()

    # Tentukan week_start
    if week_start:
        try:
            ws = date.fromisoformat(week_start)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Format week_start harus YYYY-MM-DD",
            )
    else:
        ws = _get_week_start(date.today())

    # Paksa ws selalu Senin
    ws = _get_week_start(ws)
    week_end = ws + timedelta(days=5)  # Sabtu

    # Query mbg_weekly_menus untuk minggu ini
    resp = (
        supabase.table("mbg_weekly_menus")
        .select("*")
        .eq("tenant_id", current_user.tenant_id)
        .eq("week_start", ws.isoformat())
        .execute()
    )
    db_entries: List[Dict] = getattr(resp, "data", None) or []

    # Index by day_of_week
    db_map: Dict[int, Dict] = {e["day_of_week"]: e for e in db_entries}

    # Kumpulkan semua menu_id yang ada BOM-nya
    menu_ids_with_bom: set = set()
    if db_entries:
        product_ids = [e["menu_id"] for e in db_entries if e.get("menu_id")]
        if product_ids:
            bom_resp = (
                supabase.table("recipes")
                .select("menu_id")
                .eq("tenant_id", current_user.tenant_id)
                .in_("menu_id", product_ids)
                .execute()
            )
            bom_data: List[Dict] = getattr(bom_resp, "data", None) or []
            menu_ids_with_bom = {r["menu_id"] for r in bom_data}

    # Gabungkan frame dengan data DB
    result: List[WeeklyMenuEntry] = []
    for frame in _build_week_frame(ws):
        dow = frame["day_of_week"]
        db_entry = db_map.get(dow)

        if db_entry:
            menu_id = db_entry.get("menu_id")
            result.append(
                WeeklyMenuEntry(
                    date=frame["date"],
                    day_name=frame["day_name"],
                    day_of_week=dow,
                    menu_name=db_entry.get("menu_name"),
                    menu_id=menu_id,
                    has_bom=menu_id in menu_ids_with_bom if menu_id else False,
                    is_filled=True,
                    notes=db_entry.get("notes"),
                )
            )
        else:
            result.append(
                WeeklyMenuEntry(
                    date=frame["date"],
                    day_name=frame["day_name"],
                    day_of_week=dow,
                )
            )

    return {
        "success": True,
        "week_start": ws.isoformat(),
        "week_end": week_end.isoformat(),
        "data": [e.model_dump() for e in result],
    }


# ─── GET /mbg/weekly-menus/today ─────────────────────────────────────────────

@router.get("/today", response_model=Dict[str, Any])
def get_today_menu(current_user: UserInDB = Depends(get_current_user)):
    """Shortcut: kembalikan menu hari ini. Digunakan bot saat /serah."""
    supabase = get_supabase()

    today = date.today()
    dow = today.weekday() + 1  # 1=Senin … 7=Minggu

    if dow > 6:
        return {
            "success": True,
            "data": None,
            "message": "Hari Minggu — tidak ada jadwal MBG",
        }

    ws = _get_week_start(today)

    resp = (
        supabase.table("mbg_weekly_menus")
        .select("*")
        .eq("tenant_id", current_user.tenant_id)
        .eq("week_start", ws.isoformat())
        .eq("day_of_week", dow)
        .limit(1)
        .execute()
    )
    entries: List[Dict] = getattr(resp, "data", None) or []

    if not entries:
        return {
            "success": True,
            "data": None,
            "message": f"Menu {HARI.get(dow, 'hari ini')} belum diisi",
        }

    entry = entries[0]
    menu_id = entry.get("menu_id")

    # Cek BOM
    has_bom = False
    if menu_id:
        bom_resp = (
            supabase.table("recipes")
            .select("id")
            .eq("tenant_id", current_user.tenant_id)
            .eq("menu_id", menu_id)
            .limit(1)
            .execute()
        )
        has_bom = bool(getattr(bom_resp, "data", None))

    return {
        "success": True,
        "data": WeeklyMenuEntry(
            date=today.isoformat(),
            day_name=HARI.get(dow, ""),
            day_of_week=dow,
            menu_name=entry.get("menu_name"),
            menu_id=menu_id,
            has_bom=has_bom,
            is_filled=True,
            notes=entry.get("notes"),
        ).model_dump(),
    }


# ─── POST /mbg/weekly-menus/validate ─────────────────────────────────────────

@router.post("/validate", response_model=Dict[str, Any])
def validate_menu(
    body: ValidateMenuRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Cari produk by name (ILIKE) category=produk_jadi, lalu cek BOM.
    Return: found, product {id,name}, has_bom, bom_ingredients[].
    """
    supabase = get_supabase()

    prod_resp = (
        supabase.table("products")
        .select("id, name, unit")
        .eq("tenant_id", current_user.tenant_id)
        .eq("category", "produk_jadi")
        .eq("is_active", True)
        .ilike("name", f"%{body.menu_name}%")
        .execute()
    )
    products: List[Dict] = getattr(prod_resp, "data", None) or []

    if not products:
        return {
            "success": True,
            "data": ValidateMenuResponse(
                found=False,
                product=None,
                has_bom=False,
                bom_ingredients=[],
            ).model_dump(),
        }

    # Prefer exact match
    exact_matches = [p for p in products if p["name"].lower().strip() == body.menu_name.lower().strip()]
    product = exact_matches[0] if exact_matches else products[0]
    product_id = product["id"]

    # Cek BOM / resep
    bom_resp = (
        supabase.table("recipes")
        .select("qty_needed, unit, products!recipes_ingredient_id_fkey(name)")
        .eq("tenant_id", current_user.tenant_id)
        .eq("menu_id", product_id)
        .execute()
    )
    bom_rows: List[Dict] = getattr(bom_resp, "data", None) or []

    bom_ingredients: List[BomIngredient] = []
    for row in bom_rows:
        ing_name = (row.get("products") or {}).get("name", "?")
        bom_ingredients.append(
            BomIngredient(
                name=ing_name,
                qty=float(row.get("qty_needed", 0)),
                unit=row.get("unit", ""),
            )
        )

    return {
        "success": True,
        "data": ValidateMenuResponse(
            found=True,
            product={"id": product_id, "name": product["name"]},
            has_bom=len(bom_ingredients) > 0,
            bom_ingredients=bom_ingredients,
        ).model_dump(),
    }


# ─── POST /mbg/weekly-menus ───────────────────────────────────────────────────

@router.post(
    "",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def upsert_weekly_menu(
    body: WeeklyMenuCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Upsert (insert or update) menu untuk satu hari."""
    supabase = get_supabase()

    try:
        target_date = date.fromisoformat(body.date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Format date harus YYYY-MM-DD",
        )

    dow = target_date.weekday() + 1
    if dow > 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Hari Minggu tidak termasuk jadwal MBG",
        )

    ws = _get_week_start(target_date)

    upsert_data = {
        "tenant_id": current_user.tenant_id,
        "week_start": ws.isoformat(),
        "day_of_week": dow,
        "menu_name": body.menu_name.strip(),
        "menu_id": body.menu_id,
        "notes": body.notes,
    }

    resp = (
        supabase.table("mbg_weekly_menus")
        .upsert(upsert_data, on_conflict="tenant_id,week_start,day_of_week")
        .execute()
    )

    data = getattr(resp, "data", None) or []
    if not data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal menyimpan menu",
        )

    entry = data[0]
    return {
        "success": True,
        "data": WeeklyMenuEntry(
            date=body.date,
            day_name=HARI.get(dow, ""),
            day_of_week=dow,
            menu_name=entry.get("menu_name"),
            menu_id=entry.get("menu_id"),
            is_filled=True,
        ).model_dump(),
    }


# ─── PUT /mbg/weekly-menus/{date} ────────────────────────────────────────────

@router.put(
    "/{entry_date}",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def update_weekly_menu(
    entry_date: str,
    body: WeeklyMenuUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update menu untuk satu hari yang sudah ada."""
    supabase = get_supabase()

    try:
        target_date = date.fromisoformat(entry_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Format date harus YYYY-MM-DD",
        )

    dow = target_date.weekday() + 1
    ws = _get_week_start(target_date)

    resp = (
        supabase.table("mbg_weekly_menus")
        .update({"menu_name": body.menu_name.strip(), "menu_id": body.menu_id, "notes": body.notes})
        .eq("tenant_id", current_user.tenant_id)
        .eq("week_start", ws.isoformat())
        .eq("day_of_week", dow)
        .execute()
    )

    data = getattr(resp, "data", None) or []
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entry menu tidak ditemukan untuk tanggal tersebut",
        )

    entry = data[0]
    return {
        "success": True,
        "data": WeeklyMenuEntry(
            date=entry_date,
            day_name=HARI.get(dow, ""),
            day_of_week=dow,
            menu_name=entry.get("menu_name"),
            menu_id=entry.get("menu_id"),
            is_filled=True,
        ).model_dump(),
    }


# ─── DELETE /mbg/weekly-menus/{date} ─────────────────────────────────────────

@router.delete(
    "/{entry_date}",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def delete_weekly_menu(
    entry_date: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Hapus entry menu untuk satu hari."""
    supabase = get_supabase()

    try:
        target_date = date.fromisoformat(entry_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Format date harus YYYY-MM-DD",
        )

    dow = target_date.weekday() + 1
    ws = _get_week_start(target_date)

    supabase.table("mbg_weekly_menus").delete().eq(
        "tenant_id", current_user.tenant_id
    ).eq("week_start", ws.isoformat()).eq("day_of_week", dow).execute()

    return {"success": True, "message": f"Menu tanggal {entry_date} dihapus"}


# =============================================================================
# DELIVERY ROUTER — prefix = /mbg/deliveries  (Modul 10)
# =============================================================================

from fastapi import BackgroundTasks  # noqa: E402

from models.mbg import DeliveryBulkRequest  # noqa: E402
from services.recipe_service import RecipeService  # noqa: E402
from services.pdf_service import PDFService  # noqa: E402
from services.export_service import ExportService  # noqa: E402

delivery_router = APIRouter(prefix="/deliveries", tags=["mbg-deliveries"])


# ─── POST /mbg/deliveries/bulk ────────────────────────────────────────────────

@delivery_router.post(
    "/bulk",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan", "gizi"]))],
)
async def create_bulk_delivery(
    body: DeliveryBulkRequest,
    background_tasks: BackgroundTasks,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Konfirmasi penyerahan MBG ke beberapa sekolah sekaligus — ATOMIK.
    Rollback manual jika ada langkah gagal.
    """
    supabase = get_supabase()
    recipe_svc = RecipeService()
    pdf_svc = PDFService()
    tenant_id = current_user.tenant_id

    # ─── Langkah 1: Validasi input ───────────────────────────────────
    try:
        delivery_date = date.fromisoformat(body.delivery_date)
    except ValueError:
        raise HTTPException(422, detail="Format delivery_date harus YYYY-MM-DD")

    if delivery_date > date.today():
        raise HTTPException(422, detail="delivery_date tidak boleh di masa depan")

    if not body.deliveries:
        raise HTTPException(422, detail="deliveries tidak boleh kosong")

    for d in body.deliveries:
        if d.portions_sent <= 0:
            raise HTTPException(422, detail=f"portions_sent harus > 0 untuk school_id {d.school_id}")

    # Validasi school_id milik tenant + UNIQUE constraint
    school_ids = [d.school_id for d in body.deliveries]
    schools_resp = (
        supabase.table("schools")
        .select("id, name, default_portions")
        .eq("tenant_id", tenant_id)
        .in_("id", school_ids)
        .execute()
    )
    db_schools = {s["id"]: s for s in (getattr(schools_resp, "data", None) or [])}

    for d in body.deliveries:
        if d.school_id not in db_schools:
            raise HTTPException(422, detail=f"school_id {d.school_id} tidak ditemukan")

    # Cek duplikat
    exist_resp = (
        supabase.table("mbg_deliveries")
        .select("id, school_id")
        .eq("tenant_id", tenant_id)
        .eq("delivery_date", body.delivery_date)
        .in_("school_id", school_ids)
        .execute()
    )
    existing = getattr(exist_resp, "data", None) or []
    if existing:
        dup_ids = [e["school_id"] for e in existing]
        dup_names = [db_schools.get(sid, {}).get("name", sid) for sid in dup_ids]
        raise HTTPException(409, detail=f"Delivery sudah ada untuk: {', '.join(dup_names)}")

    # ─── Langkah 2: Ambil menu hari itu ──────────────────────────────
    dow = delivery_date.weekday() + 1
    ws = _get_week_start(delivery_date)
    menu_resp = (
        supabase.table("mbg_weekly_menus")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("week_start", ws.isoformat())
        .eq("day_of_week", dow)
        .limit(1)
        .execute()
    )
    menu_rows = getattr(menu_resp, "data", None) or []
    menu_info = menu_rows[0] if menu_rows else None
    menu_id = (menu_info or {}).get("menu_id")
    menu_name = (menu_info or {}).get("menu_name") or "Tanpa Jadwal"
    warning: str | None = None
    stok_dipotong = False

    # ─── Langkah 3: Cek stok BOM (jika menu + BOM ada) ────────────────
    total_portions = sum(d.portions_sent for d in body.deliveries)

    if menu_id:
        stock_check = recipe_svc.calculate(menu_id, total_portions, tenant_id, supabase)
        if stock_check.get("has_bom") and not stock_check.get("can_produce"):
            # Stok kurang — LANJUTKAN dengan warning, jangan block
            shortage_details = [
                {
                    "ingredient": ing["name"],
                    "needed": ing["total_needed"],
                    "available": ing["available"],
                    "shortage": ing["shortage"],
                    "base_unit": ing.get("base_unit", "gram"),
                    "display_unit": ing.get("display_unit", "kg"),
                    "conversion_factor": ing.get("conversion_factor", 1000)
                }
                for ing in stock_check.get("ingredients", [])
                if not ing["sufficient"]
            ]
            shortage_names = [s["ingredient"] for s in shortage_details[:3]]
            warning = f"⚠️ Stok kurang untuk: {', '.join(shortage_names)}. Penyerahan tetap dicatat, stok dipotong sebagian."
            # Tetap potong stok yang tersedia (partial deduction)
        elif stock_check.get("has_bom"):
            pass  # stok cukup, akan dipotong di Langkah 5
        else:
            warning = "Menu tidak memiliki BOM, stok tidak dipotong"
    else:
        warning = "Tidak ada menu/BOM hari ini, stok tidak dipotong"

    # ─── Langkah 4: Insert deliveries per sekolah ────────────────────
    inserted_delivery_ids: list = []
    delivery_records: list = []
    try:
        for d in body.deliveries:
            row = {
                "tenant_id": tenant_id,
                "school_id": d.school_id,
                "delivery_date": body.delivery_date,
                "menu_id": menu_id,
                "menu_name": menu_name,
                "portions_sent": d.portions_sent,
                "receiver_name": d.receiver_name,
                "notes": d.notes,
                "status": "confirmed",
            }
            ins_resp = supabase.table("mbg_deliveries").insert(row).execute()
            ins_data = (getattr(ins_resp, "data", None) or [{}])[0]
            inserted_delivery_ids.append(ins_data.get("id"))
            delivery_records.append({
                **row,
                "id": ins_data.get("id"),
                "school_name": db_schools.get(d.school_id, {}).get("name", d.school_id),
            })
    except Exception as e:
        # Rollback deliveries yang sudah diinsert
        for did in inserted_delivery_ids:
            if did:
                try:
                    supabase.table("mbg_deliveries").delete().eq("id", did).execute()
                except Exception:
                    pass
        raise HTTPException(500, detail=f"Gagal insert delivery: {e}")

    # ─── Langkah 5: Potong stok ───────────────────────────────────────
    if menu_id and stock_check.get("has_bom"):
        try:
            recipe_svc.deduct_stock(menu_id, total_portions, tenant_id, supabase, delivery_date)
            stok_dipotong = True
        except Exception as e:
            # Rollback deliveries
            for did in inserted_delivery_ids:
                if did:
                    try:
                        supabase.table("mbg_deliveries").delete().eq("id", did).execute()
                    except Exception:
                        pass
            raise HTTPException(500, detail=f"Gagal potong stok: {e}")

    # ─── Langkah 6: Ambil allocation settings per sekolah + hitung ────────────────
    # Fetch allocation settings
    alloc_settings_resp = (
        supabase.table("mbg_allocation_settings")
        .select("*")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    alloc_rows = getattr(alloc_settings_resp, "data", None) or [{}]
    settings = alloc_rows[0] if alloc_rows else {}
    
    rate_bahan_sd = float(settings.get("bahan_sd_smp", 10000))
    rate_bahan_tk = float(settings.get("bahan_paud_tk", 8000))
    rate_ops = float(settings.get("ops_per_porsi", 3000))
    insentif_harian = float(settings.get("insentif_harian", 6000000))

    total_portions = 0
    budget_bahan = 0.0
    budget_ops = 0.0

    for d in body.deliveries:
        school = db_schools.get(d.school_id, {})
        school_level = school.get("school_level", "sd_smp")
        
        portions = d.portions_sent
        rate_bahan = rate_bahan_tk if school_level == "paud_tk" else rate_bahan_sd
        
        total_portions += portions
        budget_bahan += portions * rate_bahan
        budget_ops += portions * rate_ops

    # ─── Check if Sunday: profit = 0 ─────────────────────────────
    delivery_obj = datetime.strptime(body.delivery_date, "%Y-%m-%d")
    is_sunday = delivery_obj.weekday() == 6  # 6 = Sunday
    
    # Total Insentif is flat per day (except Sunday: 0)
    budget_insentif = 0.0 if is_sunday else insentif_harian
    total_revenue = budget_bahan + budget_ops + budget_insentif

    allocation = {
        "total_revenue": total_revenue,
        "total_portions": total_portions,
        "budget_bahan": budget_bahan,
        "budget_ops": budget_ops,
        "budget_insentif": budget_insentif,
    }

    # ─── Langkah 6b: Insert mbg_budget_allocations ───────────────────
    alloc_row = {
        "tenant_id": tenant_id,
        "date": body.delivery_date,
        "total_portions": total_portions,
        "price_per_portion": str(total_revenue / total_portions) if total_portions > 0 else "0",
        "total_revenue": str(total_revenue),
        "pph22_deduction": "0.00",
        "net_revenue": str(total_revenue),
        "budget_bahan": str(budget_bahan),
        "budget_ops": str(budget_ops),
        "budget_insentif": str(budget_insentif),
    }
    alloc_insert_resp = supabase.table("mbg_budget_allocations").insert(alloc_row).execute()
    alloc_db = (getattr(alloc_insert_resp, "data", None) or [{}])[0]
    alloc_id = alloc_db.get("id")

    # ─── Langkah 7: Insert piutang (receivables) ─────────────────────
    from datetime import timedelta as _td
    due_date = (delivery_date + _td(days=30)).isoformat()
    recv_resp = supabase.table("receivables").insert({
        "tenant_id": tenant_id,
        "transaction_id": None,
        "debtor_name": "Pemerintah - MBG",
        "amount": str(budget_bahan),               # HANYA komponen bahan (10k/8k) sesuai Juknis
        "component_bahan": str(budget_bahan),
        "component_ops": str(budget_ops),
        "component_insentif": str(budget_insentif),
        "pph22_amount": "0.00",
        "paid_amount": "0.00",
        "due_date": due_date,
        "status": "recorded",                      # Ganti 'unpaid' jadi 'recorded' (Riwayat)
    }).execute()
    receivable_id = ((getattr(recv_resp, "data", None) or [{}])[0]).get("id")

    # ─── Langkah 8: Generate draft nota PDF ──────────────────────────
    tenant_resp = (
        supabase.table("tenants")
        .select("id, name")
        .eq("id", tenant_id)
        .single()
        .execute()
    )
    tenant_info = getattr(tenant_resp, "data", None) or {"id": tenant_id, "name": "SPPG"}
    menu_info_dict = {
        "name": (menu_info or {}).get("menu_name", "—"),
        "id": menu_id,
    }
    pdf_url = pdf_svc.generate_mbg_delivery_note(
        deliveries=delivery_records,
        tenant_info=tenant_info,
        menu_info=menu_info_dict,
        allocation=allocation,
        delivery_date=body.delivery_date,
        supabase=supabase,
    )

    # Update pdf_draft_url di budget_allocations
    if alloc_id and pdf_url:
        supabase.table("mbg_budget_allocations").update(
            {"pdf_draft_url": pdf_url}
        ).eq("id", alloc_id).execute()

    # ─── Langkah 9: Trigger regenerate Excel (background) ────────────
    background_tasks.add_task(
        ExportService().regenerate_monthly_excel,
        tenant_id,
        delivery_date.year,
        delivery_date.month,
    )

    return {
        "success": True,
        "data": {
            "delivery_date": body.delivery_date,
            "total_schools": len(body.deliveries),
            "total_portions": total_portions,
            "deliveries": delivery_records,
            "allocation": allocation,
            "receivable_id": receivable_id,
            "pdf_draft_url": pdf_url,
            "stok_dipotong": stok_dipotong,
            "warning": warning,
        },
    }


# ─── GET /mbg/deliveries/summary ─────────────────────────────────────────────

@delivery_router.get("/summary", response_model=Dict[str, Any])
def get_delivery_summary(
    date_param: str = Query(default=None, alias="date"),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ringkasan penyerahan MBG untuk tanggal tertentu (default hari ini)."""
    supabase = get_supabase()
    tenant_id = current_user.tenant_id

    try:
        target_date = date.fromisoformat(date_param) if date_param else date.today()
    except ValueError:
        raise HTTPException(422, detail="Format date harus YYYY-MM-DD")

    # Ambil deliveries
    del_resp = (
        supabase.table("mbg_deliveries")
        .select("*, schools(name, default_portions, distance_km)")
        .eq("tenant_id", tenant_id)
        .eq("delivery_date", target_date.isoformat())
        .execute()
    )
    deliveries_raw = getattr(del_resp, "data", None) or []

    # Hitung total porsi
    if deliveries_raw:
        # Jika ada delivery records, gunakan portions_sent
        total_portions = sum((d.get("portions_sent") or 0) for d in deliveries_raw)
        logger.info(f"[Summary] Using actual deliveries: {total_portions} porsi")
    else:
        # Jika belum ada delivery, gunakan default_portions dari schools aktif
        schools_resp = (
            supabase.table("schools")
            .select("id, name, default_portions, is_active")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .execute()
        )
        schools_list = getattr(schools_resp, "data", None) or []
        logger.info(f"[Summary] Found {len(schools_list)} active schools: {[s.get('name') for s in schools_list]}")
        
        if not schools_list:
            # Fallback: ambil semua schools (aktif atau tidak)
            logger.warning(f"[Summary] No active schools found, trying all schools...")
            schools_resp_fallback = (
                supabase.table("schools")
                .select("id, name, default_portions, is_active")
                .eq("tenant_id", tenant_id)
                .execute()
            )
            schools_list = getattr(schools_resp_fallback, "data", None) or []
            logger.info(f"[Summary] Found {len(schools_list)} total schools (active or not)")
        
        total_portions = 0
        for s in schools_list:
            def_port = s.get("default_portions", 0)
            if def_port:
                try:
                    total_portions += int(def_port)
                except (ValueError, TypeError):
                    logger.warning(f"[Summary] Invalid default_portions for {s.get('name')}: {def_port}")
        
        logger.info(f"[Summary] Calculated total from schools: {total_portions} porsi")

    # Ambil menu
    dow = target_date.weekday() + 1
    ws = _get_week_start(target_date)
    menu_resp = (
        supabase.table("mbg_weekly_menus")
        .select("menu_name, menu_id")
        .eq("tenant_id", tenant_id)
        .eq("week_start", ws.isoformat())
        .eq("day_of_week", dow)
        .limit(1)
        .execute()
    )
    menu_rows = getattr(menu_resp, "data", None) or []
    menu_row = menu_rows[0] if menu_rows else None
    menu_name = (menu_row or {}).get("menu_name")
    menu_id = (menu_row or {}).get("menu_id")

    has_bom = False
    stok_status = "tidak_ada_menu"
    if menu_id:
        bom_chk = (
            supabase.table("recipes")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("menu_id", menu_id)
            .limit(1)
            .execute()
        )
        has_bom = bool(getattr(bom_chk, "data", None))
        stok_status = "tidak_ada_bom" if not has_bom else (
            "dipotong" if deliveries_raw else "tidak_ada_bom"
        )

    # Ambil alokasi
    alloc_resp = (
        supabase.table("mbg_budget_allocations")
        .select("total_revenue, budget_food, budget_labor, budget_ops, allocation_type, budget_raw_material, budget_operational, budget_kitchen_rent")
        .eq("tenant_id", tenant_id)
        .eq("date", target_date.isoformat())
        .limit(1)
        .execute()
    )
    alloc_rows = getattr(alloc_resp, "data", None) or []
    allocation = alloc_rows[0] if alloc_rows else None

    deliveries_clean = []
    
    if deliveries_raw:
        # Jika ada deliveries, gunakan data actual
        deliveries_clean = [
            {
                "id": d.get("id"),
                "school_id": d.get("school_id"),
                "school_name": (d.get("schools") or {}).get("name", "?"),
                "portions_sent": d.get("portions_sent"),
                "receiver_name": d.get("receiver_name"),
                "status": d.get("status"),
                "sent_time": d.get("sent_time"),
                "arrival_time": d.get("arrival_time"),
                "distance_km": float((d.get("schools") or {}).get("distance_km") or 0),
            }
            for d in deliveries_raw
        ]
    else:
        # Jika belum ada delivery, tampilkan schools aktif dengan default_portions (template)
        schools_resp = (
            supabase.table("schools")
            .select("name, default_portions")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .execute()
        )
        schools_list = getattr(schools_resp, "data", None) or []
        deliveries_clean = [
            {
                "school_name": s.get("name", "?"),
                "portions_sent": int(s.get("default_portions", 0)),
                "receiver_name": None,
                "status": "template",  # Belum actual delivery
            }
            for s in schools_list
        ]

    return {
        "success": True,
        "data": {
            "date": target_date.isoformat(),
            "has_delivery": len(deliveries_raw) > 0,
            "total_portions": total_portions,
            "total_schools": len(deliveries_clean),
            "menu_name": menu_name,
            "has_bom": has_bom,
            "deliveries": deliveries_clean,
            "allocation": allocation,
            "stok_status": stok_status,
        },
    }

# ─── GET/POST Driver Telemetry API ──────────────────────────────────────

@delivery_router.post("/driver/depart/{delivery_id}")
def driver_depart(delivery_id: str, current_user: UserInDB = Depends(require_role(["driver", "owner", "admin"]))):
    supabase = get_supabase()
    from datetime import datetime
    now_time = datetime.now().strftime("%H:%M:%S")
    
    del_resp = supabase.table("mbg_deliveries").update(
        {"sent_time": now_time, "status": "delivering"}
    ).eq("id", delivery_id).eq("tenant_id", current_user.tenant_id).execute()
    
    if not del_resp.data:
        raise HTTPException(404, "Delivery record not found.")
        
    return {"success": True, "data": del_resp.data[0]}


@delivery_router.post("/driver/arrive/{delivery_id}")
def driver_arrive(delivery_id: str, current_user: UserInDB = Depends(require_role(["driver", "owner", "admin"]))):
    supabase = get_supabase()
    from datetime import datetime
    now_time = datetime.now().strftime("%H:%M:%S")
    
    del_resp = supabase.table("mbg_deliveries").update(
        {"arrival_time": now_time, "status": "delivered"}
    ).eq("id", delivery_id).eq("tenant_id", current_user.tenant_id).execute()
    
    if not del_resp.data:
        raise HTTPException(404, "Delivery record not found.")
        
    return {"success": True, "data": del_resp.data[0]}

