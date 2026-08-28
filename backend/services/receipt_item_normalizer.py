"""
Normalisasi item hasil OCR nota belanja (pembukuan/stok).

Terpisah dari nutrition_ref / nutrition_aliases — hanya aturan deterministik
untuk kemasan pabrik, curah, dan satuan pasar.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# Kemasan pabrik: volume di label tidak boleh jadi qty untuk harga
_PACKAGING_KEYWORDS = re.compile(
    r"\b("
    r"kecap|saus|sambal|minyak|susu|sabun|deterjen|rinso|molto|mama\s*lemon|"
    r"indomie|mie\s*instan|teh\s*|kopi|bubuk|tissue|paseo|lifebuoy|abc|"
    r"bimoli|tropical|bimoli|gulaku|cap\s*kapal|uht|lemon|shampo|"
    r"botol|pouch|sachet|karton|kaleng"
    r")\b",
    re.I,
)

_VOLUME_UNITS = frozenset({"ml", "cc", "liter", "l"})
_WEIGHT_SMALL_UNITS = frozenset({"gram", "g", "gr"})
_COUNT_UNITS = frozenset({
    "pcs", "pc", "buah", "pack", "bungkus", "botol", "pouch", "sachet",
    "dus", "ikat", "papan", "ekor", "bks", "karung", "sak", "tabung",
})

# Qty di atas ambang + satuan volume/gram kecil → kemungkinan isi kemasan ter-parse salah
_ML_QTY_THRESHOLD = 50
_GRAM_QTY_THRESHOLD = 100


def _to_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _unit_lower(satuan: Any) -> str:
    return str(satuan or "pcs").lower().strip()


def _is_packaged_goods(nama: str, kategori: Optional[str], is_kemasan: bool) -> bool:
    if is_kemasan:
        return True
    if kategori and str(kategori).lower() in ("kemasan", "operasional"):
        return True
    return bool(_PACKAGING_KEYWORDS.search(nama or ""))


def _looks_like_label_volume_qty(qty: float, unit: str, subtotal: float) -> bool:
    u = unit.lower()
    if u in _VOLUME_UNITS and qty >= _ML_QTY_THRESHOLD and subtotal >= 1000:
        return True
    if u in _WEIGHT_SMALL_UNITS and qty >= _GRAM_QTY_THRESHOLD and subtotal >= 1000:
        return True
    # Desimal aneh pada qty (520.059 ml)
    if u in _VOLUME_UNITS and qty != int(qty) and qty > 10:
        return True
    return False


def _normalize_ons(item: Dict[str, Any]) -> None:
    unit = _unit_lower(item.get("satuan"))
    if unit != "ons":
        return
    qty = _to_float(item.get("qty"), 1.0)
    sub = _to_float(item.get("subtotal"), 0)
    item["qty"] = round(qty * 0.1, 3)  # 1 ons = 0.1 kg
    item["satuan"] = "kg"
    if sub > 0 and item["qty"] > 0:
        item["harga_satuan"] = round(sub / item["qty"])


def _normalize_gram_to_kg(item: Dict[str, Any]) -> None:
    unit = _unit_lower(item.get("satuan"))
    if unit not in _WEIGHT_SMALL_UNITS:
        return
    qty = _to_float(item.get("qty"), 0)
    sub = _to_float(item.get("subtotal"), 0)
    if qty < _GRAM_QTY_THRESHOLD:
        return
    item["qty"] = round(qty / 1000, 3)
    item["satuan"] = "kg"
    if sub > 0 and item["qty"] > 0:
        item["harga_satuan"] = round(sub / item["qty"])


def _collapse_packaging_to_pcs(item: Dict[str, Any], nama: str) -> None:
    """Kemasan: qty = jumlah botol/pouch, harga = subtotal per kemasan."""
    qty = _to_float(item.get("qty"), 1.0)
    sub = _to_float(item.get("subtotal"), 0)
    harga = _to_float(item.get("harga_satuan"), 0)
    unit = _unit_lower(item.get("satuan"))

    # Jika sudah pcs/botol dengan qty masuk akal, JANGAN timpa harga
    # Hanya isi harga jika kosong (fallback)
    if unit in _COUNT_UNITS and qty <= 100:
        if sub > 0 and harga <= 0:
            item["harga_satuan"] = round(sub / max(qty, 1))
        return

    if not _looks_like_label_volume_qty(qty, unit, sub):
        return

    # Satu baris harga total per kemasan
    item["qty"] = 1.0
    if "botol" in nama.lower() or unit in ("liter", "l"):
        item["satuan"] = "botol"
    elif "pouch" in nama.lower() or "sachet" in nama.lower():
        item["satuan"] = "pouch"
    else:
        item["satuan"] = "pcs"
    if sub > 0:
        item["harga_satuan"] = round(sub)


def _normalize_borongan(item: Dict[str, Any]) -> None:
    """Hanya nama + subtotal tanpa qty bermakna."""
    qty = _to_float(item.get("qty"), 0)
    sub = _to_float(item.get("subtotal"), 0)
    harga = _to_float(item.get("harga_satuan"), 0)
    if sub <= 0:
        return
    if qty <= 0 or (harga <= 0 and qty == 1 and sub > 0):
        item["qty"] = 1.0
        unit = _unit_lower(item.get("satuan"))
        if unit in _VOLUME_UNITS or unit in _WEIGHT_SMALL_UNITS:
            item["satuan"] = "bks"
        elif unit not in _COUNT_UNITS and unit not in ("kg", "ons"):
            item["satuan"] = item.get("satuan") or "bks"
        item["harga_satuan"] = round(sub)


def normalize_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Terapkan aturan normalisasi pada satu item OCR.
    Mengembalikan item yang sama (mutasi in-place + return).

    ATURAN BARU (v2):
    - TIDAK BOLEH mengubah harga_satuan atau qty jika keduanya sudah non-zero.
    - Hanya mengisi field yang KOSONG/0 (fallback).
    - Menandai math_mismatch jika qty * harga != subtotal.
    """
    if not item:
        return item

    nama = str(item.get("nama_item") or "")
    kategori = item.get("kategori")
    is_kemasan = bool(item.get("is_kemasan_pabrik", False))

    # Dukung field qty_pasti dari skema baru, kembalikan ke key qty agar kompatibel
    if "qty_pasti" in item:
        item["qty"] = item["qty_pasti"]
    if "atribut_kemasan" in item:
        item["kemasan_info"] = item["atribut_kemasan"]

    _normalize_ons(item)
    _normalize_gram_to_kg(item)

    if _is_packaged_goods(nama, kategori, is_kemasan):
        _collapse_packaging_to_pcs(item, nama)

    _normalize_borongan(item)

    # ── Konsistensi harga: HANYA isi field yang KOSONG ──
    qty = _to_float(item.get("qty"), 1.0)
    sub = _to_float(item.get("subtotal"), 0)
    harga = _to_float(item.get("harga_satuan"), 0)

    if sub > 0 and qty > 0 and harga <= 0:
        # Harga kosong, isi dari subtotal/qty (fallback)
        item["harga_satuan"] = round(sub / qty)
    elif harga > 0 and qty > 0 and sub <= 0:
        # Subtotal kosong, isi dari harga*qty (fallback)
        item["subtotal"] = round(harga * qty)

    # ── Deteksi math mismatch (JANGAN perbaiki, hanya tandai) ──
    qty = _to_float(item.get("qty"), 1.0)
    sub = _to_float(item.get("subtotal"), 0)
    harga = _to_float(item.get("harga_satuan"), 0)

    if qty > 0 and harga > 0 and sub > 0:
        expected = round(qty * harga)
        actual = round(sub)
        # Toleransi pembulatan Rp 10
        if abs(expected - actual) > 10:
            item["math_mismatch"] = (
                f"{nama}: {qty} x {int(harga)} = {expected}, "
                f"tapi subtotal nota = {actual}"
            )

    return item


def normalize_ocr_items(items: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    if not items:
        return []
    return [normalize_item(dict(it)) for it in items]


def is_suspicious_unit_price(satuan: str, harga_satuan: Any) -> bool:
    """Harga per ml/gram yang terlalu kecil — indikasi salah parse."""
    u = _unit_lower(satuan)
    try:
        h = float(harga_satuan or 0)
    except (TypeError, ValueError):
        return False
    if h <= 0:
        return False
    if u in _VOLUME_UNITS and h < 500:
        return True
    if u in _WEIGHT_SMALL_UNITS and h < 500:
        return True
    return False

