import hmac
import time
from hashlib import sha256

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings, get_settings, reset_settings_cache
from app.core.logging import redact_value
from app.core.security import (
    InternalAuthenticationError,
    InternalReplayCache,
    body_sha256,
    canonical_request,
    verify_internal_request,
)
from app.main import app


def signed_headers(
    body: bytes,
    *,
    timestamp: int = 1_721_000_000,
    method: str = "POST",
    path: str = "/v1/analysis/jobs",
    idempotency_key: str = "analysis-123",
) -> dict[str, str]:
    settings = get_settings()
    request_id = "23a9022a-6d80-4a1e-b6a8-ea13bea7371e"
    correlation_id = "corr-23a9022a"
    content_hash = body_sha256(body)
    canonical = canonical_request(
        method=method,
        path=path,
        service_id="miraaj-api",
        timestamp=timestamp,
        request_id=request_id,
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
        content_sha256=content_hash,
    )
    signature = hmac.new(
        settings.AI_SERVICE_INTERNAL_SECRET.get_secret_value().encode(),
        canonical.encode(),
        sha256,
    ).hexdigest()
    return {
        "x-miraaj-service": "miraaj-api",
        "x-miraaj-timestamp": str(timestamp),
        "x-miraaj-request-id": request_id,
        "x-miraaj-correlation-id": correlation_id,
        "idempotency-key": idempotency_key,
        "x-miraaj-content-sha256": content_hash,
        "x-miraaj-signature": signature,
    }


def test_valid_internal_signature() -> None:
    body = b'{"sourceType":"image"}'
    result = verify_internal_request(
        method="POST",
        path="/v1/analysis/jobs",
        body=body,
        headers=signed_headers(body),
        settings=get_settings(),
        now=1_721_000_030,
    )
    assert result.service_id == "miraaj-api"
    assert result.request_id == "23a9022a-6d80-4a1e-b6a8-ea13bea7371e"
    assert result.body_sha256 == (
        "46fbddc8f45dd5956c649cedcf6c1226a4f6063a97a0a4d8314a9d2281b0d699"
    )
    assert signed_headers(body)["x-miraaj-signature"] == (
        "284a49f524deefad36e871f8c71f6eb5820bac81c607edd3fdcd41c0647426ab"
    )


def test_invalid_signature_is_rejected() -> None:
    body = b'{"sourceType":"image"}'
    headers = signed_headers(body)
    headers["x-miraaj-signature"] = "0" * 64
    with pytest.raises(InternalAuthenticationError):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs",
            body=body,
            headers=headers,
            settings=get_settings(),
            now=1_721_000_030,
        )


def test_modified_body_is_rejected() -> None:
    original_body = b'{"sourceType":"image"}'
    with pytest.raises(InternalAuthenticationError, match="body hash"):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs",
            body=b'{"sourceType":"modified"}',
            headers=signed_headers(original_body),
            settings=get_settings(),
            now=1_721_000_030,
        )


def test_modified_path_is_rejected() -> None:
    body = b'{"sourceType":"image"}'
    with pytest.raises(InternalAuthenticationError, match="signature"):
        verify_internal_request(
            method="POST",
            path="/v1/different-route",
            body=body,
            headers=signed_headers(body),
            settings=get_settings(),
            now=1_721_000_030,
        )


def test_query_string_is_part_of_signed_canonical_route() -> None:
    body = b'{"sourceType":"image"}'
    signed_path = "/v1/analysis/jobs?mode=safe"
    result = verify_internal_request(
        method="POST",
        path=signed_path,
        body=body,
        headers=signed_headers(body, path=signed_path),
        settings=get_settings(),
        now=1_721_000_030,
    )
    assert result.service_id == "miraaj-api"

    with pytest.raises(InternalAuthenticationError, match="signature"):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs?mode=modified",
            body=body,
            headers=signed_headers(body, path=signed_path),
            settings=get_settings(),
            now=1_721_000_030,
        )


def test_middleware_verifies_raw_query_string() -> None:
    signed_path = "/v1/not-implemented?mode=safe"
    timestamp = int(time.time())
    valid_headers = signed_headers(
        b"",
        timestamp=timestamp,
        method="GET",
        path=signed_path,
        idempotency_key="query-valid-request",
    )
    tampered_headers = signed_headers(
        b"",
        timestamp=timestamp,
        method="GET",
        path=signed_path,
        idempotency_key="query-tampered-request",
    )
    with TestClient(app) as client:
        valid_response = client.get(signed_path, headers=valid_headers)
        tampered_response = client.get(
            "/v1/not-implemented?mode=modified",
            headers=tampered_headers,
        )
    assert valid_response.status_code == 404
    assert tampered_response.status_code == 401
    assert tampered_response.json()["error"]["code"] == ("INTERNAL_AUTHENTICATION_FAILED")


def test_modified_method_is_rejected() -> None:
    body = b'{"sourceType":"image"}'
    with pytest.raises(InternalAuthenticationError, match="signature"):
        verify_internal_request(
            method="PUT",
            path="/v1/analysis/jobs",
            body=body,
            headers=signed_headers(body),
            settings=get_settings(),
            now=1_721_000_030,
        )


def test_expired_timestamp_is_rejected() -> None:
    body = b'{"sourceType":"image"}'
    with pytest.raises(InternalAuthenticationError, match="expired"):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs",
            body=body,
            headers=signed_headers(body, timestamp=1_000_000_000),
            settings=get_settings(),
            now=1_721_000_000,
        )


