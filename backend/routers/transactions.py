"""
backend/routers/transactions.py
Endpoints untuk transaksi — Modul 7

Routes:
  POST /transactions/from-photo     → upload foto, push OCR job
  POST /transactions/{id}/confirm   → konfirmasi: update stok, cashflow
  GET  /transactions                → list dengan filter
  GET  /transactions/{id}           → detail + items
  PUT  /transactions/{id}           → edit header
  DELETE /transactions/{id}         → soft delete (status=voided)
"""

import logging
import uuid
import json
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    BackgroundTasks,
    status,
)

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.transaction import (
    ConfirmTransactionRequest,
    PhotoUploadResponse,
    TransactionUpdate,
)
from models.user import UserInDB
from utils.unit_converter import get_base_unit
from workers.ocr_worker import run_ocr_in_background, _send_batch_complete
from services.kas_service import KasService
from services.nutrition_service import nutrition_svc

router = APIRouter(tags=["transactions"])
logger = logging.getLogger(__name__)

# Safety net setelah kompresi di bot side — max 2MB
MAX_PHOTO_BYTES = 2 * 1024 * 1024
ALLOWED_MIME = {"image/jpeg", "image/png", "image/jpg", "image/webp"}


# ─── POST /transactions/from-photo ───────────────────────────────────────────

