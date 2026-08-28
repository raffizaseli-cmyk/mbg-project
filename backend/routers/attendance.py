"""
Attendance management endpoints.
"""

from datetime import date, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, status

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.hr import AttendanceBatchUpsert
from models.user import UserInDB

router = APIRouter(prefix="/attendance", tags=["hr"])


@router.get("/week", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def get_weekly_attendance(
    week_start: Optional[date] = Query(None, description="Monday of the target week"),
    current_user: UserInDB = Depends(get_current_user),
):
    """Get attendance grid for a week (Mon-Fri)."""
    supabase = get_supabase()

    # Determine week range
    if not week_start:
        today = date.today()
        # Monday is 0, Sunday is 6
        week_start = today - timedelta(days=today.weekday())
        
    # We only care about Monday (0) to Friday (4) usually, but let's do Mon-Sun (7 days) 
    # based on the UI spec which showed 5 or 7 days. The user spec showed 5 days in UI.
    # Let's do 5 days (Mon-Fri) as usually school days, but 7 is safer. Let's do 5 days as per spec.
    week_end = week_start + timedelta(days=4) # Friday
    
    days = [(week_start + timedelta(days=i)).isoformat() for i in range(5)]

    # 1. Get all active employees
    emp_res = (
        supabase.table("employees")
        .select("id, name, job_positions(name)")
        .eq("tenant_id", current_user.tenant_id)
        .eq("is_active", True)
        .order("name")
        .execute()
    )
    employees = getattr(emp_res, "data", None) or []

    # 2. Get attendances for this week
    att_res = (
        supabase.table("attendances")
        .select("*")
        .eq("tenant_id", current_user.tenant_id)
        .gte("date", week_start.isoformat())
        .lte("date", week_end.isoformat())
        .execute()
    )
    attendances_data = getattr(att_res, "data", None) or []

    # Map attendances by employee and date
    att_map = {}
    for att in attendances_data:
        emp_id = att["employee_id"]
        if emp_id not in att_map:
            att_map[emp_id] = {}
        att_map[emp_id][att["date"]] = att["status"]

    # 3. Build response
    result_employees = []
    
    for emp in employees:
        emp_id = emp["id"]
        pos_name = emp.get("job_positions", {}).get("name") if emp.get("job_positions") else None
        
        emp_att = att_map.get(emp_id, {})
        
        # Build daily attendance dict
        daily_status = {}
        total_absent = 0
        total_present = 5 # Assume 5 working days default
        
        for d in days:
            status = emp_att.get(d)
            daily_status[d] = status
            if status: # If there's a record, they are absent (sakit/izin/alpa)
                total_absent += 1
                total_present -= 1
                
        result_employees.append({
            "id": emp_id,
            "name": emp["name"],
            "position_name": pos_name,
            "attendance": daily_status,
            "total_absent": total_absent,
            "total_present": max(0, total_present),
        })

    return {
        "success": True,
        "data": {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "days": days,
            "employees": result_employees
        }
    }


@router.post("/batch", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def batch_upsert_attendance(
    body: AttendanceBatchUpsert,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Batch update/delete attendance.
    If status is None, delete the record (means Present).
    If status is set, upsert the record (Absent: sakit/izin/alpa).
    """
    supabase = get_supabase()
    updated_count = 0

    for record in body.records:
        if not record.status:
            # Delete record (mark as present)
            supabase.table("attendances").delete().eq(
                "tenant_id", current_user.tenant_id
            ).eq("employee_id", record.employee_id).eq("date", record.date.isoformat()).execute()
            updated_count += 1
        else:
            # Upsert record
            # First check if exists
            existing = (
                supabase.table("attendances")
                .select("id")
                .eq("tenant_id", current_user.tenant_id)
                .eq("employee_id", record.employee_id)
                .eq("date", record.date.isoformat())
                .execute()
            )
            data = getattr(existing, "data", None) or []
            
            if data:
                # Update
                supabase.table("attendances").update({
                    "status": record.status,
                    "notes": record.notes,
                    "recorded_by": current_user.id
                }).eq("id", data[0]["id"]).execute()
            else:
                # Insert
                supabase.table("attendances").insert({
                    "tenant_id": current_user.tenant_id,
                    "employee_id": record.employee_id,
                    "date": record.date.isoformat(),
                    "status": record.status,
                    "notes": record.notes,
                    "recorded_by": current_user.id
                }).execute()
            updated_count += 1

    return {"success": True, "updated": updated_count}
