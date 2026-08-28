from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class RecipeCreate(BaseModel):
    menu_id: str
    ingredient_id: str
    qty_needed: Decimal            # in whatever unit user chose
    unit: str                      # user-chosen unit (gram/kg/ml/liter/pcs/sosis/butir/dll)
    usage_type: str = "per_porsi"  # per_porsi | per_hari
    daily_qty: Optional[Decimal] = None  # for per_hari, in user-chosen unit
    notes: Optional[str] = None
    unit_weight_gram: Optional[Decimal] = None  # Berat per 1 satuan dalam gram (misal 1 sosis = 45g)


class RecipeUpdate(BaseModel):
    qty_needed: Optional[Decimal] = None
    unit: Optional[str] = None
    usage_type: Optional[str] = None
    daily_qty: Optional[Decimal] = None
    notes: Optional[str] = None
    unit_weight_gram: Optional[Decimal] = None


class RecipeResponse(BaseModel):
    id: str
    tenant_id: str
    menu_id: str
    ingredient_id: Optional[str] = None
    component_id: Optional[str] = None
    qty_needed: Decimal
    unit: str
    notes: Optional[str] = None
    created_at: str


class IngredientDetails(BaseModel):
    ingredient_id: str
    name: str
    unit: str
    qty_needed: Decimal
    current_stock: Decimal
    is_sufficient: bool


class MenuRecipeDetail(BaseModel):
    menu: dict  # {id, name, unit}
    ingredients: list[IngredientDetails]
    total_ingredients: int


class SimulateRequest(BaseModel):
    menu_id: str
    qty: int  # jumlah porsi yang akan diproduksi


class IngredientSimulation(BaseModel):
    name: str
    needed: Decimal
    available: Decimal
    sufficient: bool
    shortage: Decimal = Decimal("0.000")


class NutritionPerPortion(BaseModel):
    calories: float
    proteins: float
    fat: float
    carbohydrates: float
    incomplete_nutrition_data: bool

class SimulateResponse(BaseModel):
    can_produce: bool
    has_bom: bool
    max_possible: int
    ingredients: list[IngredientSimulation]
    nutrition_per_portion: Optional[NutritionPerPortion] = None


# ─── Component models ────────────────────────────────────────────────────────

class ComponentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ComponentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ComponentItemCreate(BaseModel):
    ingredient_id: str
    qty_needed: Decimal
    unit: Optional[str] = None
    usage_type: str = "per_porsi"
    daily_qty: Optional[Decimal] = None


class ComponentItemResponse(BaseModel):
    id: str
    component_id: str
    ingredient_id: str
    qty_needed: Decimal
    unit: Optional[str] = None
    product_name: Optional[str] = None  # joined from products


class ComponentResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    items: list[ComponentItemResponse] = []


class AttachComponentRequest(BaseModel):
    menu_id: str
    component_id: str
