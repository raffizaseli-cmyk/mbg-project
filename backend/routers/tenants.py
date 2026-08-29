"""
Tenant management endpoints.
"""

import random
import string
from datetime import datetime, timedelta
from typing import Any, Dict
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from core.security import create_access_token
from core.config import settings
from models.tenant import TenantResponse, TenantUpdate
from models.user import UserInDB, UserResponse

import time
from typing import Tuple

router = APIRouter(prefix="/tenants", tags=["tenants"])

_TENANT_CACHE: Dict[str, Tuple[float, dict]] = {}
_TENANT_CACHE_TTL = 60.0


def invalidate_tenant_cache(tenant_id: str = None):
    if tenant_id:
        _TENANT_CACHE.pop(tenant_id, None)
    else:
        _TENANT_CACHE.clear()


@router.get("/me", response_model=Dict[str, Any])
def get_current_tenant(current_user: UserInDB = Depends(get_current_user)):
    """Get current tenant info with in-memory caching."""
    now = time.time()
    cached = _TENANT_CACHE.get(current_user.tenant_id)
    if cached and (now - cached[0]) < _TENANT_CACHE_TTL:
        return {"success": True, "data": TenantResponse(**cached[1])}

    supabase = get_supabase()
    response = (
        supabase.table("tenants")
        .select("*")
        .eq("id", current_user.tenant_id)
        .single()
        .execute()
    )
    tenant_data = getattr(response, "data", None)
    if not tenant_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    if current_user.role == "owner":
        tenant_data["contact_name"] = current_user.name
    else:
        owner_query = supabase.table("users").select("name").eq("tenant_id", current_user.tenant_id).eq("role", "owner").limit(1).execute()
        owners = getattr(owner_query, "data", None)
        if owners:
            tenant_data["contact_name"] = owners[0].get("name")

    _TENANT_CACHE[current_user.tenant_id] = (now, tenant_data)
    return {"success": True, "data": TenantResponse(**tenant_data)}


