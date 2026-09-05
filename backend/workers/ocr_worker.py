"""
backend/workers/ocr_worker.py
OCR Worker untuk nota foto — Modul 7

Dijalankan via FastAPI BackgroundTasks (non-blocking, thread pool).
Tidak menggunakan RQ/Redis karena rq tidak kompatibel Windows (fork()).

Untuk production Linux, fungsi process_ocr_job bisa dijalankan via RQ:
  from rq import Queue
  Queue("ocr", connection=redis_conn).enqueue(process_ocr_job, ...)

Jalankan: sudah terintegrasi di FastAPI, tidak perlu daemon terpisah.
"""

import json
import logging
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional
from difflib import SequenceMatcher

from core.config import settings
from core.database import get_supabase
from services.alias_service import AliasService
from services.notification_service import NotificationService
from services.ocr_service import OCRService
from services.receipt_item_normalizer import normalize_ocr_items
from services.validation_service import ValidationService
from utils.unit_converter import is_standard_metric, resolve_standard_unit_conversion

logger = logging.getLogger(__name__)


# ─── Helper: konversi nilai ke Decimal aman ───────────────────────────────────

def _to_decimal(val: Any, precision: str = "0.01") -> Decimal:
    try:
        return Decimal(str(val or 0)).quantize(Decimal(precision))
    except InvalidOperation:
        return Decimal("0")


def _to_decimal3(val: Any) -> Decimal:
    return _to_decimal(val, "0.001")


def _to_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default

# ─── Helper: filter basa-basi AI dari array flag ──────────────────────────────

# Gemini sering mengisi math_mismatches/unclear_items dengan string basa-basi
# seperti ["Tidak ada"] atau ["Semua jelas"] alih-alih mengembalikan [].
# Filter ini membuang entri-entri palsu tersebut agar tidak memicu peringatan.
_AI_FALSE_ALARM_WORDS = frozenset({
    "tidak ada", "none", "n/a", "kosong", "jelas", "tidak", "aman",
    "semua jelas", "semua cocok", "tidak ditemukan", "no issues",
    "no mismatches", "all clear", "-", "null",
})


def _filter_ai_pleasantries(items: List[str]) -> List[str]:
    """Buang entri basa-basi AI dari list flag OCR."""
    if not items:
        return []
    real = []
    for entry in items:
        if not isinstance(entry, str):
            continue
        cleaned = entry.strip().lower()
        # Buang jika string terlalu pendek (<=3 char) atau cocok kata basa-basi
        if len(cleaned) <= 3:
            continue
        if cleaned in _AI_FALSE_ALARM_WORDS:
            continue
        if any(word == cleaned for word in _AI_FALSE_ALARM_WORDS):
            continue
        # Buang jika seluruh isi hanya kata basa-basi (partial match)
        if any(cleaned.startswith(w) or cleaned.endswith(w) for w in (
            "tidak ada", "none", "semua", "no issue", "all clear",
        )):
            continue
        real.append(entry)
    return real


# ─── Helper: parsing info kemasan ─────────────────────────────────────────────

def parse_packaging(raw_name: str, atribut_kemasan: Optional[str] = None) -> tuple[float, str]:
    """
    Parse packaging value and unit from raw_name or atribut_kemasan.
    Returns (packaging_value, packaging_unit)
    """
    text = atribut_kemasan or raw_name
    if not text:
        return 1.0, "pcs"
    
    # Matches patterns like "1/2 kg", "1/4 kg", "3/4 kg"
    fraction_match = re.search(r"\b(1/2|1/4|3/4)\s*(kg|g|gram|ml|l|liter)\b", text, re.I)
    if fraction_match:
        frac = fraction_match.group(1)
        unit = fraction_match.group(2).lower()
        val = 0.5 if frac == "1/2" else (0.25 if frac == "1/4" else 0.75)
        return val, unit

    # Match numbers followed by units
    match = re.search(r"(\d+(?:\.\d+)?)\s*(ml|g|kg|l|liter|gram|pcs|ons|papan|ikat|goni|dus|pack|pouch|sachet|bungkus|bks|sak|tabung|karung)\b", text, re.I)
    if match:
        try:
            val = float(match.group(1))
            unit = match.group(2).lower()
            return val, unit
        except ValueError:
            pass
    return 1.0, "pcs"


