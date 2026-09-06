"""
Normalisasi item hasil OCR nota belanja (pembukuan/stok).

Terpisah dari nutrition_ref / nutrition_aliases — hanya aturan deterministik
untuk kemasan pabrik, curah, dan satuan pasar.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

_VOLUME_UNITS = frozenset({"ml", "cc", "liter", "l"})
_WEIGHT_SMALL_UNITS = frozenset({"gram", "g", "gr"})
_WEIGHT_LARGE_UNITS = frozenset({"kg", "kilogram"})

# Bentuk wadah kemasan fisik universal (retail / grosir Indonesia) - BUKAN daftar merk!
_CONTAINER_FORMS = frozenset({
    "botol", "bottle", "pouch", "sachet", "karton", "kaleng", "can",
    "tube", "cup", "dus", "pack", "strip", "refill", "galon", "gallon",
    "roll", "jar", "pet", "jerigen", "kotak", "box", "sak", "karung",
    "ikat", "papan", "ekor", "bks", "bungkus", "buah", "biji", "btr", "butir", "pcs", "pc"
})

# Ekstraksi ukuran kemasan metrik universal (berlaku untuk SEMUA produk baru/lama: 5kg, 10kg, 2L, 750ml, 500g, dll.)
_METRIC_SIZE_PATTERN = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(kg|liter|l|g|gram|gr|ml|cc)\b",
    re.I,
)

# Indikator non-pangan universal untuk klasifikasi operasional / sanitasi dapur jika kategori belum terisi
_NON_FOOD_INDICATORS = re.compile(
    r"\b(sabun|deterjen|pembersih|tissue|tisu|shampoo|shampo|sikat|plastik|karbol|pel|pewangi|cuci)\b",
    re.I,
)


def _to_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _unit_lower(satuan: Any) -> str:
    return str(satuan or "pcs").lower().strip()


def _detect_container_unit(nama: str, default: str = "pcs") -> str:
    nama_lower = nama.lower()
    for form in ("botol", "pouch", "sachet", "jerigen", "kaleng", "dus", "karton", "tube", "cup", "jar", "roll", "sak", "karung", "pack"):
        if form in nama_lower:
            return form
    return default


def _is_non_food_item(nama: str, kategori: Optional[str]) -> bool:
    """Deteksi universal apakah item adalah perlengkapan non-pangan (kebersihan/operasional)."""
    kat = str(kategori or "").lower().strip()
    if kat in ("kebersihan_dapur", "operasional", "bahan_kemasan", "alat_tulis"):
        return True
    return bool(_NON_FOOD_INDICATORS.search(nama))


def _normalize_multiplier_in_name(item: Dict[str, Any], nama: str) -> None:
    """
    Ekstrak pengali tersembunyi di nama barang jika raw_qty bernilai 1.0 atau ambigu.
    Contoh: 'Indomie Goreng (x15 bks)' -> qty: 15, satuan: 'bks'
    Contoh: 'Gula Pasir 1kg (x2)' -> multiplier: 2
    """
    qty = _to_float(item.get("qty"), 1.0)
    match = re.search(r"\(x\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\)", nama, re.I)
    if not match:
        match = re.search(r"\bx\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\b", nama, re.I)

    if match and qty == 1.0:
        mult_val = float(match.group(1))
        unit_hint = (match.group(2) or "").lower().strip()
        if mult_val > 1:
            item["qty"] = mult_val
            if unit_hint in _CONTAINER_FORMS:
                item["satuan"] = unit_hint


def _normalize_packaging_and_metrics(item: Dict[str, Any], nama: str, kategori: Optional[str], is_kemasan: bool) -> None:
    """
    Penanganan metrik kemasan secara universal tanpa hardcode merek:
    1. Barang Non-Pangan (kebersihan dapur, tisu, dsb):
       Distok per kemasan fisik (pouch/botol/pack/pcs).
       Jika OCR salah menyalin volume (misal '750 ml') ke qty, dikoreksi ke 1 pouch/botol.
    2. Bahan Pangan / Masakan Dapur:
       - Kemasan berlabel KG atau LITER (misal 5kg, 10kg, 25kg, 2L, 5L):
         Dikonversi ke total metrik riil (kg / liter) agar stok & resep dapur akurat.
       - Kemasan kecil berlabel ML atau Gram dalam sachet/kotak (misal 520ml, 340ml, 160g):
         Tetap distok per wadah (pouch, botol, kotak) dengan harga per kemasan.
    """
    qty = _to_float(item.get("qty"), 1.0)
    sub = _to_float(item.get("subtotal"), 0.0)
    satuan = _unit_lower(item.get("satuan"))
    attr_kemasan = item.get("atribut_kemasan") or item.get("kemasan_info")

    # Ekstraksi ukuran kemasan metrik dari nama atau atribut
    pack_match = _METRIC_SIZE_PATTERN.search(attr_kemasan or "") or _METRIC_SIZE_PATTERN.search(nama)
    metric_val = 0.0
    metric_unit = ""
    if pack_match:
        metric_val = float(pack_match.group(1))
        metric_unit = pack_match.group(2).lower()
        if metric_unit in ("l", "liter"):
            metric_unit = "liter"
        elif metric_unit in ("ml", "cc"):
            metric_unit = "ml"
        elif metric_unit in ("g", "gram", "gr"):
            metric_unit = "gram"
        elif metric_unit in ("kg", "kilogram"):
            metric_unit = "kg"

    # Disambiguasi ekonomi: apakah OCR salah memasukkan volume isi label ke kuantitas?
    # Contoh: Sunlight 750ml dibaca qty=750 ml, subtotal=18.000. Rasio Rp 24/botol = mustahil.
    is_volume_as_qty = False
    if satuan in _VOLUME_UNITS and qty >= 50 and sub > 0:
        if (sub / qty) < 100 or sub <= 250000:
            is_volume_as_qty = True
    elif satuan in _WEIGHT_SMALL_UNITS and qty >= 100 and sub > 0:
        if is_kemasan and (sub / qty) < 100 and sub <= 200000:
            is_volume_as_qty = True

    # A. NON-PANGAN (Kebersihan Dapur, Operasional, Bahan Kemasan, Alat Tulis)
    if _is_non_food_item(nama, kategori):
        if is_volume_as_qty or satuan in _VOLUME_UNITS or satuan in _WEIGHT_SMALL_UNITS:
            container_unit = _detect_container_unit(
                nama,
                "pouch" if "pouch" in nama.lower() or "refill" in nama.lower() else "botol" if "botol" in nama.lower() else "pcs"
            )
            item["qty"] = 1.0
            item["satuan"] = container_unit
            if sub > 0:
                item["harga_satuan"] = round(sub)
        return

    # B. BAHAN PANGAN / MASAKAN DAPUR
    # Kasus: Kemasan curah besar bertanda 'kg' atau 'liter' (Beras 5kg, Ketan 10kg, Minyak 2L, Kedelai 25kg, dsb.)
    if metric_val > 0 and metric_unit in ("kg", "liter"):
        target_unit = metric_unit
        if satuan in _CONTAINER_FORMS or satuan in (target_unit, "pcs"):
            if qty <= 100:  # batas wajar pembelian dapur
                real_qty = round(qty * metric_val, 3)
                item["qty"] = real_qty
                item["satuan"] = target_unit
                if sub > 0:
                    item["harga_satuan"] = round(sub / real_qty)
        return

    # Kasus: Kemasan pabrik kecil (Kecap 520ml, Saus 340ml, Mama Lemon, Sabun, dll)
    # Jika salah ter-parse sebagai ml/gram di kolom qty:
    if is_volume_as_qty:
        container_unit = _detect_container_unit(
            nama,
            "pouch" if "pouch" in nama.lower() or "refill" in nama.lower() else "botol" if "botol" in nama.lower() else "bks"
        )
        item["qty"] = 1.0
        item["satuan"] = container_unit
        if sub > 0:
            item["harga_satuan"] = round(sub)


def _normalize_loose_produce(item: Dict[str, Any]) -> None:
    """Normalisasi komoditas curah pasar segar (ons/gram ke kg)."""
    unit = _unit_lower(item.get("satuan"))
    qty = _to_float(item.get("qty"), 0.0)
    sub = _to_float(item.get("subtotal"), 0.0)

    if unit == "ons" and qty > 0:
        item["qty"] = round(qty * 0.1, 3)
        item["satuan"] = "kg"
        if sub > 0 and item["qty"] > 0:
            item["harga_satuan"] = round(sub / item["qty"])

    elif unit in _WEIGHT_SMALL_UNITS and qty >= 100:
        item["qty"] = round(qty / 1000.0, 3)
        item["satuan"] = "kg"
        if sub > 0 and item["qty"] > 0:
            item["harga_satuan"] = round(sub / item["qty"])


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
        elif unit not in _CONTAINER_FORMS and unit not in ("kg", "ons"):
            item["satuan"] = item.get("satuan") or "bks"
        item["harga_satuan"] = round(sub)


def reconcile_row_math(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mesin perhitungan matematika multi-skenario untuk setiap baris nota.
    Mendeteksi hubungan antara kuantitas, harga satuan, dan subtotal,
    serta menyelesaikan anomali penulisan nota kasir maupun salah baca OCR:

    Skenario 0: Barang Gratis / Hadiah Promo (Subtotal & Harga <= 0)
    Skenario 1: Qty Kosong/0, tapi Harga Satuan & Subtotal ada -> hitung qty = sub / harga
    Skenario 2: Harga Satuan Kosong/0, tapi Subtotal & Qty ada -> hitung harga = sub / qty
    Skenario 3: Subtotal Kosong/0, tapi Harga Satuan & Qty ada -> hitung subtotal = qty * harga
    Skenario 4: Kolom Terbalik / Inverted oleh AI OCR (Harga Satuan & Subtotal tertukar)
    Skenario 5: Kasir menyalin Subtotal ke Kolom Harga Satuan (Bawang 0.5kg harga=14.500 sub=14.500)
    Skenario 6: Satuan Gram dengan Harga Satuan Tercantum per Kilogram
    Skenario 7: Ketidakcocokan Matematis Kasir / Selisih Pembulatan Kasir Pasar
    Skenario 8: Borongan / Paket / Jasa
    """
    qty = _to_float(item.get("qty"), 0.0)
    harga = _to_float(item.get("harga_satuan"), 0.0)
    sub = _to_float(item.get("subtotal"), 0.0)
    nama = str(item.get("nama_item") or "")
    unit = _unit_lower(item.get("satuan"))

    # Skenario 0: Barang Gratis / Hadiah Promo
    if sub <= 0 and harga <= 0:
        if qty <= 0:
            item["qty"] = 1.0
        item["harga_satuan"] = 0.0
        item["subtotal"] = 0.0
        return item

    # Skenario 1: Qty Kosong/0, tetapi Harga Satuan dan Subtotal ada
    # Contoh di nota: "@Rp 20.000, Total Rp 60.000" tanpa kolom kuantitas
    if qty <= 0 and harga > 0 and sub > 0:
        calc_qty = round(sub / harga, 3)
        item["qty"] = calc_qty
        qty = calc_qty

    # Skenario 2: Harga Satuan kosong/0 (atau null), Subtotal & Qty ada
    # Pola nota pasar tradisional: kasir cuma nulis subtotal baris (misal: 0.5 kg -> 15.500)
    elif harga <= 0 and sub > 0 and qty > 0:
        item["harga_satuan"] = round(sub / qty)
        harga = item["harga_satuan"]

    # Skenario 3: Subtotal kosong/0, Harga Satuan & Qty ada
    # Kasir lupa mencantumkan subtotal baris
    elif sub <= 0 and harga > 0 and qty > 0:
        item["subtotal"] = round(qty * harga)
        sub = item["subtotal"]

    # Skenario 4: Kolom Terbalik / Inverted oleh AI OCR (Harga Satuan & Subtotal tertukar)
    # Contoh: Qty = 5, Harga = 50.000, Subtotal = 10.000 (Padahal 5 x 10.000 = 50.000)
    elif qty > 1.0 and harga > sub and abs(round(sub * qty) - harga) <= 10:
        item["math_mismatch"] = (
            f"{nama}: kolom harga dan subtotal tertukar. "
            f"Disesuaikan menjadi {qty} x Rp {int(sub):,} = Rp {int(harga):,}"
        )
        item["harga_satuan"] = round(sub)
        item["subtotal"] = round(harga)
        harga, sub = item["harga_satuan"], item["subtotal"]

    # Skenario 5: Kasir menyalin Subtotal ke Kolom Harga Satuan
    # Contoh: Bawang Merah 0.5 kg, harga = 14.500, subtotal = 14.500
    # Jika qty != 1.0 dan harga == subtotal, 14.500 adalah subtotal, bukan harga per kg!
    elif qty > 0 and qty != 1.0 and sub > 0 and abs(harga - sub) < 1.0:
        item["harga_satuan"] = round(sub / qty)
        harga = item["harga_satuan"]

    # Skenario 6: Satuan Gram dengan Harga Satuan Tercantum per Kilogram
    # Contoh: Cabai 250 gram, harga = 60.000, subtotal = 15.000
    # (250 / 1000) * 60.000 = 15.000
    elif unit in _WEIGHT_SMALL_UNITS and qty >= 50 and harga > 0 and sub > 0:
        kg_qty = qty / 1000.0
        if abs(round(kg_qty * harga) - sub) <= 10:
            item["qty"] = round(kg_qty, 3)
            item["satuan"] = "kg"
            qty = item["qty"]

    # Skenario 7: Ketidakcocokan Matematis Kasir (Math Mismatch / Selisih Pembulatan Kasir)
    elif qty > 0 and harga > 0 and sub > 0:
        expected = round(qty * harga)
        actual = round(sub)
        if abs(expected - actual) > 10:
            item["math_mismatch"] = (
                f"{nama}: di nota tertulis {qty} {unit} x Rp {int(harga):,} = Rp {expected:,}, "
                f"tetapi subtotal nota = Rp {actual:,}"
            )
            # Prioritaskan kas riil keluar (subtotal nota), hitung harga satuan riil
            item["harga_satuan"] = round(sub / qty)
            harga = item["harga_satuan"]

    # Skenario 8: Borongan / Paket / Jasa
    if "borongan" in nama.lower() or "paket" in nama.lower():
        item["qty"] = 1.0
        item["satuan"] = "paket"
        item["harga_satuan"] = round(sub)
        item["subtotal"] = round(sub)

    item["qty"] = qty
    item["harga_satuan"] = harga
    item["subtotal"] = sub
    return item


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

    _normalize_multiplier_in_name(item, nama)
    _normalize_packaging_and_metrics(item, nama, kategori, is_kemasan)
    _normalize_loose_produce(item)
    _normalize_borongan(item)
    reconcile_row_math(item)

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

