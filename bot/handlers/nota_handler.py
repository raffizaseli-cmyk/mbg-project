"""
bot/handlers/nota_handler.py
Handler foto nota: single + batch upload + kompresi — Modul 7 & 8

State machine:
  User kirim foto → compress → tambah ke batch (context)
  Klik "Selesai" / 5 foto / timeout 5 menit → submit_batch → backend
  Backend OCR selesai → notif Telegram → konfirmasi/edit/batalkan
"""

import logging
import time
from uuid import uuid4

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.config import settings
from keyboards.main_menu import get_main_menu
from utils.api_client import get_api_client
from utils.formatter import format_error
from utils.image_utils import compress_photo
from utils.session import get_role, get_token, is_authenticated
from utils.number_parser import parse_id_number
from handlers.security import requires_role

logger = logging.getLogger(__name__)

BATCH_TIMEOUT = 300   # 5 menit
DEBOUNCE_SECONDS = 3  # auto-submit 3 detik setelah foto terakhir
MAX_BATCH_SIZE = 10

CAN_INPUT_ROLES = {"owner", "admin", "kasir"}


def _can_input(context: ContextTypes.DEFAULT_TYPE) -> bool:
    return get_role(context) in CAN_INPUT_ROLES


# ─── Tombol helper ────────────────────────────────────────────────────────────

def _batch_keyboard(n: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton(f"✅ Selesai Kirim ({n} foto)", callback_data="selesai_kirim"),
    ]])


# ─── Handler: Tombol Catat Nota ──────────────────────────────────────────────

@requires_role(['owner', 'admin', 'kasir'])
async def catat_nota_cb(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback ketika user tekan tombol 'Catat Nota'."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    await query.edit_message_text(
        "📷 *CATAT NOTA OTOMATIS*\n\n"
        "Silakan kirim foto nota belanja Anda di chat ini "
        "\\(bisa banyak foto sekaligus\\)\\.\n\n"
        "Setelah semua foto terkirim, klik tombol *Selesai* yang muncul\\.",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("← Menu Utama", callback_data="main_menu_callback")
        ]]),
        parse_mode="MarkdownV2"
    )


# ─── Handler: user kirim foto ─────────────────────────────────────────────────

