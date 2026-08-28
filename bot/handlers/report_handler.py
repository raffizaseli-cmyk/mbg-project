"""
bot/handlers/report_handler.py
Command handlers laporan & dashboard — Modul 11

Commands:
  /hariini  → GET /reports/daily
  /laporan  → GET /reports/monthly
  /stok     → GET /reports/stock
  /piutang  → GET /reports/receivables
  /hutang   → GET /reports/payables + callback lunas_hutang_{id}
"""

import logging
import re
from datetime import date
from decimal import Decimal
from typing import Optional

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.config import settings
from keyboards.main_menu import get_main_menu
from utils.api_client import get_api_client
from utils.formatter import format_error
from utils.session import get_role, get_token, is_authenticated
from handlers.security import requires_role

logger = logging.getLogger(__name__)

BULAN = {
    1: "Januari", 2: "Februari", 3: "Maret",     4: "April",
    5: "Mei",     6: "Juni",     7: "Juli",        8: "Agustus",
    9: "September", 10: "Oktober", 11: "November", 12: "Desember",
}
HARI_ID = {
    "Monday": "Senin", "Tuesday": "Selasa", "Wednesday": "Rabu",
    "Thursday": "Kamis", "Friday": "Jumat", "Saturday": "Sabtu",
    "Sunday": "Minggu",
}
OWNER_ADMIN = {"owner", "admin"}


def _esc(text) -> str:
    if text is None:
        return ""
    return re.sub(r"([_*\[\]()~`>#+\-=|{}.!\\])", r"\\\1", str(text))


def _fmt_rp(amount) -> str:
    try:
        amt = int(Decimal(str(amount or 0)))
        return f"Rp {amt:,}".replace(",", ".")
    except Exception:
        return f"Rp {amount}"


def _date_id(iso_str: Optional[str]) -> str:
    if not iso_str:
        return "—"
    try:
        d = date.fromisoformat(iso_str)
        hari = HARI_ID.get(d.strftime("%A"), d.strftime("%A"))
        return f"{hari}, {d.day} {BULAN[d.month]} {d.year}"
    except Exception:
        return iso_str


def _nav_keyboard(*extra) -> InlineKeyboardMarkup:
    base = [InlineKeyboardButton("← Menu Utama", callback_data="main_menu_callback")]
    return InlineKeyboardMarkup([[*extra, base[0]]] if extra else [[base[0]]])


# ─── /hariini ────────────────────────────────────────────────────────────────

async def hariini_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message:
        return
    msg = update.effective_message

    if not is_authenticated(context):
        await msg.reply_text("❌ Silakan /login [kode] atau /start [kode] untuk login.")
        return

    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.get("/reports/daily", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await msg.reply_text(format_error(f"Gagal ambil data: {e}"))
        return

    data = (resp or {}).get("data", {})
    target_date = data.get("date", date.today().isoformat())
    mbg = data.get("mbg", {})
    exp = data.get("expenses", {})
    cf  = data.get("cashflow", {})
    alerts = data.get("stock_alerts", [])

    tanggal = _date_id(target_date)
    lines = [
        "📊 *RINGKASAN HARI INI*",
        f"_{_esc(tanggal)}_",
        "─────────────────────────",
        "",
        "🍱 *MBG:*",
    ]

    if mbg.get("has_delivery"):
        lines += [
            f"Porsi     : {_esc(str(mbg.get('total_portions', 0)))} porsi",
            f"Sekolah   : {_esc(str(mbg.get('total_schools', 0)))} sekolah",
            f"Menu      : {_esc(mbg.get('menu_name') or '—')}",
            f"Gross     : {_esc(_fmt_rp(mbg.get('revenue_gross')))}",
        ]
    else:
        lines.append("⚪ Belum ada penyerahan hari ini")

    lines += ["", "🛒 *Belanja:*"]
    if exp.get("count", 0) > 0:
        lines += [
            f"Total     : {_esc(_fmt_rp(exp.get('total')))}",
            f"Transaksi : {_esc(str(exp.get('count')))} nota",
        ]
    else:
        lines.append("⚪ Belum ada pengeluaran")

    lines += [
        "",
        "💰 *Arus Kas:*",
        f"Masuk  : {_esc(_fmt_rp(cf.get('income')))}",
        f"Keluar : {_esc(_fmt_rp(cf.get('outcome')))}",
        f"Net    : {_esc(_fmt_rp(cf.get('net')))}",
    ]

    if alerts:
        lines += ["", f"⚠️ *STOK MENIPIS \\({len(alerts)} item\\):*"]
        for a in alerts[:5]:
            lines.append(
                f"• {_esc(a['product_name'])}: {_esc(str(a['stock_qty']))}{_esc(a['unit'])} "
                f"\\(min {_esc(str(a['stock_min']))}{_esc(a['unit'])}\\)"
            )
        if len(alerts) > 5:
            lines.append(f"  _\\+{len(alerts)-5} item lainnya_")

    await msg.reply_text(
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("📈 Laporan Bulanan", callback_data="laporan_bulanan"),
            InlineKeyboardButton("← Menu Utama",      callback_data="main_menu_callback"),
        ]]),
        parse_mode="MarkdownV2",
    )


