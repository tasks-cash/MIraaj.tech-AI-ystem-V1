"""Normalize production provider HTTP/API failures into safe error codes.

These codes are safe to return to NestJS and to log — they never include
secrets, prompts, or provider response bodies.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.models.creative_enums import CreativeErrorCode

ProviderSafeErrorCode = Literal[
    "authentication_failed",
    "permission_denied",
    "invalid_request",
    "unsupported_model",
    "content_rejected",
    "rate_limited",
    "quota_exceeded",
    "provider_unavailable",
    "provider_timeout",
    "provider_job_failed",
    "provider_output_missing",
    "provider_invalid_response",
    "provider_cancelled",
    "not_supported",
    "live_requests_disabled",
]


@dataclass(frozen=True)
class NormalizedProviderError:
    code: ProviderSafeErrorCode
    creative_error: CreativeErrorCode
    retryable: bool
    http_status: int | None = None


_HTTP_MAP: dict[int, NormalizedProviderError] = {
    401: NormalizedProviderError(
        code="authentication_failed",
        creative_error="CREATIVE_PROVIDER_UNAVAILABLE",
        retryable=False,
        http_status=401,
    ),
    403: NormalizedProviderError(
        code="permission_denied",
        creative_error="CREATIVE_PROVIDER_UNAVAILABLE",
        retryable=False,
        http_status=403,
    ),
    404: NormalizedProviderError(
        code="provider_job_failed",
        creative_error="CREATIVE_PROVIDER_JOB_FAILED",
        retryable=False,
        http_status=404,
    ),
    408: NormalizedProviderError(
        code="provider_timeout",
        creative_error="CREATIVE_PROVIDER_TIMEOUT",
        retryable=True,
        http_status=408,
    ),
    429: NormalizedProviderError(
        code="rate_limited",
        creative_error="CREATIVE_PROVIDER_UNAVAILABLE",
        retryable=True,
        http_status=429,
    ),
}


def normalize_http_status(
    status_code: int,
    *,
    body_hint: str | None = None,
) -> NormalizedProviderError:
    """Map an HTTP status (+ optional body hint) to a normalized provider error."""

    if status_code in _HTTP_MAP:
        return _HTTP_MAP[status_code]

    hint = (body_hint or "").lower()
    if status_code == 400:
        if any(
            token in hint
            for token in (
                "content_policy",
                "safety",
                "moderation",
                "rejected",
                "inappropriate",
                "nsfw",
            )
        ):
            return NormalizedProviderError(
                code="content_rejected",
                creative_error="CREATIVE_PROVIDER_JOB_FAILED",
                retryable=False,
                http_status=400,
            )
        if "model" in hint and ("unsupported" in hint or "not found" in hint):
            return NormalizedProviderError(
                code="unsupported_model",
                creative_error="CREATIVE_PROVIDER_UNAVAILABLE",
                retryable=False,
                http_status=400,
            )
        return NormalizedProviderError(
            code="invalid_request",
            creative_error="CREATIVE_PROVIDER_JOB_FAILED",
            retryable=False,
            http_status=400,
        )

    if status_code == 402 or "quota" in hint or "insufficient" in hint:
        return NormalizedProviderError(
            code="quota_exceeded",
            creative_error="CREATIVE_PROVIDER_UNAVAILABLE",
            retryable=False,
            http_status=status_code,
        )

    if 500 <= status_code <= 599:
        return NormalizedProviderError(
            code="provider_unavailable",
            creative_error="CREATIVE_PROVIDER_UNAVAILABLE",
            retryable=True,
            http_status=status_code,
        )

    return NormalizedProviderError(
        code="provider_invalid_response",
        creative_error="CREATIVE_PROVIDER_UNAVAILABLE",
        retryable=False,
        http_status=status_code,
    )


def normalize_timeout() -> NormalizedProviderError:
    return NormalizedProviderError(
        code="provider_timeout",
        creative_error="CREATIVE_PROVIDER_TIMEOUT",
        retryable=True,
        http_status=None,
    )


def normalize_network() -> NormalizedProviderError:
    return NormalizedProviderError(
        code="provider_unavailable",
        creative_error="CREATIVE_PROVIDER_UNAVAILABLE",
        retryable=True,
        http_status=None,
    )


def normalize_invalid_response() -> NormalizedProviderError:
    return NormalizedProviderError(
        code="provider_invalid_response",
        creative_error="CREATIVE_PROVIDER_UNAVAILABLE",
        retryable=False,
        http_status=None,
    )


def normalize_cancelled() -> NormalizedProviderError:
    return NormalizedProviderError(
        code="provider_cancelled",
        creative_error="CREATIVE_PROVIDER_JOB_CANCELLED",
        retryable=False,
        http_status=None,
    )


def normalize_job_failed() -> NormalizedProviderError:
    return NormalizedProviderError(
        code="provider_job_failed",
        creative_error="CREATIVE_PROVIDER_JOB_FAILED",
        retryable=False,
        http_status=None,
    )


def normalize_output_missing() -> NormalizedProviderError:
    return NormalizedProviderError(
        code="provider_output_missing",
        creative_error="CREATIVE_PROVIDER_JOB_FAILED",
        retryable=False,
        http_status=None,
    )


def is_retryable(error: NormalizedProviderError) -> bool:
    return error.retryable
