from fastapi import APIRouter
import traceback
from core.database import get_supabase
from services.export_service import ExportService
from services.spt_service import SPTService

router = APIRouter()

@router.get("/test-bug")
async def test_bug():
    sb = get_supabase()
    res = sb.table('tenants').select('id').limit(1).execute()
    tid = res.data[0]['id']
    
    excel_err = ""
    try:
        await ExportService().regenerate_monthly_excel(tid, 2026, 3, sb)
    except Exception as e:
        excel_err = traceback.format_exc()

    spt_err = ""
    try:
        await SPTService.generate_spt(tid, 2026, 3, sb)
    except Exception:
        spt_err = traceback.format_exc()
        
    bap_err = ""
    try:
        await SPTService.generate_bap(tid, 2026, 3, sb)
    except Exception:
        bap_err = traceback.format_exc()

    return {"excel": excel_err, "spt": spt_err, "bap": bap_err}
