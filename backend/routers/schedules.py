"""
backend/routers/schedules.py
AI Jadwal Operasional MBG — Full Redesign

Jadwal = timeline harian (prep, masak, berangkat, tiba)
Porsi otomatis dari schools.default_portions.

Endpoints:
  GET  /schedules/master        → master schedule + school timings
  POST /schedules/master        → upsert master schedule
  GET  /schedules/ai-draft      → draft timeline dari Gemini
  POST /schedules/load-master   → timeline dari master (no AI)
  POST /schedules/approve-draft → simpan ke schedules table
  GET  /schedules/week          → timeline minggu tersimpan
"""

import json
import logging
import re
from datetime import date, timedelta, time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from core.config import settings
from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.user import UserInDB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schedules", tags=["schedules"])

DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

NATIONAL_HOLIDAYS = {
    "2025-01-01": "Tahun Baru", "2025-01-27": "Isra Mikraj",
    "2025-01-29": "Tahun Baru Imlek", "2025-03-29": "Hari Raya Nyepi",
    "2025-03-31": "Idul Fitri", "2025-04-01": "Idul Fitri",
    "2025-04-18": "Wafat Isa Almasih", "2025-05-01": "Hari Buruh",
    "2025-05-12": "Hari Raya Waisak", "2025-05-29": "Kenaikan Isa Almasih",
    "2025-06-01": "Hari Lahir Pancasila", "2025-06-06": "Idul Adha",
    "2025-06-27": "Tahun Baru Islam", "2025-08-17": "HUT RI",
    "2025-09-05": "Maulid Nabi", "2025-12-25": "Natal",
    "2026-01-01": "Tahun Baru", "2026-02-17": "Isra Mikraj",
    "2026-02-18": "Tahun Baru Imlek", "2026-03-19": "Hari Raya Nyepi",
    "2026-03-20": "Idul Fitri", "2026-03-21": "Idul Fitri",
    "2026-04-03": "Wafat Isa Almasih", "2026-05-01": "Hari Buruh",
    "2026-05-27": "Idul Adha", "2026-06-01": "Hari Lahir Pancasila",
    "2026-08-17": "HUT RI", "2026-12-25": "Natal",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _time_str(t) -> str:
    if isinstance(t, time):
        return t.strftime("%H:%M")
    if isinstance(t, str):
        return t[:5] if len(t) >= 5 else t
    return "00:00"


def _time_sub(t_str: str, minutes: int) -> str:
    parts = t_str.split(":")
    h, m = int(parts[0]), int(parts[1])
    total = max(0, h * 60 + m - minutes)
    return f"{total // 60:02d}:{total % 60:02d}"


def _time_add(t_str: str, minutes: int) -> str:
    parts = t_str.split(":")
    h, m = int(parts[0]), int(parts[1])
    total = h * 60 + m + minutes
    return f"{total // 60:02d}:{total % 60:02d}"


def _time_diff_minutes(t1: str, t2: str) -> int:
    """Return difference in minutes: t2 - t1."""
    p1 = t1.split(":")
    p2 = t2.split(":")
    return (int(p2[0]) * 60 + int(p2[1])) - (int(p1[0]) * 60 + int(p1[1]))


def _format_duration(minutes: int) -> str:
    """Format minutes as 'Xj Ym'."""
    if minutes < 60:
        return f"{minutes}m"
    h = minutes // 60
    m = minutes % 60
    return f"{h}j {m}m" if m > 0 else f"{h}j"


def _get_monday(week_start: Optional[str], default_next: bool = False) -> date:
    today = date.today()
    if week_start:
        try:
            return date.fromisoformat(week_start)
        except ValueError:
            raise HTTPException(422, "Format week_start harus YYYY-MM-DD")
    if default_next:
        days_ahead = (7 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        return today + timedelta(days=days_ahead)
    return today - timedelta(days=today.weekday())


def _fetch_menu_for_week(supabase, tenant_id: str, monday: date) -> Dict[int, dict]:
    """Fetch mbg_weekly_menus for a week, return {day_of_week: {menu_name, menu_id}}."""
    try:
        resp = (
            supabase.table("mbg_weekly_menus")
            .select("day_of_week, menu_name, menu_id")
            .eq("tenant_id", tenant_id)
            .eq("week_start", monday.isoformat())
            .execute()
        )
        menus = getattr(resp, "data", None) or []
        return {m["day_of_week"]: m for m in menus}
    except Exception as e:
        logger.warning(f"fetch menus error: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# _fetch_master_data — shared internal helper
# ═══════════════════════════════════════════════════════════════════════════════

def _fetch_master_data(tenant_id: str) -> Optional[Dict[str, Any]]:
    """Fetch master schedule + school timings. Returns None if not set up."""
    try:
        supabase = get_supabase()

        ms_resp = (
            supabase.table("master_schedules")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        ms_rows = getattr(ms_resp, "data", None) or []

        if not ms_rows:
            return None

        master = ms_rows[0]
        master_id = master["id"]

        mss_resp = (
            supabase.table("master_schedule_schools")
            .select("*, schools(id, name, default_portions, is_active)")
            .eq("master_id", master_id)
            .eq("is_active", True)
            .order("target_arrival")
            .execute()
        )
        school_timings = getattr(mss_resp, "data", None) or []

        # Filter active schools first
        valid_timings = []
        for st in school_timings:
            school_data = st.get("schools") or {}
            # Hanya ambil yang beneran aktif
            if school_data.get("is_active") is not False:
                valid_timings.append(st)

        # FALLBACK: Jika tidak ada sekolah valid, ambil semua sekolah aktif sebagai default
        if not valid_timings:
            logger.info(f"[FALLBACK] No active linked schools for master_id {master_id}. Fetching all active schools.")
            all_schools_resp = (
                supabase.table("schools")
                .select("id, name, default_portions, is_active")
                .eq("tenant_id", tenant_id)
                .execute()
            )
            all_schools = getattr(all_schools_resp, "data", None) or []
            logger.info(f"[FALLBACK] Found {len(all_schools)} schools for tenant {tenant_id}.")
            
            valid_timings = [
                {
                    "school_id": s["id"],
                    "schools": s,
                    "target_arrival": "10:30",
                    "travel_minutes": 30,
                    "delivery_window_minutes": 15,
                    "day_of_week": 0
                }
                for s in all_schools if s.get("is_active") is not False
            ]
            logger.info(f"[FALLBACK] Final timing entries: {len(valid_timings)}")

        schools = []
        for st in valid_timings:
            school_data = st.get("schools") or {}

            target = _time_str(st.get("target_arrival", "10:30"))
            travel = st.get("travel_minutes", 30)
            delivery_window = st.get("delivery_window_minutes", 15)
            depart = _time_sub(target, travel)
            done_at = _time_add(target, delivery_window)

            schools.append({
                "school_id": st["school_id"],
                "school_name": school_data.get("name", "?"),
                "default_portions": school_data.get("default_portions", 0),
                "target_arrival": target,
                "travel_minutes": travel,
                "delivery_window_minutes": delivery_window,
                "depart_time": depart,
                "done_at_school": done_at,
                "day_of_week": st.get("day_of_week", 0),
            })

        # Determine cook_end
        cook_start = _time_str(master.get("cook_start_time", "07:00"))
        cook_end_raw = master.get("cook_end_time")
        cook_per_100 = master.get("cook_minutes_per_100", 30)
        total_portions = sum(s["default_portions"] for s in schools)

        if cook_end_raw:
            cook_end = _time_str(cook_end_raw)
        else:
            cook_duration = max(30, int((total_portions / 100) * cook_per_100)) if total_portions > 0 else 30
            cook_end = _time_add(cook_start, cook_duration)

        cook_duration_minutes = _time_diff_minutes(cook_start, cook_end)

        return {
            "id": master_id,
            "name": master.get("name", "Jadwal Utama"),
            "prep_start_time": _time_str(master.get("prep_start_time", "06:30")),
            "cook_start_time": cook_start,
            "cook_end_time": cook_end,
            "cook_minutes_per_100": cook_per_100,
            "cook_duration_minutes": cook_duration_minutes,
            "total_portions": total_portions,
            "schools": schools,
        }

    except Exception as e:
        logger.error(f"_fetch_master_data error: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# _build_timeline — shared timeline builder
# ═══════════════════════════════════════════════════════════════════════════════

def _build_timeline_from_master(
    master: Dict[str, Any],
    monday: date,
    menus: Dict[int, dict],
) -> List[Dict[str, Any]]:
    """Build Senin-Jumat timeline from master schedule data + menus."""
    prep_start = master["prep_start_time"]
    cook_start = master["cook_start_time"]
    cook_end = master["cook_end_time"]
    cook_duration = master["cook_duration_minutes"]
    total_portions = master["total_portions"]
    schools = master["schools"]

    days = []
    for i in range(6):  # Senin-Sabtu
        d = monday + timedelta(days=i)
        d_str = d.isoformat()
        holiday = NATIONAL_HOLIDAYS.get(d_str)

        # Menu for this day (day_of_week: 1=Senin...6=Sabtu)
        menu_data = menus.get(i + 1, {})
        menu_name = menu_data.get("menu_name")
        menu_id = menu_data.get("menu_id")

        if holiday:
            days.append({
                "date": d_str, "day_name": DAY_NAMES[i],
                "is_holiday": True, "holiday_name": holiday,
                "menu_name": None, "menu_id": None, "has_menu": False,
                "timeline": [], "total_portions": 0,
                "cook_duration_minutes": 0, "ai_notes": f"Libur: {holiday}",
            })
            continue

        cook_label = f"Mulai masak"
        if menu_name:
            cook_label += f" {menu_name}"
        cook_label += f" ({total_portions:,} porsi)"

        timeline = [
            {"time": prep_start, "activity": "Persiapan bahan",
             "school_id": None, "school_name": None, "type": "prep"},
            {"time": cook_start, "activity": cook_label,
             "school_id": None, "school_name": None, "type": "cook"},
            {"time": cook_end, "activity": "Selesai masak",
             "school_id": None, "school_name": None, "type": "cook_done"},
        ]

        for s in sorted(schools, key=lambda x: x["depart_time"]):
            timeline.append({
                "time": s["depart_time"],
                "activity": f"Berangkat → {s['school_name']}",
                "school_id": s["school_id"],
                "school_name": s["school_name"],
                "type": "depart",
            })
            timeline.append({
                "time": s["target_arrival"],
                "activity": f"Tiba di {s['school_name']}",
                "school_id": s["school_id"],
                "school_name": s["school_name"],
                "type": "arrive",
            })

        timeline.sort(key=lambda x: x["time"])

        days.append({
            "date": d_str, "day_name": DAY_NAMES[i],
            "is_holiday": False, "holiday_name": None,
            "menu_name": menu_name, "menu_id": menu_id,
            "has_menu": bool(menu_name),
            "timeline": timeline, "total_portions": total_portions,
            "cook_duration_minutes": cook_duration,
            "ai_notes": None,
        })

    return days


# ═══════════════════════════════════════════════════════════════════════════════
# GET /schedules/master
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/master", response_model=Dict[str, Any])
def get_master_schedule(
    current_user: UserInDB = Depends(get_current_user),
):
    """Return master schedule + school timings. Returns null if not set up."""
    try:
        data = _fetch_master_data(current_user.tenant_id)
        return {"success": True, "data": data}
    except Exception as e:
        logger.error(f"GET /schedules/master error: {e}")
        return {"success": True, "data": None}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /schedules/master
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/master",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def upsert_master_schedule(
    body: Dict[str, Any] = Body(...),
    current_user: UserInDB = Depends(get_current_user),
):
    """Upsert master schedule + school timings."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    master_data = {
        "tenant_id": tid,
        "name": body.get("name", "Jadwal Utama"),
        "prep_start_time": body.get("prep_start_time", "06:30"),
        "cook_start_time": body.get("cook_start_time", "07:00"),
        "cook_end_time": body.get("cook_end_time", "09:30"),
        "cook_minutes_per_100": body.get("cook_minutes_per_100", 30),
        "is_active": True,
    }

    ms_resp = (
        supabase.table("master_schedules")
        .upsert(master_data, on_conflict="tenant_id")
        .execute()
    )
    ms_rows = getattr(ms_resp, "data", None) or []
    if not ms_rows:
        raise HTTPException(500, "Gagal simpan master schedule")
    master_id = ms_rows[0]["id"]

    schools_input = body.get("schools", [])
    saved_schools = []

    for s in schools_input:
        school_data = {
            "tenant_id": tid,
            "master_id": master_id,
            "school_id": s["school_id"],
            "target_arrival": s.get("target_arrival", "10:30"),
            "travel_minutes": s.get("travel_minutes", 30),
            "delivery_window_minutes": s.get("delivery_window_minutes", 15),
            "day_of_week": s.get("day_of_week", 0),
            "is_active": True,
        }
        try:
            resp = (
                supabase.table("master_schedule_schools")
                .upsert(school_data, on_conflict="master_id,school_id,day_of_week")
                .execute()
            )
            saved = (getattr(resp, "data", None) or [{}])[0]
            saved_schools.append(saved)
        except Exception as e:
            logger.warning(f"Upsert school timing gagal: {e}")

    return {
        "success": True,
        "data": {"master_id": master_id, "schools_saved": len(saved_schools)},
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /schedules/load-master
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/load-master",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def load_master_timeline(
    body: Dict[str, Any] = Body(...),
    current_user: UserInDB = Depends(get_current_user),
):
    """Generate timeline dari master schedule tanpa Gemini."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    monday = _get_monday(body.get("week_start"))

    master = _fetch_master_data(tid)
    if not master:
        raise HTTPException(404, "Master schedule belum di-setup. Silakan setup dulu.")

    menus = _fetch_menu_for_week(supabase, tid, monday)
    days = _build_timeline_from_master(master, monday, menus)

    return {
        "success": True,
        "data": {
            "week_start": monday.isoformat(),
            "days": days,
            "source": "master",
            "from_ai": False,
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /schedules/ai-draft
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/ai-draft",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def get_ai_draft_schedule(
    week_start: Optional[str] = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Generate draft timeline operasional dari Gemini berdasarkan historis."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    monday = _get_monday(week_start, default_next=True)

    if not settings.gemini_api_key:
        return _load_master_fallback(tid, monday, supabase)

    try:
        master = _fetch_master_data(tid)
        menus = _fetch_menu_for_week(supabase, tid, monday)

        schools_resp = (
            supabase.table("schools")
            .select("id, name, default_portions, address")
            .eq("tenant_id", tid)
            .eq("is_active", True)
            .execute()
        )
        schools = getattr(schools_resp, "data", None) or []

        if not schools:
            return _load_master_fallback(tid, monday, supabase)

        # 4-week delivery history with times
        four_weeks_ago = (date.today() - timedelta(weeks=4)).isoformat()
        del_resp = (
            supabase.table("mbg_deliveries")
            .select("delivery_date, school_id, portions_sent, sent_time, arrival_time")
            .eq("tenant_id", tid)
            .gte("delivery_date", four_weeks_ago)
            .order("delivery_date", desc=True)
            .limit(100)
            .execute()
        )
        deliveries = getattr(del_resp, "data", None) or []

        week_holidays = {}
        for i in range(7):
            d = (monday + timedelta(days=i)).isoformat()
            h = NATIONAL_HOLIDAYS.get(d)
            if h:
                week_holidays[d] = h

        total_portions = sum(s.get("default_portions", 0) for s in schools)
        master_json = json.dumps(master, ensure_ascii=False, default=str) if master else "null"

        # Menu info per day
        menu_info = []
        for i in range(5):
            d = monday + timedelta(days=i)
            m = menus.get(i + 1, {})
            menu_info.append({
                "date": d.isoformat(),
                "day_name": DAY_NAMES[i],
                "menu_name": m.get("menu_name"),
            })

        prompt = f"""Analisis jadwal pengiriman MBG berdasarkan data:

Data historis pengiriman (4 minggu terakhir, termasuk sent_time dan arrival_time):
{json.dumps(deliveries[:50], ensure_ascii=False, default=str)}

Master schedule:
{master_json}

Menu per hari:
{json.dumps(menu_info, ensure_ascii=False)}

Daftar sekolah:
{json.dumps([{{"id": s["id"], "name": s["name"], "portions": s.get("default_portions", 0)}} for s in schools], ensure_ascii=False)}

Hari libur minggu {monday.isoformat()}:
{json.dumps(week_holidays, ensure_ascii=False)}

Total porsi: {total_portions}

Buat timeline operasional harian Senin-Jumat dalam JSON:
{{
  "days": [
    {{
      "date": "YYYY-MM-DD",
      "day_name": "Senin",
      "is_holiday": false,
      "holiday_name": null,
      "menu_name": "nama menu atau null",
      "has_menu": true,
      "timeline": [
        {{
          "time": "HH:MM",
          "activity": "deskripsi kegiatan",
          "school_id": "uuid atau null",
          "school_name": "nama atau null",
          "type": "prep|cook|cook_done|depart|arrive"
        }}
      ],
      "total_portions": {total_portions},
      "cook_duration_minutes": 150,
      "ai_notes": "catatan"
    }}
  ]
}}

Jika historis menunjukkan keterlambatan konsisten di sekolah tertentu, sesuaikan jam berangkat lebih awal.
Hari libur tidak perlu timeline.
Return HANYA JSON valid."""

        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_text_model)
        response = model.generate_content(prompt)
        raw = response.text.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        if raw.endswith("```"):
            raw = raw[:-3]

        draft = json.loads(raw.strip())

        return {
            "success": True,
            "data": {
                "week_start": monday.isoformat(),
                "days": draft.get("days", []),
                "source": "ai",
                "from_ai": True,
                "ai_notes": draft.get("ai_notes"),
            },
        }

    except Exception as e:
        logger.error("AI draft schedule error: %s", e)
        return _load_master_fallback(tid, monday, supabase)


def _load_master_fallback(tenant_id: str, monday: date, supabase=None) -> Dict[str, Any]:
    """Fallback: build from master schedule without AI."""
    try:
        master = _fetch_master_data(tenant_id)
        if not master:
            return {
                "success": True,
                "data": {
                    "week_start": monday.isoformat(), "days": [],
                    "source": "empty", "from_ai": False,
                    "ai_notes": "Master schedule belum di-setup dan AI tidak tersedia.",
                },
            }

        if not supabase:
            supabase = get_supabase()
        menus = _fetch_menu_for_week(supabase, tenant_id, monday)
        days = _build_timeline_from_master(master, monday, menus)

        return {
            "success": True,
            "data": {
                "week_start": monday.isoformat(), "days": days,
                "source": "master_fallback", "from_ai": False,
                "ai_notes": "AI tidak tersedia. Timeline dari master schedule.",
            },
        }
    except Exception:
        return {
            "success": True,
            "data": {
                "week_start": monday.isoformat(), "days": [],
                "source": "empty", "from_ai": False,
                "ai_notes": "Master schedule belum di-setup dan AI tidak tersedia.",
            },
        }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /schedules/approve-draft
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/approve-draft",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def approve_draft_schedule(
    body: Dict[str, Any] = Body(...),
    current_user: UserInDB = Depends(get_current_user),
):
    """Simpan draft timeline ke tabel schedules."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    uid = current_user.id

    days = body.get("days", [])
    if not days:
        raise HTTPException(400, "Tidak ada data hari dalam draft")

    week_start = body.get("week_start")
    if week_start:
        try:
            monday = date.fromisoformat(week_start)
            sunday = monday + timedelta(days=6)
            supabase.table("schedules").delete() \
                .eq("tenant_id", tid).eq("type", "mbg_daily") \
                .gte("scheduled_date", monday.isoformat()) \
                .lte("scheduled_date", sunday.isoformat()).execute()
        except Exception as e:
            logger.warning("Delete existing schedule error: %s", e)

    rows_to_insert = []
    for day in days:
        if day.get("is_holiday"):
            continue
        day_date = day.get("date")
        day_name = day.get("day_name", "")
        total_portions = day.get("total_portions", 0)
        menu_name = day.get("menu_name")

        for event in day.get("timeline", []):
            evt_type = event.get("type", "")
            school_id = event.get("school_id")
            school_name = event.get("school_name", "")

            title = f"MBG {day_name}"
            if school_name:
                title += f" - {school_name}"
            title += f" ({event.get('activity', '')})"

            row = {
                "tenant_id": tid,
                "user_id": uid,
                "type": "mbg_daily",
                "title": title,
                "customer_name": school_name if school_id else None,
                "description": event.get("activity"),
                "scheduled_date": day_date,
                "scheduled_time": event.get("time"),
                "qty": total_portions if evt_type == "cook" else 0,
                "status": "scheduled",
                "notes": json.dumps({
                    "event_type": evt_type,
                    "school_id": school_id,
                    "menu_name": menu_name,
                }),
            }
            rows_to_insert.append(row)

    saved_count = 0
    if rows_to_insert:
        insert_resp = supabase.table("schedules").insert(rows_to_insert).execute()
        inserted = getattr(insert_resp, "data", None) or []
        saved_count = len(inserted)

    return {
        "success": True,
        "data": {"saved_count": saved_count, "week_start": week_start},
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /schedules/week
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/week", response_model=Dict[str, Any])
def get_week_schedule(
    week_start: Optional[str] = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ambil jadwal timeline minggu ini dari DB schedules."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    monday = _get_monday(week_start)
    saturday = monday + timedelta(days=5)

    try:
        resp = (
            supabase.table("schedules")
            .select("*")
            .eq("tenant_id", tid)
            .eq("type", "mbg_daily")
            .gte("scheduled_date", monday.isoformat())
            .lte("scheduled_date", saturday.isoformat())
            .order("scheduled_date")
            .order("scheduled_time")
            .execute()
        )
        rows = getattr(resp, "data", None) or []
    except Exception as e:
        logger.error(f"GET /schedules/week error: {e}")
        rows = []

    by_day: Dict[str, list] = {}
    menu_by_day: Dict[str, str] = {}
    for row in rows:
        d = row["scheduled_date"]
        notes_raw = row.get("notes") or "{}"
        try:
            notes = json.loads(notes_raw) if isinstance(notes_raw, str) else (notes_raw or {})
        except Exception:
            notes = {}

        by_day.setdefault(d, []).append({
            "id": row.get("id"),
            "time": _time_str(row.get("scheduled_time", "")),
            "activity": row.get("description", ""),
            "school_id": notes.get("school_id"),
            "school_name": row.get("customer_name"),
            "type": notes.get("event_type", ""),
        })

        if notes.get("menu_name"):
            menu_by_day[d] = notes["menu_name"]

    has_data = bool(rows)
    days = []
    for i in range(6):
        d = monday + timedelta(days=i)
        d_str = d.isoformat()
        holiday = NATIONAL_HOLIDAYS.get(d_str)
        timeline = by_day.get(d_str, [])

        total = 0
        for evt in timeline:
            if evt.get("type") == "cook":
                act = evt.get("activity", "")
                m = re.search(r"([\d.,]+)\s*porsi", act)
                if m:
                    total = int(m.group(1).replace(".", "").replace(",", ""))

        days.append({
            "date": d_str, "day_name": DAY_NAMES[i],
            "is_holiday": bool(holiday), "holiday_name": holiday,
            "menu_name": menu_by_day.get(d_str),
            "has_menu": bool(menu_by_day.get(d_str)),
            "timeline": timeline, "total_portions": total,
        })

    return {
        "success": True,
        "data": {
            "week_start": monday.isoformat(),
            "has_schedule": has_data,
            "days": days,
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /schedules/update-timeline
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/update-timeline",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def update_schedule_timeline(
    body: Dict[str, Any] = Body(...),
    current_user: UserInDB = Depends(get_current_user),
):
    """Update scheduled_time for multiple activities in a day."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    updates = body.get("updates", [])
    
    if not updates:
        raise HTTPException(400, "Tidak ada data update")
        
    try:
        updated_count = 0
        for upd in updates:
            row_id = upd.get("id")
            new_time = upd.get("time")
            if row_id and new_time:
                supabase.table("schedules").update({
                    "scheduled_time": new_time
                }).eq("id", row_id).eq("tenant_id", tid).execute()
                updated_count += 1
                
        return {"success": True, "message": f"{updated_count} jadwal diupdate"}
    except Exception as e:
        logger.error(f"POST /schedules/update-timeline error: {e}")
        raise HTTPException(500, "Gagal update timeline")
