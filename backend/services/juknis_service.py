"""
backend/services/juknis_service.py
Auto-kategorisasi transaksi berdasarkan nama item sesuai juknis MBG.
Kategori: bahan_pangan (80%) / operasional (5%) / insentif (15%) / lainnya
"""

import logging
from typing import List

logger = logging.getLogger(__name__)

KEYWORD_MAP = {
    "bahan_pangan": [
        "beras", "ayam", "daging", "ikan", "telur",
        "tahu", "tempe", "sayur", "buah", "minyak",
        "tepung", "gula", "garam", "bumbu", "santan",
        "susu", "pisang", "wortel", "bayam", "kol",
        "kentang", "tomat", "bawang", "cabai", "kecap",
        "merica", "lada", "kunyit", "jahe", "serai",
        "daun", "kangkung", "terong", "pare", "labu",
        "udang", "cumi", "tuna", "lele", "nila",
        "sarden", "kornet", "sosis", "nugget", "bakso",
        "keju", "mentega", "margarin", "roti", "mie",
    ],
    "operasional": [
        "gas", "lpg", "listrik", "bensin", "solar",
        "bbm", "sewa", "plastik", "kemasan", "kardus",
        "sabun", "tissue", "deterjen", "tisu",
        "sarung tangan", "masker", "air galon",
        "atk", "kertas", "tinta", "piring", "sendok",
        "garpu", "mangkok", "gelas", "wadah", "aluminium",
        "serbet", "lap", "sapu", "pel",
    ],
    "insentif": [
        "upah", "gaji", "honor", "insentif",
        "transport", "uang makan", "ongkos", "relawan",
        "tunjangan", "bonus", "lembur",
    ],
}


def auto_categorize(item_names: List[str]) -> str:
    """
    Kategorisasi otomatis dari nama item.
    Cek keyword map (tanpa API call).
    """
    combined = " ".join(item_names).lower()

    for category, keywords in KEYWORD_MAP.items():
        if any(kw in combined for kw in keywords):
            return category

    return "lainnya"
