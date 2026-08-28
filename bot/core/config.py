import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for the bot
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


class BotSettings(BaseSettings):
    """Konfigurasi Telegram Bot."""

    telegram_bot_token: str
    backend_url: str

    web_url: str = "https://mbg-catering.vercel.app"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else ".env",
        env_file_encoding="utf-8"
    )


@lru_cache
def get_settings() -> BotSettings:
    return BotSettings()  # type: ignore[call-arg]


settings: BotSettings = get_settings()
