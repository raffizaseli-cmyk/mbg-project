"""
backend/utils/unit_converter.py
Konversi satuan: base unit (gram/ml/pcs) ↔ display unit (kg/liter/pcs/dll)

Aturan:
- DB selalu simpan dalam BASE UNIT (gram / ml / pcs)
- Konversi ke display HANYA saat tampil ke user
- Satuan "ambigu" (ikat, papan, sisir, dll) TIDAK punya faktor gram universal.
  Kalau butuh akurat, override per bahan baku di level data, bukan di sini.
"""

from typing import Tuple


# ─── SATUAN BERAT (→ gram) ─────────────────────────────────────────────────

SATUAN_BERAT = {
    # Metrik umum
    "kg": 1000, "kilogram": 1000, "kilograms": 1000, "kilo": 1000,
    "ons": 100, "hg": 100, "hektogram": 100,
    "gram": 1, "g": 1, "gr": 1, "grams": 1,
    "mg": 0.001, "miligram": 0.001, "milligram": 0.001, "milligrams": 0.001,
    "kwintal": 100000,             # 1 kwintal = 100 kg
    "ton": 1_000_000,              # 1 ton = 1000 kg
    "kuintal": 100000,             # alias ejaan lain

    # Imperial (kadang muncul di nota bahan impor)
    "oz": 28.35, "ounce": 28.35, "ounces": 28.35,
    "lb": 453.592, "lbs": 453.592, "pound": 453.592, "pounds": 453.592,

    # Tradisional Asia (perkiraan, bisa beda di pasar tertentu)
    "kati": 600, "kati_cina": 605,  # umum dibulatkan 600 gr di pasar Indonesia
    "pikul": 60000,                 # 1 pikul ≈ 60 kg (jarang dipakai lagi)
    "tail": 37.8,                   # satuan emas/rempah tradisional Tionghoa
}

# ─── SATUAN CAIR (→ ml) ─────────────────────────────────────────────────────

SATUAN_CAIR = {
    "liter": 1000, "liters": 1000, "l": 1000, "litre": 1000, "litres": 1000,
    "ml": 1, "mililiter": 1, "milliliter": 1, "milliliters": 1,
    "cc": 1,
    "cl": 10, "centiliter": 10, "centiliters": 10,
    "dl": 100, "desiliter": 100, "deciliter": 100, "deciliters": 100,

    # Satuan dapur non-metrik yang sering ditulis manual di nota/resep
    "sdm": 15, "sendok_makan": 15, "tbsp": 15,
    "sdt": 5, "sendok_teh": 5, "tsp": 5,
    "gelas": 250,                  # gelas belimbing standar dapur ~250ml
    "cup": 240,                    # cup takar US
    "galon": 19000,                # galon air isi ulang Indonesia = 19L
    "galon_us": 3785,              # kalau memang literatur US gallon
    "jerigen": 5000,               # default umum 5L, sebaiknya di-override per item
    "drum": 200000,                # drum minyak/bahan cair industri = 200L (perkiraan)
}

# ─── SATUAN COUNTABLE / PER-ITEM (→ pcs, faktor selalu 1 kecuali dikonversi manual) ──

SATUAN_COUNTABLE = {
    # Generik
    "pcs": 1, "pc": 1, "buah": 1, "butir": 1, "biji": 1,
    "unit": 1, "item": 1, "komponen": 1, "porsi": 1,

    # Kemasan / packaging
    "bungkus": 1, "pack": 1, "pak": 1, "dus": 1, "karton": 1,
    "botol": 1, "pouch": 1, "sachet": 1, "kaleng": 1, "kardus": 1,
    "krat": 1,          # umumnya krat telur = 15 butir, krat botol = 24 → override per item
    "peti": 1,
    "box": 1, "mika": 1, "nampan": 1, "loyang": 1,
    "karung": 1, "sak": 1,   # ada override khusus di get_base_unit (default 25kg)

    # Satuan pasar tradisional (AMBIGU — tidak universal, treated sebagai 1 unit)
    "ikat": 1, "unting": 1, "iket": 1,
    "sisir": 1,          # pisang per sisir
    "tandan": 1,         # pisang/kelapa sawit per tandan
    "papan": 1,          # tahu/telur per papan
    "lembar": 1,         # tahu, kulit lumpia, daun pisang
    "potong": 1,         # daging/ikan per potong
    "batang": 1,         # sereh, wortel, terong
    "siung": 1,          # bawang putih per siung
    "ruas": 1,           # jahe/kunyit/lengkuas per ruas
    "genggam": 1,        # bumbu daun per genggam
    "gelondong": 1,      # tebu, terasi
    "ekor": 1,           # ikan/ayam per ekor
    "bks": 1,            # singkatan bungkus

    # Satuan hitung kuantitas standar (bukan pasar, tapi kadang muncul di ATK/non-food)
    "lusin": 12, "dozen": 12,
    "kodi": 20,
    "gross": 144,
    "rim": 500,
}

