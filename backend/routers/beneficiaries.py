"""
backend/routers/beneficiaries.py
CRUD penerima manfaat: jenis penerima + jumlah per sekolah.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.user import UserInDB

logger = logging.getLogger(__name__)
router = APIRouter(tags=["beneficiaries"])


# ═══ Pydantic Models ═══════════════════════════════════════════════════════

class BeneficiaryTypeBody(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class BeneficiaryTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class SchoolBeneficiaryItem(BaseModel):
    beneficiary_type_id: str
    jumlah: int


# ═══ Beneficiary Types ════════════════════════════════════════════════════

@router.get("/beneficiary-types")
def list_beneficiary_types(
    current_user: UserInDB = Depends(get_current_user),
):
    """List jenis penerima manfaat tenant."""
    supabase = get_supabase()
    resp = (
        supabase.table("beneficiary_types")
        .select("*")
        .eq("tenant_id", current_user.tenant_id)
        .order("sort_order")
        .execute()
    )
    return {"success": True, "data": getattr(resp, "data", None) or []}


@router.post(
    "/beneficiary-types",
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def create_beneficiary_type(
    body: BeneficiaryTypeBody,
    current_user: UserInDB = Depends(get_current_user),
):
    """Tambah jenis penerima manfaat baru."""
    supabase = get_supabase()
    data = {
        "tenant_id": current_user.tenant_id,
        "name": body.name,
        "description": body.description,
        "sort_order": body.sort_order,
    }
    resp = supabase.table("beneficiary_types").insert(data).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(400, "Gagal membuat jenis penerima. Nama mungkin sudah ada.")
    return {"success": True, "data": rows[0]}


@router.put(
    "/beneficiary-types/{type_id}",
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def update_beneficiary_type(
    type_id: str,
    body: BeneficiaryTypeUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update jenis penerima manfaat."""
    supabase = get_supabase()
    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.description is not None:
        update_data["description"] = body.description
    if body.sort_order is not None:
        update_data["sort_order"] = body.sort_order
    if body.is_active is not None:
        update_data["is_active"] = body.is_active

    if not update_data:
        raise HTTPException(400, "Tidak ada data yang diupdate")

    resp = (
        supabase.table("beneficiary_types")
        .update(update_data)
        .eq("id", type_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(404, "Jenis penerima tidak ditemukan")
    return {"success": True, "data": rows[0]}


@router.delete(
    "/beneficiary-types/{type_id}",
    dependencies=[Depends(require_role(["owner"]))],
)
def delete_beneficiary_type(
    type_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Soft delete jenis penerima (cek tidak ada school_beneficiaries yang pakai)."""
    supabase = get_supabase()

    # Check usage
    usage_resp = (
        supabase.table("school_beneficiaries")
        .select("id")
        .eq("beneficiary_type_id", type_id)
        .limit(1)
        .execute()
    )
    usage = getattr(usage_resp, "data", None) or []
    if usage:
        # Soft delete only
        supabase.table("beneficiary_types").update({"is_active": False}).eq(
            "id", type_id
        ).eq("tenant_id", current_user.tenant_id).execute()
        return {"success": True, "message": "Dinonaktifkan (masih dipakai di sekolah)"}

    # Hard delete if unused
    supabase.table("beneficiary_types").delete().eq("id", type_id).eq(
        "tenant_id", current_user.tenant_id
    ).execute()
    return {"success": True, "message": "Jenis penerima dihapus"}


# ═══ School Beneficiaries ═════════════════════════════════════════════════

@router.get("/schools/{school_id}/beneficiaries")
def get_school_beneficiaries(
    school_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """List beneficiaries + total per sekolah."""
    supabase = get_supabase()
    resp = (
        supabase.table("school_beneficiaries")
        .select("*, beneficiary_types!beneficiary_type_id(name, sort_order)")
        .eq("school_id", school_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    total = sum(r.get("jumlah", 0) for r in rows)
    return {"success": True, "data": rows, "total": total}


@router.put(
    "/schools/{school_id}/beneficiaries",
    dependencies=[Depends(require_role(["owner", "admin"]))],
)
def update_school_beneficiaries(
    school_id: str,
    items: List[SchoolBeneficiaryItem],
    current_user: UserInDB = Depends(get_current_user),
):
    """Upsert semua beneficiaries sekaligus + auto-update default_portions."""
    supabase = get_supabase()
    tid = current_user.tenant_id

    results = []
    total = 0
    for item in items:
        data = {
            "tenant_id": tid,
            "school_id": school_id,
            "beneficiary_type_id": item.beneficiary_type_id,
            "jumlah": item.jumlah,
        }
        resp = (
            supabase.table("school_beneficiaries")
            .upsert(data, on_conflict="school_id,beneficiary_type_id")
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        if rows:
            results.append(rows[0])
        total += item.jumlah

    # Auto-update schools.default_portions = SUM(jumlah)
    # Use the correct table name - check if 'schools' or 'mbg_schools'
    try:
        supabase.table("schools").update(
            {"default_portion": total}
        ).eq("id", school_id).eq("tenant_id", tid).execute()
    except Exception:
        try:
            supabase.table("mbg_schools").update(
                {"default_portion": total}
            ).eq("id", school_id).eq("tenant_id", tid).execute()
        except Exception as e:
            logger.warning(f"Auto-update default_portion failed: {e}")

    return {"success": True, "data": results, "total": total}
