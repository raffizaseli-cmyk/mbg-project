"""
Telegram Bot main entry point.
Handles initialization, handler registration, dan polling.
"""

import asyncio
import logging
import sys

from telegram import BotCommand
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    PicklePersistence,
    filters,
)

from core.config import settings
from core.error_handler import error_handler as bot_error_handler
from handlers.auth_handler import (
    buka_web,
    error_handler as auth_error_handler,
    hubungkan_akun,
    logout,
    settings as settings_handler,
    start,
)

from handlers.belanja_handler import build_belanja_conversation
from handlers.serah_handler import build_serah_conversation
from handlers.report_handler import (
    hariini_command,
    laporan_command,
    stok_command,
    piutang_command,
    hutang_command,
    lunas_hutang,
    laporan_hariini_cb,
    laporan_bulanan_cb,
    cek_stok_cb,
    download_excel_cb,
)
from handlers.nota_handler import (
    cancel_nota,
    cek_dan_lanjutkan_cb,
    confirm_nota,
    edit_item,
    edit_nota,
    handle_photo,
    handle_text_input,
    selesai_kirim,
    konfirmasi_semua,
    batal_semua,
    kirim_ulang,
)
from handlers.driver_handler import (
    driver_trip_entry,
    driver_depart_action,
    driver_arrive_action,
)

# Setup logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def main() -> None:
    """Initialize dan start bot."""
    persistence = PicklePersistence(filepath="bot_data.pickle")
    app: Application = Application.builder().token(settings.telegram_bot_token).persistence(persistence).build()

    # ─── ConversationHandlers HARUS sebelum handler biasa ───────────
    app.add_handler(build_serah_conversation())
    app.add_handler(build_belanja_conversation())

    # ─── Foto nota — MessageHandler ──────────────────────────────────
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))

    # ─── Text handler: edit item inline ──────────────────────────────
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, handle_text_input
    ))

    # ─── Command handlers ─────────────────────────────────────────────
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("login", start))
    app.add_handler(CommandHandler("logout", logout))
    app.add_handler(CommandHandler("settings", settings_handler))

    # ─── Command handlers: laporan ────────────────────────────────────
    app.add_handler(CommandHandler("hariini", hariini_command))
    app.add_handler(CommandHandler("laporan", laporan_command))
    app.add_handler(CommandHandler("stok",    stok_command))
    app.add_handler(CommandHandler("piutang", piutang_command))
    app.add_handler(CommandHandler("hutang",  hutang_command))

    # ─── Callback handlers: report shortcuts ─────────────────────────
    app.add_handler(CallbackQueryHandler(laporan_hariini_cb, pattern=r"^laporan_hariini$"))
    app.add_handler(CallbackQueryHandler(laporan_bulanan_cb, pattern=r"^laporan_bulanan$"))
    app.add_handler(CallbackQueryHandler(cek_stok_cb,        pattern=r"^cek_stok$"))
    app.add_handler(CallbackQueryHandler(lunas_hutang,       pattern=r"^lunas_hutang_"))
    app.add_handler(CallbackQueryHandler(download_excel_cb,  pattern=r"^download_excel_"))


    # ─── Callback handlers: nota (confirm / edit / cancel / edit_item) ─
    app.add_handler(CallbackQueryHandler(confirm_nota, pattern=r"^confirm_[a-f0-9\-]{36}$"))
    app.add_handler(CallbackQueryHandler(edit_nota,    pattern=r"^edit_[a-f0-9\-]{36}$"))
    app.add_handler(CallbackQueryHandler(cancel_nota,  pattern=r"^cancel_[a-f0-9\-]{36}$"))
    app.add_handler(CallbackQueryHandler(edit_item,    pattern=r"^edit_item_"))

    # ─── Callback handlers: batch ────────────────────────────────────
    app.add_handler(CallbackQueryHandler(selesai_kirim,         pattern=r"^selesai_kirim$"))
    app.add_handler(CallbackQueryHandler(konfirmasi_semua,      pattern=r"^konfirmasi_semua_"))
    app.add_handler(CallbackQueryHandler(batal_semua,           pattern=r"^batal_semua_"))
    app.add_handler(CallbackQueryHandler(kirim_ulang,           pattern=r"^kirim_ulang_"))
    app.add_handler(CallbackQueryHandler(cek_dan_lanjutkan_cb,  pattern=r"^cek_lanjutkan_"))

    # ─── Callback handlers: driver telemetery ────────────────────────
    app.add_handler(CallbackQueryHandler(driver_trip_entry, pattern=r"^driver_trip$"))
    app.add_handler(CallbackQueryHandler(driver_depart_action, pattern=r"^dr_depart_"))
    app.add_handler(CallbackQueryHandler(driver_arrive_action, pattern=r"^dr_arrive_"))

    # ─── Callback handlers: auth / navigation ────────────────────────
    app.add_handler(CallbackQueryHandler(hubungkan_akun, pattern="^hubungkan_akun$"))
    app.add_handler(CallbackQueryHandler(buka_web,       pattern="^buka_web$"))

    # ─── Error handlers ───────────────────────────────────────────────
    # Global handler dari core/ menangani Network, Forbidden, dan lain-lain
    app.add_error_handler(bot_error_handler)
    # Auth-specific handler sebagai fallback di auth_handler
    # (tidak di-register lagi di sini karena bot_error_handler sudah cover)

    # ─── Bot commands menu ────────────────────────────────────────────
    bot_commands = [
        BotCommand("start",    "Login atau lihat menu utama"),
        BotCommand("login",    "Login dengan kode Telegram atau lihat menu utama"),
        BotCommand("serah",    "🍱 Konfirmasi penyerahan MBG"),
        BotCommand("belanja",  "📝 Input belanja manual"),
        BotCommand("hariini",  "📊 Ringkasan hari ini"),
        BotCommand("laporan",  "📈 Laporan bulan ini"),
        BotCommand("stok",     "📦 Status stok bahan"),
        BotCommand("piutang",  "💰 Tagihan MBG belum lunas"),
        BotCommand("hutang",   "💸 Hutang ke supplier"),
        BotCommand("settings", "Lihat pengaturan akun"),
        BotCommand("logout",   "Logout akun"),
        BotCommand("cancel",   "Batalkan proses yang sedang berjalan"),
    ]
    await app.bot.set_my_commands(bot_commands)

    logger.info("Bot starting... Press Ctrl+C to stop")

    # Jalankan app.run_polling() langsung (bukan di dalam coroutine).
    # Ini dipanggil dari __main__ block secara synchronous.
    raise _RunPollingSignal(app)


