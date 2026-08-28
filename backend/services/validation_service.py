"""
backend/services/validation_service.py
Validasi nota: 4 pengecekan otomatis — Modul 7

Pengecekan:
  1. Duplikasi ref_number (dalam 30 hari)
  2. Anomali harga per item (>30% dari rata-rata 30 hari)
  3. Supplier baru (belum pernah bertransaksi)
  4. Total mismatch (sum items ≠ total header, toleransi Rp 100)
"""

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class ValidationService:
    """Sync — dipanggil dari RQ worker."""

    def validate(self, trx_id: str, tenant_id: str, supabase) -> Dict[str, Any]:
        """
        Jalankan 4 pengecekan, simpan ke nota_validations,
        update transactions.validation_status.
        Return {result, flags, warnings}.
        """
        flags: List[str] = []
        warnings: List[str] = []

        # ─── Ambil data transaksi + items ───────────────────────────
        trx_resp = (
            supabase.table("transactions")
            .select("*")
            .eq("id", trx_id)
            .eq("tenant_id", tenant_id)
            .single()
            .execute()
        )
        trx = getattr(trx_resp, "data", None)
        if not trx:
            logger.error(f"ValidationService: transaksi {trx_id} tidak ditemukan")
            return {"result": "invalid", "flags": ["not_found"], "warnings": []}

        items_resp = (
            supabase.table("transaction_items")
            .select("*")
            .eq("transaction_id", trx_id)
            .execute()
        )
        items: List[dict] = getattr(items_resp, "data", None) or []

        # ─── 1. Duplikasi ref_number ─────────────────────────────────
        ref_number = trx.get("ref_number")
        if ref_number:
            since = (date.today() - timedelta(days=30)).isoformat()
            dup_resp = (
                supabase.table("transactions")
                .select("id, date")
                .eq("tenant_id", tenant_id)
                .eq("ref_number", ref_number)
                .neq("id", trx_id)
                .gte("date", since)
                .limit(1)
                .execute()
            )
            if getattr(dup_resp, "data", None):
                flags.append("duplicate_ref")
                warnings.append(f"No. nota '{ref_number}' sudah pernah diinput sebelumnya")

        # ─── 2. Anomali harga item ───────────────────────────────────
        for item in items:
            product_id = item.get("product_id")
            if not product_id:
                continue
            since = (date.today() - timedelta(days=30)).isoformat()
            hist_resp = (
                supabase.table("transaction_items")
                .select("price, transactions!transaction_id(date, tenant_id)")
                .eq("product_id", product_id)
                .execute()
            )
            hist_rows = [
                r for r in (getattr(hist_resp, "data", None) or [])
                if (r.get("transactions") or {}).get("tenant_id") == tenant_id
                and (r.get("transactions") or {}).get("date", "") >= since
            ]
            if len(hist_rows) >= 3:
                prices = [Decimal(str(r["price"])) for r in hist_rows if r.get("price")]
                if prices:
                    avg = sum(prices) / len(prices)
                    current_price = Decimal(str(item.get("price", 0)))
                    if avg > 0:
                        pct = ((current_price - avg) / avg) * 100
                        if pct > 30:
                            pct_rounded = round(float(pct))
                            flags.append(f"price_anomaly:{item['product_name']}:{pct_rounded}%_lebih_mahal")
                            warnings.append(
                                f"⚠️ {item['product_name']}: harga saat ini "
                                f"Rp {current_price:,.0f} (+{pct_rounded}% dari rata-rata)"
                            )

        # ─── 3. Supplier baru ────────────────────────────────────────
        supplier_id = trx.get("supplier_id")
        if supplier_id:
            prev_resp = (
                supabase.table("transactions")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("supplier_id", supplier_id)
                .neq("id", trx_id)
                .limit(1)
                .execute()
            )
            if not getattr(prev_resp, "data", None):
                flags.append("new_supplier")
                warnings.append("Supplier ini baru pertama kali bertransaksi")

        # ─── 4. Harga satuan mencurigakan (ml/gram terlalu murah) ─────
        from services.receipt_item_normalizer import is_suspicious_unit_price

        for item in items:
            unit = str(item.get("unit", "pcs"))
            price = item.get("price", 0)
            if is_suspicious_unit_price(unit, price):
                pname = item.get("product_name", "?")
                flags.append(f"unit_price_suspicious:{pname}")
                warnings.append(
                    f"⚠️ {pname}: harga per {unit} terlihat tidak wajar "
                    f"(Rp {Decimal(str(price)):,.0f}) — cek qty/satuan"
                )

        # ─── 5. Harga satuan × qty ≠ subtotal per item ─────────────────
        for item in items:
            try:
                item_qty = Decimal(str(item.get("qty", 0)))
                item_price = Decimal(str(item.get("price", 0)))
                item_sub = Decimal(str(item.get("subtotal", 0)))
                if item_qty > 0 and item_price > 0 and item_sub > 0:
                    expected = item_qty * item_price
                    diff_item = abs(expected - item_sub)
                    if diff_item > Decimal("100"):
                        pname = item.get("product_name", "?")
                        flags.append(f"item_math_mismatch:{pname}")
                        warnings.append(
                            f"⚠️ {pname}: {item_qty} x Rp {item_price:,.0f} = "
                            f"Rp {expected:,.0f}, tapi subtotal nota = Rp {item_sub:,.0f}"
                        )
            except Exception:
                pass

        # ─── 6. Total mismatch ───────────────────────────────────────
        if items:
            items_total = sum(Decimal(str(i.get("subtotal", 0))) for i in items)
            trx_total = Decimal(str(trx.get("total", 0)))
            diff = abs(items_total - trx_total)
            if diff > Decimal("100"):
                flags.append("total_mismatch")
                warnings.append(
                    f"Total item (Rp {items_total:,.0f}) ≠ total nota (Rp {trx_total:,.0f})"
                )

        # ─── Tentukan result ─────────────────────────────────────────
        critical_flags = {"duplicate_ref", "total_mismatch"}
        if any(f in critical_flags for f in flags):
            result = "suspicious"
        elif flags:
            result = "suspicious"
        else:
            result = "valid"

        # ─── Simpan ke nota_validations ──────────────────────────────
        try:
            supabase.table("nota_validations").insert({
                "tenant_id": tenant_id,
                "transaction_id": trx_id,
                "validator": "system",
                "result": result,
                "flags": {"flags": flags, "warnings": warnings},
            }).execute()
        except Exception as e:
            logger.warning(f"nota_validations insert gagal: {e}")

        logger.info(f"Validasi {trx_id}: {result} | flags={flags}")
        return {"result": result, "flags": flags, "warnings": warnings}


validation_service = ValidationService()
