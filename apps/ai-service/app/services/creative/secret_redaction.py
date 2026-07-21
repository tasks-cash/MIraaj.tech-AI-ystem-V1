"""Redact provider secrets, bearer tokens, and signed URLs for safe logging."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

_REDACTED = "[REDACTED]"

_BEARER_RE = re.compile(r"\bBearer\s+[A-Za-z0-9._\-+=/]+", re.IGNORECASE)
_API_KEY_RE = re.compile(
    r"\b(?:sk-|rk-|key-)[A-Za-z0-9]{8,}\b|\b(?:api[_-]?key|secret)\s*[:=]\s*\S+",
    re.IGNORECASE,
)
_URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)

_SENSITIVE_NORMALIZED = frozenset(
    {
        "authorization",
        "apikey",
        "secret",
        "token",
        "password",
        "bearer",
        "credentials",
        "geminiapikey",
        "aiimageproviderapikey",
        "aivideoproviderapikey",
        "signedmediaurl",
        "outputurl",
        "contentbase64",
    }
)


def _key_is_sensitive(key: str) -> bool:
    normalized = key.lower().replace("-", "").replace("_", "")
    if normalized in _SENSITIVE_NORMALIZED:
        return True
    return any(
        fragment in normalized
        for fragment in (
            "apikey",
            "secret",
            "token",
            "password",
            "authorization",
            "bearer",
            "outputurl",
            "signedurl",
            "contentbase64",
            "b64json",
        )
    )


def redact_url(url: str | None) -> str | None:
    """Strip query/fragment and path details from provider/media URLs."""

    if url is None:
        return None
    if not url.strip():
        return url
    try:
        parsed = urlparse(url)
        if parsed.scheme and parsed.hostname:
            return f"{parsed.scheme}://{parsed.hostname}/[REDACTED]"
    except ValueError:
        pass
    return _REDACTED


def redact_text(value: str) -> str:
    """Redact bearer tokens, API-key-shaped strings, and URLs inside free text."""

    redacted = _BEARER_RE.sub(f"Bearer {_REDACTED}", value)
    redacted = _API_KEY_RE.sub(_REDACTED, redacted)

    def _url_sub(match: re.Match[str]) -> str:
        return redact_url(match.group(0)) or _REDACTED

    return _URL_RE.sub(_url_sub, redacted)


def redact_provider_value(key: str, value: Any) -> Any:
    """Recursively redact sensitive keys and URL/secret-shaped values."""

    if _key_is_sensitive(key):
        return _REDACTED
    if isinstance(value, dict):
        return {
            nested_key: redact_provider_value(nested_key, nested_value)
            for nested_key, nested_value in value.items()
        }
    if isinstance(value, list):
        return [redact_provider_value(key, item) for item in value]
    if isinstance(value, str):
        if value.startswith(("http://", "https://")):
            return redact_url(value)
        if "Bearer " in value or value.startswith(("sk-", "rk-")):
            return redact_text(value)
        return value
    return value


def scrub_for_logs(payload: dict[str, Any]) -> dict[str, Any]:
    """Return a shallow-copied dict safe for structured logging."""

    return {key: redact_provider_value(key, value) for key, value in payload.items()}