class _RunPollingSignal(Exception):
    """Internal signal untuk menjalankan run_polling dari luar coroutine."""
    def __init__(self, app):
        self.app = app


import asyncio as _asyncio

def main():
    if sys.platform == "win32":
        import asyncio
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    from core.config import settings as _settings
    from core.error_handler import error_handler as bot_error_handler
    from handlers.auth_handler import (
        buka_web, error_handler as auth_error_handler,
        hubungkan_akun, logout, settings as settings_handler, 
        settings_cb, start, global_main_menu,
    )
    from handlers.belanja_handler import build_belanja_conversation
    from handlers.serah_handler import build_serah_conversation
    from handlers.report_handler import (
        hariini_command, laporan_command, stok_command,
        piutang_command, hutang_command, lunas_hutang,
        laporan_hariini_cb, laporan_bulanan_cb, cek_stok_cb, download_excel_cb,
    )
    from handlers.nota_handler import (
        catat_nota_cb, cancel_nota, confirm_nota, edit_item, edit_nota,
        handle_photo, handle_text_input, selesai_kirim,
        konfirmasi_semua, batal_semua, kirim_ulang,
    )
    from handlers.kas_handler import get_kas_conversation_handler
    from handlers.nutrisi_handler import nutrisi_command, cek_gizi_cb

    from telegram import BotCommand
    from telegram.ext import (
        Application, CallbackQueryHandler, CommandHandler,
        MessageHandler, filters, PicklePersistence,
    )

    async def post_init(application: Application):
        cmds = [
            BotCommand("start",    "Login atau lihat menu utama"),
            BotCommand("login",    "Login dengan kode Telegram atau lihat menu utama"),
            BotCommand("serah",    "🍱 Konfirmasi penyerahan MBG"),
            BotCommand("belanja",  "📝 Input belanja manual"),
            BotCommand("hariini",  "📊 Ringkasan hari ini"),
            BotCommand("laporan",  "📈 Laporan bulan ini"),
            BotCommand("stok",     "📦 Status stok bahan"),
            BotCommand("piutang",  "💰 Tagihan MBG belum lunas"),
            BotCommand("hutang",   "💸 Hutang ke supplier"),
            BotCommand(" settings", "Lihat pengaturan akun"),
            BotCommand("kas",      "🏦 Cek saldo kas & anggaran"),
            BotCommand("nutrisi",  "🩺 Cek status gizi harian"),
            BotCommand("logout",   "Logout akun"),
            BotCommand("cancel",   "Batalkan proses yang sedang berjalan"),
        ]
        await application.bot.set_my_commands(cmds)

    import warnings
    from telegram.warnings import PTBUserWarning
    warnings.filterwarnings("ignore", category=PTBUserWarning)

    persistence = PicklePersistence(filepath="bot_sessions.pickle")

    # Disable job_queue on Windows Python 3.13 to prevent weakref TypeError
    # Increase HTTP timeouts to prevent telegram.error.TimedOut on slow network
    app = (
        Application.builder()
        .token(_settings.telegram_bot_token)
        .persistence(persistence)
        .job_queue(None)
        .connect_timeout(30.0)
        .read_timeout(30.0)
        .write_timeout(30.0)
        .pool_timeout(30.0)
        .get_updates_read_timeout(45.0)
        .get_updates_connect_timeout(45.0)
        .get_updates_pool_timeout(45.0)
        .post_init(post_init)
        .build()
    )

    app.add_handler(build_serah_conversation())
    app.add_handler(build_belanja_conversation())
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_input))
    app.add_handler(CommandHandler("start",    start))
    app.add_handler(CommandHandler("login",    start))
    app.add_handler(CommandHandler("logout",   logout))
    app.add_handler(CommandHandler("settings", settings_handler))
    app.add_handler(CommandHandler("hariini",  hariini_command))
    app.add_handler(CommandHandler("laporan",  laporan_command))
    app.add_handler(CommandHandler("stok",     stok_command))
    app.add_handler(CommandHandler("nutrisi",  nutrisi_command))
    app.add_handler(CommandHandler("piutang",  piutang_command))
    app.add_handler(CommandHandler("hutang",   hutang_command))
    app.add_handler(get_kas_conversation_handler())
    app.add_handler(CallbackQueryHandler(laporan_hariini_cb, pattern=r"^laporan_hariini$"))
    app.add_handler(CallbackQueryHandler(laporan_bulanan_cb, pattern=r"^laporan_bulanan$"))
    app.add_handler(CallbackQueryHandler(cek_stok_cb,        pattern=r"^cek_stok$"))
    app.add_handler(CallbackQueryHandler(cek_gizi_cb,        pattern=r"^cek_gizi$"))
    app.add_handler(CallbackQueryHandler(settings_cb,        pattern=r"^pengaturan$"))
    app.add_handler(CallbackQueryHandler(global_main_menu,   pattern=r"^(main_menu_callback|main_menu|back_main)$"))
    app.add_handler(CallbackQueryHandler(lunas_hutang,       pattern=r"^lunas_hutang_"))
    app.add_handler(CallbackQueryHandler(download_excel_cb,  pattern=r"^download_excel_"))
    app.add_handler(CallbackQueryHandler(catat_nota_cb,      pattern=r"^catat_belanja$"))
    app.add_handler(CallbackQueryHandler(confirm_nota, pattern=r"^confirm_[a-f0-9\-]{36}$"))
    app.add_handler(CallbackQueryHandler(edit_nota,    pattern=r"^edit_[a-f0-9\-]{36}$"))
    app.add_handler(CallbackQueryHandler(cancel_nota,  pattern=r"^cancel_[a-f0-9\-]{36}$"))
    app.add_handler(CallbackQueryHandler(edit_item,    pattern=r"^edit_item_"))
    app.add_handler(CallbackQueryHandler(selesai_kirim,         pattern=r"^selesai_kirim$"))
    app.add_handler(CallbackQueryHandler(konfirmasi_semua,      pattern=r"^konfirmasi_semua_"))
    app.add_handler(CallbackQueryHandler(batal_semua,           pattern=r"^batal_semua_"))
    app.add_handler(CallbackQueryHandler(kirim_ulang,           pattern=r"^kirim_ulang_"))
    app.add_handler(CallbackQueryHandler(cek_dan_lanjutkan_cb,  pattern=r"^cek_lanjutkan_"))
    app.add_handler(CallbackQueryHandler(hubungkan_akun, pattern="^hubungkan_akun$"))
    app.add_handler(CallbackQueryHandler(buka_web,       pattern="^buka_web$"))
    app.add_error_handler(bot_error_handler)

    logger.info("Bot starting... Press Ctrl+C to stop")
    app.run_polling(allowed_updates=[])

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Bot stopped.")
