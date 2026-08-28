"""
backend/services/ocr_service.py
OCR nota via Google Gemini 1.5 Flash Vision — Modul 7

Alur:
  1. Download foto dari URL (Supabase Storage atau URL publik)
  2. Encode ke base64
  3. Kirim ke Gemini Vision dengan prompt MASTER_PLAN
  4. Parse JSON response
  5. Return dict atau None jika gagal
"""

import base64
import json
import logging
import re
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

# Prompt OCR — pembelian/stok (terpisah dari nutrition_ref / kamus gizi)
# === VERSI 2: MODE TRANSKRIP BUTA ===
# AI DILARANG memperbaiki matematika kasir. Salin persis apa adanya.
OCR_PROMPT = """Kamu adalah mesin OCR transkrip nota belanja. Tugasmu HANYA menyalin
teks yang tertera di nota PERSIS APA ADANYA. Kamu BUKAN kalkulator dan BUKAN editor.

Jika foto berisi LEBIH DARI SATU nota/struk, return JSON ARRAY (satu object per nota).
Jika hanya 1 nota, tetap return ARRAY dengan 1 element.

Return HANYA JSON valid tanpa teks lain:
[
  {
    "nama_toko": "nama toko PERSIS dari nota atau null",
    "alamat_toko": "alamat toko jika ada atau null",
    "no_telp_toko": "nomor telepon toko jika ada atau null",
    "tanggal": "YYYY-MM-DD atau null",
    "no_nota": "nomor faktur/struk atau null",
    "kasir": "nama kasir jika ada atau null",
    "is_pkp": false,
    "payment_method": "tunai/transfer/hutang atau null",
    "payment_status": "lunas/belum_lunas/cicil atau null",
    "due_date": "YYYY-MM-DD atau null",
    "items": [
      {
        "raw_name": "nama PERSIS seperti tertulis di nota (ejaan asli, brand asli)",
        "nama_canonical": "nama bersih HANYA untuk singkatan pasar, atau null",
        "raw_qty": 1.0,
        "satuan": "kg/liter/pcs/gram/ikat/buah/botol/pouch/bks/dus/goni/ktk/dll",
        "raw_price": 0,
        "raw_subtotal": 0,
        "has_ppn": false,
        "kategori": "bahan_pangan/kebersihan_dapur/bahan_kemasan/operasional/alat_tulis/lainnya",
        "is_kemasan_pabrik": false,
        "atribut_kemasan": "misal 2L atau 520ml jika ada di label kemasan, atau null"
      }
    ],
    "subtotal_nota": 0,
    "diskon": 0,
    "ppn_amount": 0,
    "total": 0,
    "catatan": null,
    "ocr_confidence": 0.95,
    "unclear_items": [],
    "math_mismatches": []
  }
]

══════════════════════════════════════════════════════════════════
█ ATURAN MUTLAK #1: DILARANG KERAS MEMPERBAIKI MATEMATIKA KASIR █
══════════════════════════════════════════════════════════════════
- Salin qty, harga_satuan, dan subtotal PERSIS seperti yang tertulis di nota.
- Jika kasir menulis: qty=2, harga=18.000, subtotal=54.000
  → SALIN: raw_qty=2, raw_price=18000, raw_subtotal=54000
  → JANGAN ubah raw_price menjadi 27000 supaya "2 x 27000 = 54000".
  → JANGAN ubah raw_qty menjadi 3 supaya "3 x 18000 = 54000".
- Jika qty × harga ≠ subtotal, BIARKAN. Masukkan ke "math_mismatches" dengan merujuk nama itemnya langsung sebagai jangkar (anchor), BUKAN nomor baris.
  Contoh: ["Item 'Gula Pasir': qty 2 x harga 18000 ≠ subtotal 54000"]
- Kamu BUKAN akuntan. Kamu BUKAN kalkulator. JANGAN pernah menghitung ulang.

══════════════════════════════════════════════════════════════════
█ ATURAN MUTLAK #2: PERTAHANKAN NAMA BRAND/MEREK ASLI           █
══════════════════════════════════════════════════════════════════
- raw_name: SALIN PERSIS teks di nota, termasuk merek/brand.
  → "Indomie Telor Soto" → raw_name: "Indomie Telor Soto" (BUKAN "Mie Instan")
  → "Bimoli 2L" → raw_name: "Bimoli 2L" (BUKAN "Minyak Goreng")
  → "Gulaku 1kg" → raw_name: "Gulaku 1kg" (BUKAN "Gula Pasir")
  → "ABC Kecap Manis" → raw_name: "ABC Kecap Manis" (BUKAN "Kecap")
- nama_canonical: HANYA gunakan untuk menerjemahkan singkatan pasar tradisional.
  → "Bamer" → nama_canonical: "Bawang Merah"
  → "Baput" → nama_canonical: "Bawang Putih"
  → "Aym" → nama_canonical: "Ayam Potong"
  → "Indomie Telor Soto" → nama_canonical: null (JANGAN ubah, sudah jelas)
  → "Bimoli 2L" → nama_canonical: null (JANGAN generalisasi ke "Minyak Goreng")

══════════════════════════════════════════════════════════════════
█ ATURAN MUTLAK #3: JANGAN MENEBAK TULISAN TIDAK JELAS          █
══════════════════════════════════════════════════════════════════
- Jika tulisan buram/tidak terbaca, JANGAN menebak atau mengkarang.
- Masukkan ke "unclear_items" dengan menyebutkan nama barang terdekat sebagai jangkar (anchor), BUKAN nomor baris.
  Contoh: ["Item di bawah 'Gula Pasir': tulisan tidak terbaca, terlihat seperti '???ng'"]
- Turunkan ocr_confidence secara signifikan (0.3-0.6) jika banyak item tidak jelas.
- Lebih baik melewatkan item daripada memasukkan data yang dikarang/ditebak.

══════════════════════════════════════════════════════════════════
█ ATURAN FORMAT DATA                                              █
══════════════════════════════════════════════════════════════════
- SELALU return JSON ARRAY (bahkan jika hanya 1 nota)
- Jika foto berisi 2+ nota terpisah, buat object terpisah untuk masing-masing
- Harga angka bulat tanpa titik/koma ribuan (12000 bukan 12.000)
- raw_qty: jumlah murni/fisik dari item seperti tertulis di nota
- satuan: SALIN satuan persis dari nota (goni, ktk, dus, sak, dll)
- atribut_kemasan: isi/ukuran label kemasan (2L, 500ml, 1kg) JANGAN gabung ke raw_qty
- has_ppn: true HANYA jika ada simbol pajak (seperti tanda *, T, N, atau Tax) di sebelah harga item, atau jika nota secara eksplisit memisahkan PPN di bagian bawah. Jika tidak ada tanda visual tersebut (terutama nota tulis tangan pasar), isi false.
- is_pkp: true jika ada NPWP/Faktur Pajak/nomor FP di nota
- Field tidak ada di nota: isi null, JANGAN tebak atau karang

BARANG KEMASAN PABRIK (kecap, sabun, indomie, susu kotak, minyak botol):
- is_kemasan_pabrik: true
- raw_qty = jumlah fisik kemasan (botol/pouch/pcs/dus/ktk), BUKAN isi ml/gram
- Contoh BENAR: Kecap 520ml Rp21000 → raw_qty 1, satuan pouch, raw_price 21000, raw_subtotal 21000
- Minyak/susu: jika harga per botol/karton, pakai pcs/botol/dus

BARANG CURAH (beras, sayur, daging, cabai timbang):
- is_kemasan_pabrik: false
- Gunakan satuan sesuai nota (kg, gram, ons, goni, sak)
- JANGAN perbaiki atau hitung ulang harga satuan murni ke Kg. Salin persis apa adanya.
- Contoh: Cabai 250 gram Rp15000 → raw_qty 250 (atau 0.25 jika tertulis 0.25 di nota), satuan gram (atau kg jika tertulis kg), raw_price 15000, raw_subtotal 15000. JANGAN menghitung harga per kg menjadi 60000.

NOTA PASAR TRADISIONAL:
- Setengah/1/2=0.5, seperempat/1/4=0.25, tiga perempat/3/4=0.75
- Hanya nama+harga tanpa berat: raw_qty 1, satuan bks atau pcs, raw_price=raw_subtotal
- Sayur: ikat/unting → satuan ikat. Tempe: papan. Ayam/ikan: ekor jika tertulis
- sak/goni = karung (raw_qty jumlah sak/goni, BUKAN kg kecuali tertulis)

CHECKLIST TERAKHIR SEBELUM RETURN:
✓ Apakah semua raw_price PERSIS dari nota? (bukan hasil bagi subtotal/qty)
✓ Apakah semua raw_qty PERSIS dari nota? (bukan hasil bagi subtotal/harga)
✓ Apakah nama brand/merek dipertahankan di raw_name?
✓ Apakah tulisan tidak jelas sudah masuk unclear_items?
✓ Apakah ketidakcocokan matematika sudah masuk math_mismatches?"""


