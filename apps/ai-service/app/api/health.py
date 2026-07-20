import asyncio
import importlib.util
from time import perf_counter
from typing import TypedDict

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.services.ocr.tesseract_provider import TesseractOCRProvider

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


def _module_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def media_dependency_readiness() -> dict[str, DependencyResult]:
    settings = get_settings()
    provider = TesseractOCRProvider(settings)
    installed_packs = provider.installed_language_packs() or settings.ocr_languages_installed_packs
    configured_packs = settings.ocr_languages_installed_packs
    missing_packs = sorted(configured_packs - installed_packs)
    tesseract_available = provider.is_available()
    pillow_available = _module_available("PIL")
    opencv_available = _module_available("cv2")
    pdf_available = _module_available("pypdf") and _module_available("fitz")
    vision_configured = settings.vision_provider_active

    return {
        "tesseract": {
            "configured": True,
            "required": True,
            "healthy": tesseract_available,
            "latencyMs": 0,
            "safeError": None if tesseract_available else "OCR_ENGINE_UNAVAILABLE",
        },
        "ocrLanguagePacks": {
            "configured": bool(configured_packs),
            "required": True,
            "healthy": tesseract_available and not missing_packs,
            "latencyMs": 0,
            "safeError": None if not missing_packs else "OCR_LANGUAGE_PACK_MISSING",
        },
        "opencv": {
            "configured": True,
            "required": True,
            "healthy": opencv_available,
            "latencyMs": 0,
            "safeError": None if opencv_available else "UNAVAILABLE",
        },
        "pillow": {
            "configured": True,
            "required": True,
            "healthy": pillow_available,
            "latencyMs": 0,
            "safeError": None if pillow_available else "UNAVAILABLE",
        },
        "pdf": {
            "configured": True,
            "required": True,
            "healthy": pdf_available,
            "latencyMs": 0,
            "safeError": None if pdf_available else "UNAVAILABLE",
        },
        "visionProvider": {
            "configured": settings.VISION_PROVIDER_ENABLED,
            "required": False,
            "healthy": vision_configured or not settings.VISION_PROVIDER_ENABLED,
            "latencyMs": 0,
            "safeError": None
            if vision_configured or not settings.VISION_PROVIDER_ENABLED
            else "VISION_PROVIDER_DISABLED",
        },
    }


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
        **media_dependency_readiness(),
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
