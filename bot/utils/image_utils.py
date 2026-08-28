"""
bot/utils/image_utils.py
Kompresi foto sebelum upload ke backend — Modul 8
"""

import io
from typing import Dict

from PIL import Image


def compress_photo(photo_bytes: bytes, max_size_kb: int = 300) -> bytes:
    """
    Kompres foto sebelum dikirim ke backend.
    Target: max 300KB, resolusi max 1280px sisi terpanjang.

    - Convert ke RGB (hindari error RGBA/palette mode)
    - Resize jika dimensi terlalu besar (max 1280px)
    - Turunkan JPEG quality bertahap (85→40) sampai ≤ max_size_kb
    """
    img = Image.open(io.BytesIO(photo_bytes))

    # Convert ke RGB agar JPEG bisa disimpan tanpa error
    if img.mode != "RGB":
        img = img.convert("RGB")

    # Resize jika sisi terpanjang > 1280px
    max_dim = 1280
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    # Kompres: turunkan quality bertahap sampai ukuran <= max_size_kb
    quality = 85
    buffer = io.BytesIO()
    while quality >= 40:
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=quality, optimize=True)
        if buffer.tell() <= max_size_kb * 1024:
            break
        quality -= 10

    return buffer.getvalue()


def get_photo_info(photo_bytes: bytes) -> Dict:
    """Return info foto: dimensi, mode, ukuran (KB)."""
    img = Image.open(io.BytesIO(photo_bytes))
    return {
        "width": img.size[0],
        "height": img.size[1],
        "mode": img.mode,
        "size_kb": len(photo_bytes) // 1024,
    }