# ─── Helper: fuzzy resolver dengan double layer protection ───────────────────

def fuzzy_resolve_product(
    nama_alias: str,
    tenant_id: str,
    supabase,
    products_cache: Optional[List[dict]] = None,
    aliases_cache: Optional[List[dict]] = None,
) -> dict:
    """
    Fuzzy resolve raw item name to product using alias_name and product names.
    Returns resolving dict:
      {product_id, product_name, packaging_value, packaging_unit, confidence, needs_confirmation}
    Uses a threshold of 60% (ratio >= 0.6).
    """
    name_clean = (nama_alias or "").strip().lower()
    if not name_clean:
        return {
            "product_id": None,
            "product_name": nama_alias,
            "packaging_value": 1.0,
            "packaging_unit": "pcs",
            "confidence": 0.0,
            "needs_confirmation": True
        }

    # Fetch aliases from DB
    if aliases_cache is not None:
        aliases = aliases_cache
    else:
        try:
            alias_resp = (
                supabase.table("product_aliases")
                .select("product_id, alias_name, packaging_value, packaging_unit, products!product_id(name)")
                .eq("tenant_id", tenant_id)
                .execute()
            )
            aliases = getattr(alias_resp, "data", None) or []
        except Exception as e:
            logger.error(f"Error fetching product aliases: {e}")
            aliases = []

    # 1. Exact match in aliases
    for al in aliases:
        if al["alias_name"].lower() == name_clean:
            prod_name = (al.get("products") or {}).get("name") or al["alias_name"]
            return {
                "product_id": al["product_id"],
                "product_name": prod_name,
                "packaging_value": float(al.get("packaging_value") or 1.0),
                "packaging_unit": al.get("packaging_unit") or "pcs",
                "confidence": 1.0,
                "needs_confirmation": False
            }

    # Fetch active products
    products = products_cache if products_cache is not None else []
    if not products:
        try:
            prod_resp = (
                supabase.table("products")
                .select("id, name, unit")
                .eq("tenant_id", tenant_id)
                .eq("is_active", True)
                .execute()
            )
            products = getattr(prod_resp, "data", None) or []
        except Exception as e:
            logger.error(f"Error fetching products: {e}")
            products = []

    # 2. Exact match in product names
    for pr in products:
        if pr["name"].lower() == name_clean:
            return {
                "product_id": pr["id"],
                "product_name": pr["name"],
                "packaging_value": 1.0,
                "packaging_unit": pr.get("unit") or "pcs",
                "confidence": 1.0,
                "needs_confirmation": False
            }

    # 3. Fuzzy match against aliases
    best_match = None
    best_ratio = 0.0
    match_source = None

    for al in aliases:
        ratio = SequenceMatcher(None, name_clean, al["alias_name"].lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = al
            match_source = "alias"

    # 4. Fuzzy match against products
    for pr in products:
        ratio = SequenceMatcher(None, name_clean, pr["name"].lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = pr
            match_source = "product"

    # Threshold Check: ratio >= 0.6
    if best_ratio >= 0.6 and best_match:
        if match_source == "alias":
            prod_name = (best_match.get("products") or {}).get("name") or best_match["alias_name"]
            # Extract nutrition_ref_id from nested product relations
            nut_id = (best_match.get("products") or {}).get("nutrition_ref_id")
            return {
                "product_id": best_match["product_id"],
                "product_name": prod_name,
                "packaging_value": float(best_match.get("packaging_value") or 1.0),
                "packaging_unit": best_match.get("packaging_unit") or "pcs",
                "confidence": round(best_ratio, 2),
                "needs_confirmation": False,
                "nutrition_ref_id": nut_id
            }
        else:
            return {
                "product_id": best_match["id"],
                "product_name": best_match["name"],
                "packaging_value": 1.0,
                "packaging_unit": best_match.get("unit") or "pcs",
                "confidence": round(best_ratio, 2),
                "needs_confirmation": False,
                "nutrition_ref_id": best_match.get("nutrition_ref_id")
            }

    # Exact matches for slangs are already in product_aliases table.
    return {
        "product_id": None,
        "product_name": nama_alias,
        "packaging_value": 1.0,
        "packaging_unit": "pcs",
        "confidence": round(best_ratio, 2),
        "needs_confirmation": True
    }


# ─── Fungsi utama job ─────────────────────────────────────────────────────────

def process_ocr_job(
    trx_id: str,
    photo_url: str,
    tenant_id: str,
    telegram_id: int,
    batch_id: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
) -> None:
    """
    FastAPI BackgroundTasks entry-point.
    Alur V5: download foto → Gemini copy-buta → fuzzy match & parsing kemasan
          → check unmapped_hold → validation → notification.
    """
    logger.info(f"OCR job start: trx={trx_id}, tenant={tenant_id}, batch={batch_id}, cached_bytes={image_bytes is not None}")

    supabase = get_supabase()
    bot_token = settings.telegram_bot_token or ""

    ocr_svc = OCRService()
    val_svc = ValidationService()
    notif_svc = NotificationService()

    def _fail(reason: str) -> None:
        """Update status transaksi ke failed dan kirim notif gagal."""
        logger.error(f"OCR job failed [{trx_id}]: {reason}")
        try:
            supabase.table("transactions").update(
                {"status": "failed", "notes": reason}
            ).eq("id", trx_id).execute()
        except Exception as e:
            logger.error(f"Failed to update status: {e}")
        if not batch_id:
            try:
                notif_svc._send_failed(telegram_id, bot_token)
            except Exception as e:
                logger.error(f"Failed to send notif: {e}")

    # ─── 1. Jalankan OCR via Gemini (mode copy-buta) ─────────────────────────
    if image_bytes:
        ocr_results: Optional[List[Dict]] = ocr_svc.extract_from_bytes(image_bytes)
    else:
        ocr_results: Optional[List[Dict]] = ocr_svc.extract_from_url(photo_url)

    if ocr_results is None:
        _fail("OCR gagal — foto tidak dapat dibaca")
        _update_batch_counter(batch_id, [trx_id], tenant_id, telegram_id, bot_token, supabase, success=False, error="OCR gagal")
        return

    if not isinstance(ocr_results, list):
        ocr_results = [ocr_results]

    if not ocr_results:
        _fail("OCR gagal — tidak ada nota terdeteksi")
        _update_batch_counter(batch_id, [trx_id], tenant_id, telegram_id, bot_token, supabase, success=False, error="OCR gagal")
        return

    # Ambil user_id dari transaksi asal
    user_id = None
    try:
        orig_resp = supabase.table("transactions").select("user_id").eq("id", trx_id).execute()
        orig_data = getattr(orig_resp, "data", None) or []
        if orig_data:
            user_id = orig_data[0].get("user_id")
    except Exception as e:
        logger.warning(f"Gagal mengambil user_id transaksi asal: {e}")

    processed_trx_ids = []

    for idx, ocr_result in enumerate(ocr_results):
        if idx == 0:
            current_trx_id = trx_id
        else:
            # Buat transaksi baru
            new_trx_data = {
                "tenant_id": tenant_id,
                "user_id": user_id,
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
            try:
                insert_resp = supabase.table("transactions").insert(new_trx_data).execute()
                insert_data = getattr(insert_resp, "data", None) or []
                if not insert_data:
                    logger.error(f"Gagal membuat transaksi tambahan untuk multi-nota ke-{idx}")
                    continue
                current_trx_id = insert_data[0]["id"]
            except Exception as e:
                logger.error(f"Gagal membuat transaksi tambahan untuk multi-nota ke-{idx}: {e}")
                continue

        # ─── 2. Update header transaksi dari hasil OCR ───────────────────────────
        total_ocr = _to_decimal(ocr_result.get("total") or ocr_result.get("subtotal_nota", 0))
        subtotal_ocr = _to_decimal(ocr_result.get("subtotal_nota", 0)) or total_ocr
        diskon = _to_decimal(ocr_result.get("diskon", 0))

        trx_update = {
            "nama_toko": ocr_result.get("nama_toko"),
            "ref_number": ocr_result.get("no_nota"),
            "date": ocr_result.get("tanggal") or date.today().isoformat(),
            "subtotal": str(subtotal_ocr),
            "ppn_amount": "0.00",
            "pph22_amount": "0.00",
            "discount": str(diskon),
            "total": str(total_ocr),
            "payment_method": ocr_result.get("payment_method"),
            "payment_status": ocr_result.get("payment_status"),
            "ocr_confidence": ocr_result.get("ocr_confidence", 0.0),
            "is_pkp": ocr_result.get("is_pkp", False),
            "status": "processing",
        }

        try:
            supabase.table("transactions").update(trx_update).eq("id", current_trx_id).execute()
        except Exception as e:
            logger.error(f"Update header transaksi gagal untuk {current_trx_id}: {e}")
            if idx == 0:
                _fail(f"Update header transaksi gagal: {e}")
            continue

        # ─── 3. Parsing Kemasan & Alias Resolver ────────────────────────────────
        # Adapt new keys raw_name, raw_qty, raw_price, raw_subtotal
        ocr_items = ocr_result.get("items") or []
        standardized_items = []
        for it in ocr_items:
            standardized_items.append({
                "nama_item": it.get("raw_name") or it.get("nama_item") or "Unknown",
                "qty": it.get("raw_qty") or it.get("qty_pasti") or it.get("qty") or 1.0,
                "satuan": it.get("satuan") or "pcs",
                "harga_satuan": it.get("raw_price") or it.get("harga_satuan") or 0.0,
                "subtotal": it.get("raw_subtotal") or it.get("subtotal") or 0.0,
                "has_ppn": it.get("has_ppn", False),
                "kategori": it.get("kategori"),
                "is_kemasan_pabrik": it.get("is_kemasan_pabrik", False),
                "atribut_kemasan": it.get("atribut_kemasan")
            })

        items_ocr = normalize_ocr_items(standardized_items)
        total_sum = Decimal("0")
        products_cache = get_products_cache(tenant_id, supabase)
        aliases_cache = get_aliases_cache(tenant_id, supabase)

        # Kumpulkan flag integritas dari OCR dan normalizer
        ocr_math_mismatches: List[str] = _filter_ai_pleasantries(ocr_result.get("math_mismatches") or [])
        ocr_unclear_items: List[str] = _filter_ai_pleasantries(ocr_result.get("unclear_items") or [])
        normalizer_mismatches: List[str] = []

        has_unmapped = False
        insert_payloads = []

        for item in items_ocr:
            nama_asli: str = item.get("nama_item", "Unknown")
            nama_alias: str = (item.get("nama_canonical") or "").strip() or nama_asli
            qty = _to_float(item.get("qty"), 1.0)
            satuan: str = item.get("satuan", "pcs")
            harga = _to_float(item.get("harga_satuan"), 0.0)
            sub = _to_float(item.get("subtotal"), 0.0)
            has_ppn: bool = bool(item.get("has_ppn", False))

            if item.get("math_mismatch"):
                normalizer_mismatches.append(item["math_mismatch"])
                logger.warning(f"Math mismatch: {item['math_mismatch']}")

            # Parse kemasan dengan Regex
            pkg_val, pkg_unit = parse_packaging(nama_asli, item.get("atribut_kemasan"))
            pkg_val, pkg_unit = resolve_standard_unit_conversion(pkg_val, pkg_unit)

            # Fuzzy Match 60% with products and aliases cache
            res = fuzzy_resolve_product(
                nama_alias,
                tenant_id,
                supabase,
                products_cache=products_cache,
                aliases_cache=aliases_cache,
            )
            product_id = res["product_id"]
            product_name = res["product_name"] or nama_asli
            needs_confirm = res["needs_confirmation"]

            if needs_confirm:
                has_unmapped = True
            else:
                # Check for unit conversion override in ingredient_unit_weights table (Penyetelan Dapur)
                nut_id = res.get("nutrition_ref_id")
                if not nut_id and product_id:
                    # Fallback lookup in products cache
                    for p in products_cache or []:
                        if p.get("id") == product_id:
                            nut_id = p.get("nutrition_ref_id")
                            break
                
                applied_custom_unit = False
                sat_clean = (satuan or "").strip().lower()

                # Layer 1: Check standard metric units first (kg, g, gr, ons, l, ml, cc, etc.)
                if is_standard_metric(sat_clean):
                    pkg_val, pkg_unit = resolve_standard_unit_conversion(1.0, sat_clean)
                    applied_custom_unit = True

                # Layer 2: Check custom unit weight mappings configured by user
                if not applied_custom_unit and nut_id and satuan:
                    try:
                        # Dapatkan master_ingredient UUID berdasarkan nutrition_ref_id
                        master_res = (
                            supabase.table("master_ingredients")
                            .select("id")
                            .eq("nutrition_ref_id", int(nut_id))
                            .limit(1)
                            .execute()
                        )
                        if master_res.data:
                            ing_id = master_res.data[0]["id"]
                            # Query tabel kustom referensi satuan
                            unit_weight_resp = (
                                supabase.table("ingredient_unit_weights")
                                .select("weight_gram")
                                .eq("ingredient_id", ing_id)
                                .ilike("unit", satuan.strip())
                                .limit(1)
                                .execute()
                            )
                            if unit_weight_resp.data:
                                pkg_val = float(unit_weight_resp.data[0]["weight_gram"])
                                pkg_unit = "gram"
                                applied_custom_unit = True
                    except Exception as e:
                        logger.warning(f"Error resolving unit from ingredient_unit_weights: {e}")

                # Layer 2.5: Fallback to GLOBAL unit weight mappings
                if not applied_custom_unit and satuan:
                    try:
                        global_weight_resp = (
                            supabase.table("ingredient_unit_weights")
                            .select("weight_gram")
                            .eq("ingredient_id", "00000000-0000-0000-0000-000000000000")
                            .ilike("unit", satuan.strip())
                            .limit(1)
                            .execute()
                        )
                        if global_weight_resp.data:
                            pkg_val = float(global_weight_resp.data[0]["weight_gram"])
                            pkg_unit = "gram"
                            applied_custom_unit = True
                    except Exception as e:
                        logger.warning(f"Error resolving global unit weight: {e}")
                
                # Double-Layer Protection: warisi kemasan dari alias jika regex/standard gagal
                if not applied_custom_unit and pkg_val == 1.0 and res["packaging_value"] != 1.0:
                    pkg_val = res["packaging_value"]
                    pkg_unit = res["packaging_unit"]
                    # If this inherited packaging unit is a standard unit, normalize it!
                    pkg_val, pkg_unit = resolve_standard_unit_conversion(pkg_val, pkg_unit)

            item_data = {
                "transaction_id": current_trx_id,
                "tenant_id": tenant_id,
                "product_id": product_id,
                "product_name": product_name,
                "ocr_nama_asli": nama_asli,
                "needs_confirmation": needs_confirm,
                "qty": str(qty), # raw_qty
                "unit": satuan,
                "price": str(harga),
                "harga_snapshot": str(harga),
                "has_ppn": has_ppn,
                "subtotal": str(sub),
                "packaging_value": str(pkg_val),
                "packaging_unit": pkg_unit,
            }
            insert_payloads.append(item_data)

        # Bulk insert transaction items (huge latency optimization)
        if insert_payloads:
            try:
                supabase.table("transaction_items").insert(insert_payloads).execute()
            except Exception as e:
                logger.warning(f"Bulk insert failed, falling back to individual inserts: {e}")
                for payload in insert_payloads:
                    try:
                        supabase.table("transaction_items").insert(payload).execute()
                    except Exception as e_ind:
                        # Fallback columns
                        if "packaging_value" in str(e_ind) or "packaging_unit" in str(e_ind):
                            payload.pop("packaging_value", None)
                            payload.pop("packaging_unit", None)
                        if "ocr_nama_asli" in str(e_ind) or "needs_confirmation" in str(e_ind):
                            payload.pop("ocr_nama_asli", None)
                            payload.pop("needs_confirmation", None)
                        try:
                            supabase.table("transaction_items").insert(payload).execute()
                        except Exception as e_ind2:
                            logger.warning(f"Fallback item insert gagal '{payload.get('ocr_nama_asli')}': {e_ind2}")

        # ─── 3b. Simpan flag integritas ke transaction notes ──────────────────
        all_flags: List[str] = []
        if ocr_math_mismatches:
            all_flags.extend([f"[OCR] {m}" for m in ocr_math_mismatches])
        if normalizer_mismatches:
            all_flags.extend([f"[MATH] {m}" for m in normalizer_mismatches])
        if ocr_unclear_items:
            all_flags.extend([f"[UNCLEAR] {u}" for u in ocr_unclear_items])

        if all_flags:
            try:
                flag_text = "; ".join(all_flags[:20])
                supabase.table("transactions").update({
                    "notes": flag_text,
                }).eq("id", current_trx_id).execute()
            except Exception as e:
                logger.warning(f"Gagal menyimpan integrity flags: {e}")

        # ─── 4. Validasi nota ─────────────────────────────────────────────────────
        try:
            val_svc.validate(current_trx_id, tenant_id, supabase)
        except Exception as e:
            logger.warning(f"Validasi gagal (non-fatal) untuk {current_trx_id}: {e}")

        # ─── 5. Update status ke pending_confirm / unmapped_hold ──────────────────
        try:
            status_target = "unmapped_hold" if has_unmapped else "pending_confirm"
            supabase.table("transactions").update({"status": status_target}).eq(
                "id", current_trx_id
            ).execute()
            processed_trx_ids.append(current_trx_id)
        except Exception as e:
            logger.error(f"Status update gagal untuk {current_trx_id}: {e}")
            if idx == 0:
                _fail(f"Status update gagal: {e}")

    if not processed_trx_ids:
        _fail("Semua transaksi dalam foto gagal diproses")
        _update_batch_counter(batch_id, [trx_id], tenant_id, telegram_id, bot_token, supabase, success=False, error="Pemrosesan gagal")
        return

    # ─── 6. Notif/Update batch ────────────────────────────────────────────────
    if not batch_id:
        for tid in processed_trx_ids:
            try:
                notif_svc.send_ocr_result(
                    trx_id=tid,
                    telegram_id=telegram_id,
                    bot_token=bot_token,
                    supabase=supabase,
                )
            except Exception as e:
                logger.error(f"Gagal mengirim notif untuk {tid}: {e}")
    else:
        _update_batch_counter(
            batch_id=batch_id,
            trx_ids=processed_trx_ids,
            tenant_id=tenant_id,
            telegram_id=telegram_id,
            bot_token=bot_token,
            supabase=supabase,
            success=True
        )

    logger.info(f"OCR job selesai: processed_trx_ids={processed_trx_ids}")


def get_products_cache(tenant_id: str, supabase) -> list:
    try:
        resp = (
            supabase.table("products")
            .select("id, name, category, unit, nutrition_ref_id")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .limit(200)
            .execute()
        )
        return getattr(resp, "data", None) or []
    except Exception:
        return []


def get_aliases_cache(tenant_id: str, supabase) -> list:
    try:
        resp = (
            supabase.table("product_aliases")
            .select("product_id, alias_name, packaging_value, packaging_unit, products!product_id(name, nutrition_ref_id)")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return getattr(resp, "data", None) or []
    except Exception:
        return []


# ─── Helper: update batch counter ────────────────────────────────────────────

def _update_batch_counter(
    batch_id: Optional[str],
    trx_ids: List[str],
    tenant_id: str,
    telegram_id: int,
    bot_token: str,
    supabase,
    success: bool = True,
    error: Optional[str] = None,
) -> None:
    """Update photo_batches counter secara atomik via RPC dan kirim notif jika batch complete."""
    if not batch_id:
        return

    try:
        # Panggil RPC increment_batch_counter untuk update atomic & merge notes
        res = supabase.rpc("increment_batch_counter", {
            "p_batch_id": batch_id,
            "p_tenant_id": tenant_id,
            "p_trx_ids": json.dumps(trx_ids),
        }).execute()
        
        batch_info = getattr(res, "data", None)
        if not batch_info:
            logger.warning(f"Batch {batch_id} tidak ditemukan atau gagal di-update oleh RPC.")
            return

        total = batch_info.get("total_photos", 1)
        processed_photos = batch_info.get("processed_photos", 0)
        is_complete = batch_info.get("is_complete", False)
        notes_raw = batch_info.get("notes") or "[]"
        
        try:
            trx_ids_batch = json.loads(notes_raw) if isinstance(notes_raw, str) else (notes_raw or [])
        except Exception:
            trx_ids_batch = []
            
        if not isinstance(trx_ids_batch, list):
            trx_ids_batch = []

        if is_complete:
            # Panggil _send_batch_complete. Perhitungan sukses & gagal akan dikalkulasi aktual dari status transaksi di DB
            _send_batch_complete(
                batch_id=batch_id,
                telegram_id=telegram_id,
                bot_token=bot_token,
                supabase=supabase,
                tenant_id=tenant_id,
                total=total,
                processed=processed_photos,
                failed=max(0, total - processed_photos),
                trx_ids=trx_ids_batch,
            )

    except Exception as e:
        logger.error(f"Update batch counter gagal via RPC [{batch_id}]: {e}")


# ─── Helper: kirim notif batch complete ke Telegram ──────────────────────────

def _fmt_rp_worker(amount) -> str:
    try:
        v = int(Decimal(str(amount or 0)))
        return f"Rp {v:,}".replace(",", ".")
    except Exception:
        return f"Rp {amount}"


def _esc_worker(text: str) -> str:
    """Escape HTML chars."""
    if not isinstance(text, str):
        text = str(text)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _display_qty_for_notif(qty_raw: float, unit: str) -> str:
    """Format qty mentah dari DB untuk tampilan Telegram.

    DB sudah menyimpan raw_qty (misal 20 kg), JANGAN konversi unit.
    Hanya format angka agar rapi.
    """
    try:
        val = float(qty_raw)
        if val == int(val):
            return f"{int(val)}"
        return f"{val:.2f}".rstrip("0").rstrip(".")
    except Exception:
        return str(qty_raw)


def _send_batch_complete(
    batch_id: str,
    telegram_id: int,
    bot_token: str,
    supabase,
    tenant_id: str,
    total: int,
    processed: int,
    failed: int,
    trx_ids: list,
) -> None:
    """Kirim ringkasan batch ke Telegram user via HTTP langsung."""
    import httpx
    from core.config import settings as app_settings

    trx_list: List[dict] = []
    if trx_ids:
        trx_resp = (
            supabase.table("transactions")
            .select("id, nama_toko, total, status, notes")
            .in_("id", trx_ids)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        trx_list = getattr(trx_resp, "data", None) or []

    # Hitung status sukses/gagal/unmapped secara aktual dari database transaksi
    actual_failed = sum(1 for t in trx_list if t.get("status") == "failed")
    actual_unmapped = sum(1 for t in trx_list if t.get("status") == "unmapped_hold")
    actual_ok = sum(1 for t in trx_list if t.get("status") == "pending_confirm")
    actual_processed = max(0, total - actual_failed)

    # ─── Buat pesan ───────────────────────────────────────────────────
    lines = []
    inline_keyboard = []

    if actual_failed == 0 and actual_unmapped == 0:
        lines.append(f"✅ <b>{total} nota selesai diproses!</b>\n")
        lines.append("Semua data berhasil diekstrak dan siap dikonfirmasi.")
    elif actual_unmapped > 0:
        lines.append(f"⚠️ <b>{actual_unmapped} nota memiliki bahan yang tidak dikenali.</b>\n")
        if actual_ok > 0:
            lines.append(f"✅ {actual_ok} nota lain siap dikonfirmasi.")
        if actual_failed > 0:
            lines.append(f"❌ {actual_failed} nota gagal dibaca.")
        lines.append("")
        lines.append("Harap petakan bahan di <b>Web Dashboard → Dapur → Pemetaan Bahan</b>")
        lines.append("lalu klik tombol [🔄 Cek & Lanjutkan] di bawah.")
    elif actual_processed > 0:
        lines.append(f"⚠️ <b>{actual_processed} berhasil, {actual_failed} gagal.</b>\n")
    else:
        lines.append(f"❌ <b>Semua {total} nota gagal dibaca.</b>\n")
        lines.append("Kemungkinan foto buram atau terpotong.")

    # Rincian per nota (tampilkan semua nota, semua item/nota)
    ok_trx = [t for t in trx_list if t.get("status") != "failed"]
    for idx, trx in enumerate(ok_trx, 1):
        tid = trx.get("id")
        toko = _esc_worker(trx.get("nama_toko") or "Toko")
        tot = _esc_worker(_fmt_rp_worker(trx.get("total", 0)))
        trx_status = trx.get("status", "")
        status_icon = "⚠️" if trx_status == "unmapped_hold" else "✅"
        lines.append("")
        lines.append(f"{idx}. {status_icon} <b>{toko}</b> — {tot}")
        if not tid:
            continue
        items_resp = (
            supabase.table("transaction_items")
            .select("product_name, ocr_nama_asli, qty, unit, price, subtotal, needs_confirmation")
            .eq("transaction_id", tid)
            .execute()
        )
        items = getattr(items_resp, "data", None) or []
        for it in items:
            nama = _esc_worker(it.get("ocr_nama_asli") or it.get("product_name", "?"))
            qty_val = float(it.get("qty", 0))
            q = _display_qty_for_notif(qty_val, it.get("unit", "pcs"))
            sat = _esc_worker(it.get("unit", "pcs"))
            price_val = float(it.get("price", 0))
            sub_val = float(it.get("subtotal", 0))
            harga = _esc_worker(_fmt_rp_worker(price_val))
            sub = _esc_worker(_fmt_rp_worker(sub_val))
            needs_conf = it.get("needs_confirmation", False)
            unmapped_mark = " ❓" if needs_conf else ""

            if sub_val <= 0:
                lines.append(f"   {nama}: {q} {sat} (total gabungan){unmapped_mark}")
            elif qty_val == 1.0 and sat in ("pcs", "bks", "karung") and price_val == sub_val and sub_val >= 100000:
                lines.append(f"   {nama}: {sub} (borongan){unmapped_mark}")
            else:
                lines.append(f"   {nama}: {q} {sat} x {harga} = {sub}{unmapped_mark}")

        # Tampilkan peringatan integritas jika ada
        trx_notes = trx.get("notes") or ""
        if trx_notes and ("[MATH]" in trx_notes or "[UNCLEAR]" in trx_notes or "[OCR]" in trx_notes):
            lines.append(f"   ⚠️ <i>Peringatan: ada ketidakcocokan hitung/tulisan tidak jelas</i>")

    # ─── Tombol berdasarkan status ────────────────────────────────────
    if actual_unmapped > 0:
        web_url = getattr(settings, 'web_url', 'http://localhost:3000') or 'http://localhost:3000'
        mapping_url = f"{web_url}/penyetelan-dapur?tab=mapping"
        inline_keyboard.append([{
            "text": "🌐 Buka Web Pemetaan Bahan",
            "url": mapping_url,
        }])
        inline_keyboard.append([{
            "text": "🔄 Cek & Lanjutkan",
            "callback_data": f"cek_lanjutkan_{batch_id}",
        }])

    if actual_ok > 0:
        inline_keyboard.append([
            {"text": f"✅ Konfirmasi Semua ({actual_ok})",
             "callback_data": f"konfirmasi_semua_{batch_id}"},
            {"text": "❌ Batal Semua",
             "callback_data": f"batal_semua_{batch_id}"},
        ])

    if actual_failed > 0:
        inline_keyboard.append([{
            "text": "🔄 Kirim Ulang Foto yang Gagal",
            "callback_data": f"kirim_ulang_{batch_id}",
        }])

    text = "\n".join(lines)
    if len(text) > 4000:
        text = text[:4000] + "\n<i>[pesan dipotong]</i>"

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": telegram_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": inline_keyboard} if inline_keyboard else None,
    }
    if payload["reply_markup"] is None:
        del payload["reply_markup"]

    try:
        with httpx.Client(timeout=15) as client:
            client.post(url, json=payload)
    except Exception as e:
        logger.error(f"Batch complete notif gagal: {e}")



# ─── Helper untuk FastAPI BackgroundTasks ─────────────────────────────────────

def run_ocr_in_background(
    trx_id: str,
    photo_url: str,
    tenant_id: str,
    telegram_id: int,
    batch_id: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
) -> None:
    """
    Entry-point untuk FastAPI BackgroundTasks.
    Dipanggil di thread pool (non-blocking terhadap request).
    """
    try:
        process_ocr_job(
            trx_id=trx_id,
            photo_url=photo_url,
            tenant_id=tenant_id,
            telegram_id=telegram_id,
            batch_id=batch_id,
            image_bytes=image_bytes,
        )
    except Exception as e:
        logger.error(f"Background OCR error [{trx_id}]: {e}")
