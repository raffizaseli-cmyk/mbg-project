"""
backend/routers/compliance.py
Compliance endpoints — Modul 21.5c

Endpoints:
  /compliance/hygiene          — Cek kebersihan harian
  /compliance/temperature      — Log suhu penyimpanan
  /compliance/food-samples     — Bank sampel makanan
  /compliance/food-waste       — Sisa makanan per sekolah
  /compliance/incidents        — Laporan insiden keamanan pangan
  /compliance/slhs             — Dokumen sertifikat SLHS
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.user import UserInDB
from models.compliance import (
    HygieneCheckCreate,
    TemperatureLogCreate,
    FoodSampleCreate, FoodSampleDispose,
    FoodWasteCreate,
    IncidentCreate,
    SLHSCreate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/compliance", tags=["compliance"])

TEMP_LIMITS = {
    "gudang_kering": {"max": 25, "min": 0},
    "chiller":       {"max": 5,  "min": 0},
    "freezer":       {"max": -18, "min": -30},
}

AREA_CHECKS = [
    "Kebersihan Lantai & Dinding",
    "Suhu Penyimpanan (Chiller/Freezer)",
    "Kebersihan Peralatan Masak",
    "Atribut Personel (Masker/Apron/Hairnet)",
    "Kualitas Air Bersih",
    "Kebersihan Area Penyimpanan",
    "Kondisi Tempat Sampah",
]


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 1: Hygiene Checks
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/hygiene/template", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner", "admin"]))])
def get_hygiene_template(current_user: UserInDB = Depends(get_current_user)):
    """Ambil template area yang perlu dicek."""
    return {
        "success": True,
        "areas": AREA_CHECKS,
        "statuses": ["baik", "perlu_perbaikan"],
    }


@router.post("/hygiene", response_model=Dict[str, Any],
             dependencies=[Depends(require_role(["owner", "admin"]))])
def create_hygiene_check(
    body: HygieneCheckCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Simpan checklist higiene untuk hari tertentu."""
    supabase = get_supabase()

    if not body.items:
        raise HTTPException(400, detail="Items tidak boleh kosong")

    # Auto-determine overall_status
    has_perlu_perbaikan = any(i.status == "perlu_perbaikan" for i in body.items)
    has_tidak_layak = any(
        i.suhu is not None and (
            (i.area == "gudang_kering" and i.suhu >= 25) or
            (i.area == "chiller" and (i.suhu < 0 or i.suhu > 5)) or
            (i.area == "freezer" and i.suhu > -18)
        )
        for i in body.items
    )

    if has_tidak_layak:
        overall_status = "tidak_layak"
    elif has_perlu_perbaikan:
        overall_status = "perlu_perbaikan"
    else:
        overall_status = "baik"

    insert_data = {
        "tenant_id": current_user.tenant_id,
        "check_date": body.check_date.isoformat(),
        "checked_by": current_user.id,
        "items": [item.model_dump() for item in body.items],
        "overall_status": overall_status,
        "notes": body.notes,
    }

    resp = supabase.table("hygiene_checks").insert(insert_data).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(500, detail="Gagal simpan higiene check")

    result = rows[0]

    # Create alert if not baik
    if overall_status != "baik":
        try:
            supabase.table("alerts").insert({
                "tenant_id": current_user.tenant_id,
                "alert_type": "hygiene_issue",
                "severity": "critical" if overall_status == "tidak_layak" else "warning",
                "title": f"Higiene {overall_status.replace('_', ' ').title()}",
                "message": f"Cek higiene tanggal {body.check_date} menunjukkan status: {overall_status}",
                "source_table": "hygiene_checks",
                "source_id": result["id"],
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to create hygiene alert: {e}")

    return {"success": True, "data": result}


@router.get("/hygiene", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner", "admin"]))])
def get_hygiene_checks(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ambil checklist higiene per bulan."""
    supabase = get_supabase()

    first = date(year, month, 1)
    if month == 12:
        last = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last = date(year, month + 1, 1) - timedelta(days=1)

    resp = (
        supabase.table("hygiene_checks").select("*")
        .eq("tenant_id", current_user.tenant_id)
        .gte("check_date", first.isoformat())
        .lte("check_date", last.isoformat())
        .order("check_date", desc=True)
        .execute()
    )
    checks = getattr(resp, "data", None) or []

    return {
        "success": True,
        "count": len(checks),
        "month": month,
        "year": year,
        "data": checks,
    }


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 2: Temperature Logs
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/temperature", response_model=Dict[str, Any],
             dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def create_temperature_log(
    body: TemperatureLogCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Catat suhu penyimpanan."""
    supabase = get_supabase()

    limits = TEMP_LIMITS.get(body.area)
    if not limits:
        raise HTTPException(400, detail=f"Area '{body.area}' tidak valid. Pilih: gudang_kering, chiller, freezer")

    is_normal = limits["min"] <= body.temperature <= limits["max"]

    insert_data = {
        "tenant_id": current_user.tenant_id,
        "log_date": body.log_date.isoformat(),
        "log_time": body.log_time,
        "area": body.area,
        "temperature": float(body.temperature),
        "is_normal": is_normal,
        "notes": body.notes,
        "recorded_by": current_user.id,
    }

    resp = supabase.table("temperature_logs").insert(insert_data).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(500, detail="Gagal simpan temperature log")

    result = {"success": True, "data": rows[0]}

    # Alert if abnormal
    if not is_normal:
        result["alert"] = {
            "severity": "critical",
            "message": (
                f"⚠️ Suhu {body.area} abnormal: {body.temperature}°C "
                f"(Batas: {limits['min']}-{limits['max']}°C)"
            ),
        }
        try:
            supabase.table("alerts").insert({
                "tenant_id": current_user.tenant_id,
                "alert_type": "temperature_abnormal",
                "severity": "critical",
                "title": f"Suhu {body.area} Abnormal",
                "message": f"Suhu tercatat {body.temperature}°C, batas {limits['min']}-{limits['max']}°C",
                "source_table": "temperature_logs",
                "source_id": rows[0]["id"],
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to create temp alert: {e}")

    return result


@router.get("/temperature", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner", "admin"]))])
def get_temperature_logs(
    log_date: date = Query(...),
    area: Optional[str] = Query(None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ambil log suhu untuk tanggal tertentu."""
    supabase = get_supabase()

    query = (
        supabase.table("temperature_logs").select("*")
        .eq("tenant_id", current_user.tenant_id)
        .eq("log_date", log_date.isoformat())
    )
    if area:
        query = query.eq("area", area)

    resp = query.order("log_time", desc=True).execute()
    logs = getattr(resp, "data", None) or []
    anomalies = [lg for lg in logs if not lg.get("is_normal")]

    return {
        "success": True,
        "log_date": log_date.isoformat(),
        "count": len(logs),
        "anomalies": len(anomalies),
        "data": logs,
        "alert": {"anomaly_count": len(anomalies)} if anomalies else None,
    }


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 3: Food Samples (Bank Sampel)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/food-samples", response_model=Dict[str, Any],
             dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def create_food_sample(
    body: FoodSampleCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Catat sampel makanan baru. Auto-generate sample_code & expires_at."""
    supabase = get_supabase()

    # Auto-generate sample_code: SMP-{YYYYMMDD}-{increment:02d}
    date_str = body.sample_date.isoformat().replace("-", "")

    existing = (
        supabase.table("food_samples").select("sample_code")
        .eq("tenant_id", current_user.tenant_id)
        .eq("sample_date", body.sample_date.isoformat())
        .order("sample_code", desc=True)
        .limit(1)
        .execute()
    )
    last_samples = getattr(existing, "data", None) or []
    if last_samples:
        try:
            increment = int(last_samples[0]["sample_code"].split("-")[-1]) + 1
        except (ValueError, IndexError):
            increment = 1
    else:
        increment = 1

    sample_code = f"SMP-{date_str}-{increment:02d}"

    # Auto-set expires_at = sample_date + taken_at + 24 hours (1 x 24h)
    try:
        taken_time = datetime.strptime(body.taken_at, "%H:%M").time()
        taken_dt = datetime.combine(body.sample_date, taken_time)
        expires_at = (taken_dt + timedelta(hours=24)).isoformat()
    except Exception:
        expires_at = None

    insert_data = {
        "tenant_id": current_user.tenant_id,
        "sample_date": body.sample_date.isoformat(),
        "sample_code": sample_code,
        "menu_name": body.menu_name,
        "taken_at": body.taken_at,
        "weight_gram": float(body.weight_gram),
        "storage_temp": float(body.storage_temp) if body.storage_temp else None,
        "expires_at": expires_at,
        "status": "disimpan",
    }

    resp = supabase.table("food_samples").insert(insert_data).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(500, detail="Gagal simpan sampel")

    return {"success": True, "data": rows[0]}


@router.get("/food-samples", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner", "admin"]))])
def get_food_samples(
    sample_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ambil daftar sampel makanan. Includes hours_remaining & alerts."""
    supabase = get_supabase()

    query = (
        supabase.table("food_samples").select("*")
        .eq("tenant_id", current_user.tenant_id)
    )
    if sample_date:
        query = query.eq("sample_date", sample_date.isoformat())
    if status:
        query = query.eq("status", status)

    resp = query.order("expires_at", desc=False).limit(100).execute()
    samples = getattr(resp, "data", None) or []

    now = datetime.now(timezone.utc)
    alerts = []

    for s in samples:
        if s.get("expires_at"):
            try:
                exp_str = s["expires_at"]
                if "+" not in exp_str and "Z" not in exp_str:
                    exp_str += "+00:00"
                expires = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
                hours_left = (expires - now).total_seconds() / 3600
                s["hours_remaining"] = round(hours_left, 1)

                if 0 < hours_left <= 4 and s.get("status") == "disimpan":
                    alerts.append({
                        "sample_code": s["sample_code"],
                        "menu": s["menu_name"],
                        "hours_left": round(hours_left, 1),
                    })
            except Exception:
                s["hours_remaining"] = None

    return {
        "success": True,
        "count": len(samples),
        "alerts_count": len(alerts),
        "data": samples,
        "alerts": alerts if alerts else None,
    }


@router.patch("/food-samples/{sample_id}/dispose", response_model=Dict[str, Any],
              dependencies=[Depends(require_role(["owner", "admin"]))])
def dispose_food_sample(
    sample_id: str,
    body: FoodSampleDispose,
    current_user: UserInDB = Depends(get_current_user),
):
    """Tandai sampel sebagai dibuang."""
    supabase = get_supabase()

    resp = (
        supabase.table("food_samples")
        .update({"status": "dibuang", "disposed_at": datetime.now().isoformat()})
        .eq("id", sample_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(404, detail="Sampel tidak ditemukan")

    return {"success": True, "message": "Sampel ditandai dibuang", "data": rows[0]}


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 4: Food Waste Reports (Sisa Makanan)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/food-waste", response_model=Dict[str, Any],
             dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def create_food_waste_report(
    body: FoodWasteCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Input laporan sisa makanan per sekolah."""
    supabase = get_supabase()

    if body.portions_consumed > body.portions_sent:
        raise HTTPException(400, detail="Porsi dikonsumsi tidak boleh > porsi kirim")

    waste_pct = round(
        (body.portions_sent - body.portions_consumed) / body.portions_sent * 100, 2
    ) if body.portions_sent > 0 else 0

    insert_data = {
        "tenant_id": current_user.tenant_id,
        "delivery_id": body.delivery_id,
        "school_id": body.school_id,
        "report_date": body.report_date.isoformat(),
        "portions_sent": body.portions_sent,
        "portions_consumed": body.portions_consumed,
        "waste_pct": waste_pct,
        "comstock_score": body.comstock_score,
        "waste_reason": body.waste_reason,
        "notes": body.notes,
        "created_by": current_user.id,
    }

    resp = supabase.table("food_waste_reports").insert(insert_data).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(500, detail="Gagal simpan laporan sisa makanan")

    return {"success": True, "data": rows[0]}


@router.get("/food-waste-targets", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner", "admin", "gizi"]))])
def get_food_waste_targets(
    target_date: date = Query(...),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ambil daftar sekolah, menu, dan porsi kirim untuk hari tertentu dari mbg_deliveries."""
    supabase = get_supabase()

    # 1. Fetch schools
    s_resp = (
        supabase.table("schools")
        .select("id, name, default_portions")
        .eq("tenant_id", current_user.tenant_id)
        .eq("is_active", True)
        .execute()
    )
    schools = getattr(s_resp, "data", None) or []

    # 2. Fetch deliveries
    d_resp = (
        supabase.table("mbg_deliveries").select("school_id, menu_name, portions_sent")
        .eq("tenant_id", current_user.tenant_id)
        .eq("delivery_date", target_date.isoformat())
        .execute()
    )
    deliveries = {d["school_id"]: d for d in (getattr(d_resp, "data", None) or [])}

    # 3. Fetch existing reports to cross-check
    r_resp = (
        supabase.table("food_waste_reports").select("school_id, id")
        .eq("tenant_id", current_user.tenant_id)
        .eq("report_date", target_date.isoformat())
        .execute()
    )
    reports = {r["school_id"]: r["id"] for r in (getattr(r_resp, "data", None) or [])}

    # 4. Format result
    targets = []
    for s in schools:
        sid = s["id"]
        d = deliveries.get(sid, {})
        targets.append({
            "school_id": sid,
            "school_name": s["name"],
            "menu_name": d.get("menu_name", ""),
            "portions_sent": d.get("portions_sent", s.get("default_portions", 0)),
            "report_id": reports.get(sid),
            "is_reported": sid in reports
        })

    return {"success": True, "target_date": target_date.isoformat(), "data": targets}


@router.get("/food-waste", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner", "admin"]))])
def get_food_waste_reports(
    month: int = Query(...),
    year: int = Query(...),
    school_id: Optional[str] = Query(None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ambil laporan sisa makanan per bulan + summary per sekolah."""
    supabase = get_supabase()

    first = date(year, month, 1)
    if month == 12:
        last = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last = date(year, month + 1, 1) - timedelta(days=1)

    query = (
        supabase.table("food_waste_reports").select("*, schools(name)")
        .eq("tenant_id", current_user.tenant_id)
        .gte("report_date", first.isoformat())
        .lte("report_date", last.isoformat())
    )
    if school_id:
        query = query.eq("school_id", school_id)

    resp = query.order("report_date", desc=True).execute()
    reports = getattr(resp, "data", None) or []

    # Summary per school
    summary: Dict[str, dict] = {}
    for r in reports:
        sid = r.get("school_id", "")
        if sid not in summary:
            sch = r.get("schools", {}) or {}
            summary[sid] = {
                "school_name": sch.get("name", ""),
                "avg_waste_pct": 0,
                "avg_comstock": 0,
                "count": 0,
            }
        summary[sid]["count"] += 1
        summary[sid]["avg_waste_pct"] += r.get("waste_pct", 0) or 0
        summary[sid]["avg_comstock"] += r.get("comstock_score", 0) or 0

    for s in summary.values():
        if s["count"] > 0:
            s["avg_waste_pct"] = round(s["avg_waste_pct"] / s["count"], 1)
            s["avg_comstock"] = round(s["avg_comstock"] / s["count"], 1)

    return {
        "success": True,
        "month": month,
        "year": year,
        "count": len(reports),
        "summary": summary,
        "data": reports,
    }


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 5: Incident Reports
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/incidents", response_model=Dict[str, Any],
             dependencies=[Depends(require_role(["owner", "admin"]))])
def create_incident_report(
    body: IncidentCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Laporkan insiden keamanan pangan (dugaan keracunan/KLB)."""
    supabase = get_supabase()

    # Auto-generate incident_code: INC-{increment:03d}/{year}
    year = datetime.now().year
    existing = (
        supabase.table("incident_reports").select("incident_code")
        .eq("tenant_id", current_user.tenant_id)
        .ilike("incident_code", f"%/{year}")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    last_incidents = getattr(existing, "data", None) or []
    if last_incidents:
        try:
            last_code = last_incidents[0]["incident_code"]
            increment = int(last_code.split("-")[1].split("/")[0]) + 1
        except (ValueError, IndexError):
            increment = 1
    else:
        increment = 1

    incident_code = f"INC-{increment:03d}/{year}"

    insert_data = {
        "tenant_id": current_user.tenant_id,
        "incident_code": incident_code,
        "school_id": body.school_id,
        "incident_time": body.incident_time.isoformat(),
        "location": body.location,
        "victim_count": body.victim_count,
        "symptoms": body.symptoms,
        "first_action": body.first_action,
        "sample_secured": body.sample_secured,
        "sample_ids": body.sample_ids,
        "reported_to": body.reported_to,
        "status": "investigasi",
        "created_by": current_user.id,
    }

    resp = supabase.table("incident_reports").insert(insert_data).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(500, detail="Gagal simpan insiden")

    # Secure samples if flagged
    if body.sample_secured and body.sample_ids:
        for sample_code in body.sample_ids:
            try:
                supabase.table("food_samples").update({
                    "status": "diamankan_investigasi"
                }).eq("sample_code", sample_code).eq(
                    "tenant_id", current_user.tenant_id
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to secure sample {sample_code}: {e}")

    # Create critical alert
    try:
        supabase.table("alerts").insert({
            "tenant_id": current_user.tenant_id,
            "alert_type": "incident_reported",
            "severity": "critical",
            "title": f"Insiden {incident_code}",
            "message": f"Insiden di {body.location}, {body.victim_count} korban. Gejala: {', '.join(body.symptoms)}",
            "source_table": "incident_reports",
            "source_id": rows[0]["id"],
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to create incident alert: {e}")

    return {"success": True, "data": rows[0]}


@router.get("/incidents", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner", "admin"]))])
def get_incidents(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ambil laporan insiden."""
    supabase = get_supabase()

    query = (
        supabase.table("incident_reports").select("*, schools(name)")
        .eq("tenant_id", current_user.tenant_id)
    )
    if month and year:
        first = date(year, month, 1)
        if month == 12:
            last = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last = date(year, month + 1, 1) - timedelta(days=1)
        query = query.gte("incident_time", f"{first}T00:00:00").lte(
            "incident_time", f"{last}T23:59:59"
        )

    resp = query.order("incident_time", desc=True).execute()
    incidents = getattr(resp, "data", None) or []

    return {"success": True, "count": len(incidents), "data": incidents}


@router.put("/incidents/{incident_id}", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner"]))])
def update_incident_report(
    incident_id: str,
    body: Dict[str, Any],
    current_user: UserInDB = Depends(get_current_user),
):
    """Update status + hasil investigasi (owner only)."""
    supabase = get_supabase()

    update_data = {}
    if "status" in body:
        update_data["status"] = body["status"]
    if "investigation_result" in body:
        update_data["investigation_result"] = body["investigation_result"]
    if not update_data:
        raise HTTPException(400, detail="Tidak ada data yang diupdate")

    update_data["updated_at"] = datetime.now().isoformat()

    resp = (
        supabase.table("incident_reports")
        .update(update_data)
        .eq("id", incident_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(404, detail="Insiden tidak ditemukan")

    return {"success": True, "message": "Insiden berhasil diupdate", "data": rows[0]}


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 6: SLHS Documents
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/slhs", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner", "admin"]))])
def get_slhs_documents(
    current_user: UserInDB = Depends(get_current_user),
):
    """Ambil daftar dokumen SLHS."""
    supabase = get_supabase()

    resp = (
        supabase.table("slhs_documents").select("*")
        .eq("tenant_id", current_user.tenant_id)
        .order("expires_date", desc=False)
        .execute()
    )
    slhs_list = getattr(resp, "data", None) or []

    now = date.today()
    alerts = []
    for s in slhs_list:
        try:
            expires = date.fromisoformat(s["expires_date"])
            days_left = (expires - now).days
            s["days_until_expiry"] = days_left
            if days_left <= 90:
                alerts.append({
                    "cert_number": s["cert_number"],
                    "days_left": days_left,
                    "severity": "critical" if days_left <= 30 else "warning",
                })
        except Exception:
            pass

    return {
        "success": True,
        "count": len(slhs_list),
        "alerts": alerts if alerts else None,
        "data": slhs_list,
    }


@router.post("/slhs", response_model=Dict[str, Any],
             dependencies=[Depends(require_role(["owner", "admin"]))])
def create_slhs_document(
    body: SLHSCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Simpan dokumen SLHS baru."""
    supabase = get_supabase()

    insert_data = {
        "tenant_id": current_user.tenant_id,
        "cert_number": body.cert_number,
        "issued_date": body.issued_date.isoformat(),
        "expires_date": body.expires_date.isoformat(),
        "label_expires": body.label_expires.isoformat() if body.label_expires else None,
        "file_url": body.file_url,
        "status": "aktif",
        "notes": body.notes,
    }

    resp = supabase.table("slhs_documents").insert(insert_data).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(500, detail="Gagal simpan SLHS")

    return {"success": True, "data": rows[0]}


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 7: Alerts (Unified)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/alerts", response_model=Dict[str, Any],
            dependencies=[Depends(require_role(["owner", "admin"]))])
def get_alerts(
    unread_only: bool = Query(False),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ambil daftar alerts."""
    supabase = get_supabase()

    query = (
        supabase.table("alerts").select("*")
        .eq("tenant_id", current_user.tenant_id)
    )
    if unread_only:
        query = query.eq("is_read", False)

    resp = query.order("created_at", desc=True).limit(50).execute()
    alerts = getattr(resp, "data", None) or []

    return {"success": True, "count": len(alerts), "data": alerts}


@router.patch("/alerts/{alert_id}/read", response_model=Dict[str, Any],
              dependencies=[Depends(require_role(["owner", "admin"]))])
def mark_alert_read(
    alert_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Tandai alert sebagai sudah dibaca."""
    supabase = get_supabase()

    resp = (
        supabase.table("alerts")
        .update({"is_read": True})
        .eq("id", alert_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(404, detail="Alert tidak ditemukan")

    return {"success": True, "message": "Alert ditandai dibaca"}


@router.patch("/alerts/{alert_id}/resolve", response_model=Dict[str, Any],
              dependencies=[Depends(require_role(["owner", "admin"]))])
def resolve_alert(
    alert_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Tandai alert sebagai resolved."""
    supabase = get_supabase()

    resp = (
        supabase.table("alerts")
        .update({
            "is_resolved": True,
            "resolved_at": datetime.now().isoformat(),
            "resolved_by": current_user.id,
        })
        .eq("id", alert_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(404, detail="Alert tidak ditemukan")

    return {"success": True, "message": "Alert resolved"}
