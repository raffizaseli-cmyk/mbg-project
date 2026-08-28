"""
backend/models/compliance.py
Pydantic models for compliance endpoints — Modul 21.5c
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date, datetime, time


# ─── Hygiene ───────────────────────────────────────────────────────────────

class HygieneCheckItem(BaseModel):
    area: str
    status: str  # "baik" | "perlu_perbaikan"
    catatan: Optional[str] = None
    suhu: Optional[float] = None

class HygieneCheckCreate(BaseModel):
    check_date: date
    items: List[HygieneCheckItem]
    notes: Optional[str] = None

class HygieneCheckResponse(BaseModel):
    id: str
    tenant_id: str
    check_date: str
    checked_by: Optional[str] = None
    items: list
    overall_status: str
    notes: Optional[str] = None
    created_at: str

    class Config:
        extra = "ignore"


# ─── Temperature ───────────────────────────────────────────────────────────

class TemperatureLogCreate(BaseModel):
    log_date: date
    log_time: str  # "HH:MM" as string for JSON compat
    area: str      # "gudang_kering" | "chiller" | "freezer"
    temperature: float
    notes: Optional[str] = None

class TemperatureLogResponse(BaseModel):
    id: str
    tenant_id: Optional[str] = None
    log_date: str
    log_time: str
    area: str
    temperature: float
    is_normal: bool
    recorded_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: str

    class Config:
        extra = "ignore"


# ─── Food Samples ─────────────────────────────────────────────────────────

class FoodSampleCreate(BaseModel):
    sample_date: date
    menu_name: str
    taken_at: str  # "HH:MM"
    weight_gram: float = 50.0
    storage_temp: Optional[float] = None

class FoodSampleResponse(BaseModel):
    id: str
    sample_code: str
    sample_date: str
    menu_name: str
    taken_at: str
    weight_gram: Optional[float] = 50.0
    storage_temp: Optional[float] = None
    expires_at: Optional[str] = None
    status: str
    created_at: str
    hours_remaining: Optional[float] = None

    class Config:
        extra = "ignore"

class FoodSampleDispose(BaseModel):
    reason: str = "normal_disposal"


# ─── Food Waste ────────────────────────────────────────────────────────────

class FoodWasteCreate(BaseModel):
    delivery_id: Optional[str] = None
    school_id: str
    report_date: date
    portions_sent: int = Field(..., gt=0)
    portions_consumed: int = Field(..., ge=0)
    comstock_score: int = Field(..., ge=1, le=5)
    waste_reason: str
    notes: Optional[str] = None

class FoodWasteResponse(BaseModel):
    id: str
    delivery_id: Optional[str] = None
    school_id: str
    report_date: str
    portions_sent: int
    portions_consumed: Optional[int] = None
    waste_pct: Optional[float] = None
    comstock_score: Optional[int] = None
    waste_reason: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str

    class Config:
        extra = "ignore"


# ─── Incident ──────────────────────────────────────────────────────────────

class IncidentCreate(BaseModel):
    school_id: Optional[str] = None
    incident_time: datetime
    location: str
    victim_count: int = Field(..., gt=0)
    symptoms: List[str]
    first_action: str
    sample_secured: bool = False
    sample_ids: Optional[List[str]] = None
    reported_to: Optional[List[str]] = None

class IncidentResponse(BaseModel):
    id: str
    incident_code: str
    school_id: Optional[str] = None
    incident_time: str
    location: str
    victim_count: int
    symptoms: Optional[list] = None
    first_action: str
    sample_secured: Optional[bool] = False
    sample_ids: Optional[list] = None
    reported_to: Optional[list] = None
    status: str
    investigation_result: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str

    class Config:
        extra = "ignore"


# ─── SLHS ──────────────────────────────────────────────────────────────────

class SLHSCreate(BaseModel):
    cert_number: str
    issued_date: date
    expires_date: date
    label_expires: Optional[date] = None
    file_url: Optional[str] = None
    notes: Optional[str] = None
