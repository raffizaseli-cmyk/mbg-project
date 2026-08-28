"""
bot/handlers/belanja_handler.py
Input belanja manual tanpa foto — Modul 9

ConversationHandler /belanja, maks 3 langkah:
  Langkah 1: Nama supplier (atau /skip)
  Langkah 2: Daftar item (format: nama qty satuan harga) + /selesai
  Langkah 3: Konfirmasi + pilih metode bayar (+ jika hutang → due date)
"""

import logging
import re
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from typing import List, Optional, Tuple

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
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
from utils.formatter import format_error
from utils.session import get_token, is_authenticated, get_role
from utils.number_parser import parse_id_number

logger = logging.getLogger(__name__)

# ─── States ───────────────────────────────────────────────────────────────────
INPUT_SUPPLIER = 0
INPUT_ITEMS = 1
CONFIRM_BELANJA = 2
AWAIT_DUE_DATE = 3

CAN_INPUT_ROLES = {"owner", "admin", "kasir"}


def _can_input(context: ContextTypes.DEFAULT_TYPE) -> bool:
    return get_role(context) in CAN_INPUT_ROLES


def _fmt_rp(amount) -> str:
    try:
        return f"Rp {int(Decimal(str(amount))):,}".replace(",", ".")
    except Exception:
        return f"Rp {amount}"


def _esc(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"([_*\[\]()~`>#+\-=|{}.!\\])", r"\\\1", str(text))


# ─── Parse satu baris item ────────────────────────────────────────────────────

def _parse_item_line(line: str) -> Optional[dict]:
    """
    Format: nama_item qty satuan harga
    Contoh: "Beras 10 kg 12000"
    Nama = semua token kecuali 3 terakhir (qty, satuan, harga)
    """
    tokens = line.strip().split()
    if len(tokens) < 4:
        return None
    try:
        harga = parse_id_number(tokens[-1])
        satuan = tokens[-2]
        qty = parse_id_number(tokens[-3])
        nama = " ".join(tokens[:-3])
        if qty <= 0 or harga <= 0 or not nama:
            return None
        return {
            "nama_item": nama,
            "qty": qty,
            "satuan": satuan,
            "harga_satuan": harga,
            "subtotal": qty * harga,
        }
    except (InvalidOperation, ValueError, IndexError):
        return None


# ─── Keyboard metode bayar ────────────────────────────────────────────────────

def _payment_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("💵 Tunai",    callback_data="bayar_tunai"),
        InlineKeyboardButton("🏦 Transfer", callback_data="bayar_transfer"),
        InlineKeyboardButton("📋 Hutang",   callback_data="bayar_hutang"),
    ]])


# ─── Entry Point: /belanja ────────────────────────────────────────────────────

async def belanja_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry point /belanja atau tombol Menu Utama."""
    if not update.effective_message:
        return ConversationHandler.END

    if not is_authenticated(context):
        await update.effective_message.reply_text(
            "❌ Silakan /login [kode] atau /start [kode] untuk login."
        )
        return ConversationHandler.END

    if not _can_input(context):
        await update.effective_message.reply_text(
            "❌ Hanya owner, admin, dan kasir yang bisa input belanja."
        )
        return ConversationHandler.END

    # Bersihkan state lama
    context.user_data.pop("manual_supplier", None)
    context.user_data.pop("manual_items", None)
    context.user_data.pop("manual_payment", None)

    await update.effective_message.reply_text(
        "📝 *INPUT BELANJA MANUAL*\n\n"
        "*Langkah 1/3:* Nama supplier?\n"
        "Ketik nama toko atau /skip jika tidak ada",
        parse_mode="MarkdownV2",
    )
    return INPUT_SUPPLIER


# ─── Langkah 1: Nama Supplier ─────────────────────────────────────────────────

async def input_supplier(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.text:
        return INPUT_SUPPLIER

    text = update.message.text.strip()
    if text.lower() == "/skip":
        context.user_data["manual_supplier"] = None
    else:
        context.user_data["manual_supplier"] = text

    await update.message.reply_text(
        "📝 *Langkah 2/3: Daftar belanja*\n\n"
        "Ketik semua item dalam satu pesan \\(satu item per baris\\):\n"
        "`Format: nama qty satuan harga`\n\n"
        "Contoh:\n"
        "`Beras 10 kg 12000`\n"
        "`Telur 30 pcs 2000`\n"
        "`Minyak 2 liter 18000`",
        parse_mode="MarkdownV2",
    )
    return INPUT_ITEMS


async def skip_supplier(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /skip di langkah supplier."""
    context.user_data["manual_supplier"] = None
    await update.message.reply_text(
        "📝 *Langkah 2/3: Daftar belanja*\n\n"
        "Ketik semua item dalam satu pesan \\(satu item per baris\\):\n"
        "`Format: nama qty satuan harga`\n\n"
        "Contoh:\n"
        "`Beras 10 kg 12000`\n"
        "`Telur 30 pcs 2000`",
        parse_mode="MarkdownV2",
    )
    return INPUT_ITEMS


