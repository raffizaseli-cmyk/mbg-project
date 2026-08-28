from typing import Optional

from pydantic import BaseModel


class SupplierCreate(BaseModel):
    name: str
    category: Optional[str] = "general"
    is_pkp: bool
    address: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    is_pkp: Optional[bool] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class SupplierResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    category: Optional[str] = "general"
    is_pkp: bool
    address: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: str
