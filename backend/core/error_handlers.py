"""
backend/core/error_handlers.py
Global FastAPI exception handlers — format respons konsisten.
"""

import logging
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

logger = logging.getLogger(__name__)


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handler untuk 422 Unprocessable Entity (Pydantic/FastAPI validation)."""
    details = []
    for err in exc.errors():
        loc = " → ".join(str(l) for l in err.get("loc", []) if l != "body")
        details.append({"field": loc or "unknown", "msg": err.get("msg", "")})

    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, details)
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "Validasi gagal. Periksa input Anda.",
            "details": details,
        },
    )


async def http_exception_handler(
    request: Request, exc: HTTPException
) -> JSONResponse:
    """Handler untuk HTTPException — format JSON konsisten."""
    logger.warning(
        "HTTP %d on %s %s: %s",
        exc.status_code, request.method, request.url.path, exc.detail,
    )
    
    content = {
        "success": False,
        "status_code": exc.status_code,
    }
    
    if isinstance(exc.detail, dict):
        content.update(exc.detail)
    else:
        content["error"] = str(exc.detail)
        
    return JSONResponse(status_code=exc.status_code, content=content)


async def general_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Catch-all handler — jangan expose detail ke client."""
    logger.error(
        "Unhandled exception on %s %s",
        request.method, request.url.path,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Terjadi kesalahan server. Coba lagi.",
        },
    )


def register_error_handlers(app) -> None:
    """Daftarkan semua error handler ke FastAPI app."""
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