def test_future_timestamp_outside_clock_skew_is_rejected() -> None:
    body = b'{"sourceType":"image"}'
    with pytest.raises(InternalAuthenticationError, match="expired"):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs",
            body=body,
            headers=signed_headers(body, timestamp=1_721_001_000),
            settings=get_settings(),
            now=1_721_000_000,
        )


def test_timestamp_at_clock_skew_boundary_is_accepted() -> None:
    body = b'{"sourceType":"image"}'
    result = verify_internal_request(
        method="POST",
        path="/v1/analysis/jobs",
        body=body,
        headers=signed_headers(body, timestamp=1_721_000_120),
        settings=get_settings(),
        now=1_721_000_000,
    )
    assert result.timestamp == 1_721_000_120


def test_missing_request_id_is_rejected() -> None:
    body = b'{"sourceType":"image"}'
    headers = signed_headers(body)
    del headers["x-miraaj-request-id"]
    with pytest.raises(InternalAuthenticationError, match="Missing"):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs",
            body=body,
            headers=headers,
            settings=get_settings(),
            now=1_721_000_030,
        )


def test_missing_signed_header_is_rejected() -> None:
    body = b'{"sourceType":"image"}'
    headers = signed_headers(body)
    del headers["x-miraaj-content-sha256"]
    with pytest.raises(InternalAuthenticationError, match="Missing"):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs",
            body=body,
            headers=headers,
            settings=get_settings(),
            now=1_721_000_030,
        )


def test_unknown_service_id_is_rejected() -> None:
    body = b'{"sourceType":"image"}'
    headers = signed_headers(body)
    headers["x-miraaj-service"] = "unknown-service"
    with pytest.raises(InternalAuthenticationError, match="not allowed"):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs",
            body=body,
            headers=headers,
            settings=get_settings(),
            now=1_721_000_030,
        )


def test_mutating_request_requires_idempotency_key() -> None:
    body = b'{"sourceType":"image"}'
    headers = signed_headers(body, idempotency_key="")
    del headers["idempotency-key"]
    with pytest.raises(InternalAuthenticationError, match="idempotency"):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs",
            body=body,
            headers=headers,
            settings=get_settings(),
            now=1_721_000_030,
        )


def test_safe_get_can_omit_idempotency_key() -> None:
    headers = signed_headers(
        b"",
        method="GET",
        path="/v1/status",
        idempotency_key="",
    )
    del headers["idempotency-key"]
    result = verify_internal_request(
        method="GET",
        path="/v1/status",
        body=b"",
        headers=headers,
        settings=get_settings(),
        now=1_721_000_030,
    )
    assert result.idempotency_key == ""


def test_idempotent_request_replay_is_rejected() -> None:
    body = b'{"sourceType":"image"}'
    headers = signed_headers(body)
    replay_cache = InternalReplayCache()
    verify_internal_request(
        method="POST",
        path="/v1/analysis/jobs",
        body=body,
        headers=headers,
        settings=get_settings(),
        now=1_721_000_030,
        replay_cache=replay_cache,
    )
    with pytest.raises(InternalAuthenticationError, match="replayed"):
        verify_internal_request(
            method="POST",
            path="/v1/analysis/jobs",
            body=body,
            headers=headers,
            settings=get_settings(),
            now=1_721_000_031,
            replay_cache=replay_cache,
        )


def test_replay_cache_expires_and_remains_bounded() -> None:
    replay_cache = InternalReplayCache(max_entries=1)
    replay_cache.check_and_store(
        service_id="miraaj-api",
        idempotency_key="first-request",
        now=100,
        replay_window_seconds=10,
    )
    replay_cache.check_and_store(
        service_id="miraaj-api",
        idempotency_key="second-request",
        now=101,
        replay_window_seconds=10,
    )
    replay_cache.check_and_store(
        service_id="miraaj-api",
        idempotency_key="first-request",
        now=102,
        replay_window_seconds=10,
    )
    replay_cache.check_and_store(
        service_id="miraaj-api",
        idempotency_key="first-request",
        now=112,
        replay_window_seconds=10,
    )


def test_empty_request_body_is_signed_and_verified() -> None:
    result = verify_internal_request(
        method="POST",
        path="/v1/analysis/jobs",
        body=b"",
        headers=signed_headers(b""),
        settings=get_settings(),
        now=1_721_000_030,
    )
    assert result.body_sha256 == sha256(b"").hexdigest()


def test_secret_redaction() -> None:
    payload = {
        "authorization": "Bearer secret-token",
        "requestId": "req_123",
        "ADMIN_API_TOKEN": "temporary-admin-secret",
        "adminApiToken": "camel-case-admin-secret",
        "nested": {
            "ai_service_internal_secret": "should-not-leak",
            "aiServiceInternalSecret": "camel-case-internal-secret",
            "mongodbUri": "mongodb://secret",
            "redisUrl": "redis://secret",
        },
    }
    redacted = redact_value("root", payload)
    assert redacted["authorization"] == "[REDACTED]"
    assert redacted["ADMIN_API_TOKEN"] == "[REDACTED]"
    assert redacted["adminApiToken"] == "[REDACTED]"
    assert redacted["nested"]["ai_service_internal_secret"] == "[REDACTED]"
    assert redacted["nested"]["aiServiceInternalSecret"] == "[REDACTED]"
    assert redacted["nested"]["mongodbUri"] == "[REDACTED]"
    assert redacted["nested"]["redisUrl"] == "[REDACTED]"
    assert redacted["requestId"] == "req_123"


def test_missing_environment_configuration_fails_early() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            AI_SERVICE_URL="http://localhost:8200",
            AI_SERVICE_INTERNAL_SECRET="short",
        )
    reset_settings_cache()
