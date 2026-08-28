"""
backend/routers/payables.py
PATCH /payables/{id}/mark-paid — Modul 11

Tandai hutang ke supplier sebagai lunas:
  - Update status = paid
  - Insert cashflow_log
"""

from datetime import date
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.user import UserInDB

router = APIRouter(prefix="/payables", tags=["payables"])


# ─── PATCH /payables/{payable_id}/mark-paid ──────────────────────────────────

@router.patch(
    "/{payable_id}/mark-paid",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def mark_payable_paid(
    payable_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Tandai hutang supplier sebagai lunas.
    Insert cashflow_log sebagai arus kas keluar (pembayaran hutang).
    """
    supabase = get_supabase()
    tid = current_user.tenant_id
    today = date.today()

    # Ambil payable
    resp = (
        supabase.table("payables")
        .select("*")
        .eq("id", payable_id)
        .eq("tenant_id", tid)
        .single()
        .execute()
    )
    payable = getattr(resp, "data", None)
    if not payable:
        raise HTTPException(404, detail="Payable tidak ditemukan")
    if payable.get("status") == "paid":
        raise HTTPException(400, detail="Hutang ini sudah lunas")

    # Update
    try:
        upd = (
            supabase.table("payables")
            .update({
                "status": "paid",
                "paid_amount": payable.get("amount"),
            })
            .eq("id", payable_id)
            .eq("tenant_id", tid)
            .execute()
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to mark payable paid: {e}")
        raise HTTPException(500, detail=str(e))
    updated = (getattr(upd, "data", None) or [{}])[0]

    # Cashflow log
    try:
        supabase.table("cashflow_log").insert({
            "tenant_id": tid,
            "flow_type": "out",
            "category": "payment",
            "amount": payable.get("amount", "0"),
            "description": f"Pelunasan hutang: {payable.get('supplier_name', '?')}",
            "date": today.isoformat(),
        }).execute()
    except Exception:
        pass  # non-fatal

    return {
        "success": True,
        "data": updated or payable,
    }
