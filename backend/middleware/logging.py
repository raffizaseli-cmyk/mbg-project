"""
backend/middleware/logging.py
Request logging middleware — JSON per baris, no sensitive data.
"""

import json
import logging
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("request")

# Path yang tidak perlu dilog
SKIP_PATHS = {"/health", "/favicon.ico", "/openapi.json", "/docs", "/redoc"}

# Header yang tidak boleh dilog
SENSITIVE_HEADERS = {"authorization", "cookie", "x-api-key"}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # Skip health dan static
        if path in SKIP_PATHS:
            return await call_next(request)

        start = time.perf_counter()
        tenant_id = None

        # Coba extract tenant_id dari JWT (tidak decode penuh, hanya untuk logging)
        try:
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer "):
                import base64
                token = auth.split(" ", 1)[1]
                parts = token.split(".")
                if len(parts) == 3:
                    payload_b64 = parts[1] + "=="  # padding
                    decoded = json.loads(base64.urlsafe_b64decode(payload_b64))
                    tenant_id = decoded.get("tenant_id")
        except Exception:
            pass

        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)

        log_entry = {
            "method":      request.method,
            "path":        path,
            "status":      response.status_code,
            "duration_ms": duration_ms,
            "tenant_id":   tenant_id,
        }

        level = logging.WARNING if response.status_code >= 500 else logging.INFO
        logger.log(level, json.dumps(log_entry, ensure_ascii=False))

        return response
