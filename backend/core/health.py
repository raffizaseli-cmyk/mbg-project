"""
backend/core/health.py
GET /health — cek koneksi Supabase, Redis, Storage.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter

logger = logging.getLogger(__name__)

health_router = APIRouter(tags=["health"])

VERSION = "1.0.0"


def _check_supabase() -> str:
    try:
        from core.database import get_supabase
        sb = get_supabase()
        # Simple query: select 1
        sb.table("tenants").select("id").limit(1).execute()
        return "ok"
    except Exception as e:
        logger.warning("Health check — Supabase error: %s", e)
        return "error"


def _check_redis() -> str:
    try:
        import os
        import redis as redis_lib
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        r = redis_lib.from_url(url, socket_connect_timeout=2)
        r.ping()
        return "ok"
    except Exception as e:
        logger.warning("Health check — Redis error: %s", e)
        return "error"


def _check_storage() -> str:
    try:
        from core.database import get_supabase
        sb = get_supabase()
        # List bucket — cukup sebagai ping
        sb.storage.list_buckets()
        return "ok"
    except Exception as e:
        logger.warning("Health check — Storage error: %s", e)
        return "error"


@health_router.get("/health")
def health_check():
    """
    Cek kesehatan semua service.
    - ok       → HTTP 200
    - degraded → HTTP 200
    - down     → HTTP 503
    """
    from fastapi.responses import JSONResponse

    db_status      = _check_supabase()
    redis_status   = _check_redis()
    storage_status = _check_storage()

    services = {
        "database": db_status,
        "redis":    redis_status,
        "storage":  storage_status,
    }

    if db_status == "error":
        overall = "down"
    elif redis_status == "error" or storage_status == "error":
        overall = "degraded"
    else:
        overall = "ok"

    payload: Dict[str, Any] = {
        "status":    overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services":  services,
        "version":   VERSION,
    }
    http_code = 503 if overall == "down" else 200
    return JSONResponse(status_code=http_code, content=payload)