@requires_role(['owner', 'admin', 'kasir'])
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Terima foto dari user:
      1. Cek auth + role
      2. Download foto (ukuran terbesar)
      3. Kompres dengan compress_photo()
      4. Tambah ke batch aktif (context.user_data)
      5. Edit/kirim pesan status batch
      6. Auto-submit jika n >= MAX_BATCH_SIZE
    """
    if not update.message or not update.message.photo:
        return

    if not is_authenticated(context):
        await update.message.reply_text(
            "❌ Silakan /login [kode] atau /start [kode] untuk login.",
            reply_markup=get_main_menu(get_role(context) or ""),
        )
        return

    if not _can_input(context):
        await update.message.reply_text(
            "❌ Hanya owner, admin, dan kasir yang bisa upload nota."
        )
        return

    # ─── Download + Kompres ───────────────────────────────────────────
    logger.info("DEBUG: handle_photo dipanggil (Job Queue: %s)", context.job_queue is not None)
    photo = update.message.photo[-1]
    try:
        photo_file = await photo.get_file()
        raw_bytes = await photo_file.download_as_bytearray()
        photo_bytes = compress_photo(bytes(raw_bytes))
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        logger.error(f"Download/kompres foto gagal: {e}")
        await update.message.reply_text(format_error(f"Gagal mengambil foto: {e}"))
        return

    chat_id = update.effective_chat.id if update.effective_chat else 0
    user_id = update.effective_user.id if update.effective_user else 0

    # ─── Inisialisasi batch jika belum ada ───────────────────────────
    batch = context.user_data.get("active_batch")
    if not batch:
        batch = {
            "batch_id": str(uuid4()),
            "photos": [],
            "start_time": time.time(),
            "message_id": None,
        }
        context.user_data["active_batch"] = batch

        # Batalkan timeout lama jika ada (job_queue bisa None di Windows)
        if context.job_queue is not None:
            jobs = context.job_queue.get_jobs_by_name(f"batch_timeout_{chat_id}")
            for j in jobs:
                j.schedule_removal()

            # Jadwalkan auto-timeout 5 menit
            context.job_queue.run_once(
                check_batch_timeout,
                when=BATCH_TIMEOUT,
                name=f"batch_timeout_{chat_id}",
                chat_id=chat_id,
                user_id=user_id,
                data={"chat_id": chat_id},
            )

    # ─── Tambah foto ke batch ────────────────────────────────────────
    batch["photos"].append(photo_bytes)
    n = len(batch["photos"])

    # ─── Edit/kirim pesan status ─────────────────────────────────────
    status_text = (
        f"📸 *{n} foto diterima\\.*\n"
        f"Kirim foto lagi atau klik Selesai\\.\n"
        f"⏱️ Otomatis terkirim 3 detik setelah foto terakhir"
    )

    msg_id = batch.get("message_id")
    try:
        if msg_id:
            await context.bot.edit_message_text(
                chat_id=chat_id,
                message_id=msg_id,
                text=status_text,
                reply_markup=_batch_keyboard(n),
                parse_mode="MarkdownV2",
            )
        else:
            sent = await update.message.reply_text(
                status_text,
                reply_markup=_batch_keyboard(n),
                parse_mode="MarkdownV2",
            )
            batch["message_id"] = sent.message_id
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        logger.warning(f"Edit/kirim pesan batch gagal: {e}")
        sent = await update.message.reply_text(
            status_text,
            reply_markup=_batch_keyboard(n),
            parse_mode="MarkdownV2",
        )
        batch["message_id"] = sent.message_id

    # ─── Debounce: auto-submit 3 detik setelah foto terakhir ──────────
    if context.job_queue is not None:
        debounce_jobs = context.job_queue.get_jobs_by_name(f"debounce_submit_{chat_id}")
        for j in debounce_jobs:
            j.schedule_removal()
        context.job_queue.run_once(
            _debounce_submit,
            when=DEBOUNCE_SECONDS,
            name=f"debounce_submit_{chat_id}",
            chat_id=chat_id,
            user_id=user_id,
            data={"chat_id": chat_id},
        )

    # ─── Hard cap jika sudah MAX ──────────────────────────────────────
    if n >= MAX_BATCH_SIZE:
        if context.job_queue is not None:
            debounce_jobs = context.job_queue.get_jobs_by_name(f"debounce_submit_{chat_id}")
            for j in debounce_jobs:
                j.schedule_removal()
        await submit_batch(context, chat_id)


# ─── submit_batch: kirim semua foto ke backend ───────────────────────────────

async def submit_batch(context: ContextTypes.DEFAULT_TYPE, chat_id: int) -> None:
    """Kirim semua foto di batch aktif ke backend via multipart POST."""
    batch = context.user_data.get("active_batch")
    if not batch or not batch.get("photos"):
        return

    photos_bytes: list = batch["photos"]
    n = len(photos_bytes)
    batch_id: str = batch["batch_id"]
    msg_id = batch.get("message_id")
    token = get_token(context)

    # Kasih tahu user sedang mengupload
    try:
        if msg_id:
            await context.bot.edit_message_text(
                chat_id=chat_id,
                message_id=msg_id,
                text=f"⏳ Mengirim {n} foto ke server\\.\\.\\.",
                parse_mode="MarkdownV2",
            )
    except Exception:
        pass

    # Clear batch dari context SEBELUM upload (prevent double-submit)
    del context.user_data["active_batch"]

    # ─── Build multipart files ────────────────────────────────────────
    files = [("files", (f"foto_{i+1}.jpg", pb, "image/jpeg")) for i, pb in enumerate(photos_bytes)]
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.post(
            "/transactions/from-photo-batch",
            token=token,
            files=[("batch_id", (None, batch_id)), *files],
        )
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        logger.error(f"submit_batch error: {e}")
        resp = None

    if resp and resp.get("success"):
        success_text = (
            f"⏳ *{n} foto sedang diproses\\.*\n"
            "Kami akan kabari hasilnya sebentar lagi\\."
        )
        try:
            if msg_id:
                await context.bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=msg_id,
                    text=success_text,
                    parse_mode="MarkdownV2",
                )
            else:
                await context.bot.send_message(chat_id=chat_id, text=success_text, parse_mode="MarkdownV2")
        except Exception:
            pass
    else:
        err_text = (
            "❌ Gagal mengirim foto\\. Coba lagi\\.\n"
        )
        retry_kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("🔄 Coba Kirim Ulang", callback_data="retry_photo"),
            InlineKeyboardButton("✏️ Input Manual",     callback_data="belanja_manual"),
        ]])
        try:
            if msg_id:
                await context.bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=msg_id,
                    text=err_text,
                    reply_markup=retry_kb,
                    parse_mode="MarkdownV2",
                )
            else:
                await context.bot.send_message(chat_id=chat_id, text=err_text, reply_markup=retry_kb, parse_mode="MarkdownV2")
        except Exception:
            pass


# ─── Callback: selesai_kirim ─────────────────────────────────────────────────

async def selesai_kirim(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()
    chat_id = update.effective_chat.id if update.effective_chat else 0
    await submit_batch(context, chat_id)


# ─── Job: check_batch_timeout ────────────────────────────────────────────────

async def check_batch_timeout(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Auto-submit batch jika timeout 5 menit sejak foto pertama."""
    chat_id = context.job.chat_id if context.job else 0
    # Akses user_data via callback_context — tidak bisa langsung di job
    # Kirim pesan info dulu, lalu submit
    batch = (context.user_data or {}).get("active_batch")
    if not batch or not batch.get("photos"):
        return

    n = len(batch["photos"])
    try:
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"⏰ Waktu habis, {n} foto sedang diproses otomatis\\.",
            parse_mode="MarkdownV2",
        )
    except Exception:
        pass

    await submit_batch(context, chat_id)


