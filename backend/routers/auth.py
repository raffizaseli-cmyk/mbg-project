import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from core.config import settings
from core.database import get_supabase
from core.dependencies import get_current_user
from core.security import create_access_token, get_password_hash, verify_password
from middleware.rate_limiter import login_limiter
from models.user import LoginRequest, TokenResponse, UserCreate, UserInDB, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

VALID_ROLES = {"owner", "admin", "akuntan", "gizi", "viewer", "driver"}


def _build_success(data: Any) -> Dict[str, Any]:
    return {"success": True, "data": data}


def _build_error(message: str) -> Dict[str, Any]:
    return {"success": False, "error": message}


def _require_owner(current_user: UserInDB):
    """Helper: return JSONResponse error if user is not owner, else None."""
    if current_user.role != "owner":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=_build_error("Hanya owner yang bisa mengakses fitur ini"),
        )
    return None


@router.post("/register-tenant", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def register_tenant(body: Dict[str, Any]):
    """
    Register tenant baru + owner user pertama.
    Body: tenant_name, slug, owner_email, password, phone
    """
    required_fields = {"tenant_name", "slug", "owner_email", "password", "phone"}
    if not required_fields.issubset(body.keys()):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error("Missing required fields"),
        )

    tenant_name = body["tenant_name"]
    slug = body["slug"]
    owner_email = body["owner_email"]
    password = body["password"]
    phone = body["phone"]

    supabase = get_supabase()

    # Validasi slug unik
    existing_tenant = supabase.table("tenants").select("id").eq("slug", slug).execute()
    if getattr(existing_tenant, "data", None):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error("Slug already in use"),
        )

    # Validasi email unik
    existing_user = supabase.table("users").select("id").eq("email", owner_email).execute()
    if getattr(existing_user, "data", None):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error("Email already in use"),
        )

    # Insert tenant
    tenant_insert = (
        supabase.table("tenants")
        .insert(
            {
                "name": tenant_name,
                "slug": slug,
                "owner_email": owner_email,
                "phone": phone,
            }
        )
        .execute()
    )
    tenant_data_list = getattr(tenant_insert, "data", None) or []
    if not tenant_data_list:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_build_error("Failed to create tenant"),
        )
    tenant = tenant_data_list[0]
    tenant_id = tenant["id"]

    # Insert owner user
    hashed_password = get_password_hash(password)
    user_insert = (
        supabase.table("users")
        .insert(
            {
                "tenant_id": tenant_id,
                "email": owner_email,
                "name": tenant_name,
                "role": "owner",
                "password_hash": hashed_password,
                "is_active": True,
            }
        )
        .execute()
    )
    user_data_list = getattr(user_insert, "data", None) or []
    if not user_data_list:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_build_error("Failed to create owner user"),
        )
    user_row = user_data_list[0]

    user_resp = UserResponse(
        id=user_row["id"],
        name=user_row["name"],
        email=user_row["email"],
        role=user_row["role"],
        tenant_id=user_row["tenant_id"],
    )


    token = create_access_token(
        data={"user_id": user_resp.id, "tenant_id": user_resp.tenant_id}
    )
    token_response = TokenResponse(access_token=token, user=user_resp)

    return _build_success(token_response.dict())


@router.post("/login", response_model=Dict[str, Any], dependencies=[Depends(login_limiter)])
def login(body: LoginRequest):
    supabase = get_supabase()
    try:
        result = supabase.table("users").select("*").eq("email", body.email).execute()
        users = getattr(result, "data", None) or []
    except Exception as e:
        logger.error("Login database query failed: %s", e)
        err_msg = str(e)
        if "infinite recursion" in err_msg or "42P17" in err_msg:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=_build_error(
                    "Database policy error (infinite recursion pada tabel users). "
                    "Jalankan script SQL fix di Supabase Dashboard."
                ),
            )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_build_error(f"Koneksi database gagal: {err_msg}"),
        )

    if not users:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=_build_error("Invalid email or password"),
        )

    user_row = users[0]
    password_hash = user_row.get("password_hash") or ""
    if not password_hash or not verify_password(body.password, password_hash):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=_build_error("Invalid email or password"),
        )

    user_resp = UserResponse(
        id=user_row["id"],
        name=user_row["name"],
        email=user_row["email"],
        role=user_row["role"],
        tenant_id=user_row["tenant_id"],
    )

    token = create_access_token(
        data={"user_id": user_resp.id, "tenant_id": user_resp.tenant_id}
    )
    token_response = TokenResponse(access_token=token, user=user_resp)

    return _build_success(token_response.dict())


