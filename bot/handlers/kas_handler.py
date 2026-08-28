"""
bot/handlers/kas_handler.py
Command /kas — Cek saldo kas, ringkasan anggaran MBG, dan transfer antar kas.

Flow:
  /kas → tampilkan saldo + ringkasan
  [↔️ Transfer Kas] → pilih kas asal → pilih kas tujuan → input nominal → konfirmasi
"""

import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from core.config import settings
from utils.api_client import get_api_client
from utils.session import get_role, get_token, is_authenticated

logger = logging.getLogger(__name__)

# States
KAS_MENU, PICK_FROM, PICK_TO, INPUT_AMOUNT, CONFIRM_TRANSFER = range(5)


def _fmt(v):
    """Format Rp."""
    try:
        n = float(v)
        return f"Rp {int(n):,}".replace(",", ".")
    except:
        return f"Rp {v}"


async def kas_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handler untuk command /kas — tampilkan saldo kas dan ringkasan anggaran."""
    if not is_authenticated(context):
        await update.message.reply_text("❌ Anda belum login. Ketik /login [kode] atau /start [kode] untuk login.")
        return ConversationHandler.END

    token = get_token(context) or ""
    role = get_role(context) or "kasir"

    if role not in ("owner", "admin"):
        await update.message.reply_text("❌ Hanya owner dan admin yang bisa melihat saldo kas.")
        return ConversationHandler.END

    await update.message.reply_text("⏳ Mengambil data kas...")

    try:
        api = get_api_client(settings.backend_url)
        resp = await api.get("/budget/summary", token=token)
        data = resp.get("data", {}) if resp else {}
    except Exception as e:
        logger.error(f"Error fetching budget summary: {e}")
        await update.message.reply_text("❌ Gagal mengambil data anggaran. Coba lagi nanti.")
        return ConversationHandler.END

    if not data:
        await update.message.reply_text(
            "ℹ️ *Belum ada data anggaran*\n\n"
            "Untuk memulai:\n"
            "1\\. Buka Web → 📊 Anggaran\n"
            "2\\. Set Pagu bulan ini\n"
            "3\\. Catat Pencairan dana\n"
            "4\\. Tambahkan Kas \\(VA Bank, Kas Kecil\\)",
            parse_mode="MarkdownV2",
        )
        return ConversationHandler.END

    context.user_data["kas_data"] = data
    context.user_data["kas_token"] = token

    # ── Format saldo kas ──
    kas_balances = data.get("kas_balances", [])
    if kas_balances:
        kas_lines = []
        for k in kas_balances:
            name = k.get("name", "?")
            bal = _fmt(k.get("balance", 0))
            kas_lines.append(f"   {name:<20s} {bal}")
        total_kas = sum(float(k.get("balance", 0)) for k in kas_balances)
        kas_text = "\n".join(kas_lines)
        kas_text += f"\n   {'─' * 30}\n   {'Total':<20s} {_fmt(total_kas)}"
    else:
        kas_text = "   (Belum ada kas. Tambahkan di Web → Anggaran)"

    # ── Format ringkasan ──
    pagu = _fmt(data.get("pagu_amount", 0))
    cair = _fmt(data.get("total_disbursed", 0))
    terpakai = _fmt(data.get("total_spent", 0))
    sisa = _fmt(data.get("sisa_anggaran", 0))
    pct = data.get("pct_terpakai", 0)
    porsi = data.get("total_porsi", 0)

    from datetime import date
    tgl = date.today().strftime("%d %B %Y")

    msg = (
        f"🏦 SALDO KAS\n"
        f"{tgl}\n"
        f"{'─' * 30}\n"
        f"{kas_text}\n\n"
        f"📊 RINGKASAN ANGGARAN\n"
        f"{'─' * 30}\n"
        f"   Pagu    : {pagu}\n"
        f"   Cair    : {cair}\n"
        f"   Terpakai: {terpakai} ({pct}%)\n"
        f"   Sisa    : {sisa}\n"
        f"   Porsi   : {porsi:,}\n"
    )

    sisa_val = float(data.get("sisa_anggaran", 0))
    if sisa_val > 0 and not data.get("fund_return"):
        msg += f"\n⚠️ Sisa {sisa} wajib dikembalikan ke Kas Negara\n"

    # Buttons
    buttons = []
    if len(kas_balances) >= 2:
        buttons.append([InlineKeyboardButton("↔️ Transfer Kas", callback_data="kas_transfer_start")])
    buttons.append([InlineKeyboardButton("📊 Detail di Web", url=f"{settings.web_url}/anggaran")])

    await update.message.reply_text(msg, reply_markup=InlineKeyboardMarkup(buttons))
    return KAS_MENU


async def transfer_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """User klik [↔️ Transfer Kas] — pilih kas asal."""
    query = update.callback_query
    await query.answer()

    data = context.user_data.get("kas_data", {})
    kas = data.get("kas_balances", [])

    if len(kas) < 2:
        await query.edit_message_text("❌ Minimal 2 kas untuk transfer.")
        return ConversationHandler.END

    buttons = []
    for k in kas:
        label = f"🏦 {k['name']} ({_fmt(k['balance'])})"
        buttons.append([InlineKeyboardButton(label, callback_data=f"kas_from_{k['id']}")])
    buttons.append([InlineKeyboardButton("❌ Batal", callback_data="kas_cancel")])

    await query.edit_message_text("↔️ TRANSFER ANTAR KAS\n\nDari kas mana?", reply_markup=InlineKeyboardMarkup(buttons))
    return PICK_FROM


async def pick_from(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """User pilih kas asal."""
    query = update.callback_query
    await query.answer()

    if query.data == "kas_cancel":
        await query.edit_message_text("❌ Transfer dibatalkan.")
        return ConversationHandler.END

    from_id = query.data.replace("kas_from_", "")
    context.user_data["tf_from_id"] = from_id

    data = context.user_data.get("kas_data", {})
    kas = data.get("kas_balances", [])
    from_kas = next((k for k in kas if k["id"] == from_id), None)
    context.user_data["tf_from_name"] = from_kas["name"] if from_kas else "?"

    # Show destination options (exclude source)
    buttons = []
    for k in kas:
        if k["id"] == from_id:
            continue
        label = f"💵 {k['name']} ({_fmt(k['balance'])})"
        buttons.append([InlineKeyboardButton(label, callback_data=f"kas_to_{k['id']}")])
    buttons.append([InlineKeyboardButton("❌ Batal", callback_data="kas_cancel")])

    await query.edit_message_text(
        f"↔️ TRANSFER\nDari: {from_kas['name'] if from_kas else '?'}\n\nKe kas mana?",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return PICK_TO


async def pick_to(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """User pilih kas tujuan."""
    query = update.callback_query
    await query.answer()

    if query.data == "kas_cancel":
        await query.edit_message_text("❌ Transfer dibatalkan.")
        return ConversationHandler.END

    to_id = query.data.replace("kas_to_", "")
    context.user_data["tf_to_id"] = to_id

    data = context.user_data.get("kas_data", {})
    kas = data.get("kas_balances", [])
    to_kas = next((k for k in kas if k["id"] == to_id), None)
    context.user_data["tf_to_name"] = to_kas["name"] if to_kas else "?"

    from_name = context.user_data.get("tf_from_name", "?")
    await query.edit_message_text(
        f"↔️ TRANSFER\n"
        f"Dari: {from_name}\n"
        f"Ke: {to_kas['name'] if to_kas else '?'}\n\n"
        f"Nominal transfer:\n"
        f"Ketik jumlah (contoh: 500000)"
    )
    return INPUT_AMOUNT


async def input_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """User ketik nominal transfer."""
    text = update.message.text.strip().replace(".", "").replace(",", "")
    try:
        amount = float(text)
        if amount <= 0:
            raise ValueError()
    except ValueError:
        await update.message.reply_text("❌ Masukkan angka yang valid. Contoh: 500000")
        return INPUT_AMOUNT

    context.user_data["tf_amount"] = amount
    from_name = context.user_data.get("tf_from_name", "?")
    to_name = context.user_data.get("tf_to_name", "?")

    buttons = [
        [
            InlineKeyboardButton("✅ Transfer", callback_data="kas_confirm_transfer"),
            InlineKeyboardButton("❌ Batal", callback_data="kas_cancel"),
        ]
    ]

    await update.message.reply_text(
        f"Konfirmasi transfer:\n"
        f"{from_name} → {to_name}\n"
        f"{_fmt(amount)}\n\n"
        f"Lanjutkan?",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return CONFIRM_TRANSFER


async def confirm_transfer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """User konfirmasi transfer."""
    query = update.callback_query
    await query.answer()

    if query.data == "kas_cancel":
        await query.edit_message_text("❌ Transfer dibatalkan.")
        return ConversationHandler.END

    token = context.user_data.get("kas_token", "")
    from_id = context.user_data.get("tf_from_id")
    to_id = context.user_data.get("tf_to_id")
    amount = context.user_data.get("tf_amount", 0)
    from_name = context.user_data.get("tf_from_name", "?")
    to_name = context.user_data.get("tf_to_name", "?")

    from datetime import date
    try:
        api = get_api_client(settings.backend_url)
        resp = await api.post("/budget/fund-transfer", data={
            "from_account_id": from_id,
            "to_account_id": to_id,
            "amount": amount,
            "transfer_date": date.today().isoformat(),
            "notes": f"Transfer via Telegram Bot",
        }, token=token)

        if resp and resp.get("success"):
            # Refresh kas data
            try:
                new_resp = await api.get("/budget/summary", token=token)
                new_data = new_resp.get("data", {}) if new_resp else {}
                new_kas = new_data.get("kas_balances", [])
                bal_lines = "\n".join(
                    f"   {k['name']:<20s} {_fmt(k['balance'])}" for k in new_kas
                )
            except:
                bal_lines = "(Ketik /kas untuk lihat saldo terbaru)"

            await query.edit_message_text(
                f"✅ Transfer berhasil!\n"
                f"{from_name} → {to_name}\n"
                f"{_fmt(amount)}\n\n"
                f"Saldo terbaru:\n{bal_lines}"
            )
        else:
            detail = resp.get("detail", "Gagal") if resp else "Gagal"
            await query.edit_message_text(f"❌ Transfer gagal: {detail}")

    except Exception as e:
        logger.error(f"Transfer failed: {e}")
        await query.edit_message_text(f"❌ Transfer gagal: {e}")

    return ConversationHandler.END


async def kas_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancel from callback."""
    query = update.callback_query
    if query:
        await query.answer()
        await query.edit_message_text("❌ Dibatalkan.")
    return ConversationHandler.END


def get_kas_conversation_handler():
    """Return ConversationHandler for /kas command."""
    return ConversationHandler(
        entry_points=[CommandHandler("kas", kas_entry)],
        states={
            KAS_MENU: [
                CallbackQueryHandler(transfer_start, pattern=r"^kas_transfer_start$"),
                CallbackQueryHandler(kas_cancel, pattern=r"^kas_cancel$"),
            ],
            PICK_FROM: [
                CallbackQueryHandler(pick_from, pattern=r"^kas_from_"),
                CallbackQueryHandler(kas_cancel, pattern=r"^kas_cancel$"),
            ],
            PICK_TO: [
                CallbackQueryHandler(pick_to, pattern=r"^kas_to_"),
                CallbackQueryHandler(kas_cancel, pattern=r"^kas_cancel$"),
            ],
            INPUT_AMOUNT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, input_amount),
            ],
            CONFIRM_TRANSFER: [
                CallbackQueryHandler(confirm_transfer, pattern=r"^kas_confirm_transfer$"),
                CallbackQueryHandler(kas_cancel, pattern=r"^kas_cancel$"),
            ],
        },
        fallbacks=[CommandHandler("cancel", kas_cancel)],
        per_message=False,
    )