@router.post(
    "/from-photo",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))],
)
async def upload_photo(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Terima foto nota, upload ke Supabase Storage,
    push async OCR job ke Redis, return transaction_id segera.
    """
    supabase = get_supabase()

    # ─── Validasi file ───────────────────────────────────────────────
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File harus berupa gambar JPEG/PNG. Diterima: {content_type}",
        )

    image_bytes = await file.read()
    if len(image_bytes) > MAX_PHOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ukuran foto maks 10 MB",
        )

    # ─── Upload ke Supabase Storage ──────────────────────────────────
    period_folder = date.today().strftime("%Y-%m")
    ext = "jpg" if "jpeg" in content_type or "jpg" in content_type else "png"
    file_name = f"{uuid.uuid4()}.{ext}"
    storage_path = f"{current_user.tenant_id}/notas/{period_folder}/{file_name}"

    try:
        supabase.storage.from_("nota-photos").upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": content_type},
        )
        # Ambil public URL
        url_resp = supabase.storage.from_("nota-photos").get_public_url(storage_path)
        photo_url = url_resp if isinstance(url_resp, str) else str(url_resp)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload foto gagal: {e}",
        )

    # ─── Insert transaksi dengan status "processing" ──────────────────
    trx_data = {
        "tenant_id": current_user.tenant_id,
        "user_id": current_user.id,
        "type": "expense",
        "source": "telegram_photo",
        "status": "processing",
        "photo_url": photo_url,
        "date": date.today().isoformat(),
        "total": "0.00",
        "pph22_amount": "0.00",   # PPh22 dihitung saat laporan, bukan di sini
        "ppn_amount": "0.00",
        "subtotal": "0.00",
        "discount": "0.00",
    }
    resp = supabase.table("transactions").insert(trx_data).execute()
    data = getattr(resp, "data", None) or []
    if not data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal membuat record transaksi",
        )
    trx_id: str = data[0]["id"]

    # ─── Jadwalkan OCR di background thread (non-blocking) ───────────
    telegram_id: int = current_user.telegram_id or 0
    background_tasks.add_task(
        run_ocr_in_background,
        trx_id,
        photo_url,
        current_user.tenant_id,
        telegram_id,
        None,
        image_bytes,
    )

    return {
        "success": True,
        "data": PhotoUploadResponse(
            transaction_id=trx_id,
            message="Foto diterima, sedang diproses... Kami akan kabari setelah selesai.",
        ).model_dump(),
    }


# ─── POST /transactions/{id}/confirm ─────────────────────────────────────────

@router.post(
    "/{trx_id}/confirm",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))],
)
async def confirm_transaction(
    trx_id: str,
    background_tasks: BackgroundTasks,
    body: ConfirmTransactionRequest = ConfirmTransactionRequest(),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Konfirmasi nota:
      1. Update status = confirmed
      2. Update stok ATOMIC per item yang punya product_id
      3. Insert cashflow_log
      4. Jika hutang → insert payables
      5. Trigger regenerate Excel (background)
    """
    supabase = get_supabase()

    # ─── Ambil transaksi ─────────────────────────────────────────────
    trx_resp = (
        supabase.table("transactions")
        .select("*")
        .eq("id", trx_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )
    trx = getattr(trx_resp, "data", None)
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaksi tidak ditemukan")
    if trx.get("is_locked"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Transaksi terkunci")
    if trx.get("status") not in ("pending_confirm", "processing", "unmapped_hold"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status harus pending_confirm/unmapped_hold, saat ini: {trx.get('status')}",
        )

    # ─── Ambil items ──────────────────────────────────────────────────
    items_resp = (
        supabase.table("transaction_items")
        .select("*")
        .eq("transaction_id", trx_id)
        .execute()
    )
    items: List[dict] = getattr(items_resp, "data", None) or []

    # ─── Match produk (DB) + belajar alias dari nama final ─────────────
    from services.alias_service import alias_service

    for item in items:
        product_id = item.get("product_id")
        product_name = (item.get("product_name") or "").strip()
        ocr_nama = (item.get("ocr_nama_asli") or product_name).strip()

        if not product_id and product_name:
            matched = alias_service.match_product_by_name(
                product_name, current_user.tenant_id, supabase
            )
            if matched:
                product_id = matched["id"]
                item["product_id"] = product_id
                try:
                    supabase.table("transaction_items").update(
                        {"product_id": product_id}
                    ).eq("id", item["id"]).execute()
                except Exception as e:
                    logger.warning(f"Update product_id item gagal: {e}")
            else:
                # Auto-create the product if it doesn't exist
                try:
                    disp_unit = item.get("unit") or "pcs"
                    base, factor = get_base_unit(disp_unit)
                    
                    new_prod_resp = supabase.table("products").insert({
                        "tenant_id": current_user.tenant_id,
                        "name": product_name.strip(),
                        "category": "bahan_baku",
                        "unit": disp_unit,
                        "base_unit": base,
                        "display_unit": disp_unit,
                        "conversion_factor": factor,
                        "harga": float(item.get("price") or 0),
                        "stock_qty": 0.0,
                        "stock_min": 0.0,
                        "is_active": True,
                    }).execute()
                    
                    new_prod_data = getattr(new_prod_resp, "data", None) or []
                    if new_prod_data:
                        product_id = new_prod_data[0]["id"]
                        item["product_id"] = product_id
                        supabase.table("transaction_items").update(
                            {"product_id": product_id}
                        ).eq("id", item["id"]).execute()
                except Exception as e:
                    logger.error(f"Gagal auto-create product {product_name}: {e}")

        alias_service.learn_aliases(
            tenant_id=current_user.tenant_id,
            product_id=product_id,
            names=[ocr_nama, product_name],
            supabase=supabase,
            source="confirm",
        )

    # ─── Resolve / Auto-create Supplier ───────────────────────────────
    trx_supplier_id = trx.get("supplier_id")
    nama_toko_raw = trx.get("nama_toko")
    
    if not trx_supplier_id and nama_toko_raw and nama_toko_raw.strip():
        nama_toko_clean = nama_toko_raw.strip()
        sup_resp = (
            supabase.table("suppliers")
            .select("id")
            .eq("tenant_id", current_user.tenant_id)
            .ilike("name", nama_toko_clean)
            .execute()
        )
        if getattr(sup_resp, "data", None):
            trx_supplier_id = sup_resp.data[0]["id"]
        else:
            try:
                new_sup = supabase.table("suppliers").insert({
                    "tenant_id": current_user.tenant_id,
                    "name": nama_toko_clean,
                    "category": "bahan_pangan",
                    "is_active": True
                }).execute()
                if getattr(new_sup, "data", None):
                    trx_supplier_id = new_sup.data[0]["id"]
            except Exception as e:
                logger.error(f"Gagal auto-create supplier {nama_toko_clean}: {e}")

    # ─── Update status ke confirmed ───────────────────────────────────
    update_payload = {
        "status": "confirmed",
        "notes": body.notes or trx.get("notes"),
        "supplier_id": trx_supplier_id,
    }
    if body.payment_method:
        update_payload["payment_method"] = body.payment_method
        trx["payment_method"] = body.payment_method
    if body.payment_status:
        update_payload["payment_status"] = body.payment_status
        trx["payment_status"] = body.payment_status
    elif body.payment_method == "hutang":
        update_payload["payment_status"] = "belum_lunas"
        trx["payment_status"] = "belum_lunas"
    # Propagate due_date & nama_toko from confirm body
    if body.due_date:
        update_payload["due_date"] = body.due_date
        trx["due_date"] = body.due_date
    if body.nama_toko:
        update_payload["nama_toko"] = body.nama_toko
        trx["nama_toko"] = body.nama_toko

    supabase.table("transactions").update(update_payload).eq("id", trx_id).execute()

    # ─── Update stok ATOMIC via RPC ────────────────────────────────────
    stok_errors: List[str] = []
    for item in items:
        product_id = item.get("product_id")
        if not product_id:
            continue
        qty = Decimal(str(item.get("qty", 0)))
        if qty <= 0:
            continue
        try:
            # Update HPP and reactivate product if soft-deleted
            update_fields = {"is_active": True}
            if item.get("price"):
                update_fields["harga"] = str(item.get("price"))
            
            supabase.table("products").update(update_fields).eq("id", product_id).eq("tenant_id", current_user.tenant_id).execute()

            # Get conversion factor and packaging_value
            prod_resp = (
                supabase.table("products")
                .select("conversion_factor")
                .eq("id", product_id)
                .single()
                .execute()
            )
            factor = float((getattr(prod_resp, "data", None) or {}).get("conversion_factor") or 1)

            # V5: Use packaging_value for stock delta if available
            pkg_val = float(item.get("packaging_value") or 1.0)
            if pkg_val != 1.0:
                # packaging_value override: delta = raw_qty * packaging_value
                qty_base = float(qty) * pkg_val
            else:
                # Fallback to product conversion_factor
                qty_base = float(qty) * factor

            # Stok KELUAR (pembelian bahan = stok masuk) → delta positif
            supabase.rpc("increment_stock", {
                "p_product_id": product_id,
                "p_delta": qty_base,
                "p_tenant_id": current_user.tenant_id,
            }).execute()

            # Insert stock_history (immutable log)
            balance_resp = (
                supabase.table("products")
                .select("stock_qty")
                .eq("id", product_id)
                .eq("tenant_id", current_user.tenant_id)
                .single()
                .execute()
            )
            balance = float((getattr(balance_resp, "data", None) or {}).get("stock_qty", 0))
            supabase.table("stock_history").insert({
                "tenant_id": current_user.tenant_id,
                "product_id": product_id,
                "transaction_id": trx_id,
                "change_qty": str(qty_base),
                "balance_after": str(balance),
                "reason": "purchase",
                "notes": f"Konfirmasi nota {trx.get('ref_number', '')}",
            }).execute()
        except Exception as e:
            logger.error(f"Gagal confirm stok {item.get('product_name', '?')}: {e}")
            stok_errors.append(f"{item.get('product_name', '?')}: {e}")

    # ─── Insert cashflow_log (arus kas keluar) ────────────────────────
    try:
        supabase.table("cashflow_log").insert({
            "tenant_id": current_user.tenant_id,
            "transaction_id": trx_id,
            "flow_type": "out",
            "category": "purchase",
            "amount": trx.get("total", "0.00"),
            "description": f"Nota {trx.get('ref_number', trx_id[:8])}",
            "date": trx.get("date") or date.today().isoformat(),
        }).execute()
    except Exception as e:
        pass  # non-fatal

    # ─── Kas Ledger Double Entry ───────────────────────────────────────
    kas_account_id = trx.get("kas_account_id")
    if kas_account_id:
        try:
            trx_dt = date.fromisoformat(trx.get("date")) if trx.get("date") else date.today()
        except Exception:
            trx_dt = date.today()
            
        try:
            KasService.record_expense(
                tenant_id=current_user.tenant_id,
                transaction_id=trx_id,
                amount=Decimal(str(trx.get("total", "0.00"))),
                kas_account_id=kas_account_id,
                description=f"Belanja nota {trx.get('ref_number', trx_id[:8])}",
                expense_date=trx_dt,
                created_by=current_user.id,
                supabase=supabase,
                reference_type="expense"
            )
        except Exception as e:
            logger.error(f"KasService double entry gagal pada confirm: {e}")

    # ─── Jika hutang → insert payables ───────────────────────────────
    payable_warning = None
    if trx.get("payment_method") == "hutang" or trx.get("payment_status") == "belum_lunas":
        try:
            # Resolve supplier name with better fallback chain
            supplier_name = trx.get("nama_toko") or None
            if trx_supplier_id:
                try:
                    sup_resp = (
                        supabase.table("suppliers")
                        .select("name")
                        .eq("id", trx_supplier_id)
                        .single()
                        .execute()
                    )
                    supplier_name = (getattr(sup_resp, "data", None) or {}).get("name", supplier_name)
                except Exception:
                    pass
            if not supplier_name:
                # Fallback: use ref_number or date-based name
                supplier_name = trx.get("ref_number") or f"Hutang Nota {trx.get('date', date.today().isoformat())}"

            # Auto-calculate due_date if not provided (default: 30 hari)
            payable_due_date = trx.get("due_date")
            if not payable_due_date:
                try:
                    trx_dt = date.fromisoformat(trx.get("date") or date.today().isoformat())
                except ValueError:
                    trx_dt = date.today()
                payable_due_date = (trx_dt + timedelta(days=30)).isoformat()

            supabase.table("payables").insert({
                "tenant_id": current_user.tenant_id,
                "supplier_id": trx_supplier_id,
                "transaction_id": trx_id,
                "supplier_name": supplier_name,
                "amount": trx.get("total", "0.00"),
                "paid_amount": "0.00",
                "due_date": payable_due_date,
                "status": "unpaid",
            }).execute()
            logger.info(f"Payable created for trx {trx_id}: supplier={supplier_name}, amount={trx.get('total')}, due={payable_due_date}")
        except Exception as e:
            logger.error(f"Failed to insert payable during confirm: {e}")
            payable_warning = f"Transaksi dikonfirmasi, tapi hutang gagal tercatat: {str(e)[:200]}"

    result = {"success": True, "transaction_id": trx_id, "status": "confirmed"}
    if stok_errors:
        result["stok_warnings"] = stok_errors
    if payable_warning:
        result["payable_warning"] = payable_warning

    # ─── Trigger regenerate Excel bulan ini (background, fire-and-forget) ──
    from services.export_service import ExportService
    confirmed_date_str = trx.get("date") or date.today().isoformat()
    try:
        confirmed_dt = date.fromisoformat(confirmed_date_str)
    except ValueError:
        confirmed_dt = date.today()
    background_tasks.add_task(
        ExportService().regenerate_monthly_excel,
        current_user.tenant_id,
        confirmed_dt.year,
        confirmed_dt.month,
    )

    return result


# ─── POST /transactions/{id}/re-run-mapping ───────────────────────────────────

@router.post(
    "/{trx_id}/re-run-mapping",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))],
)
def re_run_mapping(
    trx_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Re-run alias matching untuk transaksi yang berstatus unmapped_hold.
    Idempotent: jika status bukan unmapped_hold, langsung return success.
    """
    supabase = get_supabase()

    # Ambil transaksi
    trx_resp = (
        supabase.table("transactions")
        .select("id, status, tenant_id")
        .eq("id", trx_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )
    trx = getattr(trx_resp, "data", None)
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaksi tidak ditemukan")

    # Idempotency check
    if trx.get("status") != "unmapped_hold":
        return {
            "success": True,
            "message": "Transaksi sudah diproses sebelumnya.",
            "status": trx.get("status"),
        }

    # Ambil items yang masih perlu konfirmasi
    items_resp = (
        supabase.table("transaction_items")
        .select("*")
        .eq("transaction_id", trx_id)
        .execute()
    )
    items: List[dict] = getattr(items_resp, "data", None) or []

    from workers.ocr_worker import fuzzy_resolve_product, parse_packaging, get_products_cache, get_aliases_cache
    from utils.unit_converter import is_standard_metric, resolve_standard_unit_conversion
    products_cache = get_products_cache(current_user.tenant_id, supabase)
    aliases_cache = get_aliases_cache(current_user.tenant_id, supabase)

    still_unmapped = False
    resolved_count = 0

    for item in items:
        if not item.get("needs_confirmation"):
            continue

        # Re-run fuzzy matching
        raw_name = item.get("ocr_nama_asli") or item.get("product_name") or ""
        res = fuzzy_resolve_product(
            raw_name,
            current_user.tenant_id,
            supabase,
            products_cache=products_cache,
            aliases_cache=aliases_cache,
        )

        if not res["needs_confirmation"] and res["product_id"]:
            # Item resolved!
            pkg_val, pkg_unit = parse_packaging(raw_name, None)
            pkg_val, pkg_unit = resolve_standard_unit_conversion(pkg_val, pkg_unit)
            
            # Layer 1: Check standard metric units first (kg, g, gr, ons, l, ml, cc, etc.)
            item_unit = (item.get("unit") or "").strip().lower()
            if is_standard_metric(item_unit):
                pkg_val, pkg_unit = resolve_standard_unit_conversion(1.0, item_unit)
            else:
                # Double-Layer Protection: warisi kemasan dari alias jika regex/standard gagal
                if pkg_val == 1.0 and res["packaging_value"] != 1.0:
                    pkg_val = res["packaging_value"]
                    pkg_unit = res["packaging_unit"]
                    # If this inherited packaging unit is a standard unit, normalize it!
                    pkg_val, pkg_unit = resolve_standard_unit_conversion(pkg_val, pkg_unit)

            update_data = {
                "product_id": res["product_id"],
                "product_name": res["product_name"],
                "needs_confirmation": False,
                "packaging_value": str(pkg_val),
                "packaging_unit": pkg_unit,
            }
            try:
                supabase.table("transaction_items").update(update_data).eq("id", item["id"]).execute()
                resolved_count += 1
            except Exception as e:
                logger.error(f"Re-map item update gagal: {e}")
                still_unmapped = True
        else:
            still_unmapped = True

    # Update transaction status
    new_status = "unmapped_hold" if still_unmapped else "pending_confirm"
    supabase.table("transactions").update({"status": new_status}).eq("id", trx_id).execute()

    return {
        "success": True,
        "status": new_status,
        "resolved_count": resolved_count,
        "still_unmapped": still_unmapped,
        "message": "Semua bahan berhasil dipetakan!" if not still_unmapped else "Masih ada bahan yang belum dipetakan.",
    }


# ─── GET /transactions/unmapped-items ─────────────────────────────────────────

@router.get(
    "/unmapped-items",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan", "gizi"]))],
)
def get_unmapped_items(
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Fetch all unmapped transaction items (needs_confirmation=true).
    Searches across both unmapped_hold AND pending_confirm transactions
    to catch items that were missed during re-run mapping.
    Used by the Web Dashboard Penyetelan Dapur > Mapping Bahan tab.
    """
    supabase = get_supabase()

    # Get all transactions that may contain unmapped items
    trx_resp = (
        supabase.table("transactions")
        .select("id, nama_toko, date, total, status, photo_url")
        .eq("tenant_id", current_user.tenant_id)
        .in_("status", ["unmapped_hold", "pending_confirm"])
        .order("created_at", desc=True)
        .execute()
    )
    trx_list = getattr(trx_resp, "data", None) or []

    result = []
    if trx_list:
        # Extract all transaction IDs to batch-query their items
        trx_ids = [trx["id"] for trx in trx_list if "id" in trx]
        if trx_ids:
            items_resp = (
                supabase.table("transaction_items")
                .select("id, transaction_id, product_name, ocr_nama_asli, qty, unit, price, subtotal, needs_confirmation, packaging_value, packaging_unit, product_id")
                .in_("transaction_id", trx_ids)
                .execute()
            )
            items_list = getattr(items_resp, "data", None) or []

            # Group items by transaction_id
            from collections import defaultdict
            items_by_trx = defaultdict(list)
            for item in items_list:
                items_by_trx[item["transaction_id"]].append(item)

            # Build result: include transactions so users can map items & explicitly confirm transactions
            for trx in trx_list:
                tid = trx.get("id")
                all_items = items_by_trx.get(tid, [])
                if not all_items:
                    continue

                unmapped = [i for i in all_items if i.get("needs_confirmation")]
                recognized = [i for i in all_items if not i.get("needs_confirmation")]

                result.append({
                    "transaction": trx,
                    "unmapped_items": unmapped,
                    "recognized_items": recognized,
                })

    return {"success": True, "data": result}


# ─── POST /transactions/map-item ──────────────────────────────────────────────

@router.post(
    "/map-item",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan", "gizi"]))],
)
def map_item(
    body: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Map a single unmapped transaction_item to a product.
    Creates/updates product_alias with packaging info.
    
    Body:
      - item_id: str (transaction_items.id)
      - product_id: str (products.id to map to)
      - packaging_value: float (e.g. 520)
      - packaging_unit: str (e.g. "ml")
    """
    supabase = get_supabase()

    from utils.unit_converter import resolve_standard_unit_conversion
    item_id = body.get("item_id")
    product_id = body.get("product_id")
    pkg_val = float(body.get("packaging_value", 1.0))
    pkg_unit = body.get("packaging_unit", "pcs")
    pkg_val, pkg_unit = resolve_standard_unit_conversion(pkg_val, pkg_unit)

    if not item_id or not product_id:
        raise HTTPException(status_code=422, detail="item_id dan product_id wajib diisi")

    # Fetch the item
    item_resp = (
        supabase.table("transaction_items")
        .select("id, ocr_nama_asli, product_name, transaction_id, tenant_id, unit, product_id, needs_confirmation, qty, packaging_value")
        .eq("id", item_id)
        .single()
        .execute()
    )
    item = getattr(item_resp, "data", None)
    if not item or item.get("tenant_id") != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")

    # Fetch the product name
    prod_resp = (
        supabase.table("products")
        .select("id, name, nutrition_ref_id")
        .eq("id", product_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )
    product = getattr(prod_resp, "data", None)
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")

    # Update the transaction item
    supabase.table("transaction_items").update({
        "product_id": product_id,
        "product_name": product["name"],
        "needs_confirmation": False,
        "packaging_value": str(pkg_val),
        "packaging_unit": pkg_unit,
    }).eq("id", item_id).execute()

    # Upsert product_alias with packaging info (atomic, prevents race conditions)
    alias_name = (item.get("ocr_nama_asli") or item.get("product_name") or "").strip()
    if alias_name:
        try:
            alias_data = {
                "tenant_id": current_user.tenant_id,
                "product_id": product_id,
                "alias_name": alias_name,
                "source": "web_mapping",
                "packaging_value": pkg_val,
                "packaging_unit": pkg_unit,
            }
            supabase.table("product_aliases").upsert(alias_data, on_conflict="tenant_id,alias_name").execute()
        except Exception as e:
            logger.warning(f"Gagal upsert alias '{alias_name}': {e}")

    # Auto-create ingredient_unit_weights for ambiguous units
    original_unit = body.get("original_unit")
    if not original_unit:
        original_unit = item.get("unit")
    original_unit = (original_unit or "").strip().lower()

    resolved_weight_gram = body.get("resolved_weight_gram")
    if resolved_weight_gram is None:
        resolved_weight_gram = float(pkg_val) if pkg_unit in ("gram", "ml") else 1.0
    else:
        resolved_weight_gram = float(resolved_weight_gram)

    from utils.unit_converter import is_ambiguous_unit
    if original_unit and is_ambiguous_unit(original_unit):
        nut_id = product.get("nutrition_ref_id")
        if nut_id:
            try:
                # Find the master ingredient ID
                master_resp = (
                    supabase.table("master_ingredients")
                    .select("id")
                    .eq("nutrition_ref_id", int(nut_id))
                    .limit(1)
                    .execute()
                )
                master_data = getattr(master_resp, "data", None)
                if master_data:
                    ingredient_id = master_data[0]["id"]
                    
                    # Upsert to make it permanent for this ingredient (atomic, prevents race conditions)
                    unit_weight_data = {
                        "ingredient_id": ingredient_id,
                        "unit": original_unit,
                        "weight_gram": resolved_weight_gram,
                        "source": "user_mapping"
                    }
                    supabase.table("ingredient_unit_weights").upsert(
                        unit_weight_data, 
                        on_conflict="ingredient_id, unit"
                    ).execute()
                    logger.info(f"Upserted unit weight mapping: 1 {original_unit} = {resolved_weight_gram} g/ml for ingredient {ingredient_id}")
            except Exception as e:
                logger.warning(f"Gagal auto-create ingredient_unit_weights untuk '{original_unit}': {e}")

    # Check if all items in the transaction are now mapped
    trx_id = item.get("transaction_id")
    
    # Fetch transaction details to check status and metadata
    trx_resp = (
        supabase.table("transactions")
        .select("id, status, ref_number")
        .eq("id", trx_id)
        .single()
        .execute()
    )
    trx = getattr(trx_resp, "data", None) or {}

    # If the transaction has already been confirmed, we must adjust the stock.
    if trx.get("status") == "confirmed":
        try:
            qty = float(item.get("qty") or 1.0)
            
            # 1. Decrement old product's stock if it was already mapped
            old_product_id = item.get("product_id")
            was_mapped = not item.get("needs_confirmation", True)
            
            if was_mapped and old_product_id:
                old_pkg_val = float(item.get("packaging_value") or 1.0)
                old_qty_base = qty * old_pkg_val
                
                # Decrement old stock
                supabase.rpc("increment_stock", {
                    "p_product_id": old_product_id,
                    "p_delta": -old_qty_base,
                    "p_tenant_id": current_user.tenant_id,
                }).execute()
                
                # Log decrement to stock history
                try:
                    bal_resp_old = (
                        supabase.table("products")
                        .select("stock_qty")
                        .eq("id", old_product_id)
                        .single()
                        .execute()
                    )
                    balance_old = float((getattr(bal_resp_old, "data", None) or {}).get("stock_qty", 0))
                    
                    supabase.table("stock_history").insert({
                        "tenant_id": current_user.tenant_id,
                        "product_id": old_product_id,
                        "transaction_id": trx_id,
                        "change_qty": str(-old_qty_base),
                        "balance_after": str(balance_old),
                        "reason": "purchase",
                        "notes": f"Penyesuaian stok pasca-pemetaan ulang (nota {trx.get('ref_number', '')})",
                    }).execute()
                except Exception as ex:
                    logger.warning(f"Gagal log stock history pengurangan: {ex}")
            
            # 2. Increment new product's stock
            qty_base = qty * pkg_val
            
            # Atomic increment
            supabase.rpc("increment_stock", {
                "p_product_id": product_id,
                "p_delta": qty_base,
                "p_tenant_id": current_user.tenant_id,
            }).execute()
            
            # Query updated stock balance for history log
            bal_resp = (
                supabase.table("products")
                .select("stock_qty")
                .eq("id", product_id)
                .single()
                .execute()
            )
            balance = float((getattr(bal_resp, "data", None) or {}).get("stock_qty", 0))
            
            # Insert to stock_history
            supabase.table("stock_history").insert({
                "tenant_id": current_user.tenant_id,
                "product_id": product_id,
                "transaction_id": trx_id,
                "change_qty": str(qty_base),
                "balance_after": str(balance),
                "reason": "purchase",
                "notes": f"Pemetaan bahan tertunda (nota {trx.get('ref_number', '')})",
            }).execute()
            logger.info(f"Updated stock for product {product_id} with qty_base {qty_base} (trx confirmed)")
        except Exception as e:
            logger.error(f"Gagal update stok pasca-pemetaan untuk product {product_id}: {e}")

    remaining_resp = (
        supabase.table("transaction_items")
        .select("id")
        .eq("transaction_id", trx_id)
        .eq("needs_confirmation", True)
        .execute()
    )
    remaining = getattr(remaining_resp, "data", None) or []

    if not remaining and trx.get("status") != "confirmed":
        # All mapped → update transaction status to pending_confirm (only if not already confirmed)
        supabase.table("transactions").update({"status": "pending_confirm"}).eq("id", trx_id).execute()

    return {
        "success": True,
        "product_name": product["name"],
        "all_mapped": len(remaining) == 0,
    }


@router.get("", response_model=Dict[str, Any])
def list_transactions(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: UserInDB = Depends(get_current_user),
):
    """List transaksi dengan filter dan paginasi."""
    supabase = get_supabase()

    q = (
        supabase.table("transactions")
        .select("*", count="exact")
        .eq("tenant_id", current_user.tenant_id)
        .order("created_at", desc=True)
    )

    if date_from:
        q = q.gte("date", date_from)
    if date_to:
        q = q.lte("date", date_to)
    if status:
        q = q.eq("status", status)
    if type:
        q = q.eq("type", type)
    if search:
        q = q.ilike("nama_toko", f"%{search}%")

    resp = q.range(offset, offset + limit - 1).execute()
    data = getattr(resp, "data", None) or []
    count = getattr(resp, "count", len(data))

    return {
        "success": True,
        "total": count,
        "limit": limit,
        "offset": offset,
        "data": data,
    }


# ─── GET /transactions/{id} ───────────────────────────────────────────────────

@router.get("/{trx_id}", response_model=Dict[str, Any])
def get_transaction(
    trx_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Detail transaksi + items + validation flags."""
    supabase = get_supabase()

    trx_resp = (
        supabase.table("transactions")
        .select("*")
        .eq("id", trx_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )
    trx = getattr(trx_resp, "data", None)
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaksi tidak ditemukan")

    items_resp = (
        supabase.table("transaction_items")
        .select("*")
        .eq("transaction_id", trx_id)
        .execute()
    )
    items = getattr(items_resp, "data", None) or []

    val_resp = (
        supabase.table("nota_validations")
        .select("flags, result")
        .eq("transaction_id", trx_id)
        .limit(1)
        .execute()
    )
    val_rows = getattr(val_resp, "data", None) or []
    val_data = val_rows[0] if val_rows else {}

    trx["items"] = items
    trx["validation_result"] = val_data.get("result")
    trx["validation_flags"] = (val_data.get("flags") or {}).get("flags", [])
    trx["validation_warnings"] = (val_data.get("flags") or {}).get("warnings", [])

    return {"success": True, "data": trx}


# ─── PUT /transactions/{id} ───────────────────────────────────────────────────

@router.put(
    "/{trx_id}",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def update_transaction(
    trx_id: str,
    body: TransactionUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Edit header transaksi (jika belum locked)."""
    supabase = get_supabase()

    # Cek lock
    trx_resp = (
        supabase.table("transactions")
        .select("is_locked, tenant_id")
        .eq("id", trx_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )
    trx = getattr(trx_resp, "data", None)
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaksi tidak ditemukan")
    if trx.get("is_locked"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Transaksi terkunci")

    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tidak ada data yang diupdate")

    resp = (
        supabase.table("transactions")
        .update(update_data)
        .eq("id", trx_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    data = getattr(resp, "data", None) or []
    return {"success": True, "data": data[0] if data else {}}


# ─── DELETE /transactions/{id} ────────────────────────────────────────────────

@router.delete(
    "/{trx_id}",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))],
)
def delete_transaction(
    trx_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Soft delete / void transaction with full cascading cleanup (revert stock, ledger, and payables)."""
    supabase = get_supabase()

    trx_resp = (
        supabase.table("transactions")
        .select("id, status, ref_number, is_locked, tenant_id")
        .eq("id", trx_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )
    trx = getattr(trx_resp, "data", None)
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaksi tidak ditemukan")
    if trx.get("is_locked"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Transaksi terkunci, tidak bisa dihapus")

    trx_status = trx.get("status")

    # If the transaction was confirmed, cascade rollback stock, ledger, & payables
    if trx_status == "confirmed":
        try:
            items_resp = (
                supabase.table("transaction_items")
                .select("product_id, qty, packaging_value, needs_confirmation")
                .eq("transaction_id", trx_id)
                .execute()
            )
            items = getattr(items_resp, "data", None) or []

            for item in items:
                product_id = item.get("product_id")
                needs_conf = item.get("needs_confirmation")
                if product_id and not needs_conf:
                    qty = float(item.get("qty") or 0.0)
                    pkg_val = float(item.get("packaging_value") or 1.0)
                    qty_base = qty * pkg_val
                    if qty_base > 0:
                        # Revert stock (delta = -qty_base)
                        supabase.rpc("increment_stock", {
                            "p_product_id": product_id,
                            "p_delta": -qty_base,
                            "p_tenant_id": current_user.tenant_id,
                        }).execute()

                        # Get balance after for history log
                        bal_resp = (
                            supabase.table("products")
                            .select("stock_qty")
                            .eq("id", product_id)
                            .single()
                            .execute()
                        )
                        balance = float((getattr(bal_resp, "data", None) or {}).get("stock_qty", 0))

                        # Log reversal in stock_history
                        supabase.table("stock_history").insert({
                            "tenant_id": current_user.tenant_id,
                            "product_id": product_id,
                            "transaction_id": trx_id,
                            "change_qty": str(-qty_base),
                            "balance_after": str(balance),
                            "reason": "correction",
                            "notes": f"Pengurangan stok akibat penghapusan/pembatalan nota (ref: {trx.get('ref_number', '')})",
                        }).execute()
        except Exception as e:
            logger.warning(f"Gagal revert stok untuk transaksi {trx_id}: {e}")

        # Cleanup accounting_ledger entries
        try:
            supabase.table("accounting_ledger").delete().eq("reference_type", "transaction").eq("reference_id", trx_id).execute()
        except Exception as e:
            logger.warning(f"Gagal cleanup accounting_ledger untuk transaksi {trx_id}: {e}")

        # Cleanup payables entries
        try:
            supabase.table("payables").delete().eq("transaction_id", trx_id).execute()
        except Exception as e:
            logger.warning(f"Gagal cleanup payables untuk transaksi {trx_id}: {e}")

    # Set status = voided
    supabase.table("transactions").update({"status": "voided"}).eq(
        "id", trx_id
    ).eq("tenant_id", current_user.tenant_id).execute()

    return {"success": True, "message": "Transaksi berhasil dibatalkan dan data terkait telah dibersihkan."}


# ─── POST /transactions/from-photo-batch ─────────────────────────────────────

@router.post(
    "/from-photo-batch",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))],
)
async def upload_photo_batch(
    background_tasks: BackgroundTasks,
    batch_id: str = File(...),
    files: List[UploadFile] = File(...),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Terima 1-5 foto sekaligus.
    Tiap foto diproses independen — error 1 foto tidak hentikan lainnya.
    Membuat 1 record photo_batches yang mengaggregasi semua transaksi.
    """
    supabase = get_supabase()

    # ─── Validasi jumlah foto ─────────────────────────────────────────
    if not files:
        raise HTTPException(status_code=422, detail="Tidak ada foto yang dikirim")
    if len(files) > 10:
        raise HTTPException(status_code=422, detail="Maksimum 10 foto per batch")

    batch_photos: List[dict] = []
    trx_ids: List[str] = []
    period_folder = date.today().strftime("%Y-%m")
    telegram_id: int = current_user.telegram_id or 0

    # ─── Proses tiap foto ────────────────────────────────────────────
    for file in files:
        content_type = file.content_type or ""
        error_msg = None

        if content_type not in ALLOWED_MIME:
            error_msg = f"Tipe file tidak didukung: {content_type}"
        else:
            try:
                image_bytes = await file.read()
                if len(image_bytes) > MAX_PHOTO_BYTES:
                    error_msg = "Foto terlalu besar (max 2MB). Kompres foto sebelum kirim."
            except Exception as e:
                error_msg = f"Gagal membaca file: {e}"

        if error_msg:
            # Insert failed transaction immediately so it's tracked in the batch
            trx_data = {
                "tenant_id": current_user.tenant_id,
                "user_id": current_user.id,
                "type": "expense",
                "source": "telegram_photo",
                "status": "failed",
                "photo_url": "",
                "date": date.today().isoformat(),
                "total": "0.00",
                "pph22_amount": "0.00",
                "ppn_amount": "0.00",
                "subtotal": "0.00",
                "discount": "0.00",
                "notes": f"[OCR] {error_msg}",
            }
            try:
                resp = supabase.table("transactions").insert(trx_data).execute()
                data = getattr(resp, "data", None) or []
                if data:
                    trx_id = data[0]["id"]
                    trx_ids.append(trx_id)
            except Exception as e:
                logger.error(f"Gagal insert transaksi failed: {e}")

            batch_photos.append({
                "status": "failed",
                "error_message": error_msg,
            })
            continue

        # Upload ke Supabase Storage
        ext = "jpg" if "jpeg" in content_type or "jpg" in content_type else "png"
        file_name = f"{uuid.uuid4()}.{ext}"
        storage_path = f"{current_user.tenant_id}/notas/{period_folder}/{file_name}"
        try:
            supabase.storage.from_("nota-photos").upload(
                path=storage_path,
                file=image_bytes,
                file_options={"content-type": content_type},
            )
            url_resp = supabase.storage.from_("nota-photos").get_public_url(storage_path)
            photo_url = url_resp if isinstance(url_resp, str) else str(url_resp)
        except Exception as e:
            error_msg = f"Upload gagal: {e}"
            trx_data = {
                "tenant_id": current_user.tenant_id,
                "user_id": current_user.id,
                "type": "expense",
                "source": "telegram_photo",
                "status": "failed",
                "photo_url": "",
                "date": date.today().isoformat(),
                "total": "0.00",
                "pph22_amount": "0.00",
                "ppn_amount": "0.00",
                "subtotal": "0.00",
                "discount": "0.00",
                "notes": f"[OCR] {error_msg}",
            }
            try:
                resp = supabase.table("transactions").insert(trx_data).execute()
                data = getattr(resp, "data", None) or []
                if data:
                    trx_id = data[0]["id"]
                    trx_ids.append(trx_id)
            except Exception as e2:
                logger.error(f"Gagal insert transaksi failed (upload): {e2}")

            batch_photos.append({"status": "failed", "error_message": error_msg})
            continue

        # Insert transaksi record
        trx_data = {
            "tenant_id": current_user.tenant_id,
            "user_id": current_user.id,
            "type": "expense",
            "source": "telegram_photo",
            "status": "processing",
            "photo_url": photo_url,
            "date": date.today().isoformat(),
            "total": "0.00",
            "pph22_amount": "0.00",
            "ppn_amount": "0.00",
            "subtotal": "0.00",
            "discount": "0.00",
        }
        resp = supabase.table("transactions").insert(trx_data).execute()
        data = getattr(resp, "data", None) or []
        if not data:
            batch_photos.append({"status": "failed", "error_message": "Gagal insert transaksi"})
            continue

        trx_id = data[0]["id"]
        trx_ids.append(trx_id)
        batch_photos.append({
            "trx_id": trx_id,
            "photo_url": photo_url,
            "status": "processing",
        })

        # Simpan URL dan ID untuk background tasks nanti
        if not hasattr(current_user, "_temp_tasks"):
            current_user._temp_tasks = []
        current_user._temp_tasks.append((trx_id, photo_url, image_bytes))

    # ─── Insert photo_batches record SEBELUM background tasks ──────────
    from datetime import datetime, timedelta, timezone
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    total_valid = len(current_user._temp_tasks) if hasattr(current_user, "_temp_tasks") else 0
    total_failed = len(files) - total_valid

    batch_status = "done" if total_valid == 0 else "processing"

    try:
        supabase.table("photo_batches").insert({
            "id": batch_id,
            "tenant_id": current_user.tenant_id,
            "user_id": current_user.id,
            "total_photos": len(files),
            "processed_photos": total_failed,
            "status": batch_status,
            "collection_timeout": expires_at,
            "notes": json.dumps(trx_ids),
        }).execute()
    except Exception as e:
        logger.error(f"Gagal membuar record photo_batches [{batch_id}]: {e}")
        pass

    # ─── Enqueue OCR background tasks SETELAH batch ditulis ke DB ──────
    if total_valid > 0:
        if hasattr(current_user, "_temp_tasks"):
            for t_id, p_url, img_bytes in current_user._temp_tasks:
                background_tasks.add_task(
                    run_ocr_in_background,
                    t_id,
                    p_url,
                    current_user.tenant_id,
                    telegram_id,
                    batch_id,
                    img_bytes,
                )
            del current_user._temp_tasks
    else:
        # Semua foto gagal langsung — kirim notif complete langsung
        background_tasks.add_task(
            _send_batch_complete,
            batch_id=batch_id,
            telegram_id=telegram_id,
            bot_token=settings.telegram_bot_token or "",
            supabase=supabase,
            tenant_id=current_user.tenant_id,
            total=len(files),
            processed=0,
            failed=total_failed,
            trx_ids=trx_ids,
        )

    return {
        "success": True,
        "data": {
            "batch_id": batch_id,
            "total": len(files),
            "accepted": total_valid,
            "failed_immediately": total_failed,
            "transaction_ids": trx_ids,
            "message": f"Memproses {total_valid} foto... Kami akan kabari setelah selesai." if total_valid > 0 else "Semua foto gagal diproses langsung.",
        },
    }


# ─── GET /transactions/batch/{batch_id} ──────────────────────────────────────

@router.get(
    "/batch/{batch_id}",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))],
)
def get_batch_status(
    batch_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Status batch + detail tiap foto."""
    supabase = get_supabase()

    batch_resp = (
        supabase.table("photo_batches")
        .select("*")
        .eq("id", batch_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )
    batch = getattr(batch_resp, "data", None)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan")

    # Enrich tiap foto dengan data transaksi terbaru
    notes_raw = batch.get("notes") or "[]"
    try:
        trx_ids_in_batch = json.loads(notes_raw) if isinstance(notes_raw, str) else (notes_raw or [])
    except Exception:
        trx_ids_in_batch = []

    if not isinstance(trx_ids_in_batch, list):
        trx_ids_in_batch = []

    photos_raw = []
    if trx_ids_in_batch:
        trx_resp = (
            supabase.table("transactions")
            .select("id, status, nama_toko, total, photo_url")
            .in_("id", trx_ids_in_batch)
            .execute()
        )
        trx_list = getattr(trx_resp, "data", None) or []
        for trx in trx_list:
            photos_raw.append({
                "trx_id": trx["id"],
                "photo_url": trx.get("photo_url"),
                "status": trx.get("status"),
                "nama_toko": trx.get("nama_toko"),
                "total": trx.get("total"),
            })

    processed = batch.get("processed_photos", 0)
    total = batch.get("total_photos", 0)
    failed = max(0, total - processed)
    is_complete = processed >= total

    return {
        "success": True,
        "data": {
            "batch_id": batch_id,
            "status": batch.get("status"),
            "total_photos": total,
            "processed": processed,
            "failed": failed,
            "is_complete": is_complete,
            "photos": photos_raw,
        },
    }


# ─── PUT /transactions/{trx_id}/items/bulk ───────────────────────────────────

@router.put(
    "/{trx_id}/items/bulk",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))],
)
def update_transaction_items_bulk(
    trx_id: str,
    body: List[Dict[str, Any]],
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Replace ALL items for a transaction (Bulk text edit).
    Recalculates total and subtotal for the transaction.
    """
    supabase = get_supabase()

    # Check lock
    trx_resp = (
        supabase.table("transactions")
        .select("is_locked, tenant_id")
        .eq("id", trx_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )
    trx = getattr(trx_resp, "data", None)
    if not trx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if trx.get("is_locked"):
        raise HTTPException(status_code=403, detail="Transaksi terkunci")

    if not body:
        raise HTTPException(status_code=422, detail="Daftar item tidak boleh kosong")

    # 1. Parse and validate new items
    new_items = []
    total_amount = Decimal("0.00")
    for b in body:
        qty = b.get("qty")
        harga = b.get("harga_satuan") or b.get("price")
        nama = b.get("nama_item") or b.get("product_name") or "Item"
        satuan = b.get("satuan") or b.get("unit") or "pcs"
        
        if qty is None or harga is None:
            raise HTTPException(status_code=422, detail="qty dan harga wajib diisi untuk semua item")
        try:
            qty_dec = Decimal(str(qty))
            harga_dec = Decimal(str(harga))
            if qty_dec <= 0 or harga_dec < 0:
                raise ValueError
        except Exception:
            raise HTTPException(status_code=422, detail="qty dan harga harus angka positif")
            
        subtotal = (qty_dec * harga_dec).quantize(Decimal("0.01"))
        total_amount += subtotal
        
        # Note: We don't have product_id mapping here. For manual text edits, 
        # it is safer to leave product_id as null, or we could run JuknisService match again. 
        # But for speed, let's just insert them raw. They will be treated as raw items.
        # Sesuai plan: user edit raw text, product mapping might be lost unless matched.
        new_items.append({
            "transaction_id": trx_id,
            "tenant_id": current_user.tenant_id,
            "product_name": str(nama),
            "qty": str(qty_dec),
            "unit": str(satuan),
            "price": str(harga_dec),
            "subtotal": str(subtotal),
        })

    # 2. Delete existing items
    supabase.table("transaction_items").delete().eq("transaction_id", trx_id).execute()

    # 3. Insert new items
    supabase.table("transaction_items").insert(new_items).execute()

    # 4. Update Header Transaksi
    supabase.table("transactions").update({
        "total": str(total_amount),
        "subtotal": str(total_amount),
    }).eq("id", trx_id).eq("tenant_id", current_user.tenant_id).execute()

    return {
        "success": True, 
        "message": "Seluruh item berhasil diupdate",
        "new_total": str(total_amount)
    }

# ─── PUT /transactions/{trx_id}/items/{item_id} ──────────────────────────────

@router.put(
    "/{trx_id}/items/{item_id}",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))],
)
def update_transaction_item(
    trx_id: str,
    item_id: str,
    body: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Edit qty dan harga_satuan satu item, lalu recalculate total transaksi.
    Cek is_locked sebelum update.
    """
    supabase = get_supabase()

    # Cek lock
    trx_resp = (
        supabase.table("transactions")
        .select("is_locked, tenant_id")
        .eq("id", trx_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )
    trx = getattr(trx_resp, "data", None)
    if not trx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if trx.get("is_locked"):
        raise HTTPException(status_code=403, detail="Transaksi terkunci")

    # Fetch current item if some fields are missing
    item_resp_get = (
        supabase.table("transaction_items")
        .select("*")
        .eq("id", item_id)
        .eq("transaction_id", trx_id)
        .execute()
    )
    current_items = getattr(item_resp_get, "data", None) or []
    if not current_items:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    current_item = current_items[0]

    qty = body.get("qty") if body.get("qty") is not None else current_item.get("qty")
    harga = body.get("harga_satuan") if body.get("harga_satuan") is not None else (body.get("price") if body.get("price") is not None else current_item.get("price"))
    
    try:
        qty_dec = Decimal(str(qty))
        harga_dec = Decimal(str(harga))
        if qty_dec <= 0 or harga_dec < 0:
            raise ValueError
    except Exception:
        raise HTTPException(status_code=422, detail="qty dan harga_satuan harus angka positif")

    subtotal = (qty_dec * harga_dec).quantize(Decimal("0.01"))

    # Update item
    item_update: Dict[str, Any] = {
        "qty": str(qty_dec),
        "price": str(harga_dec),
        "subtotal": str(subtotal),
    }
    
    if "ocr_nama_asli" in body:
        item_update["ocr_nama_asli"] = body["ocr_nama_asli"]
        if "product_name" not in body:
            item_update["product_name"] = body["ocr_nama_asli"]
    if "product_name" in body:
        item_update["product_name"] = body["product_name"]
    if "nama_item" in body:
        item_update["product_name"] = body["nama_item"]
    if "unit" in body:
        item_update["unit"] = body["unit"]

    item_resp = (
        supabase.table("transaction_items")
        .update(item_update)
        .eq("id", item_id)
        .eq("transaction_id", trx_id)
        .execute()
    )
    updated_item = (getattr(item_resp, "data", None) or [{}])[0]

    # Recalculate total semua items
    all_items_resp = (
        supabase.table("transaction_items")
        .select("subtotal")
        .eq("transaction_id", trx_id)
        .execute()
    )
    all_items = getattr(all_items_resp, "data", None) or []
    new_total = sum(Decimal(str(i.get("subtotal", 0))) for i in all_items)

    supabase.table("transactions").update({
        "total": str(new_total.quantize(Decimal("0.01"))),
    }).eq("id", trx_id).execute()

    return {
        "success": True,
        "data": {
            **updated_item,
            "subtotal": str(subtotal),
        },
        "new_total": str(new_total.quantize(Decimal("0.01"))),
    }


# ─── POST /transactions/manual ────────────────────────────────────────────────

@router.post(
    "/manual",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))],
)
async def create_manual_transaction(
    background_tasks: BackgroundTasks,
    body: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Input belanja manual tanpa foto.
    Status langsung 'confirmed'. Trigger stok, cashflow, payables, Excel.
    """
    supabase = get_supabase()
    from services.alias_service import AliasService
    alias_svc = AliasService()

    # ─── Validasi ─────────────────────────────────────────────────────
    items_input: List[dict] = body.get("items", [])
    if not items_input:
        raise HTTPException(status_code=422, detail="items tidak boleh kosong")

    trx_date = body.get("date") or date.today().isoformat()
    payment_method = body.get("payment_method", "tunai")
    due_date = body.get("due_date") or None
    notes = body.get("notes") or None

    # ─── Insert transaksi (status=confirmed langsung) ─────────────────
    supplier_name = body.get("supplier_name") or None
    supplier_id = None

    # ─── Auto-create / resolve supplier ──────────────────────────────
    if supplier_name and supplier_name.strip():
        supplier_name_clean = supplier_name.strip()
        sup_resp = (
            supabase.table("suppliers")
            .select("id")
            .eq("tenant_id", current_user.tenant_id)
            .ilike("name", supplier_name_clean)
            .execute()
        )
        if getattr(sup_resp, "data", None):
            supplier_id = sup_resp.data[0]["id"]
        else:
            try:
                new_sup = supabase.table("suppliers").insert({
                    "tenant_id": current_user.tenant_id,
                    "name": supplier_name_clean,
                    "category": "bahan_pangan",
                    "is_active": True
                }).execute()
                if getattr(new_sup, "data", None):
                    supplier_id = new_sup.data[0]["id"]
                    logger.info(f"Auto-created supplier '{supplier_name_clean}' with id={supplier_id}")
            except Exception as e:
                logger.error(f"Gagal auto-create supplier '{supplier_name_clean}': {e}")

    # ─── Juknis auto-categorize ──────────────────────────────────────
    from services.juknis_service import auto_categorize
    juknis_cat = body.get("juknis_category") or auto_categorize(
        [it.get("nama_item", "") for it in items_input]
    )
    kas_account_id = body.get("kas_account_id") or None

    trx_data = {
        "tenant_id": current_user.tenant_id,
        "user_id": current_user.id,
        "type": "expense",
        "source": "telegram_manual",
        "status": "confirmed",
        "date": trx_date,
        "nama_toko": supplier_name,
        "supplier_id": supplier_id,
        "payment_method": payment_method,
        "due_date": due_date,
        "notes": f"Toko: {supplier_name or '-'} | Bayar: {payment_method}" + (f" | {notes}" if notes else ""),
        "pph22_amount": "0.00",
        "ppn_amount": "0.00",
        "discount": "0.00",
        "total": "0.00",
        "subtotal": "0.00",
        "juknis_category": juknis_cat,
        "kas_account_id": kas_account_id,
        "transaction_type": "debit",
    }
    resp = supabase.table("transactions").insert(trx_data).execute()
    data = getattr(resp, "data", None) or []
    if not data:
        raise HTTPException(status_code=500, detail="Gagal membuat transaksi")
    trx_id: str = data[0]["id"]

    # ─── Insert items + stok ──────────────────────────────────────────
    grand_total = Decimal("0")
    stok_errors: List[str] = []

    for item_in in items_input:
        nama_asli: str = item_in.get("nama_item", "")
        qty = Decimal(str(item_in.get("qty", 1)))
        satuan = item_in.get("satuan", "pcs")
        harga = Decimal(str(item_in.get("harga_satuan", 0)))
        subtotal = (qty * harga).quantize(Decimal("0.01"))
        grand_total += subtotal

        # Resolve alias
        alias_result = alias_svc.resolve(nama_asli, current_user.tenant_id, supabase)
        product_id = alias_result.get("product_id")
        product_name = alias_result.get("product_name") or nama_asli

        # Jika produk belum ada, buat otomatis sebagai bahan_baku
        if not product_id:
            try:
                # ─── Check if product with same name already exists ───
                existing_check = (
                    supabase.table("products")
                    .select("id")
                    .eq("tenant_id", current_user.tenant_id)
                    .ilike("name", product_name.strip())
                    .limit(1)
                    .execute()
                )
                existing_prods = getattr(existing_check, "data", None) or []

                if existing_prods:
                    # Reuse existing product instead of creating duplicate
                    product_id = existing_prods[0]["id"]
                else:
                    # Create new product
                    base, c_factor = get_base_unit(satuan)
                    new_prod_resp = supabase.table("products").insert({
                        "tenant_id": current_user.tenant_id,
                        "name": product_name.strip(),
                        "category": "bahan_baku",
                        "unit": satuan,
                        "base_unit": base,
                        "display_unit": satuan,
                        "conversion_factor": float(c_factor),
                        "is_active": True,
                        "harga": str(harga),
                        "sell_price": "0.00",
                        "stock_min": "0",
                        "stock_qty": "0" 
                    }).execute()
                    new_prod_data = getattr(new_prod_resp, "data", None) or []
                    if new_prod_data:
                        product_id = new_prod_data[0]["id"]
                    
                    # Auto-map and link nutrition in background
                    background_tasks.add_task(
                        nutrition_svc.map_and_link_product,
                        get_supabase(),
                        product_id,
                        product_name,
                        satuan,
                        current_user.tenant_id
                    )
                    
            except Exception as e:
                logger.error(f"Auto-create gagal untuk '{product_name}': {e}")
                stok_errors.append(f"Gagal auto-create produk '{product_name}': {e}")

        # ─── 3-Layer Unit Resolution (same as OCR workflow) ───────────
        from utils.unit_converter import (
            is_standard_metric, resolve_standard_unit_conversion,
            is_ambiguous_unit
        )

        pkg_val = 1.0
        pkg_unit = satuan
        applied_custom_unit = False
        sat_clean = (satuan or "").strip().lower()

        # Layer 1: Standard metric units (kg→1000g, ons→100g, etc.)
        if is_standard_metric(sat_clean):
            pkg_val, pkg_unit = resolve_standard_unit_conversion(1.0, sat_clean)
            applied_custom_unit = True

        # Layer 2 & 2.5: Custom + Global ingredient_unit_weights
        if not applied_custom_unit and product_id:
            try:
                nut_id = None
                prod_nut_resp = (
                    supabase.table("products")
                    .select("nutrition_ref_id")
                    .eq("id", product_id)
                    .single()
                    .execute()
                )
                nut_id = (getattr(prod_nut_resp, "data", None) or {}).get("nutrition_ref_id")

                if nut_id:
                    master_res = (
                        supabase.table("master_ingredients")
                        .select("id")
                        .eq("nutrition_ref_id", int(nut_id))
                        .limit(1)
                        .execute()
                    )
                    if getattr(master_res, "data", None):
                        ing_id = master_res.data[0]["id"]
                        unit_weight_resp = (
                            supabase.table("ingredient_unit_weights")
                            .select("weight_gram")
                            .eq("ingredient_id", ing_id)
                            .ilike("unit", sat_clean)
                            .limit(1)
                            .execute()
                        )
                        if getattr(unit_weight_resp, "data", None):
                            pkg_val = float(unit_weight_resp.data[0]["weight_gram"])
                            pkg_unit = "gram"
                            applied_custom_unit = True

                # Layer 2.5: Global fallback
                if not applied_custom_unit and sat_clean:
                    global_weight_resp = (
                        supabase.table("ingredient_unit_weights")
                        .select("weight_gram")
                        .eq("ingredient_id", "00000000-0000-0000-0000-000000000000")
                        .ilike("unit", sat_clean)
                        .limit(1)
                        .execute()
                    )
                    if getattr(global_weight_resp, "data", None):
                        pkg_val = float(global_weight_resp.data[0]["weight_gram"])
                        pkg_unit = "gram"
                        applied_custom_unit = True
            except Exception as e:
                logger.warning(f"Unit resolution fallback error for '{satuan}': {e}")

        # Layer 3: Alias packaging inheritance
        if not applied_custom_unit and pkg_val == 1.0:
            alias_pkg_val = alias_result.get("packaging_value")
            alias_pkg_unit = alias_result.get("packaging_unit")
            if alias_pkg_val and float(alias_pkg_val) != 1.0:
                pkg_val = float(alias_pkg_val)
                pkg_unit = alias_pkg_unit or satuan
                pkg_val, pkg_unit = resolve_standard_unit_conversion(pkg_val, pkg_unit)

        # Ambil HPP dari produk jika ketemu
        harga_snapshot = str(harga)
        if product_id:
            prod_resp = (
                supabase.table("products")
                .select("harga")
                .eq("id", product_id)
                .single()
                .execute()
            )
            harga_val = (getattr(prod_resp, "data", None) or {}).get("harga")
            if harga_val:
                harga_snapshot = str(harga_val)

        supabase.table("transaction_items").insert({
            "transaction_id": trx_id,
            "tenant_id": current_user.tenant_id,
            "product_id": product_id,
            "product_name": product_name,
            "ocr_nama_asli": nama_asli,
            "qty": str(qty),
            "unit": satuan,
            "price": str(harga),
            "harga_snapshot": harga_snapshot,
            "subtotal": str(subtotal),
            "has_ppn": False,
            "packaging_value": str(pkg_val),
            "packaging_unit": pkg_unit,
            "needs_confirmation": False,
        }).execute()

        # Learn alias for future matching
        if product_id and nama_asli:
            alias_svc.learn_aliases(
                tenant_id=current_user.tenant_id,
                product_id=product_id,
                names=[nama_asli, product_name],
                supabase=supabase,
                source="manual",
            )

        # Update stok jika ada product_id
        if product_id:
            try:
                # Update HPP
                supabase.table("products").update({
                    "harga": str(harga)
                }).eq("id", product_id).eq("tenant_id", current_user.tenant_id).execute()

                # Stock delta uses packaging_value (aligned with OCR workflow)
                qty_base = float(qty) * pkg_val

                supabase.rpc("increment_stock", {
                    "p_product_id": product_id,
                    "p_delta": qty_base,
                    "p_tenant_id": current_user.tenant_id,
                }).execute()
                bal_resp = (
                    supabase.table("products")
                    .select("stock_qty")
                    .eq("id", product_id)
                    .single()
                    .execute()
                )
                balance = float((getattr(bal_resp, "data", None) or {}).get("stock_qty", 0))
                supabase.table("stock_history").insert({
                    "tenant_id": current_user.tenant_id,
                    "product_id": product_id,
                    "transaction_id": trx_id,
                    "change_qty": str(qty_base),
                    "balance_after": str(balance),
                    "reason": "purchase",
                    "notes": f"Manual: {supplier_name or 'tanpa supplier'}",
                }).execute()
            except Exception as e:
                logger.error(f"Gagal update stok {product_name}: {e}")
                stok_errors.append(f"{product_name}: {e}")

    # ─── Update total ─────────────────────────────────────────────────
    supabase.table("transactions").update({
        "total": str(grand_total),
        "subtotal": str(grand_total),
    }).eq("id", trx_id).execute()

    # ─── Cashflow ─────────────────────────────────────────────────────
    try:
        supabase.table("cashflow_log").insert({
            "tenant_id": current_user.tenant_id,
            "transaction_id": trx_id,
            "flow_type": "out",
            "category": "purchase",
            "amount": str(grand_total),
            "description": f"Manual: {supplier_name or 'Belanja'}",
            "date": trx_date,
        }).execute()
    except Exception:
        pass

    # ─── Payables jika hutang ─────────────────────────────────────────
    if payment_method == "hutang":
        try:
            supabase.table("payables").insert({
                "tenant_id": current_user.tenant_id,
                "transaction_id": trx_id,
                "supplier_name": supplier_name or "Supplier",
                "amount": str(grand_total),
                "paid_amount": "0.00",
                "due_date": due_date,
                "status": "unpaid",
            }).execute()
            logger.info(f"Payable created for trx {trx_id}, amount={grand_total}, due={due_date}")
        except Exception as e:
            logger.error(f"Failed to insert payable for manual transaction {trx_id}: {e}")

    # ─── Kas Ledger Double Entry ───────────────────────────────────────
    if kas_account_id and grand_total > 0:
        try:
            trx_dt = date.fromisoformat(trx_date) if trx_date else date.today()
        except:
            trx_dt = date.today()
            
        try:
            KasService.record_expense(
                tenant_id=current_user.tenant_id,
                transaction_id=trx_id,
                amount=grand_total,
                kas_account_id=kas_account_id,
                description=f"Belanja manual {supplier_name or ''}",
                expense_date=trx_dt,
                created_by=current_user.id,
                supabase=supabase,
                reference_type="expense"
            )
        except Exception as e:
            logger.error(f"Kas double entry failed: {e}")

    # ─── Trigger Excel regenerate ──────────────────────────────────────
    from services.export_service import ExportService
    try:
        trx_dt = date.fromisoformat(trx_date)
    except ValueError:
        trx_dt = date.today()
    background_tasks.add_task(
        ExportService().regenerate_monthly_excel,
        current_user.tenant_id,
        trx_dt.year,
        trx_dt.month,
    )

    result: Dict[str, Any] = {
        "success": True,
        "data": {
            "transaction_id": trx_id,
            "total": str(grand_total),
            "item_count": len(items_input),
            "supplier_name": supplier_name,
            "payment_method": payment_method,
        },
    }
    if stok_errors:
        result["stok_warnings"] = stok_errors
    return result