async def _debounce_submit(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Auto-submit batch 3 detik setelah foto terakhir diterima."""
    chat_id = context.job.chat_id if context.job else 0
    batch = (context.user_data or {}).get("active_batch")
    if not batch or not batch.get("photos"):
        return
    await submit_batch(context, chat_id)


# ─── Callback: konfirmasi nota single ────────────────────────────────────────

async def confirm_nota(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback: confirm_{trx_id}"""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    trx_id = query.data.replace("confirm_", "")
    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.post(f"/transactions/{trx_id}/confirm", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await query.edit_message_text(format_error(f"Gagal konfirmasi: {e}"))
        return

    if not resp.get("success"):
        await query.edit_message_text(format_error(resp.get("detail", "Konfirmasi gagal")))
        return

    # Ambil info toko & total untuk ringkasan sukses
    trx = resp.get("data") or {}
    nama_toko = trx.get("nama_toko") or "Nota"
    total = trx.get("total", 0)
    def fmt(v): return f"Rp {int(float(v)):,}".replace(",", ".")
    
    warnings = resp.get("stok_warnings", [])
    warn_text = "\n\n⚠️ " + "\n⚠️ ".join(warnings[:3]) if warnings else ""

    await query.edit_message_text(
        f"✅ *{_esc(nama_toko)}* | *{_esc(fmt(total))}*\n"
        f"Stok \\& kas sudah diupdate\\.{_esc(warn_text)}",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("← Menu Utama", callback_data="main_menu_callback"),
        ]]),
        parse_mode="MarkdownV2",
    )


# ─── Callback: edit nota ─────────────────────────────────────────────────────

