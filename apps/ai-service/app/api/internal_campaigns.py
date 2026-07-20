"""Prompt 4 — campaign strategy, generation, transcreation, quality, and
compliance routes. Every route reuses the existing internal HMAC middleware
(``app/main.py``) and never touches MongoDB, never approves, and never
publishes content — NestJS remains the sole authority over approval and
publishing. Providers only suggest content and structured safety signals.
"""

from __future__ import annotations

from time import perf_counter

import structlog
from fastapi import APIRouter, Request

from app.core.config import Settings, get_settings
from app.models.campaign_schemas import (
    CampaignComplianceCheckInput,
    CampaignComplianceCheckResponse,
    CampaignGenerationInput,
    CampaignGenerationResponse,
    CampaignProviderStatusResponse,
    CampaignQualityCheckInput,
    CampaignQualityCheckResponse,
    CampaignStrategyInput,
    CampaignStrategyResponse,
    CampaignTranscreateInput,
    CampaignTranscreateResponse,
    ProviderStatusBlock,
)
from app.services.campaign.disabled_provider import DisabledCampaignGenerationProvider
from app.services.campaign.gemini_provider import GeminiCampaignGenerationProvider
from app.services.campaign.provider import CampaignGenerationProvider

router = APIRouter(prefix="/internal/v1/campaigns", tags=["internal-campaigns"])
logger = structlog.get_logger()

_INPUT_TOO_LARGE = "CAMPAIGN_INPUT_TOO_LARGE"
_PROVIDER_FAILED = "CAMPAIGN_PROVIDER_UNAVAILABLE"


def _settings() -> Settings:
    return get_settings()


def _campaign_provider(settings: Settings) -> CampaignGenerationProvider:
    if settings.ai_campaign_provider_active:
        # Live Gemini traffic stays behind an explicit provider-level flag,
        # mirroring app/api/internal_intelligence.py's _reasoning_provider —
        # routes never flip allow_live_requests on by themselves.
        return GeminiCampaignGenerationProvider(settings, allow_live_requests=False)
    return DisabledCampaignGenerationProvider(settings)


def _source_content_chars(source_content: object | None) -> int:
    if source_content is None:
        return 0
    return len(getattr(source_content, "ocrSummary", "") or "") + len(
        getattr(source_content, "additionalContext", "") or ""
    )


async def _run(
    coro_factory: object,
    *,
    settings: Settings,
    request: Request,
    route_name: str,
    input_chars: int,
) -> tuple[object | None, int, str | None, str | None]:
    started = perf_counter()

    if input_chars > settings.AI_CAMPAIGN_MAX_INPUT_CHARS:
        return (
            None,
            max(0, round((perf_counter() - started) * 1_000)),
            _INPUT_TOO_LARGE,
            "Input exceeds the maximum allowed size.",
        )

    try:
        output = await coro_factory()  # type: ignore[operator]
    except (RuntimeError, ValueError):
        logger.warning(
            f"campaign_{route_name}_provider_failed",
            route=request.url.path,
            request_id=request.headers.get("x-miraaj-request-id"),
            safe_error_code=_PROVIDER_FAILED,
        )
        return (
            None,
            max(0, round((perf_counter() - started) * 1_000)),
            _PROVIDER_FAILED,
            "Campaign provider failed.",
        )

    logger.info(
        f"campaign_{route_name}_completed",
        route=request.url.path,
        provider=getattr(output, "provider", None),
        requires_review=getattr(output, "requiresReview", None),
        request_id=request.headers.get("x-miraaj-request-id"),
    )
    return output, max(0, round((perf_counter() - started) * 1_000)), None, None


@router.post("/strategy")
async def strategy(
    request_body: CampaignStrategyInput, request: Request
) -> CampaignStrategyResponse:
    settings = _settings()
    provider = _campaign_provider(settings)
    output, processing_ms, error_code, safe_message = await _run(
        lambda: provider.strategy(request_body),
        settings=settings,
        request=request,
        route_name="strategy",
        input_chars=_source_content_chars(request_body.sourceContent),
    )
    return CampaignStrategyResponse(
        accepted=output is not None,
        data=output,
        errorCode=error_code,
        safeMessage=safe_message,
        processingMs=processing_ms,
    )


