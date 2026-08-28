from decimal import Decimal
from typing import Any, Dict, Optional

from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    category: str
    unit: str = "pcs"                        # kept for backward compat
    display_unit: Optional[str] = None       # user-chosen display unit (kg, liter, pcs…)
    harga: Decimal = Decimal("0.00")
    sell_price: Decimal = Decimal("0.00")
    stock_qty: Decimal = Decimal("0.000")    # in DISPLAY unit from user
    stock_min: Decimal = Decimal("0.000")    # in DISPLAY unit from user
    notes: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    display_unit: Optional[str] = None
    harga: Optional[Decimal] = None
    sell_price: Optional[Decimal] = None
    stock_min: Optional[Decimal] = None       # in DISPLAY unit
    nutrition_ref_id: Optional[int] = None
    notes: Optional[str] = None


class ProductResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    sku: Optional[str] = None
    category: str
    unit: str
    base_unit: Optional[str] = "gram"
    display_unit: Optional[str] = "kg"
    conversion_factor: Optional[Decimal] = Decimal("1000")
    harga: Decimal
    sell_price: Decimal
    stock_qty: Decimal                        # base unit (gram/ml/pcs) from DB
    stock_qty_display: Optional[Decimal] = None  # computed: stock_qty / factor
    stock_min: Decimal
    stock_min_display: Optional[Decimal] = None  # computed: stock_min / factor
    nutrition_ref_id: Optional[int] = None
    nutrition_ref: Optional[Dict[str, Any]] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: str
    nutrition_ref_kategori: Optional[str] = None
    nutrition_ref_kondisi: Optional[str] = None


class StockAdjustRequest(BaseModel):
    change_qty: Decimal
    reason: str  # adjustment, spoilage, waste
    notes: Optional[str] = None


class StockManualAdjustRequest(BaseModel):
    """Koreksi stok manual — menerima stok fisik baru dalam DISPLAY unit."""
    new_qty: Decimal       # in display unit
    reason: str
    notes: Optional[str] = None

