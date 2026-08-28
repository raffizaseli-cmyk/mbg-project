"""
bot/handlers/security.py
RBAC decorator for Telegram bot handler protection — Modul 21.5a

Usage:
    from handlers.security import requires_role

    @requires_role(['owner', 'admin'])
    async def sensitive_handler(update, context):
        ...
"""

from functools import wraps
from typing import Callable, List

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from utils.session import get_role


def requires_role(allowed_roles: List[str]) -> Callable:
    """
    Decorator untuk proteksi handler berdasarkan role.

    Jika role user tidak di allowed_roles:
        → Bot reply: "⛔ Akses Ditolak. Fitur ini hanya untuk [role]."
        → Return ConversationHandler.END
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int | None:
            user_role = get_role(context)

            if not user_role or user_role not in allowed_roles:
                role_names = ", ".join(allowed_roles)
                text = (
                    f"⛔ Akses Ditolak.\n\n"
                    f"Fitur ini hanya untuk: {role_names}.\n"
                    f"Role kamu sekarang: {user_role or 'NOT SET'}"
                )

                if update.callback_query:
                    await update.callback_query.answer(text[:200], show_alert=True)
                elif update.message:
                    await update.message.reply_text(text)

                return ConversationHandler.END

            return await func(update, context)

        return wrapper

    return decorator
