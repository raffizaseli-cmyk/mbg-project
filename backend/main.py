import os
import sys

# ─── Ensure backend dir is in sys.path (fixes imports when CWD != backend/) ──
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import logging
from typing import Any, Dict

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings, validate_config
from core.dependencies import get_current_user, require_role
from core.error_handlers import register_error_handlers
from core.health import health_router
from middleware.logging import RequestLoggingMiddleware
from models.user import UserInDB
from routers import (
    auth as auth_router,
    beneficiaries as beneficiaries_router,
    budget as budget_router,
    imports as imports_router,
    mbg as mbg_router,
    mbg_settings as mbg_settings_router,
    payables as payables_router,
    price_tracking as price_tracking_router,
    products as products_router,
    recipes as recipes_router,
    reports as reports_router,
    schedules as schedules_router,
    schools as schools_router,
    suppliers as suppliers_router,
    tenants as tenants_router,
    transactions as transactions_router,
    employees as employees_router,
    attendance as attendance_router,
    payroll as payroll_router,
    operational as operational_router,
    legal as legal_router,
    compliance as compliance_router,
    nutrition as nutrition_router,
    ingredients as ingredients_router,
    ui as ui_router,
)
from routers.mbg import delivery_router as mbg_delivery_router
from routers import price_tracking as price_tracking_router
from routers import schedules as schedules_router
from routers import imports as imports_router
from routers import budget as budget_router
from routers import beneficiaries as beneficiaries_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="MBG Catering Backend", version="1.0.2")


# ─── CORS ──────────────────────────────────────────────────────────────────
if settings.app_env == "development":
    origins = ["*"]
else:
    origins = [
        o for o in [settings.web_url, settings.backend_url,
                    "http://localhost:3000", "http://localhost:8000"]
        if o
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestLoggingMiddleware)

# ─── Error Handlers ─────────────────────────────────────────────────────────
register_error_handlers(app)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(health_router)


def repair_confirmed_items_on_startup():
    from core.database import get_supabase
    from utils.unit_converter import get_base_unit
    from decimal import Decimal
    
    supabase = get_supabase()
    logger.info("Running auto-repair for confirmed transaction items with missing products...")
    try:
        # Fetch transaction items with missing product_id
        items_resp = (
            supabase.table("transaction_items")
            .select("id, product_name, tenant_id, transaction_id, qty, unit, price")
            .is_("product_id", "null")
            .execute()
        )
        items = getattr(items_resp, "data", None) or []
        if not items:
            logger.info("No items found with missing product_id.")
            return

        # Fetch transaction statuses to check which ones are confirmed
        trx_ids = list(set(item["transaction_id"] for item in items if item.get("transaction_id")))
        if not trx_ids:
            return

        trx_resp = (
            supabase.table("transactions")
            .select("id, status, ref_number")
            .in_("id", trx_ids)
            .execute()
        )
        trx_map = {t["id"]: t for t in (getattr(trx_resp, "data", None) or [])}

        repaired_count = 0
        for item in items:
            tid = item.get("transaction_id")
            trx = trx_map.get(tid)
            if not trx or trx.get("status") != "confirmed":
                continue

            tenant_id = item["tenant_id"]
            product_name = item["product_name"]

            # Check if product exists now (exact/ilike match, active or inactive)
            try:
                existing_check = supabase.table("products") \
                    .select("id, is_active") \
                    .eq("tenant_id", tenant_id) \
                    .ilike("name", product_name.strip()) \
                    .limit(1) \
                    .execute()
                existing_prods = getattr(existing_check, "data", None) or []
            except Exception as e:
                logger.error(f"Failed to check existing product '{product_name}': {e}")
                existing_prods = []

            product_id = None
            if existing_prods:
                product_id = existing_prods[0]["id"]
                # Reactivate if inactive
                if not existing_prods[0].get("is_active"):
                    try:
                        supabase.table("products").update({"is_active": True}).eq("id", product_id).execute()
                    except Exception as e:
                        logger.error(f"Failed to reactivate product '{product_name}' during repair: {e}")
            else:
                # Auto-create the product
                try:
                    disp_unit = item.get("unit") or "pcs"
                    base, factor = get_base_unit(disp_unit)
                    
                    new_prod_resp = supabase.table("products").insert({
                        "tenant_id": tenant_id,
                        "name": product_name.strip(),
                        "category": "bahan_baku",
                        "unit": disp_unit,
                        "base_unit": base,
                        "display_unit": disp_unit,
                        "conversion_factor": factor,
                        "harga": float(item.get("price") or 0),
                        "stock_qty": 0.0,
                        "stock_min": 0.0,
                        "is_active": True,
                    }).execute()
                    new_prod_data = getattr(new_prod_resp, "data", None) or []
                    if new_prod_data:
                        product_id = new_prod_data[0]["id"]
                except Exception as e:
                    logger.error(f"Failed to auto-create product '{product_name}' during repair: {e}")
                    continue

            if product_id:
                # Link product to item and increment stock
                try:
                    supabase.table("transaction_items").update(
                        {"product_id": product_id}
                    ).eq("id", item["id"]).execute()
                    
                    qty = Decimal(str(item.get("qty", 0)))
                    prod_resp = supabase.table("products").select("conversion_factor").eq("id", product_id).single().execute()
                    factor = float((getattr(prod_resp, "data", None) or {}).get("conversion_factor") or 1)
                    qty_base = float(qty) * factor

                    supabase.rpc("increment_stock", {
                        "p_product_id": product_id,
                        "p_delta": qty_base,
                        "p_tenant_id": tenant_id,
                    }).execute()

                    # Insert stock history
                    balance_resp = supabase.table("products").select("stock_qty").eq("id", product_id).single().execute()
                    balance = float((getattr(balance_resp, "data", None) or {}).get("stock_qty", 0))

                    supabase.table("stock_history").insert({
                        "tenant_id": tenant_id,
                        "product_id": product_id,
                        "transaction_id": tid,
                        "change_qty": str(qty_base),
                        "balance_after": str(balance),
                        "reason": "purchase",
                        "notes": f"Auto-repair startup: Konfirmasi nota {trx.get('ref_number', '')}",
                    }).execute()

                    repaired_count += 1
                except Exception as e:
                    logger.error(f"Failed to process repair update for item '{product_name}': {e}")

        logger.info(f"Repair check finished. Repaired {repaired_count} items.")
    except Exception as e:
        logger.error(f"Error in repair startup check: {e}")


