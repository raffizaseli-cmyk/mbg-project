import os
from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve path .env secara absolut dari lokasi config.py ini
# config.py ada di backend/core/ → naik 1 level ke backend/
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    # --- Supabase ---
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_anon_key: str | None = None

    # --- Auth / JWT ---
    secret_key: str = "dev-secret-key-ganti-di-production"
    access_token_expire_minutes: int = 1296000
    algorithm: str = "HS256"

    # --- Telegram ---
    telegram_bot_token: str | None = None

    # --- AI ---
    gemini_api_key: str | None = None
    gemini_ocr_model: str = "gemini-2.0-flash"
    gemini_text_model: str = "gemini-2.0-flash"

    # --- Redis ---
    redis_url: str = "redis://localhost:6379"

    # --- App ---
    app_env: str = "development"
    backend_url: str = "http://localhost:8000"
    web_url: str = "https://mbg-catering.vercel.app"

    # --- Rate limiting ---
    photo_rate_limit_per_user: int = 10
    photo_rate_limit_window_seconds: int = 60

    # --- MBG settings ---
    # ⚠️ DEPRECATED: Old per-portion model (15k/13k) — DO NOT USE
    # mbg_price_per_portion: int = 15000
    # mbg_food_allocation: float = 0.80      # Old: 80% bahan
    # mbg_labor_allocation: float = 0.15     # Old: 15% upah
    # mbg_ops_allocation: float = 0.05       # Old: 5% ops
    #
    # NEW Model (v2.0): Breakdown pricing (configured in mbg_allocation_settings table)
    # - Bahan Baku: 10k (SD/SMP) | 8k (PAUD/TK) per porsi
    # - Operasional: 3k per porsi
    # - Profit Harian: 6jt FIXED per hari (tidak ada Minggu)
    # Settings diambil dari DB, bukan dari config ini.

    # --- OCR / Worker ---
    ocr_worker_count: int = 2
    ocr_job_timeout: int = 120

    model_config = SettingsConfigDict(
        # Path absolut — tidak bergantung dari mana uvicorn dijalankan
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def validate_config() -> None:
    """
    Validasi semua ENV vars wajib saat startup.
    Raise ValueError jika ada yang tidak terisi.
    """
    required_map = {
        "SUPABASE_URL":        settings.supabase_url,
        "SUPABASE_SERVICE_KEY": settings.supabase_service_key,
        "SECRET_KEY":          settings.secret_key,
        "TELEGRAM_BOT_TOKEN":  settings.telegram_bot_token,
        "GEMINI_API_KEY":      settings.gemini_api_key,
        "REDIS_URL":           settings.redis_url,
    }

    missing = [k for k, v in required_map.items() if not v]

    if missing:
        raise ValueError(
            f"❌ ENV vars wajib tidak ada: {', '.join(missing)}\n"
            "Periksa file .env Anda."
        )







