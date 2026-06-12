from __future__ import annotations

from typing import Any

from nyagallery.config import RedisConfig


def create_redis_client(config: RedisConfig) -> Any | None:
    if not config.url:
        return None
    try:
        import redis.asyncio as redis
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Redis is configured but the redis extra is not installed. "
            'Install with: python -m pip install -e ".[redis]"'
        ) from exc
    return redis.from_url(config.url, decode_responses=True)


async def ping_redis_client(client: Any | None) -> None:
    if client is not None:
        await client.ping()


async def close_redis_client(client: Any | None) -> None:
    if client is None:
        return
    close = getattr(client, "aclose", None)
    if close is not None:
        await close()
        return
    await client.close()
