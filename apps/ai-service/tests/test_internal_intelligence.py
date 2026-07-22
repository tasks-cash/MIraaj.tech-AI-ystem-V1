import json

import pytest

from app.main import app
from tests.asgi_test_client import TestClient
from tests.media_helpers import signed_headers


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def _business_profile_payload() -> dict[str, object]:
    return {
        "audienceSignals": [
            {"code": "professional_dentist", "confidence": 0.9, "evidence": ["dental chair"]},
        ],
    }


def test_business_profile_requires_hmac(client: TestClient) -> None:
    response = client.post(
        "/internal/v1/intelligence/business-profile",
        json=_business_profile_payload(),
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INTERNAL_AUTHENTICATION_FAILED"


def test_business_profile_with_valid_hmac(client: TestClient) -> None:
    body = json.dumps(_business_profile_payload()).encode()
    response = client.post(
        "/internal/v1/intelligence/business-profile",
        content=body,
        headers={
            **signed_headers(
                body,
                path="/internal/v1/intelligence/business-profile",
                idempotency_key="intel-profile-1",
            ),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["rankedAudienceTypes"][0]["code"] == "professional_dentist"
    assert payload["promotionEligibility"]["status"] == "eligible_b2b"


def test_business_profile_with_invalid_signature_is_rejected(client: TestClient) -> None:
    body = json.dumps(_business_profile_payload()).encode()
    headers = signed_headers(
        body,
        path="/internal/v1/intelligence/business-profile",
        idempotency_key="intel-profile-2",
    )
    headers["x-miraaj-signature"] = "0" * 64
    response = client.post(
        "/internal/v1/intelligence/business-profile",
        content=body,
        headers={**headers, "content-type": "application/json"},
    )
    assert response.status_code == 401


def test_needs_route_returns_needs_for_decision_maker_audience(client: TestClient) -> None:
    body = json.dumps(
        {"audienceSignals": [{"code": "restaurant_owner", "confidence": 0.85}]}
    ).encode()
    response = client.post(
        "/internal/v1/intelligence/needs",
        content=body,
        headers={
            **signed_headers(
                body, path="/internal/v1/intelligence/needs", idempotency_key="intel-needs-1"
            ),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["needs"]


def test_needs_route_requires_hmac(client: TestClient) -> None:
    response = client.post("/internal/v1/intelligence/needs", json={})
    assert response.status_code == 401


def test_contradictions_route_flags_conflicting_signals(client: TestClient) -> None:
    body = json.dumps(
        {
            "audienceSignals": [
                {"code": "restaurant_owner", "confidence": 0.55},
                {"code": "consumer", "confidence": 0.5},
            ]
        }
    ).encode()
    response = client.post(
        "/internal/v1/intelligence/contradictions",
        content=body,
        headers={
            **signed_headers(
                body,
                path="/internal/v1/intelligence/contradictions",
                idempotency_key="intel-contradictions-1",
            ),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is True
    assert payload["contradictions"]
    assert payload["requiresReview"] is True


def test_contradictions_route_requires_hmac(client: TestClient) -> None:
    response = client.post("/internal/v1/intelligence/contradictions", json={})
    assert response.status_code == 401


def test_intelligence_provider_status_requires_hmac(client: TestClient) -> None:
    response = client.get("/internal/v1/intelligence/providers/status")
    assert response.status_code == 401


def test_intelligence_provider_status_disabled_by_default(client: TestClient) -> None:
    headers = signed_headers(
        b"",
        method="GET",
        path="/internal/v1/intelligence/providers/status",
        idempotency_key="",
    )
    del headers["idempotency-key"]
    response = client.get("/internal/v1/intelligence/providers/status", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "disabled"
    assert payload["enabled"] is False
    assert payload["safeError"] == "REASONING_PROVIDER_DISABLED"


def test_ready_reports_intelligence_provider_status(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code in {200, 503}
    payload = response.json()
    assert "intelligenceProvider" in payload["checks"]
    assert payload["checks"]["intelligenceProvider"] == {
        "configured": False,
        "required": False,
        "healthy": True,
        "latencyMs": 0,
        "safeError": None,
    }


def test_business_profile_input_too_large_is_rejected(client: TestClient) -> None:
    from app.core.config import get_settings

    max_chars = get_settings().AI_REASONING_MAX_INPUT_CHARS
    oversized_payload = {
        "audienceSignals": [{"code": "consumer", "confidence": 0.5}],
        "additionalContext": "x" * (max_chars + 10),
    }
    body = json.dumps(oversized_payload).encode()
    response = client.post(
        "/internal/v1/intelligence/business-profile",
        content=body,
        headers={
            **signed_headers(
                body,
                path="/internal/v1/intelligence/business-profile",
                idempotency_key="intel-profile-oversized",
            ),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted"] is False
    assert payload["errorCode"] == "INPUT_TOO_LARGE"
