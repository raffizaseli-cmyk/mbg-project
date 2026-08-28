"""
Supplier management endpoints.
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.supplier import SupplierCreate, SupplierResponse, SupplierUpdate
from models.user import UserInDB

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("", response_model=Dict[str, Any])
def list_suppliers(
    search: str = Query(""),
    is_active: bool = Query(True),
    current_user: UserInDB = Depends(get_current_user),
):
    """List suppliers."""
    supabase = get_supabase()
    query = supabase.table("suppliers").select("*").eq("tenant_id", current_user.tenant_id)

    if is_active:
        query = query.eq("is_active", True)

    response = query.execute()
    data = getattr(response, "data", None) or []

    if search:
        data = [s for s in data if search.lower() in s.get("name", "").lower()]

    return {
        "success": True,
        "data": [SupplierResponse(**s) for s in data],
        "total": len(data),
    }


@router.post("", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def create_supplier(
    body: SupplierCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Create new supplier."""
    supabase = get_supabase()

    existing = (
        supabase.table("suppliers")
        .select("id")
        .eq("tenant_id", current_user.tenant_id)
        .eq("name", body.name)
        .execute()
    )
    if getattr(existing, "data", None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier dengan nama ini sudah ada",
        )

    response = (
        supabase.table("suppliers")
        .insert(
            {
                "tenant_id": current_user.tenant_id,
                "name": body.name,
                "category": body.category,
                "is_pkp": body.is_pkp,
                "address": body.address,
                "phone": body.phone,
                "notes": body.notes,
                "is_active": True,
            }
        )
        .execute()
    )

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create supplier",
        )

    return {"success": True, "data": SupplierResponse(**data[0])}


@router.put("/{supplier_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def update_supplier(
    supplier_id: str,
    body: SupplierUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update supplier."""
    supabase = get_supabase()

    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.category is not None:
        update_data["category"] = body.category
    if body.is_pkp is not None:
        update_data["is_pkp"] = body.is_pkp
    if body.address is not None:
        update_data["address"] = body.address
    if body.phone is not None:
        update_data["phone"] = body.phone
    if body.notes is not None:
        update_data["notes"] = body.notes

    response = (
        supabase.table("suppliers")
        .update(update_data)
        .eq("id", supplier_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    return {"success": True, "data": SupplierResponse(**data[0])}


@router.delete("/{supplier_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner"]))])
def delete_supplier(
    supplier_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Soft delete supplier."""
    supabase = get_supabase()

    supabase.table("suppliers").update({"is_active": False}).eq("id", supplier_id).eq(
        "tenant_id", current_user.tenant_id
    ).execute()

    return {"success": True, "message": "Supplier deleted"}