# ─── Default fallback untuk satuan "kemasan besar" yang perlu asumsi berat ──

SAK_KG_DEFAULT = 25        # 1 sak beras umum ~25 kg
KARUNG_KG_DEFAULT = 25     # 1 karung umum diasumsikan sama dengan sak
PAPAN_TELUR_QTY = 30       # 1 papan telur umumnya = 30 butir (kalau butuh convert ke butir)

ALL_UNITS = {
    **{k: ("gram", v) for k, v in SATUAN_BERAT.items()},
    **{k: ("ml", v) for k, v in SATUAN_CAIR.items()},
    **{k: ("pcs", v) for k, v in SATUAN_COUNTABLE.items()},
}


def get_base_unit(display_unit: str) -> Tuple[str, float]:
    """
    Return (base_unit, conversion_factor) dari display_unit.
    Contoh:
        'kg'     → ('gram', 1000)
        'liter'  → ('ml', 1000)
        'pcs'    → ('pcs', 1)
        'sak'    → ('gram', 25000)   # default 25 kg
        'karung' → ('gram', 25000)  # default 25 kg
        'ikat'   → ('pcs', 1)       # AMBIGU, sebaiknya override per bahan baku
    """
    unit = display_unit.lower().strip()

    # Override khusus untuk satuan kemasan besar yang butuh asumsi berat
    if unit == "sak":
        return ("gram", SAK_KG_DEFAULT * 1000)
    if unit == "karung":
        return ("gram", KARUNG_KG_DEFAULT * 1000)

    result = ALL_UNITS.get(unit)
    if result:
        return result

    # Fallback: anggap sebagai pcs × 1 (satuan tidak dikenal)
    return ("pcs", 1)


def to_base(value: float, display_unit: str, factor: float = None) -> float:
    """
    Konversi nilai dari display_unit ke base_unit.
    Contoh: to_base(50, 'kg') → 50000 (gram)
    """
    if factor is not None:
        return value * factor
    _, f = get_base_unit(display_unit)
    return value * f


def to_display(base_value: float, conversion_factor: float) -> float:
    """
    Konversi dari base_unit ke display_unit.
    Contoh: to_display(50000, 1000) → 50 (kg)
    """
    if conversion_factor == 0:
        return base_value
    return base_value / conversion_factor


def format_display(
    base_value: float,
    display_unit: str,
    conversion_factor: float,
) -> str:
    """
    Format nilai untuk ditampilkan ke user.
    Contoh: format_display(50000, 'kg', 1000) → '50 kg'
            format_display(200, 'pcs', 1) → '200 pcs'
    """
    display_val = to_display(base_value, conversion_factor)
    if display_val == int(display_val):
        return f"{int(display_val)} {display_unit}"
    return f"{display_val:.2f} {display_unit}"


STANDARD_METRIC_UNITS = {
    "kg", "g", "gr", "gram", "ons", "hg",
    "l", "liter", "ml", "cc",
    "kwintal", "ton",
}

def is_standard_metric(unit: str) -> bool:
    """Check if the unit is a standard international/national metric unit."""
    return (unit or "").strip().lower() in STANDARD_METRIC_UNITS

def resolve_standard_unit_conversion(val: float, unit: str) -> tuple[float, str]:
    """
    Converts standard metric units (kg, l, ons, etc.) to base units (gram/ml).
    If unit is a standard metric unit, returns (converted_value, base_unit).
    Otherwise returns (original_val, unit).
    """
    u_clean = (unit or "").strip().lower()
    if is_standard_metric(u_clean):
        base_unit, factor = get_base_unit(u_clean)
        return val * factor, base_unit
    return val, unit


def is_ambiguous_unit(unit: str) -> bool:
    """
    True kalau satuan ini TIDAK punya faktor konversi berat/volume yang pasti
    (misal: ikat, papan, sisir, siung). Berguna untuk kasih warning di UI
    input bahan baku, supaya admin SPPG diminta isi konversi gram manual.
    """
    AMBIGUOUS = {
        "ikat", "unting", "iket", "sisir", "tandan", "papan", "lembar",
        "potong", "batang", "siung", "ruas", "genggam", "gelondong",
        "krat", "peti", "goni", "karung", "sak", "pouch", "sachet",
        "botol", "box", "pack", "bks", "bungkus", "dus"
    }
    return (unit or "").strip().lower() in AMBIGUOUS