# ─── /laporan ─────────────────────────────────────────────────────────────────

@requires_role(['owner', 'admin'])
async def laporan_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message:
        return
    msg = update.effective_message

    if not is_authenticated(context):
        await msg.reply_text("❌ Silakan /login [kode] atau /start [kode] untuk login.")
        return

    loading = await msg.reply_text("⏳ Mengambil data laporan\\.\\.\\.", parse_mode="MarkdownV2")

    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.get("/reports/monthly", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await loading.edit_text(format_error(f"Gagal: {e}"))
        return

    data = (resp or {}).get("data", {})
    mbg  = data.get("mbg", {})
    exp  = data.get("expenses", {})
    pe   = data.get("profit_estimate", {})
    stk  = data.get("stock_summary", {})
    excel_status = data.get("excel_status", "not_generated")

    excel_labels = {
        "ready": "✅ Siap didownload",
        "pending_regenerate": "🔄 Sedang diperbarui\\.\\.\\.",
        "not_generated": "❌ Belum dibuat",
    }
    excel_label = excel_labels.get(excel_status, "❓")

    lines = [
        "📈 *LAPORAN BULAN INI*",
        f"_{_esc(data.get('period_label', ''))} — {data.get('year', '')}_",
        "─────────────────────────",
        "",
        "🍱 *MBG:*",
        f"Total Porsi : {_esc(str(mbg.get('total_portions', 0)))} porsi",
        f"Hari Kirim  : {_esc(str(mbg.get('total_delivery_days', 0)))} hari",
        f"Rata\\-rata  : {_esc(str(mbg.get('avg_portions_per_day', 0)))} porsi/hari",
        f"Pendapatan  : {_esc(_fmt_rp(mbg.get('revenue_gross')))}",
        "",
        "🛒 *Pengeluaran:*",
        f"Total       : {_esc(_fmt_rp(exp.get('total')))}",
        f"Nota        : {_esc(str(exp.get('count', 0)))} transaksi",
        f"Hutang      : {_esc(_fmt_rp(exp.get('hutang_outstanding')))}",
    ]

    top = exp.get("top_suppliers", [])
    if top:
        lines.append("Top Supplier:")
        for s in top[:5]:
            lines.append(f"  • {_esc(s['name'])}: {_esc(_fmt_rp(s['total']))}")

    lines += [
        "",
        "💹 *Estimasi Profit:*",
        f"Pendapatan  : {_esc(_fmt_rp(pe.get('revenue')))}",
        f"Pengeluaran : {_esc(_fmt_rp(pe.get('expenses')))}",
        f"Gross Profit: {_esc(_fmt_rp(pe.get('gross_profit')))}",
    ]

    low_count = stk.get("low_stock_count", 0)
    if low_count:
        lines.append(f"\n⚠️ *{low_count} item stok menipis*")

    lines += ["", f"📄 Excel: {excel_label}"]

    # Ambil year/month untuk callback
    y = data.get("year", date.today().year)
    m = data.get("month", date.today().month)

    keyboard_rows = []
    if excel_status == "ready":
        keyboard_rows.append([InlineKeyboardButton(
            "📥 Download Excel", callback_data=f"download_excel_{y}_{m}"
        )])
    elif excel_status == "pending_regenerate":
        keyboard_rows.append([InlineKeyboardButton(
            "🔄 Generate Ulang Excel", callback_data=f"download_excel_{y}_{m}"
        )])
    else:
        keyboard_rows.append([InlineKeyboardButton(
            "📊 Generate Excel", callback_data=f"download_excel_{y}_{m}"
        )])
    keyboard_rows.append([
        InlineKeyboardButton("📊 Hari Ini", callback_data="laporan_hariini"),
        InlineKeyboardButton("📦 Cek Stok", callback_data="cek_stok"),
        InlineKeyboardButton("← Menu",      callback_data="main_menu_callback"),
    ])

    await loading.edit_text(
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup(keyboard_rows),
        parse_mode="MarkdownV2",
    )


# ─── /stok ────────────────────────────────────────────────────────────────────

@requires_role(['owner', 'admin'])
async def stok_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message:
        return
    msg = update.effective_message

    if not is_authenticated(context):
        await msg.reply_text("❌ Silakan /login [kode] atau /start [kode] untuk login.")
        return

    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.get("/reports/stock", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await msg.reply_text(format_error(f"Gagal: {e}"))
        return

    data      = (resp or {}).get("data", {})
    total     = data.get("total_items", 0)
    low_count = data.get("low_stock_count", 0)
    items     = data.get("items", [])

    low_items  = [i for i in items if i.get("is_low_stock")]
    safe_items = [i for i in items if not i.get("is_low_stock")]

    lines = [
        "📦 *STATUS STOK*",
        f"_{total} item total_",
        "─────────────────────────",
    ]

    if low_items:
        lines.append(f"\n⚠️ *MENIPIS \\({low_count} item\\):*")
        for p in low_items[:10]:
            sq = p.get("stock_qty_display", p.get("stock_qty", 0))
            sm = p.get("stock_min_display", p.get("stock_min", 0))
            lines.append(
                f"• {_esc(p['name'])}: {_esc(str(sq))}/{_esc(str(sm))} "
                f"{_esc(p['unit'])} ⚠️"
            )

    if safe_items:
        lines.append("\n✅ *STOK AMAN:*")
        show = safe_items[:20 - len(low_items)]
        for p in show:
            sq = p.get("stock_qty_display", p.get("stock_qty", 0))
            lines.append(f"• {_esc(p['name'])}: {_esc(str(sq))} {_esc(p['unit'])}")

    if total > 20:
        shown = min(len(low_items), 10) + min(len(safe_items), 20 - len(low_items))
        lines.append(f"\n_\\.\\.\\. dan {total - shown} item lainnya\\. Lihat detail di web\\._")

    await msg.reply_text(
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("📝 Catat Belanja", callback_data="belanja"),
            InlineKeyboardButton("← Menu Utama",    callback_data="main_menu_callback"),
        ]]),
        parse_mode="MarkdownV2",
    )


