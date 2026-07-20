from __future__ import annotations

from time import perf_counter

import structlog
from fastapi import APIRouter, Request

from app.core.config import Settings, get_settings
from app.models.intelligence_schemas import (
    BusinessProfileResponse,
    BusinessReasoningInput,
    BusinessReasoningOutput,
    ContradictionsResponse,
    NeedsResponse,
    ReasoningProviderStatusResponse,
)
from app.services.intelligence.disabled_provider import DisabledBusinessReasoningProvider
from app.services.intelligence.gemini_provider import GeminiBusinessReasoningProvider
from app.services.intelligence.provider import BusinessReasoningProvider

router = APIRouter(prefix="/internal/v1/intelligence", tags=["internal-intelligence"])
logger = structlog.get_logger()

_INPUT_TOO_LARGE = "INPUT_TOO_LARGE"
_PROVIDER_FAILED = "REASONING_PROVIDER_FAILED"


def _settings() -> Settings:
    return get_settings()


def _reasoning_provider(settings: Settings) -> BusinessReasoningProvider:
    if settings.ai_reasoning_provider_active:
        return GeminiBusinessReasoningProvider(settings, allow_live_requests=False)
    return DisabledBusinessReasoningProvider(settings)


def _input_size_error(payload: BusinessReasoningInput, settings: Settings) -> str | None:
    total_chars = len(payload.additionalContext or "")
    if payload.ocrSummary:
        total_chars += len(payload.ocrSummary.normalizedTextSummary or "")
    if total_chars > settings.AI_REASONING_MAX_INPUT_CHARS:
        return _INPUT_TOO_LARGE
    return None


async def _run_reasoning(
    payload: BusinessReasoningInput,
    request: Request,
    *,
    route_name: str,
) -> tuple[BusinessReasoningOutput | None, int, str | None, str | None]:
    settings = _settings()
    started = perf_counter()

    size_error = _input_size_error(payload, settings)
    if size_error:
        return (
            None,
            max(0, round((perf_counter() - started) * 1_000)),
            size_error,
            "Input exceeds the maximum allowed size.",
        )

    provider = _reasoning_provider(settings)
    try:
        output = await provider.analyze(payload)
    except (RuntimeError, ValueError):
        logger.warning(
            "intelligence_provider_failed",
            route=request.url.path,
            request_id=request.headers.get("x-miraaj-request-id"),
            safe_error_code=_PROVIDER_FAILED,
        )
        return (
            None,
            max(0, round((perf_counter() - started) * 1_000)),
            _PROVIDER_FAILED,
            "Business reasoning provider failed.",
        )

    logger.info(
        f"intelligence_{route_name}_completed",
        route=request.url.path,
        provider=output.provider,
        requires_review=output.requiresReview,
        request_id=request.headers.get("x-miraaj-request-id"),
    )
    return output, max(0, round((perf_counter() - started) * 1_000)), None, None


@router.post("/business-profile")
async def business_profile(
    request_body: BusinessReasoningInput, request: Request
) -> BusinessProfileResponse:
    output, processing_ms, error_code, safe_message = await _run_reasoning(
        request_body, request, route_name="business_profile"
    )
    if output is None:
        return BusinessProfileResponse(
            accepted=False,
            errorCode=error_code,
            safeMessage=safe_message,
            processingMs=processing_ms,
        )
    return BusinessProfileResponse(
        accepted=True,
        provider=output.provider,
        model=output.model,
        rankedBusinessTypes=output.rankedBusinessTypes,
        rankedAudienceTypes=output.rankedAudienceTypes,
        decisionMakerLikelihood=output.decisionMakerLikelihood,
        promotionEligibility=output.promotionEligibility,
        regulatedDomainSignals=output.regulatedDomainSignals,
        evidence=output.evidence,
        requiresReview=output.requiresReview,
        reviewReasonCodes=output.reviewReasonCodes,
        processingMs=processing_ms,
    )


@router.post("/needs")
async def needs(request_body: BusinessReasoningInput, request: Request) -> NeedsResponse:
    output, processing_ms, error_code, safe_message = await _run_reasoning(
        request_body, request, route_name="needs"
    )
    if output is None:
        return NeedsResponse(
            accepted=False,
            errorCode=error_code,
            safeMessage=safe_message,
            processingMs=processing_ms,
        )
    return NeedsResponse(
        accepted=True,
        provider=output.provider,
        model=output.model,
        needs=output.needs,
        painPoints=output.painPoints,
        objectives=output.objectives,
        requiresReview=output.requiresReview,
        reviewReasonCodes=output.reviewReasonCodes,
        processingMs=processing_ms,
    )


@router.post("/contradictions")
async def contradictions(
    request_body: BusinessReasoningInput, request: Request
) -> ContradictionsResponse:
    output, processing_ms, error_code, safe_message = await _run_reasoning(
        request_body, request, route_name="contradictions"
    )
    if output is None:
        return ContradictionsResponse(
            accepted=False,
            errorCode=error_code,
            safeMessage=safe_message,
            processingMs=processing_ms,
        )
    return ContradictionsResponse(
        accepted=True,
        provider=output.provider,
        model=output.model,
        contradictions=output.contradictions,
        regulatedDomainSignals=output.regulatedDomainSignals,
        requiresReview=output.requiresReview,
        reviewReasonCodes=output.reviewReasonCodes,
        processingMs=processing_ms,
    )


@router.get("/providers/status")
async def providers_status() -> ReasoningProviderStatusResponse:
    settings = _settings()
    enabled = settings.ai_reasoning_provider_active
    return ReasoningProviderStatusResponse(
        provider="gemini" if enabled else "disabled",
        enabled=enabled,
        configured=settings.GEMINI_API_KEY is not None,
        model=settings.AI_REASONING_MODEL if enabled else None,
        maxRetries=settings.AI_REASONING_MAX_RETRIES,
        timeoutSeconds=settings.AI_REASONING_TIMEOUT_SECONDS,
        maxInputChars=settings.AI_REASONING_MAX_INPUT_CHARS,
        safeError=None if enabled else "REASONING_PROVIDER_DISABLED",
    )
