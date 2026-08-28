from pydantic import BaseModel, Field
from typing import Optional

class AllocationUpdate(BaseModel):
    price_per_portion: float = Field(..., ge=0)
    budget_food: float = Field(..., ge=0)
    budget_labor: float = Field(..., ge=0)
    budget_ops: float = Field(..., ge=0)

class AllocationSettingsResponse(AllocationUpdate):
    tenant_id: str
