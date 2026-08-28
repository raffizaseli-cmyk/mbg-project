import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.database import get_supabase
from models.user import UserInDB
from core.dependencies import get_current_user, require_role
from services.spt_service import SPTService
from services.export_service import ExportService

router = APIRouter(tags=["Legal Documents"])
logger = logging.getLogger(__name__)

class GenerateRequest(BaseModel):
    year: int
    month: int

class StatusUpdateRequest(BaseModel):
    status: str

@router.post("/spt/generate", dependencies=[Depends(require_role(["owner"]))])
def generate_spt(
    req: GenerateRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Generate SPT PDF and save to storage & legal_documents."""
    supabase = get_supabase()
    try:
        res = SPTService.generate_spt(current_user.tenant_id, req.year, req.month, supabase)
        return {"success": True, "file_url": res["file_url"], "doc_number": res["doc_number"]}
    except Exception as e:
        logger.error(f"Generate SPT Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bap/generate", dependencies=[Depends(require_role(["owner"]))])
def generate_bap(
    req: GenerateRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Generate BAP PDF. Only if there is remaining balance/returns."""
    supabase = get_supabase()
    
    from services.kas_service import KasService
    balances = KasService.get_all_balances(current_user.tenant_id, supabase)
    total_balance = sum(b.get("current_balance", 0) for b in balances)
    
    # Check returns in ledger
    import datetime
    first = datetime.date(req.year, req.month, 1)
    if req.month == 12:
        last = datetime.date(req.year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        last = datetime.date(req.year, req.month + 1, 1) - datetime.timedelta(days=1)
        
    return_resp = supabase.table("kas_ledger").select("id").eq("tenant_id", current_user.tenant_id).eq("entry_type", "credit").eq("reference_type", "return_to_gov").gte("entry_date", first.isoformat()).lte("entry_date", last.isoformat()).execute()
    returns = getattr(return_resp, "data", None) or []
    
    if total_balance <= 0 and not returns:
        return {
            "success": False, 
            "error": "Tidak ada sisa kas bulan ini. BAP hanya dibuat jika ada sisa yang dikembalikan."
        }
        
    try:
        res = SPTService.generate_bap(current_user.tenant_id, req.year, req.month, supabase)
        return {"success": True, "file_url": res["file_url"], "doc_number": res["doc_number"]}
    except Exception as e:
        logger.error(f"Generate BAP Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents", dependencies=[Depends(require_role(["owner", "admin"]))])
def get_documents(
    year: Optional[int] = None,
    month: Optional[int] = None,
    doc_type: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_user)
):
    """Get list of generated legal documents for a specific month/year."""
    supabase = get_supabase()
    q = supabase.table("legal_documents").select("*").eq("tenant_id", current_user.tenant_id)
    if year:
        q = q.eq("year", year)
    if month:
        q = q.eq("month", month)
    if doc_type:
        q = q.eq("doc_type", doc_type)
        
    res = q.order("created_at", desc=True).execute()
    return {"success": True, "data": getattr(res, "data", None) or []}

@router.put("/documents/{doc_id}/status", dependencies=[Depends(require_role(["owner"]))])
def update_doc_status(
    doc_id: str,
    req: StatusUpdateRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    supabase = get_supabase()
    update_data = {"status": req.status}
    if req.status == "submitted":
        import datetime
        update_data["submitted_at"] = datetime.datetime.now().isoformat()
        
    res = supabase.table("legal_documents").update(update_data).eq("id", doc_id).eq("tenant_id", current_user.tenant_id).execute()
    if not getattr(res, "data", None):
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
        
    return {"success": True, "data": res.data[0]}

@router.post("/excel-dinas/generate", dependencies=[Depends(require_role(["owner", "admin"]))])
def generate_excel_dinas(
    req: GenerateRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Generate Excel Dinas (10 sheets)."""
    supabase = get_supabase()
    svc = ExportService()
    try:
        logger.info(f"[Excel Generate] Starting for tenant={current_user.tenant_id}, period={req.year}-{req.month}")
        url = svc.regenerate_monthly_excel(current_user.tenant_id, req.year, req.month, supabase)
        if url:
            # Add cache-buster so browser always fetches fresh file
            import time
            busted_url = f"{url}?t={int(time.time())}" if "?" not in url else f"{url}&t={int(time.time())}"
            # Upsert legal doc for Excel Dinas tracking
            SPTService._upsert_legal_doc(supabase, current_user.tenant_id, "excel_dinas", req.year, req.month, busted_url)
            logger.info(f"[Excel Generate] SUCCESS: {busted_url}")
            return {"success": True, "file_url": busted_url}
        
        # If url is None, check excel_files for the error message
        period_key = f"{req.year:04d}-{req.month:02d}"
        err_resp = supabase.table("excel_files").select("error_message, status").eq("tenant_id", current_user.tenant_id).eq("period", period_key).limit(1).execute()
        err_data = (getattr(err_resp, "data", None) or [{}])[0]
        error_msg = err_data.get("error_message", "Unknown error — check Railway logs")
        logger.error(f"[Excel Generate] FAILED with None url. Error: {error_msg}")
        return {"success": False, "error": f"Gagal generate Excel: {error_msg}"}
    except Exception as e:
        logger.error(f"[Excel Generate] EXCEPTION: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
