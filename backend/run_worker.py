"""
backend/run_worker.py
Worker OCR untuk Windows — jalankan dengan: python run_worker.py
Menggunakan SimpleWorker karena Windows tidak punya fork().
"""

import os
import sys
import logging

# Pastikan import dari folder backend/
sys.path.insert(0, os.path.dirname(__file__))

from redis import Redis
from rq import Queue, SimpleWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    from core.config import settings

    redis_url = settings.redis_url or "redis://localhost:6379"
    logger.info("Connecting to Redis: %s", redis_url)

    conn = Redis.from_url(redis_url)
    queue = Queue("ocr_queue", connection=conn)

    logger.info("Worker started — listening on: ocr_queue")
    logger.info("Press Ctrl+C to stop.")

    worker = SimpleWorker([queue], connection=conn)
    worker.work()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Worker stopped.")
