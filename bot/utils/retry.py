"""
bot/utils/retry.py
Utility untuk retry API call dengan exponential backoff.
"""

import asyncio
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class RetryError(Exception):
    """Raise ketika semua retry habis."""
    pass


async def with_retry(
    func: Callable,
    *args,
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,),
    label: str = "operation",
    **kwargs,
) -> Any:
    """
    Retry sebuah async func dengan exponential backoff.

    Args:
        func: async callable
        *args / **kwargs: argumen ke func
        max_attempts: maksimum percobaan (default 3)
        delay: delay awal dalam detik (default 1.0)
        backoff: multiplier per attempt (default 2.0 → 1s, 2s, 4s)
        exceptions: tuple exception yang akan di-retry
        label: nama operasi untuk logging
    """
    last_exc: Optional[Exception] = None
    current_delay = delay

    for attempt in range(1, max_attempts + 1):
        try:
            return await func(*args, **kwargs)
        except exceptions as e:
            last_exc = e
            if attempt < max_attempts:
                logger.warning(
                    "[retry] %s failed (attempt %d/%d): %s — retry in %.1fs",
                    label, attempt, max_attempts, e, current_delay,
                )
                await asyncio.sleep(current_delay)
                current_delay *= backoff
            else:
                logger.error(
                    "[retry] %s failed after %d attempts: %s",
                    label, max_attempts, e, exc_info=True,
                )

    raise RetryError(f"{label} gagal setelah {max_attempts} percobaan") from last_exc
