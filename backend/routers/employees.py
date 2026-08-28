"""
HR (Employees & Job Positions) management endpoints.
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.hr import (
    EmployeeCreate, EmployeeResponse, EmployeeUpdate,
    JobPositionCreate, JobPositionResponse, JobPositionUpdate
)
from models.user import UserInDB

router = APIRouter(prefix="/employees", tags=["hr"])


# ─── Job Positions ────────────────────────────────────────────────────────────

@router.get("/positions", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))])
def list_job_positions(
    current_user: UserInDB = Depends(get_current_user),
):
    """List job positions + employee count."""
    supabase = get_supabase()
    
    # Get positions
    pos_res = supabase.table("job_positions").select("*").eq("tenant_id", current_user.tenant_id).execute()
    positions = getattr(pos_res, "data", None) or []
    
    # Get active employee count per position
    emp_res = supabase.table("employees").select("position_id").eq("tenant_id", current_user.tenant_id).eq("is_active", True).execute()
    employees = getattr(emp_res, "data", None) or []
    
    counts: Dict[str, int] = {}
    for emp in employees:
        pid = emp.get("position_id")
        if pid:
            counts[pid] = counts.get(pid, 0) + 1
            
    result = []
    for p in positions:
        p["employee_count"] = counts.get(p["id"], 0)
        result.append(p)
        
    # Sort by name
    result.sort(key=lambda x: x.get("name", ""))

    return {
        "success": True,
        "data": result,
    }


@router.post("/positions", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))])
def create_job_position(
    body: JobPositionCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Create new job position."""
    supabase = get_supabase()

    # Check unique
    existing = (
        supabase.table("job_positions")
        .select("id")
        .eq("tenant_id", current_user.tenant_id)
        .ilike("name", body.name)
        .execute()
    )
    if getattr(existing, "data", None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Jabatan dengan nama ini sudah ada",
        )

    response = (
        supabase.table("job_positions")
        .insert(
            {
                "tenant_id": current_user.tenant_id,
                "name": body.name,
                "salary_type": body.salary_type,
                "base_salary": float(body.base_salary),
                "is_active": body.is_active,
                "notes": body.notes,
            }
        )
        .execute()
    )

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create job position")

    return {"success": True, "data": data[0]}


@router.put("/positions/{position_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))])
def update_job_position(
    position_id: str,
    body: JobPositionUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update job position."""
    supabase = get_supabase()

    update_data = body.model_dump(exclude_unset=True)
    if "base_salary" in update_data and update_data["base_salary"] is not None:
        update_data["base_salary"] = float(update_data["base_salary"])

    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    response = (
        supabase.table("job_positions")
        .update(update_data)
        .eq("id", position_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job position not found")

    return {"success": True, "data": data[0]}


# ─── Employees ────────────────────────────────────────────────────────────────

@router.get("", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))])
def list_employees(
    is_active: bool = Query(True),
    current_user: UserInDB = Depends(get_current_user),
):
    """List employees with position info."""
    supabase = get_supabase()
    
    # We can join job_positions
    query = (
        supabase.table("employees")
        .select("*, job_positions(name, base_salary)")
        .eq("tenant_id", current_user.tenant_id)
    )

    if is_active:
        query = query.eq("is_active", True)
        
    query = query.order("created_at", desc=False)

    response = query.execute()
    data = getattr(response, "data", None) or []

    # Flatten the join
    for emp in data:
        pos = emp.pop("job_positions", None)
        if pos:
            emp["position_name"] = pos.get("name")
            emp["base_salary"] = pos.get("base_salary")

    return {
        "success": True,
        "data": data,
        "total": len(data),
    }


@router.post("", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))])
def create_employee(
    body: EmployeeCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Create new employee."""
    supabase = get_supabase()

    insert_data = body.model_dump(exclude_unset=True)
    insert_data["tenant_id"] = current_user.tenant_id
    if "join_date" in insert_data and insert_data["join_date"]:
        insert_data["join_date"] = insert_data["join_date"].isoformat()

    response = supabase.table("employees").insert(insert_data).execute()

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create employee")

    return {"success": True, "data": data[0]}


@router.put("/{employee_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin", "akuntan"]))])
def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update employee."""
    supabase = get_supabase()

    update_data = body.model_dump(exclude_unset=True)
    if "join_date" in update_data and update_data["join_date"]:
        update_data["join_date"] = update_data["join_date"].isoformat()

    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    response = (
        supabase.table("employees")
        .update(update_data)
        .eq("id", employee_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    return {"success": True, "data": data[0]}


@router.delete("/{employee_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner"]))])
def delete_employee(
    employee_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Soft delete employee."""
    supabase = get_supabase()

    response = (
        supabase.table("employees")
        .update({"is_active": False})
        .eq("id", employee_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    
    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    return {"success": True, "message": "Employee deactivated"}
