import pytest
from fastapi.testclient import TestClient

from app.core.config import reset_settings_cache
from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "miraaj-ai-service",
        "version": "0.1.0",
        "environment": "test",
    }


def test_ready() -> None:
    with TestClient(app) as client:
        response = client.get("/ready")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["checks"]["configuration"]["healthy"] is True
    assert payload["checks"]["internalSecurity"]["healthy"] is True
    assert payload["checks"]["redis"] == {
        "configured": False,
        "required": False,
        "healthy": False,
        "latencyMs": None,
        "safeError": None,
    }


def test_ready_fails_when_required_redis_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://127.0.0.1:1")
    monkeypatch.setenv("AI_SERVICE_REDIS_REQUIRED", "true")
    monkeypatch.setenv("AI_SERVICE_DEPENDENCY_TIMEOUT_MS", "100")
    reset_settings_cache()
    try:
        with TestClient(app) as client:
            response = client.get("/ready")
        payload = response.json()
        assert response.status_code == 503
        assert payload["status"] == "not_ready"
        assert payload["checks"]["redis"]["configured"] is True
        assert payload["checks"]["redis"]["required"] is True
        assert payload["checks"]["redis"]["healthy"] is False
        assert payload["checks"]["redis"]["safeError"] == "UNAVAILABLE"
        assert "127.0.0.1" not in str(payload)
    finally:
        reset_settings_cache()


def test_version() -> None:
    with TestClient(app) as client:
        response = client.get("/version")
    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "miraaj-ai-service"
    assert payload["version"] == "0.1.0"
    assert payload["environment"] == "test"
    assert payload["buildId"] == "test-build"


def test_sensitive_routes_fail_closed_without_internal_signature() -> None:
    with TestClient(app) as client:
        response = client.post("/v1/analysis/jobs", json={"sourceType": "image"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INTERNAL_AUTHENTICATION_FAILED"
