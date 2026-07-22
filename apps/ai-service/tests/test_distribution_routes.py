import pytest

from app.core.config import reset_settings_cache
from app.main import app
from tests.asgi_test_client import TestClient
from tests.media_helpers import signed_headers


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("APP_ENV", "test")
    reset_settings_cache()
    with TestClient(app) as value:
        yield value
    reset_settings_cache()


def test_distribution_routes_require_hmac(client: TestClient) -> None:
    assert client.get("/internal/v1/distribution/status").status_code == 401
    assert client.post("/internal/v1/distribution/assets", json={}).status_code == 401


def test_distribution_status_defaults_fail_closed(client: TestClient) -> None:
    path = "/internal/v1/distribution/status"
    headers = signed_headers(b"", method="GET", path=path, idempotency_key="")
    del headers["idempotency-key"]
    response = client.get(path, headers=headers)
    assert response.status_code == 200
    assert response.json()["autoVerificationEnabled"] is False
    assert response.json()["publicPostInspectionEnabled"] is False