@router.post("/generate")
async def generate(
    request_body: CampaignGenerationInput, request: Request
) -> CampaignGenerationResponse:
    settings = _settings()
    provider = _campaign_provider(settings)
    output, processing_ms, error_code, safe_message = await _run(
        lambda: provider.generate(request_body),
        settings=settings,
        request=request,
        route_name="generate",
        input_chars=_source_content_chars(request_body.sourceContent),
    )
    return CampaignGenerationResponse(
        accepted=output is not None,
        data=output,
        errorCode=error_code,
        safeMessage=safe_message,
        processingMs=processing_ms,
    )


@router.post("/transcreate")
async def transcreate(
    request_body: CampaignTranscreateInput, request: Request
) -> CampaignTranscreateResponse:
    settings = _settings()
    provider = _campaign_provider(settings)
    source = request_body.sourceVariant
    input_chars = len(source.headline) + len(source.primaryText) + len(source.shortText)
    output, processing_ms, error_code, safe_message = await _run(
        lambda: provider.transcreate(request_body),
        settings=settings,
        request=request,
        route_name="transcreate",
        input_chars=input_chars,
    )
    return CampaignTranscreateResponse(
        accepted=output is not None,
        data=output,
        errorCode=error_code,
        safeMessage=safe_message,
        processingMs=processing_ms,
    )


@router.post("/quality-check")
async def quality_check(
    request_body: CampaignQualityCheckInput, request: Request
) -> CampaignQualityCheckResponse:
    settings = _settings()
    provider = _campaign_provider(settings)
    variant = request_body.variant
    input_chars = len(variant.headline) + len(variant.primaryText) + len(variant.shortText)
    output, processing_ms, error_code, safe_message = await _run(
        lambda: provider.quality_check(request_body),
        settings=settings,
        request=request,
        route_name="quality_check",
        input_chars=input_chars,
    )
    return CampaignQualityCheckResponse(
        accepted=output is not None,
        data=output,
        errorCode=error_code,
        safeMessage=safe_message,
        processingMs=processing_ms,
    )


@router.post("/compliance-check")
async def compliance_check(
    request_body: CampaignComplianceCheckInput, request: Request
) -> CampaignComplianceCheckResponse:
    settings = _settings()
    provider = _campaign_provider(settings)
    input_chars = sum(
        len(variant.headline) + len(variant.primaryText) + len(variant.shortText)
        for variant in request_body.variants
    ) + _source_content_chars(request_body.sourceContent)
    output, processing_ms, error_code, safe_message = await _run(
        lambda: provider.compliance_check(request_body),
        settings=settings,
        request=request,
        route_name="compliance_check",
        input_chars=input_chars,
    )
    return CampaignComplianceCheckResponse(
        accepted=output is not None,
        data=output,
        errorCode=error_code,
        safeMessage=safe_message,
        processingMs=processing_ms,
    )


@router.get("/providers/status")
async def providers_status() -> CampaignProviderStatusResponse:
    settings = _settings()
    campaign_enabled = settings.ai_campaign_provider_active
    translation_enabled = settings.ai_translation_provider_active
    return CampaignProviderStatusResponse(
        campaignProvider=ProviderStatusBlock(
            provider="gemini" if campaign_enabled else "disabled",
            enabled=campaign_enabled,
            configured=settings.GEMINI_API_KEY is not None,
            model=settings.AI_CAMPAIGN_MODEL if campaign_enabled else None,
            timeoutSeconds=settings.AI_CAMPAIGN_PROVIDER_TIMEOUT_SECONDS,
            maxRetries=settings.AI_CAMPAIGN_PROVIDER_MAX_RETRIES,
            maxInputChars=settings.AI_CAMPAIGN_MAX_INPUT_CHARS,
            maxOutputChars=settings.AI_CAMPAIGN_MAX_OUTPUT_CHARS,
            safeError=None if campaign_enabled else "CAMPAIGN_PROVIDER_DISABLED",
        ),
        translationProvider=ProviderStatusBlock(
            provider="gemini" if translation_enabled else "disabled",
            enabled=translation_enabled,
            configured=settings.GEMINI_API_KEY is not None,
            model=settings.AI_TRANSLATION_MODEL if translation_enabled else None,
            timeoutSeconds=settings.AI_TRANSLATION_TIMEOUT_SECONDS,
            maxRetries=settings.AI_TRANSLATION_MAX_RETRIES,
            maxInputChars=None,
            maxOutputChars=None,
            safeError=None if translation_enabled else "TRANSLATION_PROVIDER_DISABLED",
        ),
    )
