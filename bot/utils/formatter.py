"""
Utility formatters untuk display pesan di Telegram.
"""

from datetime import datetime


def format_currency(amount: int | float) -> str:
    """
    Format uang ke format Indonesia.
    1500000 → "Rp 1.500.000"
    """
    if isinstance(amount, float):
        amount = int(amount)
    formatted = f"{amount:,}".replace(",", ".")
    return f"Rp {formatted}"


def format_date(date_str: str) -> str:
    """
    Format tanggal dari YYYY-MM-DD ke format Indonesia.
    "2025-01-15" → "Rabu, 15 Jan 2025"
    """
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        day_names = [
            "Senin",
            "Selasa",
            "Rabu",
            "Kamis",
            "Jumat",
            "Sabtu",
            "Minggu",
        ]
        day_name = day_names[date_obj.weekday()]
        formatted = date_obj.strftime("%d %b %Y")
        return f"{day_name}, {formatted}"
    except (ValueError, IndexError):
        return date_str


def format_success(msg: str) -> str:
    """Bungkus pesan dengan emoji sukses."""
    return f"✅ {msg}"


def format_error(msg: str) -> str:
    """Bungkus pesan dengan emoji error."""
    return f"❌ {msg}"


def format_warning(msg: str) -> str:
    """Bungkus pesan dengan emoji warning."""
    return f"⚠️ {msg}"


def format_info(msg: str) -> str:
    """Bungkus pesan dengan emoji informasi."""
    return f"ℹ️ {msg}"


def truncate(text: str, max_len: int = 50) -> str:
    """
    Potong teks jika terlalu panjang + tambahkan "..."
    """
    if len(text) > max_len:
        return text[:max_len] + "..."
    return text


def format_stok(base_qty: float, display_unit: str, conversion_factor: float) -> str:
    """
    Format stok untuk pesan bot (base → display).
    format_stok(50000, 'kg', 1000) → '50 kg'
    format_stok(200, 'pcs', 1)     → '200 pcs'
    """
    if not conversion_factor or conversion_factor == 0:
        display = base_qty
    else:
        display = base_qty / conversion_factor

    if display == int(display):
        return f"{int(display)} {display_unit}"
    return f"{display:.2f} {display_unit}"


async def safe_edit(query, text: str, parse_mode=None, reply_markup=None):
    """
    Safely edit a callback query message.
    - Jika konten tidak berubah → abaikan (hindari BadRequest: Message is not modified)
    - Jika MarkdownV2 gagal (BadRequest formatting) → retry sebagai plain text.
    """
    from telegram.error import BadRequest

    try:
        await query.edit_message_text(
            text, parse_mode=parse_mode, reply_markup=reply_markup
        )
    except BadRequest as e:
        # Jika error hanya karena pesan tidak berubah, abaikan saja
        if "Message is not modified" in str(e):
            return

        # Strip markdown dan retry sebagai plain text untuk error formatting lain
        import re

        clean = re.sub(r"[\\*_\[\]()~`>#+=|{}.!-]", "", text)
        try:
            await query.edit_message_text(clean, reply_markup=reply_markup)
        except Exception:
            # Jika masih gagal, diamkan agar tidak mengganggu alur bot
            pass

