from fastapi import APIRouter, Depends, Query
from typing import Any, Dict
from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.user import UserInDB
from models.allocation import AllocationUpdate, AllocationSettingsResponse

router = APIRouter(prefix="/mbg", tags=["mbg-settings"])


@router.get("/allocation-settings", response_model=Dict[str, Any])
def get_allocation_settings(current_user: UserInDB = Depends(get_current_user)):
    """Mengambil preset alokasi bulanan/tetap MBG (Food, Labor, dsb)"""
    supabase = get_supabase()
    MASTER_DATE = "2000-01-01"
    res = supabase.table("mbg_budget_allocations").select("price_per_portion, budget_food, budget_labor, budget_ops").eq("tenant_id", current_user.tenant_id).eq("date", MASTER_DATE).limit(1).execute()
    data = getattr(res, "data", None) or []
    return {"success": True, "data": data[0] if data else None}

@router.put("/allocation-settings", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def update_allocation_settings(body: AllocationUpdate, current_user: UserInDB = Depends(get_current_user)):
    """Memperbarui preset alokasi MBG."""
    supabase = get_supabase()

    # Kita simpan konfigurasi master ini ke dalam tabel mbg_budget_allocations
    # dengan record khusus di mana date-nya kita biarkan null atau set tahun 2000 
    # agar berlaku sebagai Template. 
    MASTER_DATE = "2000-01-01"

    check = supabase.table("mbg_budget_allocations").select("id").eq("tenant_id", current_user.tenant_id).eq("date", MASTER_DATE).execute()
    existing = getattr(check, "data", None)
    
    upsert_data = {
        "tenant_id": current_user.tenant_id,
        "date": MASTER_DATE,
        "price_per_portion": body.price_per_portion,
        "budget_food": body.budget_food,
        "budget_labor": body.budget_labor,
        "budget_ops": body.budget_ops,
        "total_portions": 0,
        "total_revenue": 0.0,
        "pph22_deduction": 0.0,
        "net_revenue": 0.0,
        "notes": "System Master Allocation Template",
    }

    if not existing:
        res = supabase.table("mbg_budget_allocations").insert(upsert_data).execute()
    else:
        res = supabase.table("mbg_budget_allocations").update(upsert_data).eq("tenant_id", current_user.tenant_id).eq("date", MASTER_DATE).execute()

    return {"success": True, "message": "Allocation settings saved", "data": body.model_dump()}