# ─── /piutang ─────────────────────────────────────────────────────────────────

async def piutang_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message:
        return
    msg = update.effective_message

    if not is_authenticated(context):
        await msg.reply_text("❌ Silakan /login [kode] atau /start [kode] untuk login.")
        return
    if get_role(context) not in OWNER_ADMIN:
        await msg.reply_text("❌ Hanya owner dan admin yang bisa lihat piutang.")
        return

    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.get("/reports/receivables?status=unpaid", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await msg.reply_text(format_error(f"Gagal: {e}"))
        return

    data   = (resp or {}).get("data", {})
    total  = data.get("total_outstanding", "0")
    count  = data.get("count", 0)
    items  = data.get("receivables", [])

    lines = [
        "💰 *PIUTANG BELUM LUNAS*",
        f"Total: {_esc(_fmt_rp(total))} \\({count} tagihan\\)",
        "─────────────────────────",
    ]

    for r in items[:10]:
        due = _date_id(r.get("due_date"))
        over = r.get("days_overdue", 0)
        over_note = f"\n    ⚠️ Terlambat {over} hari" if over > 0 else ""
        lines += [
            "",
            f"🏛️ *{_esc(r.get('debtor_name', '?'))}*",
            f"   {_esc(_fmt_rp(r.get('amount')))}",
            f"   Jatuh tempo: {_esc(due)}{over_note}",
        ]

    if count == 0:
        lines.append("\n✅ Tidak ada piutang yang belum lunas")

    await msg.reply_text(
        "\n".join(lines),
        reply_markup=_nav_keyboard(),
        parse_mode="MarkdownV2",
    )


# ─── /hutang ──────────────────────────────────────────────────────────────────

async def hutang_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message:
        return
    msg = update.effective_message

    if not is_authenticated(context):
        await msg.reply_text("❌ Silakan /login [kode] atau /start [kode] untuk login.")
        return
    if get_role(context) not in OWNER_ADMIN:
        await msg.reply_text("❌ Hanya owner dan admin yang bisa lihat hutang.")
        return

    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.get("/reports/payables?status=unpaid", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await msg.reply_text(format_error(f"Gagal: {e}"))
        return

    data  = (resp or {}).get("data", {})
    total = data.get("total_outstanding", "0")
    count = data.get("count", 0)
    items = data.get("payables", [])

    lines = [
        "💸 *HUTANG BELUM LUNAS*",
        f"Total: {_esc(_fmt_rp(total))} \\({count} tagihan\\)",
        "─────────────────────────",
    ]

    keyboard_buttons = []
    for p in items[:10]:
        pid   = p.get("id", "")
        name  = p.get("supplier_name", "?")
        due   = _date_id(p.get("due_date"))
        over  = p.get("days_overdue", 0)
        over_note = f"\n    ⚠️ Terlambat {over} hari" if over > 0 else ""

        lines += [
            "",
            f"🏪 *{_esc(name)}*",
            f"   Pokok : {_esc(_fmt_rp(p.get('amount')))}",
            f"   Jatuh : {_esc(due)}{over_note}",
        ]
        keyboard_buttons.append([
            InlineKeyboardButton(f"✅ Tandai Lunas: {name[:20]}", callback_data=f"lunas_hutang_{pid}"),
        ])

    if count == 0:
        lines.append("\n✅ Tidak ada hutang yang belum lunas")

    keyboard_buttons.append([InlineKeyboardButton("← Menu Utama", callback_data="main_menu_callback")])

    await msg.reply_text(
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup(keyboard_buttons),
        parse_mode="MarkdownV2",
    )


# ─── Callback: lunas_hutang_{payable_id} ─────────────────────────────────────

async def lunas_hutang(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()

    payable_id = query.data.replace("lunas_hutang_", "")
    token = get_token(context)
    api = get_api_client(settings.backend_url)

    try:
        resp = await api.patch(f"/payables/{payable_id}/mark-paid", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await query.edit_message_text(format_error(f"Gagal: {e}"))
        return

    if not (resp or {}).get("success"):
        err = (resp or {}).get("detail", "Gagal tandai lunas")
        await query.edit_message_text(format_error(str(err)))
        return

    supplier = ((resp or {}).get("data") or {}).get("supplier_name", "Supplier")
    await query.edit_message_text(
        f"✅ Hutang *{_esc(supplier)}* ditandai lunas\\.\n\n/hutang untuk lihat sisa hutang\\.",
        parse_mode="MarkdownV2",
    )


# ─── Callback shortcuts dari main menu ───────────────────────────────────────

async def laporan_hariini_cb(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback 'laporan_hariini' → trigger /hariini."""
    if update.callback_query:
        await update.callback_query.answer()
    await hariini_command(update, context)


async def laporan_bulanan_cb(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback 'laporan_bulanan' → trigger /laporan."""
    if update.callback_query:
        await update.callback_query.answer()
    await laporan_command(update, context)


async def cek_stok_cb(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Callback 'cek_stok' → trigger /stok."""
    if update.callback_query:
        await update.callback_query.answer()
    await stok_command(update, context)


# ─── Callback: download_excel_{year}_{month} ─────────────────────────────────

async def download_excel_cb(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Panggil GET /reports/excel/download (sync generate jika perlu).
    Edit pesan jadi URL download atau error.
    """
    query = update.callback_query
    if not query:
        return
    await query.answer()

    # Parse year/month dari callback_data
    parts = query.data.split("_")  # download_excel_{y}_{m}
    y = m = None
    try:
        if len(parts) >= 4:
            y = int(parts[2])
            m = int(parts[3])
    except Exception:
        pass

    token = get_token(context)
    api = get_api_client(settings.backend_url)

    # Tampil loading
    await query.edit_message_text(
        "⏳ Menyiapkan file Excel\\.\\.\\.",
        parse_mode="MarkdownV2",
    )

    params = ""
    if y and m:
        params = f"?year={y}&month={m}"

    try:
        resp = await api.get(f"/reports/excel/download{params}", token=token)
    except Exception as e:
        from utils.api_client import APIError
        if isinstance(e, APIError) and e.status_code in (401, 403): raise e
        await query.edit_message_text(
            f"❌ Gagal generate Excel: {_esc(str(e))}",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔄 Coba Lagi", callback_data=query.data),
                InlineKeyboardButton("← Menu",      callback_data="main_menu_callback"),
            ]]),
            parse_mode="MarkdownV2",
        )
        return

    if not (resp or {}).get("success"):
        err = (resp or {}).get("detail", "Gagal generate")
        await query.edit_message_text(
            f"❌ {_esc(str(err))}",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("← Menu", callback_data="main_menu_callback"),
            ]]),
            parse_mode="MarkdownV2",
        )
        return

    file_url = (resp or {}).get("data", {}).get("file_url", "")
    bulan_str = BULAN.get(m, str(m)) if m else "?"
    year_str  = str(y) if y else ""

    await query.edit_message_text(
        f"✅ *Excel siap\\!*\n\n"
        f"📥 [Download Pembukuan {_esc(bulan_str)} {_esc(year_str)}]({file_url})\n\n"
        f"_File tersedia di Supabase Storage\\._",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("← Menu Utama", callback_data="main_menu_callback"),
        ]]),
        parse_mode="MarkdownV2",
    )
