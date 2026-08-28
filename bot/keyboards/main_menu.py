"""
Telegram keyboards untuk main menu dan navigasi.
"""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def get_main_menu(role: str = "") -> InlineKeyboardMarkup:
    """
    Main menu keyboard dengan Role-Based Access Control (RBAC).
    Disusun seimbang & rata (2 tombol per baris).
    """
    role = (role or "").lower()
    buttons = []

    # Operasional
    if role in ["owner", "admin", "kasir"]:
        buttons.append(InlineKeyboardButton("📷 Catat Nota", callback_data="catat_belanja"))
        buttons.append(InlineKeyboardButton("📝 Belanja Manual", callback_data="belanja"))
        buttons.append(InlineKeyboardButton("🍱 Konfirmasi Serah", callback_data="serah"))

    if role == "driver":
        buttons.append(InlineKeyboardButton("🚚 Mulai Perjalanan", callback_data="driver_trip"))

    # Laporan
    if role in ["owner", "admin", "viewer"]:
        buttons.append(InlineKeyboardButton("📊 Laporan Hari Ini", callback_data="laporan_hariini"))
        buttons.append(InlineKeyboardButton("📈 Laporan Bulanan", callback_data="laporan_bulanan"))

    # Utility & Pengaturan
    if role in ["owner", "admin", "kasir", "viewer"]:
        buttons.append(InlineKeyboardButton("📦 Cek Stok", callback_data="cek_stok"))

    if role in ["owner", "admin", "viewer"]:
        buttons.append(InlineKeyboardButton("🩺 Cek Gizi", callback_data="cek_gizi"))

    if role in ["owner", "admin"]:
        buttons.append(InlineKeyboardButton("⚙️ Pengaturan", callback_data="pengaturan"))

    # Construct balanced 2-2 rows
    keyboard = []
    for i in range(0, len(buttons), 2):
        keyboard.append(buttons[i:i + 2])

    return InlineKeyboardMarkup(keyboard)



def get_back_button(callback_data: str = "back_main") -> InlineKeyboardMarkup:
    """Get back button to return to main menu."""
    keyboard = [[InlineKeyboardButton("← Kembali ke Menu", callback_data=callback_data)]]
    return InlineKeyboardMarkup(keyboard)


def get_login_menu() -> InlineKeyboardMarkup:
    """Get login menu for unauthenticated users."""
    keyboard = [[InlineKeyboardButton("🔗 Hubungkan Akun", callback_data="hubungkan_akun")]]
    return InlineKeyboardMarkup(keyboard)


def get_open_web_button() -> InlineKeyboardMarkup:
    """Get button to open web dashboard."""
    keyboard = [[InlineKeyboardButton("🌐 Buka Dashboard Web", callback_data="buka_web")]]
    return InlineKeyboardMarkup(keyboard)
