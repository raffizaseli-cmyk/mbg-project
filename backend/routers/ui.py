from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import os

router = APIRouter(prefix="/ui", tags=["ui"])

# Ensure templates directory path is absolute to avoid cwd issues
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
templates_dir = os.path.join(base_dir, "templates")
templates = Jinja2Templates(directory=templates_dir)

@router.get("/produksi/simulasi", response_class=HTMLResponse)
async def produksi_simulasi(request: Request):
    return templates.TemplateResponse("produksi_simulasi.html", {"request": request})