async def edit_nota(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback: edit_{trx_id}"""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    trx_id = query.data.replace("edit_", "")
    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.get(f"/transactions/{trx_id}", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await query.edit_message_text(format_error(f"Tidak bisa load: {e}"))
        return

    trx = resp.get("data", {})
    items = trx.get("items", [])
    nama_toko = trx.get("nama_toko") or "Nota"

    # Bulk text edit approach
    context.user_data["editing_trx_id"] = trx_id
    context.user_data["editing_mode"] = "bulk"
    context.user_data.pop("editing_item_id", None)

    lines = []
    for item in items:
        qty = item.get("qty", 0)
        try:
            qty_num = float(qty)
            if qty_num == int(qty_num): qty = int(qty_num)
        except:
            pass
        sat = item.get("unit", "pcs")
        harga = item.get('price', 0)
        try:
            harga = int(float(harga))
        except:
            pass
        nama = item.get("ocr_nama_asli") or item.get("product_name", "?")
        lines.append(f"{nama} {qty} {sat} {harga}")

    raw_text = "\n".join(lines)

    msg = (
        f"Gagal deteksi beberapa bahan atau ada typo?\n\n"
        f"📝 *Edit Massal Nota — {_esc(nama_toko)}*\n\n"
        f"Ini hasil bacaan OCR \\(Total: {len(items)} item\\)\\.\n"
        f"Copy\\-paste teks di bawah, perbaiki yang salah, "
        f"lalu kirim balik ke saya di chat ini:\n\n"
        f"```text\n{_esc(raw_text)}\n```\n\n"
        f"Atau abaikan jika sudah benar\\."
    )

    buttons = [[InlineKeyboardButton("✅ Konfirmasi Nota", callback_data=f"confirm_{trx_id}")]]

    await query.edit_message_text(
        msg,
        reply_markup=InlineKeyboardMarkup(buttons),
        parse_mode="MarkdownV2",
    )


# ─── Callback: batalkan nota ─────────────────────────────────────────────────

async def cancel_nota(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback: cancel_{trx_id}"""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    trx_id = query.data.replace("cancel_", "")
    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        await api.delete(f"/transactions/{trx_id}", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await query.edit_message_text(format_error(f"Gagal batalkan: {e}"))
        return

    await query.edit_message_text(
        "❌ Nota dibatalkan\\.",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("← Menu Utama", callback_data="main_menu_callback"),
        ]]),
        parse_mode="MarkdownV2",
    )


# ─── Callback: edit_item ─────────────────────────────────────────────────────

async def edit_item(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback: edit_item_{trx_id}_{idx}"""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    parts = query.data.split("_")
    try:
        item_idx = int(parts[-1])
        trx_id = "_".join(parts[2:-1])
    except (ValueError, IndexError):
        await query.edit_message_text(format_error("Data tidak valid"))
        return

    items = context.user_data.get("editing_items", [])
    if item_idx >= len(items):
        await query.edit_message_text(format_error("Item tidak ditemukan"))
        return

    item = items[item_idx]
    nama = item.get("ocr_nama_asli") or item.get("product_name", "?")
    qty = float(item.get("qty", 0))
    sat = item.get("unit", "pcs")
    harga = item.get("price", 0)
    conf_note = "\n⚠️ _Nama item ini tidak cocok di database produk_" if item.get("needs_confirmation") else ""

    context.user_data["editing_item_idx"] = item_idx
    context.user_data["editing_item_id"] = item.get("id")

    await query.edit_message_text(
        f"✏️ *Edit: {_esc(nama)}*{conf_note}\n\n"
        f"Qty saat ini: {qty} {_esc(sat)}\n"
        f"Harga saat ini: Rp {int(harga):,}\n\n".replace(",", ".") +
        "Ketik: `qty\\_baru harga\\_baru`\nContoh: `10 12500`\n\n"
        "Atau /skip untuk kembali tanpa ubah\\.",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("← Kembali", callback_data=f"edit_{trx_id}")
        ]]),
        parse_mode="MarkdownV2",
    )


# ─── Callback batch: konfirmasi semua ────────────────────────────────────────

async def konfirmasi_semua(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback: konfirmasi_semua_{batch_id}"""
    query = update.callback_query
    if not query:
        return
    await query.answer("Memproses...")

    batch_id = query.data.replace("konfirmasi_semua_", "")
    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        batch_resp = await api.get(f"/transactions/batch/{batch_id}", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await query.edit_message_text(format_error(f"Gagal ambil data batch: {e}"))
        return

    photos = (batch_resp.get("data") or {}).get("photos", [])
    confirmed = 0
    errors = []

    for p in photos:
        tid = p.get("trx_id")
        if not tid or p.get("status") not in ("pending_confirm", "done"):
            continue
        try:
            r = await api.post(f"/transactions/{tid}/confirm", token=token)
            if r.get("success"):
                confirmed += 1
            else:
                errors.append(tid[:8])
        except Exception as e:
            from utils.api_client import APIError
            if isinstance(e, APIError) and e.status_code in (401, 403): raise e
            errors.append(f"{tid[:8]}: {e}")

    err_note = f"\n\n⚠️ {len(errors)} gagal: {', '.join(errors[:3])}" if errors else ""
    await query.edit_message_text(
        f"✅ *{confirmed} nota dikonfirmasi\\!*\n"
        f"Stok \\& kas sudah diupdate\\.{_esc(err_note)}",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("← Menu Utama", callback_data="main_menu_callback"),
        ]]),
        parse_mode="MarkdownV2",
    )


