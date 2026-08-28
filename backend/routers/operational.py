"""
Operational costs endpoints.
"""

from datetime import date
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.hr import OperationalCostCreate
from models.user import UserInDB
from services.kas_service import KasService
from decimal import Decimal

router = APIRouter(prefix="/operational", tags=["financial"])


@router.get("", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def get_operational_costs(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020, le=2100),
    current_user: UserInDB = Depends(get_current_user),
):
    """Get operational costs for a specific month."""
    supabase = get_supabase()

    today = date.today()
    if not month:
        month = today.month
    if not year:
        year = today.year

    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    response = (
        supabase.table("operational_costs")
        .select("*")
        .eq("tenant_id", current_user.tenant_id)
        .gte("cost_date", start_date.isoformat())
        .lt("cost_date", end_date.isoformat())
        .order("cost_date", desc=True)
        .execute()
    )
    items = getattr(response, "data", None) or []

    # Calculate summaries
    total = sum(item.get("amount", 0) for item in items)
    
    by_category = {
        "Listrik": 0,
        "Gas LPG": 0,
        "BBM": 0,
        "Sewa": 0,
        "Lainnya": 0
    }
    
    recurring = []
    
    for item in items:
        amt = item.get("amount", 0)
        cat = item.get("name", "Lainnya")
        
        # Simple categorization based on name (if they use standard names)
        # Using name to group since category field is just 'operasional'
        mapped_cat = "Lainnya"
        for key in by_category.keys():
            if key.lower() in cat.lower():
                mapped_cat = key
                break
                
        by_category[mapped_cat] += amt
        
        if item.get("is_recurring"):
            recurring.append(item)

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "by_category": by_category,
            "recurring": recurring
        }
    }


@router.post("", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
async def create_operational_cost(
    body: OperationalCostCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Record new operational cost & insert transaction & double entry kas."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    cost_data = body.model_dump(exclude_unset=True)
    cost_data["tenant_id"] = tid
    cost_data["amount"] = float(body.amount)
    
    try:
        cost_dt = cost_data["cost_date"] if isinstance(cost_data.get("cost_date"), date) else date.today()
        cost_data["cost_date"] = cost_dt.isoformat()
    except:
        cost_dt = date.today()
        cost_data["cost_date"] = cost_dt.isoformat()

    # Get kas account id fallback
    kas_account_id = cost_data.get("kas_account_id")
    if "kas_account_id" in cost_data:
        del cost_data["kas_account_id"]
    
    if not kas_account_id:
        kas_res = supabase.table("kas_accounts").select("id").eq("tenant_id", tid).eq("type", "kas_kecil").limit(1).execute()
        kas_rows = getattr(kas_res, "data", None) or []
        if not kas_rows:
            kas_res = supabase.table("kas_accounts").select("id").eq("tenant_id", tid).eq("type", "va_bank").limit(1).execute()
            kas_rows = getattr(kas_res, "data", None) or []
        if kas_rows:
            kas_account_id = kas_rows[0]["id"]
            
    if not kas_account_id:
        raise HTTPException(status_code=400, detail="Belum ada akun Kas yang dikonfigurasi.")

    # 1. Insert transaction
    txn_res = supabase.table("transactions").insert({
        "tenant_id": tid,
        "type": "expense",
        "source": "manual_operational",
        "juknis_category": "operasional",
        "kas_account_id": kas_account_id,
        "total": float(body.amount),
        "date": cost_data["cost_date"],
        "notes": body.name,
        "status": "confirmed",
    }).execute()
    
    txn_data = getattr(txn_res, "data", None)
    trx_id = None
    if txn_data:
        trx_id = txn_data[0]["id"]
        cost_data["transaction_id"] = trx_id

    # 2. Insert operational cost
    response = supabase.table("operational_costs").insert(cost_data).execute()
    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(status_code=500, detail="Failed to save operational cost")

    # 3. Double entry Kas
    if trx_id and float(body.amount) > 0:
        try:
            KasService.record_expense(
                tenant_id=tid,
                transaction_id=trx_id,
                amount=Decimal(str(body.amount)),
                kas_account_id=kas_account_id,
                description=f"Biaya Operasional: {body.name}",
                expense_date=cost_dt,
                created_by=current_user.id,
                supabase=supabase,
                reference_type="expense"
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Kas double entry failed: {e}")

    return {"success": True, "data": data[0]}


@router.delete("/{cost_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def delete_operational_cost(
    cost_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Delete operational cost and void transaction."""
    supabase = get_supabase()

    # Get the cost to find transaction_id
    cost_res = supabase.table("operational_costs").select("transaction_id").eq("id", cost_id).eq("tenant_id", current_user.tenant_id).execute()
    costs = getattr(cost_res, "data", None)
    if not costs:
        raise HTTPException(status_code=404, detail="Operational cost not found")
        
    cost = costs[0]
    
    # 1. Delete cost
    supabase.table("operational_costs").delete().eq("id", cost_id).execute()
    
    # 2. Void transaction if exists
    if cost.get("transaction_id"):
        supabase.table("transactions").update({
            "status": "voided"
        }).eq("id", cost["transaction_id"]).execute()

    return {"success": True, "message": "Operational cost deleted and transaction voided"}
