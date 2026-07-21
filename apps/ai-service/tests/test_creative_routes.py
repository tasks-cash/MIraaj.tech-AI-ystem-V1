"""HMAC creative routes + SSRF rejection + readiness wiring."""

from __future__ import annotations

import base64
import json

import pytest
from fastapi.testclient import TestClient

from app.core.config import reset_settings_cache
from app.core.logging import redact_value
from app.main import app
from tests.media_helpers import signed_headers, tiny_png_bytes

_MUTATING_ROUTES = (
    "/internal/v1/creative/generate-image",
    "/internal/v1/creative/generate-video",
    "/internal/v1/creative/render/image-variant",
    "/internal/v1/creative/render/text-overlay",
    "/internal/v1/creative/render/subtitles",
    "/internal/v1/creative/render/thumbnail",
    "/internal/v1/creative/validate-media",
    "/internal/v1/creative/ocr-check",
)


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def _post(
    client: TestClient, path: str, payload: dict[str, object], idempotency_key: str
) -> object:
    body = json.dumps(payload).encode()
    return client.post(
        path,
        content=body,
        headers={
            **signed_headers(body, path=path, idempotency_key=idempotency_key),
            "content-type": "application/json",
        },
    )


@pytest.mark.parametrize("path", _MUTATING_ROUTES)
def test_creative_mutating_routes_require_hmac(client: TestClient, path: str) -> None:
    response = client.post(path, json={})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INTERNAL_AUTHENTICATION_FAILED"


def test_creative_providers_status_disabled_by_default(client: TestClient) -> None:
    headers = signed_headers(
        b"", method="GET", path="/internal/v1/creative/providers/status", idempotency_key=""
    )
    del headers["idempotency-key"]
    response = client.get("/internal/v1/creative/providers/status", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["imageProvider"]["provider"] == "disabled"
    assert payload["imageProvider"]["safeError"] == "CREATIVE_PROVIDER_DISABLED"
    assert payload["videoProvider"]["provider"] == "disabled"
    assert payload["renderProvider"]["provider"] == "local"
    assert payload["renderProvider"]["enabled"] is True


def test_generate_image_disabled_shell(client: TestClient) -> None:
    response = _post(
        client,
        "/internal/v1/creative/generate-image",
        {"prompt": "Clinic exterior hero image"},
        "creative-image-disabled-1",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["data"]["status"] == "provider_unavailable"
    assert payload["data"]["media"] is None
    assert payload["data"]["safeError"] == "CREATIVE_PROVIDER_DISABLED"


def test_generate_image_mock_mode(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_IMAGE_PROVIDER", "mock")
    reset_settings_cache()
    try:
        response = _post(
            client,
            "/internal/v1/creative/generate-image",
            {"prompt": "Restaurant menu board", "width": 128, "height": 128, "seed": 3},
            "creative-image-mock-1",
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["accepted"] is True
        assert payload["data"]["provider"] == "mock"
        assert payload["data"]["media"]["isMock"] is True
        assert payload["data"]["media"]["mimeType"] == "image/png"
        assert payload["data"]["media"]["sha256"]
    finally:
        reset_settings_cache()


def test_validate_media_ssrf_block_on_retrieve(client: TestClient) -> None:
    response = _post(
        client,
        "/internal/v1/creative/validate-media",
        {"signedMediaUrl": "http://evil.example/asset.png", "expectedKind": "image"},
        "creative-validate-ssrf-1",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is False
    assert payload["errorCode"] == "INTERNAL_MEDIA_FETCH_REJECTED"


def test_validate_media_accepts_inline_png(client: TestClient) -> None:
    encoded = base64.b64encode(tiny_png_bytes()).decode("ascii")
    response = _post(
        client,
        "/internal/v1/creative/validate-media",
        {"media": {"contentBase64": encoded, "mimeType": "image/png"}},
        "creative-validate-png-1",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["data"]["kind"] == "image"
    assert payload["data"]["sha256"]


def test_render_text_overlay_arabic(client: TestClient) -> None:
    encoded = base64.b64encode(tiny_png_bytes()).decode("ascii")
    response = _post(
        client,
        "/internal/v1/creative/render/text-overlay",
        {
            "media": {"contentBase64": encoded, "mimeType": "image/png"},
            "text": "احجز الآن",
            "language": "ar",
            "direction": "auto",
        },
        "creative-overlay-ar-1",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["data"]["direction"] == "rtl"
    assert payload["data"]["media"]["byteLength"] > 0


def test_render_subtitles_en(client: TestClient) -> None:
    response = _post(
        client,
        "/internal/v1/creative/render/subtitles",
        {
            "cues": [
                {"startMs": 0, "endMs": 2000, "text": "Welcome"},
                {"startMs": 2000, "endMs": 4000, "text": "Bienvenue"},
            ],
            "formats": "both",
            "language": "en",
        },
        "creative-subs-1",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert "Welcome" in payload["data"]["srt"]
    assert payload["data"]["webvtt"].startswith("WEBVTT")


def test_ocr_check_reports_mismatch_signal(client: TestClient) -> None:
    encoded = base64.b64encode(tiny_png_bytes()).decode("ascii")
    response = _post(
        client,
        "/internal/v1/creative/ocr-check",
        {
            "media": {"contentBase64": encoded, "mimeType": "image/png"},
            "expectedText": "identity verification licensed third-party",
            "language": "en",
        },
        "creative-ocr-1",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["data"]["mismatch"] is True or payload["data"]["matched"] is True
    assert "contentBase64" not in json.dumps(payload["data"])


def test_ready_includes_creative_providers(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code in {200, 503}
    checks = response.json()["checks"]
    assert "imageProvider" in checks
    assert "videoProvider" in checks
    assert "renderProvider" in checks
    assert checks["imageProvider"]["healthy"] is True
    assert checks["videoProvider"]["healthy"] is True


def test_no_secret_values_in_redacted_creative_log_fields() -> None:
    leaked = {
        "geminiApiKey": "should-not-appear",
        "authorization": "Bearer abc",
        "sha256": "deadbeef",
        "byte_length": 12,
    }
    scrubbed = {key: redact_value(key, value) for key, value in leaked.items()}
    assert scrubbed["geminiApiKey"] == "[REDACTED]"
    assert scrubbed["authorization"] == "[REDACTED]"
    assert scrubbed["sha256"] == "deadbeef"
    assert "should-not-appear" not in json.dumps(scrubbed)
