from typing import Optional

from pydantic import BaseModel


class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    phone: Optional[str] = None
    address: Optional[str] = None
    business_type: str = "catering"
    sppg_code: Optional[str] = None
    contact_name: Optional[str] = None
    plan: str = "free"
    is_active: bool = True


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    business_type: Optional[str] = None
    sppg_code: Optional[str] = None
    contact_name: Optional[str] = None
