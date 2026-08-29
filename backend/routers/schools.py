"""
School management endpoints.
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from core.database import get_supabase
from core.dependencies import get_current_user, require_role
from models.school import SchoolCreate, SchoolResponse, SchoolUpdate
from models.user import UserInDB
from datetime import datetime

import time
from typing import Tuple

router = APIRouter(prefix="/schools", tags=["schools"])

_SCHOOLS_CACHE: Dict[str, Tuple[float, list]] = {}
_SCHOOLS_CACHE_TTL = 60.0


def invalidate_schools_cache(tenant_id: str = None):
    if tenant_id:
        _SCHOOLS_CACHE.pop(tenant_id, None)
    else:
        _SCHOOLS_CACHE.clear()


@router.get("", response_model=Dict[str, Any])
def list_schools(
    search: str = Query("", description="Search by name"),
    is_active: bool = Query(True),
    current_user: UserInDB = Depends(get_current_user),
):
    """List schools with in-memory caching."""
    now = time.time()
    cache_key = f"{current_user.tenant_id}_{is_active}"
    cached = _SCHOOLS_CACHE.get(cache_key)

    if cached and (now - cached[0]) < _SCHOOLS_CACHE_TTL:
        raw_data = cached[1]
    else:
        supabase = get_supabase()
        query = supabase.table("schools").select("*").eq("tenant_id", current_user.tenant_id)
        if is_active:
            query = query.eq("is_active", True)
        response = query.execute()
        raw_data = getattr(response, "data", None) or []
        _SCHOOLS_CACHE[cache_key] = (now, raw_data)

    data = raw_data
    if search:
        data = [s for s in data if search.lower() in s.get("name", "").lower()]

    return {
        "success": True,
        "data": [SchoolResponse(**s) for s in data],
        "total": len(data),
    }


@router.post("", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def create_school(
    body: SchoolCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Create new school."""
    supabase = get_supabase()

    # Cek duplikat
    existing = (
        supabase.table("schools")
        .select("id")
        .eq("tenant_id", current_user.tenant_id)
        .eq("name", body.name)
        .execute()
    )
    if getattr(existing, "data", None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sekolah dengan nama ini sudah ada",
        )

    response = (
        supabase.table("schools")
        .insert(
            {
                "tenant_id": current_user.tenant_id,
                "name": body.name,
                "address": body.address,
                "contact_name": body.contact_name,
                "default_portions": body.default_portions,
                "notes": body.notes,
                "school_level": body.school_level or "sd_smp",
                "distance_km": body.distance_km,
                "is_active": True,
            }
        )
        .execute()
    )

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create school",
        )

    invalidate_schools_cache(current_user.tenant_id)
    return {"success": True, "data": SchoolResponse(**data[0])}


@router.put("/{school_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner", "admin"]))])
def update_school(
    school_id: str,
    body: SchoolUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update school."""
    supabase = get_supabase()

    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.address is not None:
        update_data["address"] = body.address
    if body.contact_name is not None:
        update_data["contact_name"] = body.contact_name
    if body.default_portions is not None:
        update_data["default_portions"] = body.default_portions
    if body.notes is not None:
        update_data["notes"] = body.notes
    if body.school_level is not None:
        update_data["school_level"] = body.school_level
    if body.distance_km is not None:
        update_data["distance_km"] = body.distance_km

    response = (
        supabase.table("schools")
        .update(update_data)
        .eq("id", school_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )

    data = getattr(response, "data", None) or []
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found")

    invalidate_schools_cache(current_user.tenant_id)
    return {"success": True, "data": SchoolResponse(**data[0])}


@router.delete("/{school_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role(["owner"]))])
def delete_school(
    school_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Soft delete school."""
    supabase = get_supabase()

    supabase.table("schools").update({"is_active": False}).eq("id", school_id).eq(
        "tenant_id", current_user.tenant_id
    ).execute()

    invalidate_schools_cache(current_user.tenant_id)
    return {"success": True, "message": "School deleted"}


@router.get("/{school_id}/deliveries", response_model=Dict[str, Any])
def get_school_deliveries(
    school_id: str,
    month: int = Query(default=None),
    year: int = Query(default=None),
    current_user: UserInDB = Depends(get_current_user),
):
    """Get delivery history untuk school."""
    supabase = get_supabase()

    response = (
        supabase.table("mbg_deliveries")
        .select("*")
        .eq("school_id", school_id)
        .eq("tenant_id", current_user.tenant_id)
        .execute()
    )

    deliveries = getattr(response, "data", None) or []

    return {
        "success": True,
        "data": deliveries,
        "total": len(deliveries),
    }


@router.put("/{school_id}/level", dependencies=[Depends(require_role(["owner", "admin"]))])
def update_school_level(
    school_id: str,
    body: Dict[str, str],
    current_user: UserInDB = Depends(get_current_user)
):
    """Set school level preference untuk sekolah"""
    supabase = get_supabase()
    
    level = body.get("school_level", "sd_smp")
    if level not in ["sd_smp", "paud_tk"]:
        raise HTTPException(status_code=400, detail="Invalid school_level. Use 'sd_smp' or 'paud_tk'")
    
    # Update school
    update_resp = supabase.table("schools").update({
        "school_level": level,
        "updated_at": datetime.now().isoformat()
    }).eq("id", school_id).eq("tenant_id", current_user.tenant_id).execute()
    
    if not update_resp.data:
        raise HTTPException(status_code=404, detail="School not found")
        
    invalidate_schools_cache(current_user.tenant_id)
    return {
        "success": True,
        "school_id": school_id,
        "school_level": level
    }
