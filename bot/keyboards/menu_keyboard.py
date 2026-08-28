"""
bot/keyboards/menu_keyboard.py
Inline keyboards untuk /menu handler — Modul 6
"""

from typing import List, Optional

from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def get_week_keyboard(week_data: List[dict]) -> InlineKeyboardMarkup:
    """
    Keyboard utama tampilan 1 minggu.

    Tombol per hari:
      Terisi  → "✏️ Senin: Nasi Goreng" (callback: edit_day_YYYY-MM-DD)
      Kosong  → "➕ Selasa"              (callback: edit_day_YYYY-MM-DD)
    Baris terakhir: Simpan Semua + Menu Utama
    """
    rows = []

    for entry in week_data:
        date_str = entry["date"]
        day_name = entry["day_name"]
        is_filled = entry.get("is_filled", False)
        menu_name = entry.get("menu_name") or ""

        if is_filled and menu_name:
            # Potong label supaya tidak terlalu panjang (maks 15 char nama menu)
            label = menu_name[:15] + ("…" if len(menu_name) > 15 else "")
            text = f"✏️ {day_name}: {label}"
        else:
            if day_name == "Sabtu":
                text = f"➕ {day_name} (opsional)"
            else:
                text = f"➕ {day_name}"

        rows.append([InlineKeyboardButton(text, callback_data=f"edit_day_{date_str}")])

    # Cek apakah Senin–Jumat sudah terisi (hari ke-0 s/d ke-4)
    senin_jumat = week_data[:5]
    all_filled = all(e.get("is_filled", False) for e in senin_jumat)

    action_row = []
    if all_filled:
        action_row.append(InlineKeyboardButton("✅ Simpan Semua", callback_data="save_week"))
    action_row.append(InlineKeyboardButton("← Menu Utama", callback_data="main_menu"))

    rows.append(action_row)
    return InlineKeyboardMarkup(rows)


def get_day_action_keyboard(date_str: str, menu_name: str) -> InlineKeyboardMarkup:
    """
    Keyboard untuk hari yang SUDAH terisi — pilihan edit atau hapus.
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔄 Ganti Menu", callback_data=f"change_menu_{date_str}"),
            InlineKeyboardButton("🗑️ Hapus", callback_data=f"delete_day_{date_str}"),
        ],
        [InlineKeyboardButton("← Kembali", callback_data="back_to_week")],
    ])


def get_bom_confirm_keyboard() -> InlineKeyboardMarkup:
    """
    Keyboard konfirmasi menu yang DITEMUKAN + punya BOM.
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("💾 Simpan", callback_data="confirm_save"),
            InlineKeyboardButton("✏️ Ganti Nama", callback_data="change_name"),
            InlineKeyboardButton("❌ Batal", callback_data="cancel_input"),
        ],
    ])


def get_no_bom_keyboard() -> InlineKeyboardMarkup:
    """
    Keyboard untuk menu yang BELUM punya BOM.
    """
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📝 Input BOM Sekarang", callback_data="input_bom")],
        [InlineKeyboardButton("⏭️ Simpan Tanpa BOM", callback_data="save_no_bom")],
        [InlineKeyboardButton("✏️ Ganti Menu", callback_data="change_name")],
    ])


def get_new_product_keyboard() -> InlineKeyboardMarkup:
    """
    Keyboard untuk menu yang TIDAK DITEMUKAN di database produk.
    """
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("➕ Simpan sebagai Menu Baru", callback_data="save_new_product")],
        [InlineKeyboardButton("⏭️ Simpan Tanpa BOM", callback_data="save_no_bom")],
        [InlineKeyboardButton("✏️ Ketik Ulang", callback_data="change_name")],
    ])


def get_cancel_keyboard() -> InlineKeyboardMarkup:
    """Keyboard minimal saat menunggu input teks."""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("❌ Batal", callback_data="cancel_input")],
    ])


def get_bom_cancel_keyboard() -> InlineKeyboardMarkup:
    """Keyboard saat user sedang input BOM baris per baris."""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ Selesai Input BOM", callback_data="bom_done")],
        [InlineKeyboardButton("❌ Batal BOM", callback_data="cancel_bom")],
    ])
