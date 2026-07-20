"""Shared structured log envelope helpers for the FastAPI AI service."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.logging import redact_value

CONTENT_METADATA_KEYS = ("ocr", "campaign", "content", "prompt", "providerresponse", "rawtext")


def truncate_for_log(value: str, max_chars: int = 240) -> str:
    if len(value) <= max_chars:
        return value
    return f"{value[:max_chars]}…[truncated]"


def _should_truncate_metadata_key(key: str) -> bool:
    normalized = key.lower().replace("_", "").replace("-", "")
    return any(fragment in normalized for fragment in CONTENT_METADATA_KEYS)


def build_structured_log(
    *,
    level: str,
    event: str,
    service: str,
    environment: str,
    module: str | None = None,
    request_id: str | None = None,
    correlation_id: str | None = None,
    trace_id: str | None = None,
    span_id: str | None = None,
    actor_id: str | None = None,
    actor_role: str | None = None,
    media_id: str | None = None,
    analysis_job_id: str | None = None,
    intelligence_job_id: str | None = None,
    campaign_job_id: str | None = None,
    attempt_id: str | None = None,
    duration_ms: int | None = None,
    outcome: str | None = None,
    safe_error_code: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    sanitized_metadata: dict[str, Any] | None = None
    if metadata is not None:
        sanitized_metadata = {}
        for key, value in metadata.items():
            redacted = redact_value(key, value)
            if isinstance(redacted, str) and _should_truncate_metadata_key(key):
                sanitized_metadata[key] = truncate_for_log(redacted)
            else:
                sanitized_metadata[key] = redacted

    envelope: dict[str, Any] = {
        "timestamp": datetime.now(UTC).isoformat(),
        "level": level,
        "event": event,
        "service": service,
        "environment": environment,
    }
    optional = {
        "module": module,
        "requestId": request_id,
        "correlationId": correlation_id,
        "traceId": trace_id,
        "spanId": span_id,
        "actorId": actor_id,
        "actorRole": actor_role,
        "mediaId": media_id,
        "analysisJobId": analysis_job_id,
        "intelligenceJobId": intelligence_job_id,
        "campaignJobId": campaign_job_id,
        "attemptId": attempt_id,
        "durationMs": duration_ms,
        "outcome": outcome,
        "safeErrorCode": safe_error_code,
        "metadata": sanitized_metadata,
    }
    for key, value in optional.items():
        if value is not None:
            envelope[key] = value
    return envelope
