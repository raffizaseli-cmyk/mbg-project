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


_BULK_STAPLES_PATTERN = re.compile(
    r"\b(beras|minyak|gula|terigu|tepung|telur|telor)\b",
    re.I,
)

_PACKAGING_PATTERN = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(kg|liter|l|g|gram|ml)\b",
    re.I,
)


def _normalize_bulk_packaging(item: Dict[str, Any], nama: str) -> None:
    """
    Jika bahan pokok curah dapur (beras, minyak, gula, terigu) dibeli dalam kemasan
    berisi berat/volume (misal 'Beras Pandan Wangi 5kg' atau 'Minyak Tropical 2L'),
    pastikan kuantitas stok mencerminkan total berat/volume riil (kg/liter),
    bukan '1 kg' atau '1 liter'.
    """
    if not _BULK_STAPLES_PATTERN.search(nama):
        return

    pack_match = _PACKAGING_PATTERN.search(nama)
    if not pack_match:
        return

    pack_val = float(pack_match.group(1))
    pack_unit = pack_match.group(2).lower()
    if pack_unit in ("l", "liter"):
        target_unit = "liter"
    elif pack_unit in ("g", "gram"):
        pack_val = round(pack_val / 1000.0, 3)
        target_unit = "kg"
    elif pack_unit == "kg":
        target_unit = "kg"
    else:
        return

    qty = _to_float(item.get("qty"), 1.0)
    sub = _to_float(item.get("subtotal"), 0.0)
    current_unit = _unit_lower(item.get("satuan"))

    # Jika di nota qty adalah jumlah kemasan (misal 1 sak/pouch atau qty=1)
    if current_unit in ("pcs", "pack", "bks", "sak", "karung", "pouch", "botol", target_unit) and qty <= 50:
        real_qty = round(qty * pack_val, 3)
        item["qty"] = real_qty
        item["satuan"] = target_unit
        if sub > 0:
            item["harga_satuan"] = round(sub / real_qty)


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
    _normalize_bulk_packaging(item, nama)

    if _is_packaged_goods(nama, kategori, is_kemasan):
        _collapse_packaging_to_pcs(item, nama)

    _normalize_borongan(item)

    # ── Rekonsiliasi harga dan subtotal matematis ──
    qty = _to_float(item.get("qty"), 1.0)
    sub = _to_float(item.get("subtotal"), 0.0)
    harga = _to_float(item.get("harga_satuan"), 0.0)

    # 1. Jika harga kosong/0 tapi subtotal ada
    if sub > 0 and qty > 0 and harga <= 0:
        item["harga_satuan"] = round(sub / qty)
        harga = item["harga_satuan"]

    # 2. Jika subtotal kosong/0 tapi harga ada
    elif harga > 0 and qty > 0 and sub <= 0:
        item["subtotal"] = round(harga * qty)
        sub = item["subtotal"]

    # 3. Kasus kasir menyalin subtotal ke kolom harga (contoh: Bawang Merah 0.5kg harga=20.000 subtotal=20.000)
    # Jika harga == subtotal dan qty != 1.0, maka 20.000 adalah subtotal nota, bukan harga per kg!
    elif sub > 0 and qty > 0 and qty != 1.0 and abs(harga - sub) < 1.0:
        item["harga_satuan"] = round(sub / qty)
        harga = item["harga_satuan"]

    # 4. Kasus ketidakcocokan matematis kasir (misal: 0.5 x 13.500 tapi subtotal 15.500)
    elif sub > 0 and qty > 0 and harga > 0:
        expected = round(qty * harga)
        actual = round(sub)
        if abs(expected - actual) > 10:
            item["math_mismatch"] = (
                f"{nama}: di nota tertulis {qty} x {int(harga)} = {expected}, "
                f"tetapi subtotal nota = {actual}"
            )
            # Prioritaskan subtotal riil (uang kas keluar) dan hitung ulang harga per unit riil
            item["harga_satuan"] = round(sub / qty)
            harga = item["harga_satuan"]

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