# ─── Langkah 2: Kumpulkan Item ────────────────────────────────────────────────

async def input_items(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Parse daftar item langsung dari pesan user."""
    if not update.message or not update.message.text:
        return INPUT_ITEMS

    text = update.message.text.strip()
    raw_lines = text.split("\n")
    
    items: List[dict] = []
    skipped = 0

    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        parsed = _parse_item_line(line)
        if parsed:
            items.append(parsed)
        else:
            skipped += 1

    if not items:
        await update.message.reply_text(
            "❌ Tidak ada item yang bisa diparsing\\.\n"
            "Coba lagi dengan format yang benar:\n"
            "`nama qty satuan harga`\n\n"
            "Contoh: `Beras 10 kg 12000`",
            parse_mode="MarkdownV2",
        )
        return INPUT_ITEMS

    context.user_data["manual_items"] = items
    grand_total = sum(i["subtotal"] for i in items)
    supplier = context.user_data.get("manual_supplier")

    # ─── Juknis kategori auto-detect ────────────────────────────────
    _KEYWORD_MAP = {
        "bahan_pangan": ["beras", "ayam", "daging", "ikan", "telur", "tahu", "tempe", "sayur", "buah", "minyak", "tepung", "gula", "garam", "bumbu", "santan", "susu", "pisang", "wortel", "bayam", "kol", "kentang", "tomat", "bawang", "cabai", "kecap", "merica", "lada", "kunyit", "jahe", "serai", "daun", "kangkung", "terong", "pare", "labu", "udang", "cumi", "tuna", "lele", "nila", "sarden", "kornet", "sosis", "nugget", "bakso", "keju", "mentega", "margarin", "roti", "mie"],
        "operasional": ["gas", "lpg", "listrik", "bensin", "solar", "bbm", "sewa", "plastik", "kemasan", "kardus", "sabun", "tissue", "deterjen", "tisu", "sarung", "masker", "galon", "atk", "kertas", "tinta", "piring", "sendok", "garpu", "mangkok", "gelas", "wadah", "aluminium", "serbet", "lap", "sapu", "pel"],
        "insentif": ["upah", "gaji", "honor", "insentif", "transport", "makan", "ongkos", "relawan", "tunjangan", "bonus", "lembur"]
    }
    
    combined = " ".join([i["nama_item"] for i in items]).lower()
    juknis_cat = "lainnya"
    for cat, kws in _KEYWORD_MAP.items():
        if any(kw in combined for kw in kws):
            juknis_cat = cat
            break
    juknis_labels = {
        "bahan_pangan": "🥦 Bahan Pangan",
        "operasional": "⚙️ Operasional",
        "insentif": "👷 Insentif",
        "lainnya": "📦 Lainnya",
    }
    context.user_data["manual_juknis"] = juknis_cat

    # ─── Format konfirmasi ────────────────────────────────────────────
    lines = [
        "📝 *Langkah 3/3: Konfirmasi*\n",
        f"🏪 Supplier: {_esc(supplier or 'Tidak ada')}",
        f"📅 Tanggal: {_esc(date.today().strftime('%d/%m/%Y'))}",
        f"📂 Kategori: {_esc(juknis_labels.get(juknis_cat, juknis_cat))}",
        "\n📦 *Item:*",
    ]
    for i in items:
        sub = _fmt_rp(i["subtotal"])
        lines.append(
            f"\\- {_esc(i['nama_item'])} "
            f"{_esc(str(i['qty']))} {_esc(i['satuan'])} × "
            f"{_esc(_fmt_rp(i['harga_satuan']))} \\= {_esc(sub)}"
        )
    lines.append(f"\n💰 *Total: {_esc(_fmt_rp(grand_total))}*")

    if skipped:
        lines.append(f"\n⚠️ {skipped} baris dilewati \\(format salah\\)")

    lines.append("\n*Metode bayar:*")

    await update.message.reply_text(
        "\n".join(lines),
        reply_markup=_payment_keyboard(),
        parse_mode="MarkdownV2",
    )
    return CONFIRM_BELANJA


# ─── Langkah 3: Pilih Metode Bayar ───────────────────────────────────────────

async def pilih_bayar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return CONFIRM_BELANJA
    await query.answer()

    method_map = {
        "bayar_tunai": "tunai",
        "bayar_transfer": "transfer",
        "bayar_hutang": "hutang",
    }
    payment = method_map.get(query.data, "tunai")
    context.user_data["manual_payment"] = payment

    if payment == "hutang":
        default_due = (date.today() + timedelta(days=30)).strftime("%d/%m/%Y")
        await query.edit_message_text(
            f"📅 *Kapan jatuh tempo?*\n\n"
            f"Format: `DD/MM/YYYY`\n"
            f"Default \\(30 hari\\): `{_esc(default_due)}`\n\n"
            f"Atau /skip untuk 30 hari dari sekarang",
            parse_mode="MarkdownV2",
        )
        return AWAIT_DUE_DATE

    # Non-hutang: langsung submit
    return await _submit_manual(update, context, payment=payment, due_date=None)


async def input_due_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Terima due date setelah pilih hutang."""
    if not update.message:
        return AWAIT_DUE_DATE

    text = (update.message.text or "").strip()
    due_date: Optional[str] = None

    if text.lower() != "/skip":
        # Parse DD/MM/YYYY
        try:
            parts = text.split("/")
            if len(parts) != 3:
                raise ValueError
            d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
            due_date = date(y, m, d).isoformat()
        except Exception:
            await update.message.reply_text(
                "❌ Format tanggal salah\\. Gunakan `DD/MM/YYYY`\n"
                "Atau /skip untuk 30 hari dari sekarang",
                parse_mode="MarkdownV2",
            )
            return AWAIT_DUE_DATE
    else:
        due_date = (date.today() + timedelta(days=30)).isoformat()

    return await _submit_manual(update, context, payment="hutang", due_date=due_date)


async def skip_due_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """/skip saat diminta due date."""
    due_date = (date.today() + timedelta(days=30)).isoformat()
    return await _submit_manual(update, context, payment="hutang", due_date=due_date)


# ─── Submit ke backend ───────────────────────────────────────────────────────

async def _submit_manual(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    payment: str,
    due_date: Optional[str],
) -> int:
    msg_fn = (update.message or update.callback_query).reply_text if update.message else update.callback_query.edit_message_text  # type: ignore
    if update.callback_query:
        msg_fn = update.callback_query.edit_message_text

    token = get_token(context)
    api = get_api_client(settings.backend_url)
    supplier = context.user_data.get("manual_supplier")
    items = context.user_data.get("manual_items", [])

    payload = {
        "supplier_name": supplier,
        "date": date.today().isoformat(),
        "payment_method": payment,
        "due_date": due_date,
        "items": items,
    }

    try:
        resp = await api.post("/transactions/manual", token=token, json=payload)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        logger.error(f"Submit manual gagal: {e}")
        resp = None

    if resp and resp.get("success"):
        data = resp.get("data", {})
        total = _fmt_rp(data.get("total", 0))
        n = data.get("item_count", len(items))

        await msg_fn(
            f"✅ *Belanja dicatat\\!*\n\n"
            f"💰 Total: *{_esc(total)}*\n"
            f"📦 {n} item tersimpan\n"
            f"📊 Laporan sedang diperbarui\\.\\.\\.",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("← Menu Utama", callback_data="main_menu_callback"),
            ]]),
            parse_mode="MarkdownV2",
        )
    else:
        err = (resp or {}).get("detail", "Coba lagi")
        retry_kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("🔄 Coba Lagi", callback_data="retry_belanja"),
            InlineKeyboardButton("← Batal",     callback_data="main_menu_callback"),
        ]])
        await msg_fn(
            f"❌ Gagal menyimpan: {_esc(str(err))}",
            reply_markup=retry_kb,
            parse_mode="MarkdownV2",
        )

    # Bersihkan state
    for k in ("manual_supplier", "manual_items", "manual_items_raw", "manual_payment"):
        context.user_data.pop(k, None)

    return ConversationHandler.END