class TelegramLoginRequest(BaseModel):
    telegram_id: int
    session_token: str

@router.post("/telegram-login", response_model=Dict[str, Any])
def telegram_login(body: TelegramLoginRequest):
    """
    Login via Telegram: body harus berisi telegram_id (int) dan session_token (str).
    """
    telegram_id = body.telegram_id
    session_token = body.session_token
    if telegram_id is None or session_token is None:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error("telegram_id and session_token are required"),
        )

    supabase = get_supabase()
    result = (
        supabase.table("users")
        .select("*")
        .eq("telegram_id", telegram_id)
        .eq("session_token", session_token)
        .execute()
    )
    users = getattr(result, "data", None) or []
    if not users:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=_build_error("Invalid Telegram session"),
        )

    user_row = users[0]
    if not user_row.get("is_active", True):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=_build_error("User is inactive"),
        )

    user_resp = UserResponse(
        id=user_row["id"],
        name=user_row["name"],
        email=user_row["email"],
        role=user_row["role"],
        tenant_id=user_row["tenant_id"],
    )

    token = create_access_token(
        data={"user_id": user_resp.id, "tenant_id": user_resp.tenant_id}
    )
    token_response = TokenResponse(access_token=token, user=user_resp)

    return _build_success(token_response.dict())


@router.post("/refresh", response_model=Dict[str, Any])
def refresh_token(current_user: UserInDB = Depends(get_current_user)):
    token = create_access_token(
        data={"user_id": current_user.id, "tenant_id": current_user.tenant_id}
    )
    user_resp = UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
    )
    token_response = TokenResponse(access_token=token, user=user_resp)
    return _build_success(token_response.dict())


@router.post("/logout", response_model=Dict[str, Any])
def logout(current_user: UserInDB = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("users").update({"session_token": None}).eq("id", current_user.id).execute()
    return {"success": True, "message": "Logged out"}


@router.get("/me", response_model=Dict[str, Any])
def get_me(current_user: UserInDB = Depends(get_current_user)):
    supabase = get_supabase()
    tenant_res = (
        supabase.table("tenants")
        .select("id,name,slug,plan")
        .eq("id", current_user.tenant_id)
        .execute()
    )
    tenant_list = getattr(tenant_res, "data", None) or []
    tenant = tenant_list[0] if tenant_list else None

    user_resp = UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
    )

    return _build_success(
        {
            "user": user_resp.dict(),
            "tenant": tenant,
        }
    )


@router.put("/users/{user_id}/telegram", response_model=Dict[str, Any])
def update_user_telegram(
    user_id: str,
    body: Dict[str, int],
    current_user: UserInDB = Depends(get_current_user),
):
    """Update telegram_id untuk user (untuk bot linkage)."""
    from datetime import datetime

    supabase = get_supabase()

    telegram_id = body.get("telegram_id")
    if not telegram_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error("telegram_id tidak boleh kosong"),
        )

    resp = supabase.table("users").update({
        "telegram_id": telegram_id,
        "updated_at": datetime.now().isoformat(),
    }).eq("id", user_id).eq("tenant_id", current_user.tenant_id).execute()

    if not getattr(resp, "data", None):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=_build_error("User tidak ditemukan"),
        )

    return _build_success({"message": "Telegram ID linked", "user_id": user_id})


# ═══════════════════════════════════════════════════════════════════════════════
# USER MANAGEMENT (Tim & Akses) — Owner Only
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/users", response_model=Dict[str, Any])
def list_users(current_user: UserInDB = Depends(get_current_user)):
    """GET /auth/users — list semua user di tenant ini (owner only)."""
    err = _require_owner(current_user)
    if err:
        return err

    supabase = get_supabase()
    result = (
        supabase.table("users")
        .select("id,name,email,role,telegram_id,is_active,created_at")
        .eq("tenant_id", current_user.tenant_id)
        .order("created_at")
        .execute()
    )
    rows = getattr(result, "data", None) or []

    # Add has_telegram boolean
    for row in rows:
        row["has_telegram"] = row.get("telegram_id") is not None

    return _build_success(rows)