# ─── Callback batch: batal semua ─────────────────────────────────────────────

async def batal_semua(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback: batal_semua_{batch_id}"""
    query = update.callback_query
    if not query:
        return
    await query.answer("Membatalkan...")

    batch_id = query.data.replace("batal_semua_", "")
    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        batch_resp = await api.get(f"/transactions/batch/{batch_id}", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await query.edit_message_text(format_error(f"Gagal ambil data batch: {e}"))
        return

    photos = (batch_resp.get("data") or {}).get("photos", [])
    cancelled = 0
    for p in photos:
        tid = p.get("trx_id")
        if not tid:
            continue
        try:
            await api.delete(f"/transactions/{tid}", token=token)
            cancelled += 1
        except Exception:
            pass

    await query.edit_message_text(
        f"❌ *{cancelled} nota dibatalkan\\.*",
        parse_mode="MarkdownV2",
    )


# ─── Callback batch: kirim ulang ─────────────────────────────────────────────

async def kirim_ulang(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback: kirim_ulang_{batch_id}"""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    # Bersihkan active_batch agar user bisa kirim ulang dari awal
    context.user_data.pop("active_batch", None)

    await query.edit_message_text(
        "📸 Kirim ulang foto yang gagal\\.\nBot akan proses secara terpisah\\.",
        parse_mode="MarkdownV2",
    )


# ─── Callback: Cek & Lanjutkan (re-run mapping) ─────────────────────────────

async def cek_dan_lanjutkan_cb(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback: cek_lanjutkan_{batch_id}
    
    Idempotent handler:
    1. Disable button immediately (prevent spam)
    2. Re-run mapping for all unmapped transactions in the batch
    3. Report results
    """
    query = update.callback_query
    if not query:
        return
    await query.answer("Memproses pemetaan ulang...")

    # Immediately disable buttons to prevent double-clicks
    try:
        await query.edit_message_reply_markup(reply_markup=None)
    except Exception:
        pass

    batch_id = query.data.replace("cek_lanjutkan_", "")
    token = get_token(context)
    api = get_api_client(settings.backend_url)

    # Fetch batch info
    try:
        batch_resp = await api.get(f"/transactions/batch/{batch_id}", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await query.message.reply_text(format_error(f"Gagal ambil data batch: {e}"))
        return

    photos = (batch_resp.get("data") or {}).get("photos", [])
    resolved_total = 0
    still_unmapped_total = 0
    errors = []

    for p in photos:
        tid = p.get("trx_id")
        if not tid or p.get("status") != "unmapped_hold":
            continue
        try:
            r = await api.post(f"/transactions/{tid}/re-run-mapping", token=token)
            if r.get("success"):
                resolved_total += r.get("resolved_count", 0)
                if r.get("still_unmapped"):
                    still_unmapped_total += 1
        except Exception as e:
            from utils.api_client import APIError
            if isinstance(e, APIError) and e.status_code in (401, 403): raise e
            errors.append(f"{tid[:8]}: {e}")

    # Build response message
    if still_unmapped_total == 0 and not errors:
        msg_text = (
            f"✅ *Semua bahan berhasil dipetakan\\!*\\n"
            f"Total {resolved_total} bahan ter\\-resolve\\.\\n\\n"
            f"Klik tombol Konfirmasi untuk menyimpan ke stok\\."
        )
        kb = InlineKeyboardMarkup([[
            InlineKeyboardButton(f"✅ Konfirmasi Semua", callback_data=f"konfirmasi_semua_{batch_id}"),
            InlineKeyboardButton("❌ Batal Semua", callback_data=f"batal_semua_{batch_id}"),
        ]])
    else:
        err_note = f"\\n⚠️ Error: {', '.join(errors[:3])}" if errors else ""
        msg_text = (
            f"⚠️ *Masih ada {still_unmapped_total} nota dengan bahan yang belum dipetakan\\.*\\n"
            f"{resolved_total} bahan ter\\-resolve\\.{_esc(err_note)}\\n\\n"
            f"Petakan lagi di Web Dashboard, lalu klik Cek \\& Lanjutkan\\."
        )
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("🌐 Buka Web Pemetaan", url=f"{settings.web_url}/penyetelan-dapur?tab=mapping")],
            [InlineKeyboardButton("🔄 Cek & Lanjutkan", callback_data=f"cek_lanjutkan_{batch_id}")],
        ])

    try:
        await query.message.reply_text(msg_text, reply_markup=kb, parse_mode="MarkdownV2")
    except Exception as e:
        logger.error(f"Gagal kirim hasil re-run mapping: {e}")
        # Fallback tanpa MarkdownV2
        await query.message.reply_text(
            f"Hasil re-run mapping: {resolved_total} resolved, {still_unmapped_total} masih unmapped",
            reply_markup=kb,
        )


# ─── Utility ─────────────────────────────────────────────────────────────────

def _esc(text: str) -> str:
    import re
    if not text:
        return ""
    return re.sub(r"([_*\[\]()~`>#+\-=|{}.!\\])", r"\\\1", str(text))


def _parse_edit_input(text: str) -> tuple[float, float] | None:
    """Helper to parse 'qty harga' input."""
    parts = text.split()
    if len(parts) != 2:
        return None
    try:
        qty = parse_id_number(parts[0])
        harga = parse_id_number(parts[1])
        if qty < 0 or harga < 0:
            return None
        return float(qty), float(harga)
    except Exception:
        return None


# ─── Global text input handler: edit item inline ──────────────────────────────

async def handle_text_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Tangkap teks bebas untuk edit item massal OCR.
    Hanya aktif jika context.user_data["editing_mode"] == "bulk".
    """
    if not update.message or not update.message.text:
        return

    trx_id = context.user_data.get("editing_trx_id")
    mode = context.user_data.get("editing_mode")
    
    if not trx_id or mode != "bulk":
        return

    text = update.message.text.strip()
    
    # parse lines
    from handlers.belanja_handler import _parse_item_line
    lines = text.split("\n")
    parsed_items = []
    for line in lines:
        if not line.strip(): continue
        item = _parse_item_line(line)
        if not item:
            await update.message.reply_text(
                f"❌ Format salah di baris:\n`{_esc(line)}`\n"
                f"Pastikan format: `nama qty satuan harga`",
                parse_mode="MarkdownV2"
            )
            return
        parsed_items.append(item)

    if not parsed_items:
        await update.message.reply_text("❌ Teks kosong atau format salah.")
        return

    msg = await update.message.reply_text("⏳ Menyimpan perubahan...")

    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.put(
            f"/transactions/{trx_id}/items/bulk",
            token=token,
            json=parsed_items,
        )
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await msg.edit_text(format_error(f"Gagal update: {e}"))
        return

    # Clear editing state
    context.user_data.pop("editing_mode", None)
    context.user_data.pop("editing_trx_id", None)

    new_total = resp.get("new_total", "?")
    def fmt(v): return f"Rp {int(float(v)):,}".replace(",", ".")

    await msg.edit_text(
        f"✅ *{len(parsed_items)} Item berhasil diupdate!*\n\n"
        f"💰 Total nota baru: *{_esc(fmt(new_total))}*",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("✏️ Edit Ulang",  callback_data=f"edit_{trx_id}"),
            InlineKeyboardButton("✅ Konfirmasi Nota", callback_data=f"confirm_{trx_id}"),
        ]]),
        parse_mode="MarkdownV2",
    )

