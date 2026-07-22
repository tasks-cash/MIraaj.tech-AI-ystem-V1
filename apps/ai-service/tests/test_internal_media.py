import json
from unittest.mock import AsyncMock, patch

import pytest

from app.main import app
from tests.asgi_test_client import TestClient
from tests.media_helpers import inspect_payload, signed_headers, tiny_png_bytes


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_internal_route_requires_hmac(client: TestClient) -> None:
    response = client.post("/internal/v1/media/inspect", json=inspect_payload())
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INTERNAL_AUTHENTICATION_FAILED"


@patch("app.api.internal_media.fetch_signed_media", new_callable=AsyncMock)
def test_inspect_route_with_valid_hmac(mock_fetch: AsyncMock, client: TestClient) -> None:
    from app.services.media_fetch import FetchedMedia

    mock_fetch.return_value = FetchedMedia(
        content=tiny_png_bytes(),
        content_type="image/png",
        final_url="http://127.0.0.1:9200/media/test.png",
    )
    body = json.dumps(inspect_payload()).encode()
    response = client.post(
        "/internal/v1/media/inspect",
        content=body,
        headers={**signed_headers(body), "content-type": "application/json"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["metadata"]["kind"] == "image"


@patch("app.api.internal_media.fetch_signed_media", new_callable=AsyncMock)
@patch("app.services.ocr.tesseract_provider.TesseractOCRProvider.run_ocr")
@patch("app.services.ocr.tesseract_provider.TesseractOCRProvider.is_available", return_value=True)
@patch(
    "app.services.ocr.tesseract_provider.TesseractOCRProvider.installed_language_packs",
    return_value=frozenset({"eng", "ara", "fra"}),
)
def test_ocr_route_with_mocked_engine(
    _mock_packs: object,
    _mock_available: object,
    mock_run_ocr: object,
    mock_fetch: AsyncMock,
    client: TestClient,
) -> None:
    from app.models.media_schemas import LanguageDetectionSummary, OCRPage, OCRResultPayload
    from app.services.media_fetch import FetchedMedia

    mock_fetch.return_value = FetchedMedia(
        content=tiny_png_bytes(),
        content_type="image/png",
        final_url="http://127.0.0.1:9200/media/test.png",
    )
    mock_run_ocr.return_value = OCRResultPayload(
        provider="tesseract",
        providerVersion="system",
        languagesRequested=["eng"],
        languagesAvailable=["eng"],
        languagesUnavailable=[],
        pages=[
            OCRPage(
                page=1,
                width=120,
                height=40,
                rawText="Miraaj.tech",
                normalizedText="Miraaj.tech",
                averageConfidence=0.9,
            )
        ],
        rawText="Miraaj.tech",
        normalizedText="Miraaj.tech",
        detectedScripts=["Latin"],
        languageDetection=LanguageDetectionSummary(primaryLanguage="en"),
        averageConfidence=0.9,
        processingMs=10,
    )
    body = json.dumps(inspect_payload()).encode()
    response = client.post(
        "/internal/v1/media/ocr",
        content=body,
        headers={
            **signed_headers(body, path="/internal/v1/media/ocr", idempotency_key="ocr-1"),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["ocr"]["normalizedText"] == "Miraaj.tech"


def test_provider_status_requires_hmac(client: TestClient) -> None:
    response = client.get("/internal/v1/providers/status")
    assert response.status_code == 401


def test_provider_status_with_hmac(client: TestClient) -> None:
    headers = signed_headers(
        b"",
        method="GET",
        path="/internal/v1/providers/status",
        idempotency_key="",
    )
    del headers["idempotency-key"]
    response = client.get("/internal/v1/providers/status", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["vision"]["enabled"] is False
    assert "ocr" in payload