class OCRService:
    """
    Service untuk ekstrak data nota via Google Gemini 1.5 Flash Vision.
    Digunakan oleh ocr_worker (sync context).
    """

    def __init__(self) -> None:
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_ocr_model
        self.api_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

    def extract_from_bytes(
        self, image_bytes: bytes, mime_type: str = "image/jpeg"
    ) -> Optional[dict]:
        """
        Kirim bytes gambar ke Gemini Vision, return parsed dict atau None.
        Sync (non-async) karena dipanggil dari RQ worker.
        """
        if not self.api_key:
            logger.error("GEMINI_API_KEY tidak dikonfigurasi")
            return None

        b64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": OCR_PROMPT},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 8192,
            },
        }

        try:
            with httpx.Client(timeout=60) as client:
                resp = client.post(self.api_url, json=payload)
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return None

        try:
            text = (
                data["candidates"][0]["content"]["parts"][0]["text"]
            )
            # Strip markdown code fences jika ada
            text = re.sub(r"```json\s*", "", text)
            text = re.sub(r"```\s*", "", text)
            parsed = json.loads(text.strip())

            # Normalize: selalu return list of dicts
            if isinstance(parsed, dict):
                return [parsed]
            elif isinstance(parsed, list):
                return parsed
            else:
                logger.error(f"OCR unexpected type: {type(parsed)}")
                return None
        except (KeyError, json.JSONDecodeError, IndexError) as e:
            logger.error(f"OCR parse error: {e} | raw: {data}")
            return None

    def extract_from_url(self, photo_url: str) -> Optional[dict]:
        """
        Download foto dari URL lalu extract. Sync.
        """
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.get(photo_url)
                resp.raise_for_status()
                image_bytes = resp.content
                mime_type = resp.headers.get("content-type", "image/jpeg")
        except Exception as e:
            logger.error(f"Download foto gagal: {e}")
            return None

        return self.extract_from_bytes(image_bytes, mime_type)


ocr_service = OCRService()
