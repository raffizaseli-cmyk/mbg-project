import logging
from typing import Optional
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from core.config import settings
from utils.api_client import get_api_client
from keyboards.main_menu import get_back_button
from .security import requires_role

logger = logging.getLogger(__name__)


async def render_driver_trip(update: Update, context: ContextTypes.DEFAULT_TYPE, message_id: Optional[int] = None):
    token = context.user_data.get("token")
    if not token:
        if update.callback_query:
            await update.callback_query.answer("Sesi habis. Silakan /login [kode] atau /start [kode].", show_alert=True)
        else:
            await update.message.reply_text("Sesi habis. Silakan /login [kode] atau /start [kode].")
        return

    api = get_api_client(settings.backend_url)

    # Ambil data deliveries hari ini
    try:
        resp = await api.get("/mbg/deliveries/summary", token=token)
    except Exception as e:
        logger.error(f"Driver trip fetch error: {e}")
        text = "❌ Gagal mengambil data pengiriman. Coba lagi nanti."
        try:
            if update.callback_query:
                await update.callback_query.edit_message_text(text)
            else:
                await update.message.reply_text(text)
        except Exception:
            pass
        return

    data = resp.get("data", {})
    has_delivery = data.get("has_delivery", False)
    deliveries = data.get("deliveries", [])

    text_lines = [
        "🚚 <b>Daftar Pengiriman MBG Hari Ini</b>",
        f"📅 Tanggal: {data.get('date')}\n"
    ]

    keyboard = []

    if not has_delivery:
        text_lines.append("⚠️ <b>Belum ada surat jalan dari Dapur.</b>")
        text_lines.append("Silakan admin klik /serah terlebih dahulu untuk memproses stok dapur.")
    else:
        text_lines.append("Berikut adalah daftar sekolah yang siap diantar:")
        text_lines.append("")

        for d in deliveries:
            sid = d.get("id")
            sname = d.get("school_name")
            porsi = d.get("portions_sent")
            sent = d.get("sent_time")
            arrive = d.get("arrival_time")
            dist = d.get("distance_km", 0)

            # Formatting status text & buttons
            if not sent:
                status_icon = "⏳"
                status_text = "Menunggu Berangkat"
                if sid:
                    keyboard.append([InlineKeyboardButton(f"🚀 Berangkat - {sname}", callback_data=f"dr_depart_{sid}")])
            elif sent and not arrive:
                status_icon = "🚚"
                # Target = dist * 3 menit
                import datetime
                try:
                    s_dt = datetime.datetime.strptime(sent, "%H:%M:%S")
                    t_dt = s_dt + datetime.timedelta(minutes=dist * 3)
                    target = t_dt.strftime("%H:%M")
                except Exception:
                    target = "?"
                status_text = f"Dalam Perjalanan (Target Tiba: {target})"
                if sid:
                    keyboard.append([InlineKeyboardButton(f"✅ Selesai (Tiba di {sname})", callback_data=f"dr_arrive_{sid}")])
            else:
                status_icon = "✅"
                status_text = f"Tiba di lokasi jam {arrive}"

            text_lines.append(f"{status_icon} <b>{sname}</b> ({porsi} porsi)")
            text_lines.append(f"└ Status: {status_text}")
            text_lines.append("")

    keyboard.append([InlineKeyboardButton("🔄 Refresh", callback_data="driver_trip")])
    keyboard.append([InlineKeyboardButton("🏠 Menu Utama", callback_data="back_main")])

    final_text = "\n".join(text_lines)
    reply_markup = InlineKeyboardMarkup(keyboard)

    try:
        if update.callback_query:
            await update.callback_query.edit_message_text(final_text, reply_markup=reply_markup, parse_mode="HTML")
        else:
            await update.message.reply_text(final_text, reply_markup=reply_markup, parse_mode="HTML")
    except Exception as e:
        logger.warning(f"Driver trip render warning (maybe not modified): {e}")


@requires_role(["driver", "owner", "admin"])
async def driver_trip_entry(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Entry point for /perjalanan or Main Menu driver trip"""
    query = update.callback_query
    if query:
        await query.answer()

    await render_driver_trip(update, context)


@requires_role(["driver", "owner", "admin"])
async def driver_depart_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer("Memproses keberangkatan...")

    delivery_id = query.data.split("_")[2]
    token = context.user_data.get("token")
    api = get_api_client(settings.backend_url)

    try:
        await api.post(f"/mbg/deliveries/driver/depart/{delivery_id}", data={}, token=token)
    except Exception as e:
        await query.message.reply_text(f"❌ Gagal berangkat: {e}")
        return

    await render_driver_trip(update, context)


@requires_role(["driver", "owner", "admin"])
async def driver_arrive_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer("Memproses ketibaan...")

    delivery_id = query.data.split("_")[2]
    token = context.user_data.get("token")
    api = get_api_client(settings.backend_url)

    try:
        await api.post(f"/mbg/deliveries/driver/arrive/{delivery_id}", data={}, token=token)
    except Exception as e:
        await query.message.reply_text(f"❌ Gagal tiba: {e}")
        return

    await render_driver_trip(update, context)
