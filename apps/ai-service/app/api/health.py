import asyncio
from time import perf_counter
from typing import TypedDict

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings

router = APIRouter(tags=["health"])


class DependencyResult(TypedDict):
    configured: bool
    required: bool
    healthy: bool
    latencyMs: int | None
    safeError: str | None


async def redis_readiness() -> DependencyResult:
    settings = get_settings()
    if not settings.REDIS_URL:
        return {
            "configured": False,
            "required": settings.AI_SERVICE_REDIS_REQUIRED,
            "healthy": False,
            "latencyMs": None,
            "safeError": "NOT_CONFIGURED" if settings.AI_SERVICE_REDIS_REQUIRED else None,
        }

    client = Redis.from_url(
        settings.REDIS_URL,
        socket_connect_timeout=settings.AI_SERVICE_DEPENDENCY_TIMEOUT_MS / 1_000,
        socket_timeout=settings.AI_SERVICE_DEPENDENCY_TIMEOUT_MS / 1_000,
        decode_responses=True,
    )
    started = perf_counter()
    try:
        response = await asyncio.wait_for(
            client.ping(),
            timeout=settings.AI_SERVICE_DEPENDENCY_TIMEOUT_MS / 1_000,
        )
        return {
            "configured": True,
            "required": settings.AI_SERVICE_REDIS_REQUIRED,
            "healthy": bool(response),
            "latencyMs": max(0, round((perf_counter() - started) * 1_000)),
            "safeError": None if response else "PING_FAILED",
        }
    except (TimeoutError, OSError, RedisError):
        return {
            "configured": True,
            "required": settings.AI_SERVICE_REDIS_REQUIRED,
            "healthy": False,
            "latencyMs": max(0, round((perf_counter() - started) * 1_000)),
            "safeError": "UNAVAILABLE",
        }
    finally:
        await client.aclose()


@router.get("/health")
async def health() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "miraaj-ai-service",
        "version": settings.AI_SERVICE_VERSION,
        "environment": settings.APP_ENV,
    }


@router.get("/ready")
async def ready() -> JSONResponse:
    settings = get_settings()
    secret = settings.AI_SERVICE_INTERNAL_SECRET.get_secret_value()
    checks: dict[str, DependencyResult] = {
        "configuration": {
            "configured": True,
            "required": True,
            "healthy": True,
            "latencyMs": 0,
            "safeError": None,
        },
        "internalSecurity": {
            "configured": len(secret) >= 32 and len(settings.allowed_service_ids) > 0,
            "required": True,
            "healthy": len(secret) >= 32 and len(settings.allowed_service_ids) > 0,
            "latencyMs": 0,
            "safeError": None,
        },
        "redis": await redis_readiness(),
    }
    is_ready = all(
        not dependency["required"] or dependency["healthy"] for dependency in checks.values()
    )
    return JSONResponse(
        status_code=200 if is_ready else 503,
        content={
            "status": "ready" if is_ready else "not_ready",
            "service": "miraaj-ai-service",
            "checks": checks,
        },
    )


@router.get("/version")
async def version() -> dict[str, str | None]:
    settings = get_settings()
    return {
        "service": "miraaj-ai-service",
        "version": settings.AI_SERVICE_VERSION,
        "environment": settings.APP_ENV,
        "buildId": settings.BUILD_ID,
    }
