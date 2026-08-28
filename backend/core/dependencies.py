from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.database import get_supabase
from core.security import verify_token
from models.user import UserInDB


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserInDB:
    """
    Decode JWT, load current user from Supabase, and ensure the user is active.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = verify_token(credentials.credentials)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    supabase = get_supabase()
    response = supabase.table("users").select("*").eq("id", user_id).single().execute()
    user_data = getattr(response, "data", None)

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user_data.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive",
        )

    return UserInDB(**user_data)


def require_role(allowed_roles: list[str]) -> Callable:
    """
    Dependency factory yang mengembalikan dependency checker.
    Checker akan memvalidasi bahwa user memiliki role yang diizinkan.

    Usage:
        @router.post("/", dependencies=[Depends(require_role(["owner", "admin"]))])
        def create_something(...):
            pass
    """

    async def role_checker(current_user: UserInDB = Depends(get_current_user)) -> UserInDB:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "success": False,
                    "error": "Akses ditolak",
                },
            )
        return current_user

    return role_checker


def check_transaction_lock(
    transaction_id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> dict:
    """
    Cek apakah transaksi terkunci (is_locked = true).
    Jika terkunci, raise 403 Forbidden.
    Return transaction object jika valid.
    """
    supabase = get_supabase()
    response = (
        supabase.table("transactions")
        .select("*")
        .eq("id", transaction_id)
        .eq("tenant_id", current_user.tenant_id)
        .single()
        .execute()
    )

    transaction_data = getattr(response, "data", None)
    if not transaction_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    if transaction_data.get("is_locked", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "error": "Transaksi terkunci, tidak dapat diubah",
            },
        )

    return transaction_data