@app.on_event("startup")
async def startup_event():
    """Startup: validate config dan log info."""
    try:
        validate_config()
    except ValueError as e:
        logger.warning("Config validation (non-fatal in dev): %s", e)
    logger.info("Backend started — env: %s", settings.app_env)
    
    # Run auto-repair for items confirmed without products
    repair_confirmed_items_on_startup()


@app.get("/")
def root():
    return {"status": "ok", "version": "1.0.2"}


# ─── Test endpoint untuk verifikasi role checking (Modul 3) ───
@app.get(
    "/test-role-owner",
    dependencies=[Depends(require_role(["owner"]))],
    response_model=Dict[str, Any],
)
def test_role_owner(current_user: UserInDB = Depends(get_current_user)):
    """
    Test endpoint: hanya owner yang bisa akses.
    Jalankan test setelah server start, kemudian hapus endpoint ini.
    """
    return {
        "success": True,
        "message": f"Halo {current_user.name}, kamu owner",
        "role": current_user.role,
    }


@app.get(
    "/test-role-kasir",
    dependencies=[Depends(require_role(["owner", "admin", "kasir"]))],
    response_model=Dict[str, Any],
)
def test_role_kasir(current_user: UserInDB = Depends(get_current_user)):
    """
    Test endpoint: owner, admin, dan kasir bisa akses.
    Jalankan test setelah server start, kemudian hapus endpoint ini.
    """
    return {
        "success": True,
        "message": f"Halo {current_user.name}, kamu bisa input",
        "role": current_user.role,
    }


# ─── End of test endpoints ───

app.include_router(auth_router.router)
app.include_router(tenants_router.router)
app.include_router(schools_router.router)
app.include_router(suppliers_router.router)
app.include_router(products_router.router)
app.include_router(recipes_router.router)
app.include_router(mbg_settings_router.router)
app.include_router(mbg_router.router, prefix="/mbg")
app.include_router(mbg_delivery_router, prefix="/mbg")
app.include_router(transactions_router.router, prefix="/transactions")
app.include_router(reports_router.router)
app.include_router(payables_router.router)
app.include_router(price_tracking_router.router)
app.include_router(schedules_router.router)
app.include_router(imports_router.router)
app.include_router(budget_router.router, prefix="/budget")
app.include_router(beneficiaries_router.router)

# Modul 20
app.include_router(employees_router.router)
app.include_router(attendance_router.router)
app.include_router(payroll_router.router)
app.include_router(operational_router.router)
app.include_router(legal_router.router, prefix="/legal")
app.include_router(compliance_router.router)
app.include_router(nutrition_router.router)
app.include_router(ingredients_router.router)
app.include_router(ui_router.router)



















