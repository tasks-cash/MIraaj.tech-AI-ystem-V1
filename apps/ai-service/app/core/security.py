import hmac
import time
from collections.abc import Mapping
from dataclasses import dataclass
from hashlib import sha256
from threading import Lock

from .config import Settings


@dataclass(frozen=True)
class VerifiedInternalRequest:
    service_id: str
    timestamp: int
    request_id: str
    correlation_id: str
    idempotency_key: str
    body_sha256: str


class InternalAuthenticationError(ValueError):
    """Raised when a service-to-service signature cannot be trusted."""


class InternalReplayCache:
    """Bounded, per-process replay protection for signed internal requests."""

    def __init__(self, max_entries: int = 10_000) -> None:
        self._entries: dict[str, int] = {}
        self._max_entries = max_entries
        self._lock = Lock()

    def check_and_store(
        self,
        *,
        service_id: str,
        idempotency_key: str,
        now: int,
        replay_window_seconds: int,
    ) -> None:
        if not idempotency_key:
            return

        cache_key = f"{service_id}:{idempotency_key}"
        with self._lock:
            expired = [key for key, expires_at in self._entries.items() if expires_at <= now]
            for key in expired:
                del self._entries[key]

            if cache_key in self._entries:
                raise InternalAuthenticationError("Internal request was replayed.")

            if len(self._entries) >= self._max_entries:
                oldest_key = min(self._entries, key=self._entries.__getitem__)
                del self._entries[oldest_key]
            self._entries[cache_key] = now + replay_window_seconds

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


internal_replay_cache = InternalReplayCache()


def body_sha256(body: bytes) -> str:
    return sha256(body).hexdigest()


def canonical_request(
    *,
    method: str,
    path: str,
    service_id: str,
    timestamp: int,
    request_id: str,
    correlation_id: str,
    idempotency_key: str,
    content_sha256: str,
) -> str:
    return "\n".join(
        [
            method.upper(),
            path,
            service_id,
            str(timestamp),
            request_id,
            correlation_id,
            idempotency_key,
            content_sha256,
        ]
    )


def verify_internal_request(
    *,
    method: str,
    path: str,
    body: bytes,
    headers: Mapping[str, str],
    settings: Settings,
    now: int | None = None,
    replay_cache: InternalReplayCache | None = None,
) -> VerifiedInternalRequest:
    normalized = {key.lower(): value for key, value in headers.items()}
    required = {
        "x-miraaj-service",
        "x-miraaj-timestamp",
        "x-miraaj-request-id",
        "x-miraaj-correlation-id",
        "x-miraaj-content-sha256",
        "x-miraaj-signature",
    }
    if not required.issubset(normalized):
        raise InternalAuthenticationError("Missing internal authentication headers.")

    required_values = (
        "x-miraaj-service",
        "x-miraaj-timestamp",
        "x-miraaj-request-id",
        "x-miraaj-correlation-id",
        "x-miraaj-content-sha256",
        "x-miraaj-signature",
    )
    if any(not normalized[header].strip() for header in required_values):
        raise InternalAuthenticationError("Missing request ID.")

    service_id = normalized["x-miraaj-service"]
    if service_id not in settings.allowed_service_ids:
        raise InternalAuthenticationError("Internal service is not allowed.")

    try:
        timestamp = int(normalized["x-miraaj-timestamp"])
    except ValueError as error:
        raise InternalAuthenticationError("Invalid internal timestamp.") from error

    current_time = now if now is not None else int(time.time())
    if abs(current_time - timestamp) > settings.AI_SERVICE_REPLAY_WINDOW_SECONDS:
        raise InternalAuthenticationError("Internal request timestamp has expired.")

    idempotency_key = normalized.get("idempotency-key", "").strip()
    if method.upper() in {"POST", "PUT", "PATCH", "DELETE"} and not idempotency_key:
        raise InternalAuthenticationError("Mutating internal requests require an idempotency key.")

    expected_body_hash = body_sha256(body)
    supplied_body_hash = normalized["x-miraaj-content-sha256"]
    if not hmac.compare_digest(expected_body_hash, supplied_body_hash):
        raise InternalAuthenticationError("Internal request body hash is invalid.")

    canonical = canonical_request(
        method=method,
        path=path,
        service_id=service_id,
        timestamp=timestamp,
        request_id=normalized["x-miraaj-request-id"],
        correlation_id=normalized["x-miraaj-correlation-id"],
        idempotency_key=idempotency_key,
        content_sha256=supplied_body_hash,
    )
    expected_signature = hmac.new(
        settings.AI_SERVICE_INTERNAL_SECRET.get_secret_value().encode(),
        canonical.encode(),
        sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, normalized["x-miraaj-signature"]):
        raise InternalAuthenticationError("Internal request signature is invalid.")

    if replay_cache is not None:
        replay_cache.check_and_store(
            service_id=service_id,
            idempotency_key=idempotency_key,
            now=current_time,
            replay_window_seconds=settings.AI_SERVICE_REPLAY_WINDOW_SECONDS,
        )

    return VerifiedInternalRequest(
        service_id=service_id,
        timestamp=timestamp,
        request_id=normalized["x-miraaj-request-id"],
        correlation_id=normalized["x-miraaj-correlation-id"],
        idempotency_key=idempotency_key,
        body_sha256=supplied_body_hash,
    )