@router.put("/me", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner"]))])
def update_tenant(
    body: TenantUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update current tenant info."""
    supabase = get_supabase()

    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.phone is not None:
        update_data["phone"] = body.phone
    if body.address is not None:
        update_data["address"] = body.address
    if body.business_type is not None:
        update_data["business_type"] = body.business_type
    if body.sppg_code is not None:
        update_data["sppg_code"] = body.sppg_code
    
    if body.contact_name is not None:
        # Field "contact_name" tidak ada di tabel tenants. 
        # Simpan nama pemilik ke master tabel users supaya UI tidak kehilangan datanya
        user_update = supabase.table("users").update({"name": body.contact_name}).eq("tenant_id", current_user.tenant_id).eq("role", "owner").execute()

    # Hanya jalankan update di tabel tenants KETIKA ada field selain contact_name
    tenant_list = []
    if update_data:
        response = (
            supabase.table("tenants")
            .update(update_data)
            .eq("id", current_user.tenant_id)
            .execute()
        )
        tenant_list = getattr(response, "data", None) or []
    else:
        # Panggil ulang datanya saja tanpa update ke tabel tenants karena kosong
        response = supabase.table("tenants").select("*").eq("id", current_user.tenant_id).execute()
        tenant_list = getattr(response, "data", None) or []

    if not tenant_list:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update tenant",
        )

    invalidate_tenant_cache(current_user.tenant_id)

    # Sisipkan contact_name di response akhir
    tenant_resp = tenant_list[0]
    if body.contact_name is not None:
        tenant_resp["contact_name"] = body.contact_name
    elif current_user:
        # Ambil kembali the latest name kalau nggak disubmit tp ada di db users
        owner_query = supabase.table("users").select("name").eq("tenant_id", current_user.tenant_id).eq("role", "owner").limit(1).execute()
        owners = getattr(owner_query, "data", None)
        if owners:
            tenant_resp["contact_name"] = owners[0].get("name")

    return {"success": True, "data": TenantResponse(**tenant_resp)}


@router.post("/telegram-link-code", response_model=Dict[str, Any])
def generate_telegram_link_code(current_user: UserInDB = Depends(get_current_user)):
    """Generate linking code untuk Telegram."""
    supabase = get_supabase()

    # Generate kode unik 6 karakter
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    from datetime import datetime, timedelta, timezone
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    # Simpan ke session_token user
    supabase.table("users").update({"session_token": code}).eq("id", current_user.id).execute()

    return {
        "success": True,
        "data": {
            "code": code,
            "expires_at": expires_at.isoformat(),
        },
    }


class TelegramLinkRequest(BaseModel):
    telegram_id: int
    linking_code: str


@router.post("/telegram-link", response_model=Dict[str, Any])
def link_telegram_account(body: TelegramLinkRequest):
    """Link Telegram account dengan kode yang digenerate."""
    telegram_id = body.telegram_id
    linking_code = body.linking_code

    if not telegram_id or not linking_code:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": "telegram_id and linking_code required"},
        )

    supabase = get_supabase()

    # Cari user dengan kode ini
    response = supabase.table("users").select("*").eq("session_token", linking_code).execute()
    users = getattr(response, "data", None) or []

    if not users:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "error": "Kode tidak valid atau sudah expired"},
        )

    user_row = users[0]

    # Lepaskan telegram_id dari user lama (jika ada) yang mungkin terbentuk dari sesi trial/sebelumnya
    # agar tidak melanggar 'users_telegram_id_key' unique constraint
    try:
        existing = supabase.table("users").select("id").eq("telegram_id", telegram_id).execute()
        existing_users = getattr(existing, "data", None) or []
        for eu in existing_users:
            if eu["id"] != user_row["id"]:
                supabase.table("users").update({"telegram_id": None}).eq("id", eu["id"]).execute()
    except Exception as e:
        print(f"Warning: Failed to check/clear existing telegram_id: {e}")

    # Update telegram_id dan clear session_token
    try:
        supabase.table("users").update(
            {"telegram_id": telegram_id, "session_token": None}
        ).eq("id", user_row["id"]).execute()
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": f"Gagal menautkan akun Telegram: {str(e)}"}
        )

    # Generate token untuk bot
    token = create_access_token(
        data={
            "user_id": user_row["id"],
            "tenant_id": user_row["tenant_id"],
        }
    )

    user_resp = UserResponse(
        id=user_row["id"],
        name=user_row["name"],
        email=user_row["email"],
        role=user_row["role"],
        tenant_id=user_row["tenant_id"],
    )

    return {
        "success": True,
        "data": {
            "access_token": token,
            "user": user_resp,
        },
    }


class TelegramAutoLoginRequest(BaseModel):
    telegram_id: int


@router.post("/telegram-auto-login", response_model=Dict[str, Any])
def telegram_auto_login(body: TelegramAutoLoginRequest):
    """Auto-login user by their already-linked telegram_id.
    Called by the bot when session is lost (e.g. after Railway redeploy)
    but the user's telegram_id is already linked in the database.
    """
    supabase = get_supabase()

    response = supabase.table("users").select("*").eq("telegram_id", body.telegram_id).limit(1).execute()
    users = getattr(response, "data", None) or []

    if not users:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "error": "Telegram belum terhubung"},
        )

    user_row = users[0]

    # Check user is_active (for SaaS billing enforcement)
    if not user_row.get("is_active", True):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "error": "Akun dinonaktifkan. Hubungi admin untuk info langganan."},
        )

    # Check tenant is_active
    tenant_resp = supabase.table("tenants").select("is_active").eq("id", user_row["tenant_id"]).limit(1).execute()
    tenant_rows = getattr(tenant_resp, "data", None) or []
    if tenant_rows and not tenant_rows[0].get("is_active", True):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "error": "Langganan tidak aktif. Hubungi admin untuk perpanjangan."},
        )

    token = create_access_token(
        data={
            "user_id": user_row["id"],
            "tenant_id": user_row["tenant_id"],
        }
    )

    user_resp = UserResponse(
        id=user_row["id"],
        name=user_row["name"],
        email=user_row["email"],
        role=user_row["role"],
        tenant_id=user_row["tenant_id"],
    )

    return {
        "success": True,
        "data": {
            "access_token": token,
            "user": user_resp,
        },
    }

class MbgSettingsUpdate(BaseModel):
    bahan_sd_smp: float
    bahan_paud_tk: float
    ops_per_porsi: float
    insentif_harian: float
    hari_kerja_bulan: int

@router.get("/mbg-settings", response_model=Dict[str, Any])
def get_mbg_settings(current_user: UserInDB = Depends(get_current_user)):
    supabase = get_supabase()
    resp = supabase.table("mbg_allocation_settings").select("*").eq("tenant_id", current_user.tenant_id).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        # Auto-create default if not exist
        default_data = {
            "tenant_id": current_user.tenant_id,
        }
        ins = supabase.table("mbg_allocation_settings").insert(default_data).execute()
        rows = getattr(ins, "data", None) or [{}]
    
    settings_data = rows[0]
    if "hari_kerja_bulan" not in settings_data:
        settings_data["hari_kerja_bulan"] = 26
        
    return {"success": True, "data": settings_data}

@router.put("/mbg-settings", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def update_mbg_settings(body: MbgSettingsUpdate, current_user: UserInDB = Depends(get_current_user)):
    supabase = get_supabase()
    update_data = body.model_dump()
    
    # Workaround: Kolom hari_kerja_bulan belum ada di DB Supabase (error 42703).
    # Pop agar 4 field budget utama tetap bisa tersimpan tanpa error 500.
    hari_kerja = update_data.pop("hari_kerja_bulan", 26)
    
    resp = supabase.table("mbg_allocation_settings").update(update_data).eq("tenant_id", current_user.tenant_id).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        update_data["tenant_id"] = current_user.tenant_id
        ins = supabase.table("mbg_allocation_settings").insert(update_data).execute()
        rows = getattr(ins, "data", None) or [{}]
        
    saved_data = rows[0]
    saved_data["hari_kerja_bulan"] = hari_kerja
    return {"success": True, "data": saved_data}