class InviteUserBody(BaseModel):
    name: str
    email: str
    role: str
    password: str


@router.post("/users/invite", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def invite_user(
    body: InviteUserBody,
    current_user: UserInDB = Depends(get_current_user),
):
    """POST /auth/users/invite — tambah user baru ke tenant (owner only)."""
    err = _require_owner(current_user)
    if err:
        return err

    # Validate role
    if body.role not in VALID_ROLES:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error(f"Role tidak valid. Harus salah satu: {', '.join(sorted(VALID_ROLES))}"),
        )

    supabase = get_supabase()

    # Block duplicate owner
    if body.role == "owner":
        existing_owner = (
            supabase.table("users")
            .select("id")
            .eq("tenant_id", current_user.tenant_id)
            .eq("role", "owner")
            .execute()
        )
        if getattr(existing_owner, "data", None):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=_build_error("Tenant sudah punya owner."),
            )

    # Check email unique within tenant
    existing = (
        supabase.table("users")
        .select("id")
        .eq("email", body.email)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    if getattr(existing, "data", None):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error("Email sudah terdaftar di tenant ini"),
        )

    hashed_password = get_password_hash(body.password)
    insert_resp = (
        supabase.table("users")
        .insert(
            {
                "tenant_id": current_user.tenant_id,
                "name": body.name,
                "email": body.email,
                "role": body.role,
                "password_hash": hashed_password,
                "is_active": True,
            }
        )
        .execute()
    )
    rows = getattr(insert_resp, "data", None) or []
    if not rows:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_build_error("Gagal membuat user"),
        )

    new_user = rows[0]
    return _build_success({
        "id": new_user["id"],
        "name": new_user["name"],
        "email": new_user["email"],
        "role": new_user["role"],
        "is_active": new_user.get("is_active", True),
        "created_at": new_user.get("created_at"),
    })


class UpdateRoleBody(BaseModel):
    role: str


@router.put("/users/{user_id}/role", response_model=Dict[str, Any])
def update_user_role(
    user_id: str,
    body: UpdateRoleBody,
    current_user: UserInDB = Depends(get_current_user),
):
    """PUT /auth/users/{user_id}/role — ubah role user (owner only)."""
    err = _require_owner(current_user)
    if err:
        return err

    if body.role not in VALID_ROLES:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error(f"Role tidak valid. Harus salah satu: {', '.join(sorted(VALID_ROLES))}"),
        )

    if user_id == current_user.id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error("Tidak bisa ubah role sendiri"),
        )

    supabase = get_supabase()

    # Verify user belongs to same tenant
    check = (
        supabase.table("users")
        .select("id")
        .eq("id", user_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    if not getattr(check, "data", None):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=_build_error("User tidak ditemukan di tenant ini"),
        )

    supabase.table("users").update({"role": body.role}).eq("id", user_id).execute()

    return _build_success({"user_id": user_id, "new_role": body.role})


class UpdateStatusBody(BaseModel):
    is_active: bool


@router.put("/users/{user_id}/status", response_model=Dict[str, Any])
def update_user_status(
    user_id: str,
    body: UpdateStatusBody,
    current_user: UserInDB = Depends(get_current_user),
):
    """PUT /auth/users/{user_id}/status — aktifkan/nonaktifkan user (owner only)."""
    err = _require_owner(current_user)
    if err:
        return err

    if user_id == current_user.id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_build_error("Tidak bisa nonaktifkan diri sendiri"),
        )

    supabase = get_supabase()

    # Verify user belongs to same tenant
    check = (
        supabase.table("users")
        .select("id,session_token")
        .eq("id", user_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    check_data = getattr(check, "data", None) or []
    if not check_data:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=_build_error("User tidak ditemukan di tenant ini"),
        )

    update_payload: Dict[str, Any] = {"is_active": body.is_active}

    # If deactivating and user has active bot session, expire it
    if not body.is_active and check_data[0].get("session_token"):
        update_payload["session_token"] = None

    supabase.table("users").update(update_payload).eq("id", user_id).execute()

    return _build_success({"user_id": user_id, "is_active": body.is_active})

















