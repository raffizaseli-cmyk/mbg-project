"""
backend/routers/budget.py
Endpoint anggaran MBG: pagu, pencairan, kas, transfer, pengembalian.
"""

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.user import UserInDB
from services.budget_service import budget_service
from services.kas_service import KasService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["budget"])


# ═══ Pydantic Models ═══════════════════════════════════════════════════════

class PaguBody(BaseModel):
    year: int
    month: int
    pagu_amount: float
    notes: Optional[str] = None


class DisbursementBody(BaseModel):
    year: int
    month: int
    disbursement_date: str  # ISO date
    amount: float
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class FundTransferBody(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: float
    transfer_date: str  # ISO date
    notes: Optional[str] = None


class FundReturnBody(BaseModel):
    year: int
    month: int
    amount: float
    return_date: str  # ISO date
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class KasAccountBody(BaseModel):
    name: str
    type: str = "kas_kecil"  # va_bank / kas_kecil / rekening_lain
    initial_balance: float = 0


# ═══ Endpoints ═════════════════════════════════════════════════════════════


@router.get("/summary", dependencies=[Depends(require_role(["owner", "admin"]))])
def get_budget_summary(
    year: int = Query(default=None),
    month: int = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Ringkasan anggaran bulanan."""
    today = date.today()
    y = year or today.year
    m = month or today.month
    return {
        "success": True,
        "data": budget_service.get_monthly_summary(current_user.tenant_id, y, m),
    }


@router.get("/pagu", dependencies=[Depends(require_role(["owner", "admin"]))])
def get_pagu(
    year: int = Query(default=None),
    month: int = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Get pagu + disbursements bulan itu."""
    today = date.today()
    y = year or today.year
    m = month or today.month
    supabase = get_supabase()

    pagu_resp = (
        supabase.table("budget_allocations")
        .select("*")
        .eq("tenant_id", current_user.tenant_id)
        .eq("year", y)
        .eq("month", m)
        .limit(1)
        .execute()
    )
    pagu_rows = getattr(pagu_resp, "data", None) or []

    disb_resp = (
        supabase.table("fund_disbursements")
        .select("*")
        .eq("tenant_id", current_user.tenant_id)
        .eq("year", y)
        .eq("month", m)
        .order("disbursement_date")
        .execute()
    )
    disbursements = getattr(disb_resp, "data", None) or []

    return {
        "success": True,
        "data": {
            "pagu": pagu_rows[0] if pagu_rows else None,
            "disbursements": disbursements,
            "total_disbursed": sum(float(d.get("amount", 0)) for d in disbursements),
        },
    }


@router.post("/pagu", dependencies=[Depends(require_role(["owner"]))])
def set_pagu(
    body: PaguBody,
    current_user: UserInDB = Depends(get_current_user),
):
    """Set/update pagu bulan ini."""
    supabase = get_supabase()
    data = {
        "tenant_id": current_user.tenant_id,
        "year": body.year,
        "month": body.month,
        "pagu_amount": body.pagu_amount,
        "notes": body.notes,
    }
    resp = (
        supabase.table("budget_allocations")
        .upsert(data, on_conflict="tenant_id,year,month")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    return {"success": True, "data": rows[0] if rows else data}


@router.post("/disbursement", dependencies=[Depends(require_role(["owner", "admin"]))])
async def add_disbursement(
    body: DisbursementBody,
    current_user: UserInDB = Depends(get_current_user),
):
    """Catat pencairan dana dari pemerintah."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    # Insert disbursement
    disb_data = {
        "tenant_id": tid,
        "year": body.year,
        "month": body.month,
        "disbursement_date": body.disbursement_date,
        "amount": body.amount,
        "reference_number": body.reference_number,
        "notes": body.notes,
    }
    resp = supabase.table("fund_disbursements").insert(disb_data).execute()
    disb = (getattr(resp, "data", None) or [{}])[0]

    # Create VA Bank if not exists so KasService can find it
    va_resp = (
        supabase.table("kas_accounts")
        .select("id")
        .eq("tenant_id", tid)
        .eq("type", "va_bank")
        .limit(1)
        .execute()
    )
    if not va_resp.data:
        # Auto-create VA Bank with 0 balance (will be updated by record_entry)
        supabase.table("kas_accounts").insert({
            "tenant_id": tid,
            "name": "VA Bank MBG",
            "type": "va_bank",
            "current_balance": 0,
        }).execute()

    KasService.record_disbursement(
        tenant_id=tid,
        disbursement_id=disb["id"],
        amount=Decimal(str(body.amount)),
        disbursement_date=date.fromisoformat(body.disbursement_date),
        reference_number=body.reference_number or "-",
        created_by=current_user.id,
        supabase=supabase
    )

    # Cashflow log
    try:
        supabase.table("cashflow_log").insert({
            "tenant_id": tid,
            "flow_type": "in",
            "category": "dana_masuk_pemerintah",
            "amount": body.amount,
            "description": f"Pencairan dana {body.reference_number or ''}",
            "date": body.disbursement_date,
        }).execute()
    except Exception as e:
        logger.warning(f"Cashflow log insert failed: {e}")

    return {"success": True, "data": disb}


@router.post("/fund-transfer", dependencies=[Depends(require_role(["owner", "admin"]))])
async def fund_transfer(
    body: FundTransferBody,
    current_user: UserInDB = Depends(get_current_user),
):
    """Transfer dana antar kas (Double Entry via KasService)."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    if body.from_account_id == body.to_account_id:
        raise HTTPException(400, "Kas asal dan tujuan tidak boleh sama")

    try:
        transfer_data = KasService.transfer(
            tenant_id=tid,
            from_account_id=body.from_account_id,
            to_account_id=body.to_account_id,
            amount=Decimal(str(body.amount)),
            transfer_date=date.fromisoformat(body.transfer_date),
            notes=body.notes or "",
            created_by=current_user.id,
            supabase=supabase
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Optional: Keep cashflow log if needed for UI, although ledger is the source of truth now
    try:
        from_acc = supabase.table("kas_accounts").select("name").eq("id", body.from_account_id).execute().data[0]
        to_acc = supabase.table("kas_accounts").select("name").eq("id", body.to_account_id).execute().data[0]
        supabase.table("cashflow_log").insert({
            "tenant_id": tid,
            "flow_type": "out",
            "category": "pemindahan_dana",
            "amount": body.amount,
            "description": f"Transfer ke {to_acc['name']}",
            "date": body.transfer_date,
        }).execute()
        supabase.table("cashflow_log").insert({
            "tenant_id": tid,
            "flow_type": "in",
            "category": "pemindahan_dana",
            "amount": body.amount,
            "description": f"Transfer dari {from_acc['name']}",
            "date": body.transfer_date,
        }).execute()
    except Exception as e:
        logger.warning(f"Cashflow log insert failed: {e}")

    return {"success": True, "data": transfer_data}


@router.post("/fund-return", dependencies=[Depends(require_role(["owner"]))])
async def fund_return(
    body: FundReturnBody,
    current_user: UserInDB = Depends(get_current_user),
):
    """Catat pengembalian sisa dana ke kas negara."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    # Insert fund_returns
    data = {
        "tenant_id": tid,
        "year": body.year,
        "month": body.month,
        "amount": body.amount,
        "return_date": body.return_date,
        "reference_number": body.reference_number,
        "notes": body.notes,
    }
    resp = (
        supabase.table("fund_returns")
        .upsert(data, on_conflict="tenant_id,year,month")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    ret_id = rows[0]["id"] if rows else None

    if ret_id:
        try:
            KasService.record_return_to_gov(
                tenant_id=tid,
                return_id=ret_id,
                amount=Decimal(str(body.amount)),
                return_date=date.fromisoformat(body.return_date),
                created_by=current_user.id,
                supabase=supabase
            )
        except ValueError as e:
            raise HTTPException(400, str(e))

    # Cashflow log
    try:
        supabase.table("cashflow_log").insert({
            "tenant_id": tid,
            "flow_type": "out",
            "category": "pengembalian_kas_negara",
            "amount": body.amount,
            "description": f"Pengembalian sisa dana {body.reference_number or ''}",
            "date": body.return_date,
        }).execute()
    except Exception as e:
        logger.warning(f"Cashflow log insert failed: {e}")

    return {"success": True, "data": rows[0] if rows else data}


@router.get("/kas-accounts", dependencies=[Depends(require_role(["owner", "admin"]))])
async def get_kas_accounts(
    current_user: UserInDB = Depends(get_current_user),
):
    """List semua kas accounts + saldo realtime dari kas_ledger."""
    return {
        "success": True,
        "data": KasService.get_all_balances(current_user.tenant_id, get_supabase()),
    }


@router.post("/kas-accounts", dependencies=[Depends(require_role(["owner"]))])
async def create_kas_account(
    body: KasAccountBody,
    current_user: UserInDB = Depends(get_current_user),
):
    """Buat kas account baru."""
    supabase = get_supabase()
    data = {
        "tenant_id": current_user.tenant_id,
        "name": body.name,
        "type": body.type,
        "current_balance": 0, # Initial balance will be recorded as opening balance if needed
    }
    resp = supabase.table("kas_accounts").insert(data).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(400, "Gagal membuat kas account. Nama mungkin sudah ada.")
        
    acc = rows[0]
    if body.initial_balance > 0:
        KasService.record_entry(
            tenant_id=current_user.tenant_id,
            kas_account_id=acc["id"],
            entry_type="debit",
            amount=Decimal(str(body.initial_balance)),
            reference_type="income",
            reference_id=None,
            description="Saldo Awal",
            entry_date=date.today(),
            created_by=current_user.id,
            supabase=supabase
        )
        # return updated balance
        acc["current_balance"] = float(body.initial_balance)
        
    return {"success": True, "data": acc}

@router.get("/ledger", dependencies=[Depends(require_role(["owner", "admin"]))])
async def get_kas_ledger(
    kas_account_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(50),
    current_user: UserInDB = Depends(get_current_user),
):
    """Mendapatkan riwayat kas_ledger lengkap dengan object double entry."""
    supabase = get_supabase()
    tid = current_user.tenant_id
    
    sd = date.fromisoformat(start_date) if start_date else None
    ed = date.fromisoformat(end_date) if end_date else None
    
    entries = KasService.get_ledger(tid, supabase, kas_account_id, sd, ed, limit)
    
    resp_data = {"entries": entries}
    
    if kas_account_id:
        acc_resp = supabase.table("kas_accounts").select("*").eq("id", kas_account_id).eq("tenant_id", tid).execute()
        if acc_resp.data:
            acc = acc_resp.data[0]
            curr_bal = KasService.get_balance(kas_account_id, tid, supabase)
            acc["current_balance"] = float(curr_bal)
            resp_data["account"] = acc

    return {"success": True, "data": resp_data}
