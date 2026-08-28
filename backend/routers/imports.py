"""
backend/routers/imports.py
Import Harga Historis — CSV upload untuk data harga masa lampau

GET    /imports/template   → download CSV template
POST   /imports/validate   → validasi CSV, return preview
POST   /imports/execute    → import data ke DB
GET    /imports/history    → riwayat import
DELETE /imports/rollback   → rollback satu batch import
"""

import csv
import io
import logging
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.user import UserInDB

router = APIRouter(prefix="/imports", tags=["imports"])
logger = logging.getLogger(__name__)

TEMPLATE_HEADER = ["tanggal", "nama_bahan", "qty", "satuan", "harga_satuan", "nama_supplier"]
TEMPLATE_EXAMPLES = [
    ["2026-01-15", "Beras", "50", "kg", "14000", "Toko Pak Ahmad"],
    ["2026-01-15", "Ayam", "20", "kg", "35000", "CV Makmur"],
    ["2026-02-03", "Beras", "30", "kg", "14500", "Toko Pak Ahmad"],
]
MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 MB


# ─── GET /imports/template ───────────────────────────────────────────────────

@router.get(
    "/template",
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def download_template():
    """Download CSV template kosong."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(TEMPLATE_HEADER)
    for row in TEMPLATE_EXAMPLES:
        writer.writerow(row)

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_import_harga.csv"},
    )


# ─── Shared CSV parser ───────────────────────────────────────────────────────

def _parse_csv(content: bytes) -> List[dict]:
    """Parse CSV bytes → list of row dicts. Raises HTTPException on format error."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except Exception:
            raise HTTPException(422, detail="File tidak bisa dibaca. Pastikan encoding UTF-8.")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(422, detail="File CSV kosong atau tidak punya header.")

    # Normalise header names
    clean_fields = [f.strip().lower().replace(" ", "_") for f in reader.fieldnames]
    required = {"tanggal", "nama_bahan", "qty", "harga_satuan"}
    missing = required - set(clean_fields)
    if missing:
        raise HTTPException(422, detail=f"Header kolom tidak lengkap: {', '.join(missing)}")

    rows: List[dict] = []
    for i, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower().replace(" ", "_"): (v or "").strip() for k, v in raw_row.items()}
        row["_row_number"] = i
        rows.append(row)
    return rows