# ─── Cancel ───────────────────────────────────────────────────────────────────

async def cancel_belanja(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    for k in ("manual_supplier", "manual_items", "manual_items_raw", "manual_payment"):
        context.user_data.pop(k, None)
    if update.message:
        await update.message.reply_text("❌ Input belanja dibatalkan\\.", parse_mode="MarkdownV2")
    return ConversationHandler.END


# ─── Build ConversationHandler ────────────────────────────────────────────────

def build_belanja_conversation() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[
            CommandHandler("belanja", belanja_entry),
            CallbackQueryHandler(belanja_entry, pattern="^belanja$"),
        ],
        states={
            INPUT_SUPPLIER: [
                CommandHandler("skip", skip_supplier),
                MessageHandler(filters.TEXT & ~filters.COMMAND, input_supplier),
            ],
            INPUT_ITEMS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, input_items),
            ],
            CONFIRM_BELANJA: [
                CallbackQueryHandler(pilih_bayar, pattern=r"^bayar_"),
            ],
            AWAIT_DUE_DATE: [
                CommandHandler("skip", skip_due_date),
                MessageHandler(filters.TEXT & ~filters.COMMAND, input_due_date),
            ],
        },
        fallbacks=[
            CommandHandler("cancel", cancel_belanja),
            CommandHandler("start",  cancel_belanja),
        ],
        allow_reentry=True,
        name="belanja_conversation",
    )
