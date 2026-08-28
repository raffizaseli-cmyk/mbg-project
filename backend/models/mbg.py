"""
backend/models/mbg.py
Pydantic models untuk MBG weekly menus — Modul 6
Ditambah Delivery models — Modul 10
"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ─── Response: satu hari dalam tampilan minggu ───

class WeeklyMenuEntry(BaseModel):
    date: str                        # "YYYY-MM-DD"
    day_name: str                    # "Senin", "Selasa", dst
    day_of_week: int                 # 1=Senin … 6=Sabtu
    menu_name: Optional[str] = None
    menu_id: Optional[str] = None
    has_bom: bool = False
    is_filled: bool = False
    notes: Optional[str] = None


# ─── Request: simpan/upsert menu satu hari ───

class WeeklyMenuCreate(BaseModel):
    date: str                        # "YYYY-MM-DD"
    menu_name: str
    menu_id: Optional[str] = None
    notes: Optional[str] = None


# ─── Request: update menu yang sudah ada ───

class WeeklyMenuUpdate(BaseModel):
    menu_name: str
    menu_id: Optional[str] = None
    notes: Optional[str] = None


# ─── Request: validasi nama menu + cek BOM ───

class ValidateMenuRequest(BaseModel):
    menu_name: str


# ─── Detail ingredient untuk response BOM ───

class BomIngredient(BaseModel):
    name: str
    qty: float
    unit: str


# ─── Response: hasil validasi menu + status BOM ───

class ValidateMenuResponse(BaseModel):
    found: bool
    product: Optional[dict] = None   # {id, name} atau null
    has_bom: bool = False
    bom_ingredients: List[BomIngredient] = []


# ─── Modul 10: Delivery Models ────────────────────────────────────────────────

class DeliveryItem(BaseModel):
    school_id: str
    portions_sent: int
    receiver_name: Optional[str] = None
    notes: Optional[str] = None


class DeliveryBulkRequest(BaseModel):
    delivery_date: str               # "YYYY-MM-DD"
    deliveries: List[DeliveryItem]


class StockShortageDetail(BaseModel):
    ingredient: str
    needed: float
    available: float
    shortage: float
    unit: str


class AllocationResult(BaseModel):
    total_revenue: float
    total_portions: int
    budget_raw_material: float
    budget_operational: float
    budget_kitchen_rent: float
    allocation_type: str


class DeliverySummaryResponse(BaseModel):
    date: str
    total_portions: int
    total_schools: int
    menu_name: Optional[str] = None
    has_bom: bool = False
    deliveries: List[Dict[str, Any]] = []
    allocation: Optional[Dict[str, Any]] = None
    stok_status: str = "tidak_ada_menu"  # "dipotong" | "tidak_ada_bom" | "tidak_ada_menu"