def _validate_rows(rows: List[dict], tenant_id: str, supabase) -> dict:
    """Validate parsed rows against DB. Return preview structure."""
    today = date.today()

    # Pre-fetch products + aliases
    prod_resp = (
        supabase.table("products")
        .select("id, name")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .execute()
    )
    products = getattr(prod_resp, "data", None) or []
    prod_by_name = {p["name"].lower(): p for p in products}

    alias_resp = (
        supabase.table("product_aliases")
        .select("alias_name, product_id")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    aliases = getattr(alias_resp, "data", None) or []
    alias_map = {a["alias_name"].lower(): a["product_id"] for a in aliases}

    # Pre-fetch suppliers
    sup_resp = (
        supabase.table("suppliers")
        .select("id, name")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    suppliers = getattr(sup_resp, "data", None) or []
    sup_by_name = {s["name"].lower(): s for s in suppliers}

    validated: List[dict] = []
    not_found_products = set()
    will_create_suppliers = set()

    for row in rows:
        rn = row["_row_number"]
        errors: List[str] = []

        # 1. tanggal
        tanggal_str = row.get("tanggal", "")
        tanggal_val: Optional[str] = None
        try:
            d = date.fromisoformat(tanggal_str)
            if d > today:
                errors.append("Tanggal tidak boleh di masa depan")
            else:
                tanggal_val = d.isoformat()
        except (ValueError, TypeError):
            errors.append(f"Format tanggal salah: '{tanggal_str}' (harus YYYY-MM-DD)")

        # 2. nama_bahan
        nama_bahan = row.get("nama_bahan", "")
        if not nama_bahan:
            errors.append("nama_bahan tidak boleh kosong")

        # 3. qty
        qty_val: Optional[float] = None
        try:
            qty_val = float(row.get("qty", "").replace(",", "."))
            if qty_val <= 0:
                errors.append("qty harus positif")
        except (ValueError, TypeError):
            errors.append("qty harus angka positif")

        # 4. satuan
        satuan = row.get("satuan", "pcs") or "pcs"

        # 5. harga_satuan
        harga_val: Optional[Decimal] = None
        try:
            harga_val = Decimal(row.get("harga_satuan", "").replace(",", "."))
            if harga_val <= 0:
                errors.append("harga_satuan harus positif")
        except (InvalidOperation, ValueError, TypeError):
            errors.append("harga_satuan harus angka positif")

        # 6. nama_supplier
        nama_supplier = row.get("nama_supplier", "") or ""

        # Resolve product
        product_id = None
        product_found = False
        if nama_bahan:
            key = nama_bahan.lower()
            if key in prod_by_name:
                product_id = prod_by_name[key]["id"]
                product_found = True
            elif key in alias_map:
                product_id = alias_map[key]
                product_found = True
            else:
                not_found_products.add(nama_bahan)

        # Resolve supplier
        supplier_id = None
        supplier_status = "empty"
        if nama_supplier:
            s_key = nama_supplier.lower()
            if s_key in sup_by_name:
                supplier_id = sup_by_name[s_key]["id"]
                supplier_status = "found"
            else:
                supplier_status = "will_create"
                will_create_suppliers.add(nama_supplier)

        row_status = "valid" if not errors else "invalid"

        validated.append({
            "row_number": rn,
            "tanggal": tanggal_val,
            "nama_bahan": nama_bahan,
            "product_id": product_id,
            "product_found": product_found,
            "qty": qty_val,
            "satuan": satuan,
            "harga_satuan": str(harga_val) if harga_val else None,
            "nama_supplier": nama_supplier,
            "supplier_id": supplier_id,
            "supplier_status": supplier_status,
            "status": row_status,
            "errors": errors,
        })

    valid_count = sum(1 for r in validated if r["status"] == "valid")
    invalid_count = len(validated) - valid_count

    warnings: List[str] = []
    if not_found_products:
        warnings.append(f"{len(not_found_products)} bahan tidak ditemukan di master data")
    if will_create_suppliers:
        warnings.append(f"{len(will_create_suppliers)} supplier baru akan dibuat")

    return {
        "total_rows": len(validated),
        "valid_rows": valid_count,
        "invalid_rows": invalid_count,
        "rows": validated,
        "warnings": warnings,
    }


# ─── POST /imports/validate ──────────────────────────────────────────────────

@router.post(
    "/validate",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
async def validate_csv(
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user),
):
    """Validasi CSV dan return preview tanpa menyimpan data."""
    content = await file.read()
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(422, detail="File terlalu besar (max 5MB)")

    rows = _parse_csv(content)
    if not rows:
        raise HTTPException(422, detail="File CSV tidak berisi data")

    supabase = get_supabase()
    preview = _validate_rows(rows, current_user.tenant_id, supabase)
    return {"success": True, "data": preview}


# ─── POST /imports/execute ───────────────────────────────────────────────────

@router.post(
    "/execute",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
async def execute_import(
    file: UploadFile = File(...),
    create_missing_products: bool = Form(default=False),
    create_missing_suppliers: bool = Form(default=True),
    current_user: UserInDB = Depends(get_current_user),
):
    """Import CSV ke database."""
    content = await file.read()
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(422, detail="File terlalu besar (max 5MB)")

    rows = _parse_csv(content)
    if not rows:
        raise HTTPException(422, detail="File CSV tidak berisi data")

    supabase = get_supabase()
    tid = current_user.tenant_id

    # Pre-fetch products + aliases
    prod_resp = supabase.table("products").select("id, name").eq("tenant_id", tid).eq("is_active", True).execute()
    products = getattr(prod_resp, "data", None) or []
    prod_by_name = {p["name"].lower(): p for p in products}

    alias_resp = supabase.table("product_aliases").select("alias_name, product_id").eq("tenant_id", tid).execute()
    aliases = getattr(alias_resp, "data", None) or []
    alias_map = {a["alias_name"].lower(): a["product_id"] for a in aliases}

    sup_resp = supabase.table("suppliers").select("id, name").eq("tenant_id", tid).execute()
    suppliers = getattr(sup_resp, "data", None) or []
    sup_by_name = {s["name"].lower(): s for s in suppliers}

    today = date.today()
    imported_rows = 0
    skipped_rows = 0
    created_suppliers = 0
    created_products = 0
    transactions_created = 0
    skipped_details: List[dict] = []

    # Cache for transactions created in this import (date+supplier_id → trx_id)
    trx_cache: Dict[str, str] = {}
    # Cache for items per transaction to recalc total
    trx_totals: Dict[str, Decimal] = {}

    try:
        for row in rows:
            rn = row["_row_number"]
            errors: List[str] = []

            # Parse tanggal
            tanggal_str = row.get("tanggal", "")
            try:
                d = date.fromisoformat(tanggal_str)
                if d > today:
                    errors.append("Tanggal di masa depan")
            except Exception:
                errors.append("Format tanggal salah")

            nama_bahan = row.get("nama_bahan", "")
            if not nama_bahan:
                errors.append("nama_bahan kosong")

            try:
                qty = Decimal(str(row.get("qty", "0")).replace(",", "."))
                if qty <= 0:
                    errors.append("qty <= 0")
            except Exception:
                errors.append("qty tidak valid")
                qty = Decimal("0")

            satuan = row.get("satuan", "pcs") or "pcs"

            try:
                harga = Decimal(str(row.get("harga_satuan", "0")).replace(",", "."))
                if harga <= 0:
                    errors.append("harga <= 0")
            except Exception:
                errors.append("harga tidak valid")
                harga = Decimal("0")

            nama_supplier = row.get("nama_supplier", "") or ""

            if errors:
                skipped_rows += 1
                skipped_details.append({"row": rn, "reason": "; ".join(errors)})
                continue

            # ─── Resolve supplier ────────────────────────────────────
            supplier_id = None
            if nama_supplier:
                s_key = nama_supplier.lower()
                if s_key in sup_by_name:
                    supplier_id = sup_by_name[s_key]["id"]
                elif create_missing_suppliers:
                    resp = supabase.table("suppliers").insert({
                        "tenant_id": tid,
                        "name": nama_supplier,
                        "is_pkp": False,
                        "is_active": True,
                    }).execute()
                    new_data = getattr(resp, "data", None) or []
                    if new_data:
                        supplier_id = new_data[0]["id"]
                        sup_by_name[s_key] = {"id": supplier_id, "name": nama_supplier}
                        created_suppliers += 1

            # ─── Resolve product ─────────────────────────────────────
            bahan_key = nama_bahan.lower()
            product_id = None
            if bahan_key in prod_by_name:
                product_id = prod_by_name[bahan_key]["id"]
            elif bahan_key in alias_map:
                product_id = alias_map[bahan_key]
            elif create_missing_products:
                # prod_by_name already checked — no duplicate possible within same import
                resp = supabase.table("products").insert({
                    "tenant_id": tid,
                    "name": nama_bahan.strip(),
                    "category": "bahan_baku",
                    "unit": satuan,
                    "harga": str(harga),
                    "sell_price": "0.00",
                    "stock_min": "0",
                    "stock_qty": "0",
                }).execute()
                new_data = getattr(resp, "data", None) or []
                if new_data:
                    product_id = new_data[0]["id"]
                    prod_by_name[bahan_key] = {"id": product_id, "name": nama_bahan}
                    created_products += 1

            if not product_id:
                skipped_rows += 1
                skipped_details.append({"row": rn, "reason": f"Bahan '{nama_bahan}' tidak ditemukan dan auto-create dinonaktifkan"})
                continue

            # ─── Find or create transaction ──────────────────────────
            trx_key = f"{tanggal_str}|{supplier_id or 'none'}"
            if trx_key in trx_cache:
                trx_id = trx_cache[trx_key]
            else:
                # Check existing
                q = (
                    supabase.table("transactions")
                    .select("id")
                    .eq("tenant_id", tid)
                    .eq("date", tanggal_str)
                    .eq("source", "import_historis")
                )
                if supplier_id:
                    q = q.eq("supplier_id", supplier_id)
                else:
                    q = q.is_("supplier_id", "null")
                existing = getattr(q.limit(1).execute(), "data", None) or []

                if existing:
                    trx_id = existing[0]["id"]
                else:
                    trx_data: Dict[str, Any] = {
                        "tenant_id": tid,
                        "user_id": current_user.id,
                        "type": "expense",
                        "source": "import_historis",
                        "status": "confirmed",
                        "date": tanggal_str,
                        "total": "0.00",
                        "subtotal": "0.00",
                        "pph22_amount": "0.00",
                        "ppn_amount": "0.00",
                        "discount": "0.00",
                        "payment_method": "tunai",
                        "notes": "Import historis",
                    }
                    if supplier_id:
                        trx_data["supplier_id"] = supplier_id
                    if nama_supplier:
                        trx_data["nama_toko"] = nama_supplier

                    resp = supabase.table("transactions").insert(trx_data).execute()
                    new_data = getattr(resp, "data", None) or []
                    if not new_data:
                        raise Exception(f"Gagal membuat transaksi untuk baris {rn}")
                    trx_id = new_data[0]["id"]
                    transactions_created += 1

                trx_cache[trx_key] = trx_id
                trx_totals[trx_id] = Decimal("0")

            # ─── Insert transaction_item ─────────────────────────────
            subtotal = (qty * harga).quantize(Decimal("0.01"))
            supabase.table("transaction_items").insert({
                "transaction_id": trx_id,
                "tenant_id": tid,
                "product_id": product_id,
                "product_name": nama_bahan,
                "qty": str(qty),
                "unit": satuan,
                "price": str(harga),
                "harga_snapshot": str(harga),
                "subtotal": str(subtotal),
                "has_ppn": False,
            }).execute()

            trx_totals[trx_id] = trx_totals.get(trx_id, Decimal("0")) + subtotal

            # ─── Insert price_history ────────────────────────────────
            try:
                supabase.table("price_history").insert({
                    "product_id": product_id,
                    "tenant_id": tid,
                    "price_type": "harga",
                    "new_price": str(harga),
                    "effective_date": tanggal_str,
                    "notes": "Import historis",
                }).execute()
            except Exception as e:
                logger.warning(f"price_history insert gagal baris {rn}: {e}")

            imported_rows += 1

        # ─── Update transaction totals ────────────────────────────────
        for trx_id, total in trx_totals.items():
            supabase.table("transactions").update({
                "total": str(total.quantize(Decimal("0.01"))),
                "subtotal": str(total.quantize(Decimal("0.01"))),
            }).eq("id", trx_id).execute()

    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(500, detail=f"Import gagal: {str(e)}")

    return {
        "success": True,
        "data": {
            "imported_rows": imported_rows,
            "skipped_rows": skipped_rows,
            "created_suppliers": created_suppliers,
            "created_products": created_products,
            "transactions_created": transactions_created,
            "skipped_details": skipped_details,
        },
    }


# ─── GET /imports/history ────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def get_import_history(current_user: UserInDB = Depends(get_current_user)):
    """Riwayat import historis."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    resp = (
        supabase.table("transactions")
        .select("id, created_at, date, total")
        .eq("tenant_id", tid)
        .eq("source", "import_historis")
        .order("created_at", desc=True)
        .execute()
    )
    rows = getattr(resp, "data", None) or []

    # Group by created_at date
    from collections import defaultdict
    groups: Dict[str, dict] = {}
    for r in rows:
        created = r.get("created_at", "")[:10]  # YYYY-MM-DD
        if created not in groups:
            groups[created] = {
                "imported_at": created,
                "total_rows": 0,
                "dates": set(),
                "total_amount": Decimal("0"),
            }
        groups[created]["total_rows"] += 1
        groups[created]["dates"].add(r.get("date", "")[:7])  # YYYY-MM
        groups[created]["total_amount"] += Decimal(str(r.get("total", 0) or 0))

    imports = []
    for g in sorted(groups.values(), key=lambda x: x["imported_at"], reverse=True):
        sorted_dates = sorted(g["dates"])
        date_range = f"{sorted_dates[0]} - {sorted_dates[-1]}" if len(sorted_dates) > 1 else sorted_dates[0] if sorted_dates else ""
        imports.append({
            "imported_at": g["imported_at"],
            "total_rows": g["total_rows"],
            "date_range": date_range,
            "total_amount": str(g["total_amount"].quantize(Decimal("0.01"))),
        })

    return {"success": True, "data": {"imports": imports}}


# ─── DELETE /imports/rollback ────────────────────────────────────────────────

@router.delete(
    "/rollback",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner"]))],
)
def rollback_import(
    body: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user),
):
    """Rollback import historis berdasarkan tanggal import."""
    imported_at = body.get("imported_at")
    if not imported_at:
        raise HTTPException(422, detail="imported_at wajib diisi (YYYY-MM-DD)")

    supabase = get_supabase()
    tid = current_user.tenant_id

    # Find transactions to delete
    start_of_day = f"{imported_at}T00:00:00"
    end_of_day = f"{imported_at}T23:59:59"

    trx_resp = (
        supabase.table("transactions")
        .select("id")
        .eq("tenant_id", tid)
        .eq("source", "import_historis")
        .gte("created_at", start_of_day)
        .lte("created_at", end_of_day)
        .execute()
    )
    trx_rows = getattr(trx_resp, "data", None) or []
    trx_ids = [r["id"] for r in trx_rows]

    if not trx_ids:
        return {"success": True, "data": {"deleted": 0, "message": "Tidak ada data import untuk tanggal tersebut"}}

    deleted = 0
    for trx_id in trx_ids:
        # Delete items
        supabase.table("transaction_items").delete().eq("transaction_id", trx_id).execute()
        # Delete transaction
        supabase.table("transactions").delete().eq("id", trx_id).execute()
        deleted += 1

    # Delete price_history entries with notes 'Import historis' from that date range
    try:
        supabase.table("price_history").delete().eq("tenant_id", tid).eq("notes", "Import historis").gte("created_at", start_of_day).lte("created_at", end_of_day).execute()
    except Exception as e:
        logger.warning(f"price_history rollback partial: {e}")

    return {"success": True, "data": {"deleted": deleted}}
