"""
backend/models/transaction.py
Pydantic models untuk transaksi — Modul 7
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


# ─── Item dalam transaksi ───────────────────────────────────────────

class TransactionItemCreate(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    qty: Decimal
    unit: str = "pcs"
    price: Decimal
    harga_snapshot: Optional[Decimal] = None
    has_ppn: bool = False
    subtotal: Decimal
    kategori: Optional[str] = None         # kategori dari OCR
    ocr_nama_asli: Optional[str] = None    # nama asli di nota (sebelum alias)
    needs_confirmation: bool = False        # alias belum yakin


class TransactionItemResponse(BaseModel):
    id: str
    transaction_id: str
    tenant_id: str
    product_id: Optional[str] = None
    product_name: str
    qty: Decimal
    unit: str
    price: Decimal
    harga_snapshot: Optional[Decimal] = None
    has_ppn: bool = False
    subtotal: Decimal
    created_at: str


# ─── Header transaksi ────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    type: str = "expense"                  # income / expense / purchase
    source: str = "manual"
    supplier_id: Optional[str] = None
    ref_number: Optional[str] = None
    date: Optional[str] = None            # YYYY-MM-DD; default today
    subtotal: Decimal = Decimal("0.00")
    ppn_amount: Decimal = Decimal("0.00")
    pph22_amount: Decimal = Decimal("0.00")
    discount: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    payment_method: Optional[str] = None  # tunai/transfer/hutang
    payment_status: Optional[str] = None  # lunas/belum_lunas
    due_date: Optional[str] = None        # YYYY-MM-DD
    items: List[TransactionItemCreate] = []


class TransactionUpdate(BaseModel):
    ref_number: Optional[str] = None
    date: Optional[str] = None
    supplier_id: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    due_date: Optional[str] = None


class TransactionResponse(BaseModel):
    id: str
    tenant_id: str
    user_id: Optional[str] = None
    supplier_id: Optional[str] = None
    type: str
    source: str
    ref_number: Optional[str] = None
    date: str
    subtotal: Decimal
    ppn_amount: Decimal
    pph22_amount: Decimal
    discount: Decimal
    total: Decimal
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    status: str
    is_locked: bool
    created_at: str
    items: List[TransactionItemResponse] = []

    # Field tambahan dari OCR / join
    nama_toko: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    due_date: Optional[str] = None
    validation_flags: List[str] = []


class ConfirmTransactionRequest(BaseModel):
    """Opsional: user bisa override beberapa field saat konfirmasi."""
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    due_date: Optional[str] = None
    nama_toko: Optional[str] = None
    supplier_id: Optional[str] = None
    notes: Optional[str] = None


class PhotoUploadResponse(BaseModel):
    transaction_id: str
    message: str = "Foto diterima, sedang diproses..."
