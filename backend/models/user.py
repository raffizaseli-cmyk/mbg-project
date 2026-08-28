from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "owner"
    telegram_id: Optional[int] = None


class UserInDB(BaseModel):
    id: str
    tenant_id: str
    telegram_id: Optional[int] = None
    email: str
    name: str
    role: str
    is_active: bool = True

    class Config:
        extra = "ignore"

    # ─── Helper methods ───

    def is_owner(self) -> bool:
        """Return True jika user adalah owner."""
        return self.role == "owner"

    def is_admin_or_above(self) -> bool:
        """Return True jika user adalah owner atau admin."""
        return self.role in ["owner", "admin"]

    def can_input(self) -> bool:
        """Return True jika user bisa input transaksi (owner, admin, kasir)."""
        return self.role in ["owner", "admin", "kasir"]

    def can_view_reports(self) -> bool:
        """Return True jika user bisa lihat laporan (owner, admin, viewer)."""
        return self.role in ["owner", "admin", "viewer"]

    def can_access_sensitive(self) -> bool:
        """Return True jika user bisa akses fitur sensitif (OCR, Keuangan, Stok)."""
        return self.role in ["owner", "admin"]

    def is_driver(self) -> bool:
        """Return True jika user adalah driver."""
        return self.role == "driver"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    tenant_id: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse





