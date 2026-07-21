"""Prompt 5 — creative image/video generation and local render routes.

HMAC-only under ``/internal/v1/creative``. NestJS remains the sole authority
over approval, rights, and MinIO persistence; these routes never connect to
MongoDB. Production providers (openai/runway) are used only when configured
with API keys; automated tests keep them disabled and mock httpx.
"""

from __future__ import annotations

import base64
import hashlib
import io
from time import perf_counter

import structlog
from fastapi import APIRouter, Request
from PIL import Image, UnidentifiedImageError

from app.core.config import Settings, get_settings
from app.models.creative_schemas import (
    CreateThumbnailInput,
    CreateThumbnailResponse,
    CreativeJobStatusResponse,
    CreativeProviderStatusResponse,
    GenerateImageInput,
    GenerateImageResponse,
    GenerateVideoInput,
    GenerateVideoResponse,
    MediaValidationResult,
    OcrCheckInput,
    OcrCheckResponse,
    ProviderStatusBlock,
    RenderImageVariantInput,
    RenderImageVariantResponse,
    RenderSubtitlesInput,
    RenderSubtitlesResponse,
    RenderTextOverlayInput,
    RenderTextOverlayResponse,
    ValidateMediaInput,
    ValidateMediaResponse,
)
from app.services.creative.factory import (
    resolve_image_provider,
    resolve_render_provider,
    resolve_video_provider,
)
from app.services.creative.local_render import LocalMediaRenderingProvider
from app.services.creative.secret_redaction import scrub_for_logs
from app.services.media_fetch import MediaFetchError, fetch_signed_media

router = APIRouter(prefix="/internal/v1/creative", tags=["internal-creative"])
logger = structlog.get_logger()

_PROVIDER_FAILED = "CREATIVE_PROVIDER_UNAVAILABLE"
_INPUT_INVALID = "CREATIVE_MEDIA_DECODE_FAILED"


def _settings() -> Settings:
    return get_settings()


async def _validate_media_bytes(
    content: bytes,
    *,
    settings: Settings,
    expected_kind: str,
    max_bytes: int | None,
    max_duration_seconds: float | None,
) -> MediaValidationResult:
    started = perf_counter()
    warnings: list[str] = []
    digest = hashlib.sha256(content).hexdigest()
    limit = max_bytes or settings.CREATIVE_MAX_IMAGE_BYTES

    if len(content) > limit:
        return MediaValidationResult(
            accepted=False,
            byteLength=len(content),
            sha256=digest,
            errorCode="CREATIVE_INPUT_TOO_LARGE",
            safeMessage="Media exceeds configured byte limit.",
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    # Prefer image decode; treat undecodable payloads as signature failures.
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.load()
            width, height = image.size
            kind = "image"
            mime = Image.MIME.get(image.format or "", "application/octet-stream")
            if expected_kind == "video":
                warnings.append("Expected video but received a decodable image payload.")
            return MediaValidationResult(
                accepted=True,
                kind=kind,
                mimeType=mime,
                width=width,
                height=height,
                byteLength=len(content),
                sha256=digest,
                metadataStripped=False,
                warnings=warnings,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
    except UnidentifiedImageError:
        pass

    # Minimal MP4 signature check (ftyp) for mock/local video bytes.
    if content[4:8] == b"ftyp" or content.startswith(b"\x00\x00\x00"):
        if len(content) > (max_bytes or settings.CREATIVE_MAX_VIDEO_BYTES):
            return MediaValidationResult(
                accepted=False,
                kind="video",
                byteLength=len(content),
                sha256=digest,
                errorCode="CREATIVE_INPUT_TOO_LARGE",
                safeMessage="Video exceeds configured byte limit.",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        duration_cap = max_duration_seconds or float(settings.CREATIVE_MAX_VIDEO_DURATION_SECONDS)
        return MediaValidationResult(
            accepted=True,
            kind="video",
            mimeType="video/mp4",
            durationSeconds=None,
            byteLength=len(content),
            sha256=digest,
            warnings=[
                f"Duration not probed locally; configured max is {duration_cap}s.",
            ],
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    return MediaValidationResult(
        accepted=False,
        kind="unknown",
        byteLength=len(content),
        sha256=digest,
        errorCode="CREATIVE_MEDIA_SIGNATURE_INVALID",
        safeMessage="Unsupported or mismatched media signature.",
        processingMs=max(0, round((perf_counter() - started) * 1_000)),
    )


@router.post("/generate-image")
async def generate_image(
    request_body: GenerateImageInput, request: Request
) -> GenerateImageResponse:
    settings = _settings()
    started = perf_counter()
    provider = resolve_image_provider(settings)
    try:
        output = await provider.generate_image(request_body)
    except (RuntimeError, ValueError):
        logger.warning(
            "creative_generate_image_failed",
            route=request.url.path,
            request_id=request.headers.get("x-miraaj-request-id"),
            provider=provider.provider_id,
            safe_error_code=_PROVIDER_FAILED,
        )
        return GenerateImageResponse(
            accepted=False,
            errorCode=_PROVIDER_FAILED,
            safeMessage="Image provider failed.",
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    logger.info(
        "creative_generate_image_completed",
        **scrub_for_logs(
            {
                "route": request.url.path,
                "provider": output.provider,
                "status": output.status,
                "job_id": output.jobId,
                "provider_job_id": output.providerJobId,
                "byte_length": output.media.byteLength if output.media else 0,
                "sha256": output.media.sha256 if output.media else None,
                "safe_error_code": output.safeErrorCode,
                "request_id": request.headers.get("x-miraaj-request-id"),
            }
        ),
    )
    return GenerateImageResponse(
        accepted=True,
        data=output,
        processingMs=output.processingMs,
    )


@router.post("/generate-video")
async def generate_video(
    request_body: GenerateVideoInput, request: Request
) -> GenerateVideoResponse:
    settings = _settings()
    started = perf_counter()
    provider = resolve_video_provider(settings)
    try:
        output = await provider.generate_video(request_body)
    except (RuntimeError, ValueError):
        logger.warning(
            "creative_generate_video_failed",
            route=request.url.path,
            request_id=request.headers.get("x-miraaj-request-id"),
            provider=provider.provider_id,
            safe_error_code=_PROVIDER_FAILED,
        )
        return GenerateVideoResponse(
            accepted=False,
            errorCode=_PROVIDER_FAILED,
            safeMessage="Video provider failed.",
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    logger.info(
        "creative_generate_video_completed",
        **scrub_for_logs(
            {
                "route": request.url.path,
                "provider": output.provider,
                "status": output.status,
                "job_id": output.jobId,
                "provider_job_id": output.providerJobId,
                "byte_length": output.media.byteLength if output.media else 0,
                "sha256": output.media.sha256 if output.media else None,
                "is_poster_fallback": bool(output.media and output.media.isPosterFrameFallback),
                "safe_error_code": output.safeErrorCode,
                "request_id": request.headers.get("x-miraaj-request-id"),
            }
        ),
    )
    return GenerateVideoResponse(
        accepted=True,
        data=output,
        processingMs=output.processingMs,
    )


@router.post("/render/image-variant")
async def render_image_variant(
    request_body: RenderImageVariantInput, request: Request
) -> RenderImageVariantResponse:
    settings = _settings()
    provider = resolve_render_provider(settings)
    output = await provider.render_image_variant(request_body)
    logger.info(
        "creative_render_image_variant_completed",
        route=request.url.path,
        provider=output.provider,
        safe_error=output.safeError,
        byte_length=output.media.byteLength if output.media else 0,
        request_id=request.headers.get("x-miraaj-request-id"),
    )
    return RenderImageVariantResponse(
        accepted=output.media is not None,
        data=output,
        errorCode=output.safeError,
        safeMessage=None if output.media else "Image variant render failed.",
        processingMs=output.processingMs,
    )


@router.post("/render/text-overlay")
async def render_text_overlay(
    request_body: RenderTextOverlayInput, request: Request
) -> RenderTextOverlayResponse:
    settings = _settings()
    provider = resolve_render_provider(settings)
    output = await provider.render_text_overlay(request_body)
    logger.info(
        "creative_render_text_overlay_completed",
        route=request.url.path,
        provider=output.provider,
        direction=output.direction,
        text_length=len(request_body.text),
        request_id=request.headers.get("x-miraaj-request-id"),
    )
    return RenderTextOverlayResponse(
        accepted=output.media is not None,
        data=output,
        errorCode=output.safeError,
        safeMessage=None if output.media else "Text overlay render failed.",
        processingMs=output.processingMs,
    )


@router.post("/render/subtitles")
async def render_subtitles(
    request_body: RenderSubtitlesInput, request: Request
) -> RenderSubtitlesResponse:
    settings = _settings()
    provider = resolve_render_provider(settings)
    output = await provider.render_subtitles(request_body)
    logger.info(
        "creative_render_subtitles_completed",
        route=request.url.path,
        provider=output.provider,
        cue_count=output.cueCount,
        request_id=request.headers.get("x-miraaj-request-id"),
    )
    return RenderSubtitlesResponse(
        accepted=output.safeError is None,
        data=output,
        errorCode=output.safeError,
        safeMessage=None if output.safeError is None else "Subtitle render failed.",
        processingMs=output.processingMs,
    )


@router.post("/render/thumbnail")
async def render_thumbnail(
    request_body: CreateThumbnailInput, request: Request
) -> CreateThumbnailResponse:
    settings = _settings()
    provider = resolve_render_provider(settings)
    output = await provider.create_thumbnail(request_body)
    logger.info(
        "creative_render_thumbnail_completed",
        route=request.url.path,
        provider=output.provider,
        byte_length=output.media.byteLength if output.media else 0,
        request_id=request.headers.get("x-miraaj-request-id"),
    )
    return CreateThumbnailResponse(
        accepted=output.media is not None,
        data=output,
        errorCode=output.safeError,
        safeMessage=None if output.media else "Thumbnail render failed.",
        processingMs=output.processingMs,
    )


@router.post("/validate-media")
async def validate_media(
    request_body: ValidateMediaInput, request: Request
) -> ValidateMediaResponse:
    settings = _settings()
    started = perf_counter()

    if request_body.media is None and not request_body.signedMediaUrl:
        return ValidateMediaResponse(
            accepted=False,
            errorCode=_INPUT_INVALID,
            safeMessage="Either media bytes or a signedMediaUrl is required.",
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    content: bytes
    if request_body.signedMediaUrl:
        try:
            # Reuse Prompt 2 SSRF-safe fetch (allowlist, no redirects).
            fetched = await fetch_signed_media(
                request_body.signedMediaUrl,
                settings=settings,
            )
            content = fetched.content
            if len(content) > settings.CREATIVE_MAX_PROVIDER_DOWNLOAD_BYTES:
                return ValidateMediaResponse(
                    accepted=False,
                    data=MediaValidationResult(
                        accepted=False,
                        byteLength=len(content),
                        errorCode="CREATIVE_INPUT_TOO_LARGE",
                        safeMessage="Downloaded media exceeds provider download limit.",
                        processingMs=max(0, round((perf_counter() - started) * 1_000)),
                    ),
                    errorCode="CREATIVE_INPUT_TOO_LARGE",
                    safeMessage="Downloaded media exceeds provider download limit.",
                    processingMs=max(0, round((perf_counter() - started) * 1_000)),
                )
        except MediaFetchError as error:
            logger.warning(
                "creative_validate_media_fetch_rejected",
                route=request.url.path,
                request_id=request.headers.get("x-miraaj-request-id"),
                safe_error_code=error.code,
            )
            return ValidateMediaResponse(
                accepted=False,
                data=MediaValidationResult(
                    accepted=False,
                    errorCode=error.code,
                    safeMessage="Signed media URL was rejected.",
                    processingMs=max(0, round((perf_counter() - started) * 1_000)),
                ),
                errorCode=error.code,
                safeMessage="Signed media URL was rejected.",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
    else:
        assert request_body.media is not None
        try:
            content = base64.b64decode(request_body.media.contentBase64, validate=False)
        except Exception:
            return ValidateMediaResponse(
                accepted=False,
                errorCode=_INPUT_INVALID,
                safeMessage="Invalid base64 media payload.",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

    result = await _validate_media_bytes(
        content,
        settings=settings,
        expected_kind=request_body.expectedKind,
        max_bytes=request_body.maxBytes,
        max_duration_seconds=request_body.maxDurationSeconds,
    )
    logger.info(
        "creative_validate_media_completed",
        route=request.url.path,
        accepted=result.accepted,
        kind=result.kind,
        byte_length=result.byteLength,
        sha256=result.sha256,
        request_id=request.headers.get("x-miraaj-request-id"),
    )
    return ValidateMediaResponse(
        accepted=result.accepted,
        data=result,
        errorCode=None if result.accepted else (result.errorCode or _INPUT_INVALID),
        safeMessage=None if result.accepted else result.safeMessage,
        processingMs=result.processingMs,
    )


@router.post("/ocr-check")
async def ocr_check(request_body: OcrCheckInput, request: Request) -> OcrCheckResponse:
    settings = _settings()
    render = LocalMediaRenderingProvider(settings)
    output = await render.ocr_check(request_body)
    logger.info(
        "creative_ocr_check_completed",
        route=request.url.path,
        matched=output.matched,
        mismatch=output.mismatch,
        similarity=output.similarity,
        ocr_available=output.ocrAvailable,
        request_id=request.headers.get("x-miraaj-request-id"),
    )
    return OcrCheckResponse(
        accepted=True,
        data=output,
        errorCode=output.safeError if output.mismatch else None,
        safeMessage=None,
        processingMs=output.processingMs,
    )


@router.get("/jobs/{provider_job_id}/status")
async def provider_job_status(provider_job_id: str, request: Request) -> CreativeJobStatusResponse:
    settings = _settings()
    started = perf_counter()
    # Prefer the video provider for async provider job IDs; fall back to image.
    video = resolve_video_provider(settings)
    image = resolve_image_provider(settings)
    try:
        if settings.AI_VIDEO_PROVIDER in {"runway", "mock"}:
            output = await video.get_job_status(provider_job_id)
        else:
            output = await image.get_job_status(provider_job_id)
    except RuntimeError:
        return CreativeJobStatusResponse(
            accepted=False,
            errorCode=_PROVIDER_FAILED,
            safeMessage="Provider job status unavailable.",
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    # Never echo outputUrl into logs.
    logger.info(
        "creative_provider_job_status",
        **scrub_for_logs(
            {
                "route": request.url.path,
                "provider": output.provider,
                "status": output.status,
                "provider_job_id": output.providerJobId or provider_job_id,
                "safe_error_code": output.safeErrorCode,
                "has_output_url": bool(output.outputUrl),
                "request_id": request.headers.get("x-miraaj-request-id"),
            }
        ),
    )
    return CreativeJobStatusResponse(
        accepted=True,
        data=output,
        processingMs=max(0, round((perf_counter() - started) * 1_000)),
    )


@router.post("/jobs/{provider_job_id}/cancel")
async def provider_job_cancel(provider_job_id: str, request: Request) -> CreativeJobStatusResponse:
    settings = _settings()
    started = perf_counter()
    video = resolve_video_provider(settings)
    image = resolve_image_provider(settings)
    try:
        if settings.AI_VIDEO_PROVIDER in {"runway", "mock"}:
            output = await video.cancel_job(provider_job_id)
        else:
            output = await image.cancel_job(provider_job_id)
    except RuntimeError:
        return CreativeJobStatusResponse(
            accepted=False,
            errorCode=_PROVIDER_FAILED,
            safeMessage="Provider job cancel unavailable.",
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    logger.info(
        "creative_provider_job_cancel",
        **scrub_for_logs(
            {
                "route": request.url.path,
                "provider": output.provider,
                "status": output.status,
                "provider_job_id": output.providerJobId or provider_job_id,
                "safe_error_code": output.safeErrorCode,
                "request_id": request.headers.get("x-miraaj-request-id"),
            }
        ),
    )
    return CreativeJobStatusResponse(
        accepted=True,
        data=output,
        processingMs=max(0, round((perf_counter() - started) * 1_000)),
    )


@router.get("/providers/status")
async def providers_status() -> CreativeProviderStatusResponse:
    settings = _settings()
    image_active = settings.ai_image_provider_active
    video_active = settings.ai_video_provider_active
    render_enabled = settings.AI_RENDER_PROVIDER == "local"

    image_configured = (
        settings.AI_IMAGE_PROVIDER in {"disabled", "mock"}
        or settings.AI_IMAGE_PROVIDER_API_KEY is not None
    )
    video_configured = (
        settings.AI_VIDEO_PROVIDER in {"disabled", "mock"}
        or settings.AI_VIDEO_PROVIDER_API_KEY is not None
    )

    image_error: str | None = None
    if settings.AI_IMAGE_PROVIDER == "disabled":
        image_error = "CREATIVE_PROVIDER_DISABLED"
    elif settings.AI_IMAGE_PROVIDER == "openai" and not image_configured:
        image_error = "CREATIVE_PROVIDER_UNAVAILABLE"

    video_error: str | None = None
    if settings.AI_VIDEO_PROVIDER == "disabled":
        video_error = "CREATIVE_PROVIDER_DISABLED"
    elif settings.AI_VIDEO_PROVIDER == "runway" and not video_configured:
        video_error = "CREATIVE_PROVIDER_UNAVAILABLE"

    return CreativeProviderStatusResponse(
        imageProvider=ProviderStatusBlock(
            provider=settings.AI_IMAGE_PROVIDER,
            enabled=image_active,
            configured=image_configured,
            model=(settings.AI_IMAGE_MODEL or None) if image_active else None,
            timeoutSeconds=settings.AI_IMAGE_PROVIDER_TIMEOUT_SECONDS,
            maxRetries=settings.AI_IMAGE_PROVIDER_MAX_RETRIES,
            safeError=image_error,
            usageTrackingEnabled=settings.AI_PROVIDER_USAGE_TRACKING_ENABLED,
            liveSmokeTestEnabled=settings.AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED,
            concurrencyLimit=settings.AI_PROVIDER_MAX_ACTIVE_IMAGE_JOBS,
        ),
        videoProvider=ProviderStatusBlock(
            provider=settings.AI_VIDEO_PROVIDER,
            enabled=video_active,
            configured=video_configured,
            model=(settings.AI_VIDEO_MODEL or None) if video_active else None,
            timeoutSeconds=settings.AI_VIDEO_PROVIDER_TIMEOUT_SECONDS,
            maxRetries=settings.AI_VIDEO_PROVIDER_MAX_RETRIES,
            safeError=video_error,
            usageTrackingEnabled=settings.AI_PROVIDER_USAGE_TRACKING_ENABLED,
            liveSmokeTestEnabled=settings.AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED,
            concurrencyLimit=settings.AI_PROVIDER_MAX_ACTIVE_VIDEO_JOBS,
            pollIntervalSeconds=settings.AI_VIDEO_PROVIDER_POLL_INTERVAL_SECONDS,
            maxPollAttempts=settings.AI_VIDEO_PROVIDER_MAX_POLL_ATTEMPTS,
        ),
        renderProvider=ProviderStatusBlock(
            provider=settings.AI_RENDER_PROVIDER,
            enabled=render_enabled,
            configured=True,
            model=None,
            timeoutSeconds=settings.AI_RENDER_TIMEOUT_SECONDS,
            maxRetries=None,
            safeError=None if render_enabled else "CREATIVE_RENDER_DISABLED",
        ),
    )
