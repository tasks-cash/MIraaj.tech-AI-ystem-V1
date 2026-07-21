"""Mocked httpx tests for Runway video provider — no real network."""

from __future__ import annotations

import json

import httpx
import pytest

from app.models.creative_schemas import GenerateVideoInput
from app.services.creative.runway_video_provider import (
    RunwayVideoGenerationProvider,
    runway_duration_seconds,
    runway_ratio_for_dimensions,
)
from tests.conftest import runway_settings


def _mock_client(handler: httpx.MockTransport) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=handler, base_url="https://api.dev.runwayml.com")


@pytest.mark.asyncio
async def test_live_requests_blocked() -> None:
    provider = RunwayVideoGenerationProvider(runway_settings(), allow_live_requests=False)
    with pytest.raises(RuntimeError, match="Live Runway video requests are disabled"):
        await provider.generate_video(GenerateVideoInput(prompt="Product demo"))


@pytest.mark.asyncio
async def test_runway_submit_returns_pending() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/v1/text_to_video"
        assert request.headers.get("Authorization", "").startswith("Bearer ")
        assert request.headers.get("X-Runway-Version") == "2024-11-06"
        body = json.loads(request.content.decode())
        assert body["model"] == "gen3a_turbo"
        assert "promptText" in body
        assert "duration" in body
        assert "ratio" in body
        return httpx.Response(200, json={"id": "task_abc123"})

    provider = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    result = await provider.generate_video(
        GenerateVideoInput(prompt="Kitchen ambience", width=1280, height=720, durationSeconds=5)
    )
    assert result.provider == "runway"
    assert result.status == "provider_pending"
    assert result.providerJobId == "task_abc123"
    assert result.media is None
    assert result.usage is not None
    assert result.usage.costUnknown is True
    assert "rw-" not in repr(provider)


@pytest.mark.asyncio
async def test_runway_poll_succeeded_with_output_url() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(f"{request.method}:{request.url.path}")
        if request.method == "GET":
            return httpx.Response(
                200,
                json={
                    "id": "task_abc123",
                    "status": "SUCCEEDED",
                    "output": ["https://cdn.runway.example/out.mp4?sig=secret"],
                },
            )
        return httpx.Response(404)

    provider = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    status = await provider.get_job_status("task_abc123")
    assert status.status == "completed"
    assert status.outputUrl is not None
    assert status.outputUrl.startswith("https://")
    assert "GET:/v1/tasks/task_abc123" in calls


@pytest.mark.asyncio
async def test_runway_poll_pending_and_failed() -> None:
    def pending(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": "t1", "status": "RUNNING"})

    provider = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(pending)),
        allow_live_requests=True,
    )
    status = await provider.get_job_status("t1")
    assert status.status == "provider_pending"

    def failed(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": "t2", "status": "FAILED", "failure": "boom"})

    provider2 = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(failed)),
        allow_live_requests=True,
    )
    failed_status = await provider2.get_job_status("t2")
    assert failed_status.status == "failed"
    assert failed_status.safeErrorCode == "provider_job_failed"


@pytest.mark.asyncio
async def test_runway_succeeded_missing_output() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": "t3", "status": "SUCCEEDED", "output": []})

    provider = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    status = await provider.get_job_status("t3")
    assert status.status == "failed"
    assert status.safeErrorCode == "provider_output_missing"


@pytest.mark.asyncio
async def test_runway_401_and_429() -> None:
    def auth(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorized"})

    provider = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(auth)),
        allow_live_requests=True,
    )
    result = await provider.generate_video(GenerateVideoInput(prompt="x"))
    assert result.safeErrorCode == "authentication_failed"

    def limited(_: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": "rate"})

    provider2 = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(limited)),
        allow_live_requests=True,
    )
    result2 = await provider2.generate_video(GenerateVideoInput(prompt="x"))
    assert result2.safeErrorCode == "rate_limited"


@pytest.mark.asyncio
async def test_runway_timeout_on_submit() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out")

    provider = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    result = await provider.generate_video(GenerateVideoInput(prompt="x"))
    assert result.safeErrorCode == "provider_timeout"


@pytest.mark.asyncio
async def test_runway_cancel_delete() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "DELETE"
        assert request.url.path == "/v1/tasks/task_cancel"
        return httpx.Response(204)

    provider = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    cancelled = await provider.cancel_job("task_cancel")
    assert cancelled.status == "cancelled"
    assert cancelled.safeErrorCode == "provider_cancelled"


@pytest.mark.asyncio
async def test_runway_cancel_not_supported() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(405, json={"error": "method not allowed"})

    provider = RunwayVideoGenerationProvider(
        runway_settings(),
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    cancelled = await provider.cancel_job("task_x")
    assert cancelled.status == "cancelled"
    assert cancelled.safeErrorCode == "not_supported"


@pytest.mark.asyncio
async def test_runway_health() -> None:
    health = await RunwayVideoGenerationProvider(
        runway_settings(), allow_live_requests=False
    ).health_check()
    assert health["provider"] == "runway"
    assert health["configured"] is True


def test_ratio_and_duration_helpers() -> None:
    assert runway_ratio_for_dimensions(1280, 720) == "1280:720"
    assert runway_ratio_for_dimensions(720, 1280) == "720:1280"
    assert runway_ratio_for_dimensions(900, 900) == "960:960"
    assert runway_duration_seconds(1.0) == 2
    assert runway_duration_seconds(5.4) == 5
    assert runway_duration_seconds(99) == 10
