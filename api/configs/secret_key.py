"""SECRET_KEY persistence helpers for runtime setup."""

from __future__ import annotations

import logging
import secrets

from extensions.ext_redis import redis_client
from extensions.ext_storage import storage

logger = logging.getLogger(__name__)

GENERATED_SECRET_KEY_FILENAME = ".dify_secret_key"
GENERATED_SECRET_KEY_LOCK_NAME = "dify_secret_key_generation_lock"
GENERATED_SECRET_KEY_LOCK_TIMEOUT_SECONDS = 30


def resolve_secret_key(secret_key: str) -> str:
    """Return an explicit SECRET_KEY or a generated key persisted in storage."""
    if secret_key:
        return secret_key

    return _load_or_create_secret_key()


def _load_persisted_secret_key() -> str | None:
    try:
        persisted_key = storage.load_once(GENERATED_SECRET_KEY_FILENAME).decode("utf-8").strip()
    except FileNotFoundError:
        return None

    return persisted_key or None


def _load_or_create_secret_key() -> str:
    persisted_key = _load_persisted_secret_key()
    if persisted_key:
        return persisted_key

    # Separate processes (e.g. the `api` and `api_websocket` containers, which have no
    # startup ordering between them) can all miss the file on first boot and each generate
    # a different key. Serialize generation with a Redis lock and re-check storage under
    # the lock so every process converges on the same persisted key instead of each one
    # caching its own, mutually-incompatible value in memory.
    lock = redis_client.lock(
        GENERATED_SECRET_KEY_LOCK_NAME,
        timeout=GENERATED_SECRET_KEY_LOCK_TIMEOUT_SECONDS,
        blocking_timeout=GENERATED_SECRET_KEY_LOCK_TIMEOUT_SECONDS,
    )
    if not lock.acquire(blocking=True):
        persisted_key = _load_persisted_secret_key()
        if persisted_key:
            return persisted_key
        raise ValueError(
            f"SECRET_KEY is not set and timed out waiting for another process to generate "
            f"{GENERATED_SECRET_KEY_FILENAME}. Set SECRET_KEY explicitly."
        )

    try:
        persisted_key = _load_persisted_secret_key()
        if persisted_key:
            return persisted_key

        generated_key = secrets.token_urlsafe(48)
        try:
            storage.save(GENERATED_SECRET_KEY_FILENAME, f"{generated_key}\n".encode())
        except Exception as exc:
            raise ValueError(
                f"SECRET_KEY is not set and could not be generated at {GENERATED_SECRET_KEY_FILENAME}. "
                "Set SECRET_KEY explicitly or make storage writable."
            ) from exc

        return generated_key
    finally:
        try:
            lock.release()
        except Exception:
            logger.warning("Failed to release SECRET_KEY generation lock", exc_info=True)
