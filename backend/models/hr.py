"""
HR and Payroll Pydantic Models.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# ─── Job Positions ────────────────────────────────────────────────────────────

class JobPositionBase(BaseModel):
    name: str = Field(..., description="Nama jabatan")
    salary_type: str = Field("harian", description="harian / mingguan / bulanan")
    base_salary: Decimal = Field(..., description="Nominal gaji dasar")
    is_active: bool = True
    notes: Optional[str] = None


class JobPositionCreate(JobPositionBase):
    pass


class JobPositionUpdate(BaseModel):
    name: Optional[str] = None
    salary_type: Optional[str] = None
    base_salary: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class JobPositionResponse(JobPositionBase):
    id: str
    tenant_id: str
    employee_count: Optional[int] = 0


# ─── Employees ────────────────────────────────────────────────────────────────

class EmployeeBase(BaseModel):
    name: str
    nik: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    position_id: Optional[str] = None
    employee_type: str = Field("relawan", description="relawan / karyawan_tetap / kader / guru")
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_holder: Optional[str] = None
    join_date: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    nik: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    position_id: Optional[str] = None
    employee_type: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_holder: Optional[str] = None
    join_date: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    id: str
    tenant_id: str
    position_name: Optional[str] = None
    base_salary: Optional[Decimal] = None


# ─── Attendances ──────────────────────────────────────────────────────────────

class AttendanceRecord(BaseModel):
    employee_id: str
    date: date
    status: Optional[str] = None # null = hadir, "sakit", "izin", "alpa"
    notes: Optional[str] = None

class AttendanceBatchUpsert(BaseModel):
    records: list[AttendanceRecord]


# ─── Payroll ──────────────────────────────────────────────────────────────────

class PayrollPeriodCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    working_days: int
    notes: Optional[str] = None
    employee_ids: Optional[list[str]] = None


class OperationalCostCreate(BaseModel):
    name: str
    category: str = "operasional"
    amount: Decimal
    cost_date: date
    is_recurring: bool = False
    recurring_day: Optional[int] = None
    notes: Optional[str] = None
