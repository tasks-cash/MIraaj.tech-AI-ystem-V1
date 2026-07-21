"""Mocked httpx tests for OpenAI image provider — no real network."""

from __future__ import annotations

import base64
import json

import httpx
import pytest

from app.models.creative_schemas import GenerateImageInput
from app.services.creative.openai_image_provider import (
    OpenAIImageGenerationProvider,
    nearest_openai_size,
)
from tests.conftest import openai_settings


def _tiny_png_b64() -> str:
    # 1x1 PNG
    raw = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    return base64.b64encode(raw).decode("ascii")


def _mock_client(handler: httpx.MockTransport) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=handler, base_url="https://api.openai.com")


@pytest.mark.asyncio
async def test_live_requests_blocked_without_flag() -> None:
    settings = openai_settings()
    provider = OpenAIImageGenerationProvider(settings, allow_live_requests=False)
    with pytest.raises(RuntimeError, match="Live OpenAI image requests are disabled"):
        await provider.generate_image(GenerateImageInput(prompt="Clinic exterior"))


@pytest.mark.asyncio
async def test_openai_b64_success() -> None:
    b64 = _tiny_png_b64()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/v1/images/generations"
        assert request.headers.get("Authorization", "").startswith("Bearer ")
        body = json.loads(request.content.decode())
        assert body["model"] == "gpt-image-1"
        assert body["response_format"] == "b64_json"
        assert body["n"] == 1
        assert "size" in body
        return httpx.Response(
            200,
            json={"data": [{"b64_json": b64}], "usage": {"total_tokens": 10}},
        )

    client = _mock_client(httpx.MockTransport(handler))
    provider = OpenAIImageGenerationProvider(
        openai_settings(), client=client, allow_live_requests=True
    )
    result = await provider.generate_image(
        GenerateImageInput(prompt="Restaurant storefront", width=1024, height=1024, jobId="img-1")
    )
    assert result.provider == "openai"
    assert result.status == "completed"
    assert result.media is not None
    assert result.media.isMock is False
    assert result.media.byteLength > 0
    assert result.usage is not None
    assert result.usage.costUnknown is True
    assert "sk-" not in repr(provider)


@pytest.mark.asyncio
async def test_openai_url_only_needs_retrieve() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "url": "https://oaidalleapiprodscus.blob.core.windows.net/private/signed?sig=secret"
                    }
                ]
            },
        )

    client = _mock_client(httpx.MockTransport(handler))
    provider = OpenAIImageGenerationProvider(
        openai_settings(), client=client, allow_live_requests=True
    )
    result = await provider.generate_image(GenerateImageInput(prompt="Banner art"))
    assert result.status == "provider_pending"
    assert result.media is None
    assert result.outputUrl is not None
    assert "provider_output_url_pending_retrieve" in result.reviewReasonCodes


@pytest.mark.asyncio
async def test_openai_401_auth() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "invalid api key"}})

    provider = OpenAIImageGenerationProvider(
        openai_settings(),
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    result = await provider.generate_image(GenerateImageInput(prompt="Test"))
    assert result.status == "failed"
    assert result.safeErrorCode == "authentication_failed"


@pytest.mark.asyncio
async def test_openai_429_rate_limit() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "rate limit"}})

    settings = openai_settings(AI_IMAGE_PROVIDER_MAX_RETRIES=0)
    provider = OpenAIImageGenerationProvider(
        settings,
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    result = await provider.generate_image(GenerateImageInput(prompt="Test"))
    assert result.status == "failed"
    assert result.safeErrorCode == "rate_limited"


@pytest.mark.asyncio
async def test_openai_400_content_rejected() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400, json={"error": {"message": "content_policy_violation: rejected by safety"}}
        )

    settings = openai_settings(AI_IMAGE_PROVIDER_MAX_RETRIES=0)
    provider = OpenAIImageGenerationProvider(
        settings,
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    result = await provider.generate_image(GenerateImageInput(prompt="Unsafe"))
    assert result.status == "failed"
    assert result.safeErrorCode == "content_rejected"


@pytest.mark.asyncio
async def test_openai_400_invalid_request() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"message": "invalid size"}})

    settings = openai_settings(AI_IMAGE_PROVIDER_MAX_RETRIES=0)
    provider = OpenAIImageGenerationProvider(
        settings,
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    result = await provider.generate_image(GenerateImageInput(prompt="Test"))
    assert result.safeErrorCode == "invalid_request"


@pytest.mark.asyncio
async def test_openai_500_unavailable() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": {"message": "unavailable"}})

    settings = openai_settings(AI_IMAGE_PROVIDER_MAX_RETRIES=0)
    provider = OpenAIImageGenerationProvider(
        settings,
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    result = await provider.generate_image(GenerateImageInput(prompt="Test"))
    assert result.safeErrorCode == "provider_unavailable"


@pytest.mark.asyncio
async def test_openai_timeout() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out")

    settings = openai_settings(AI_IMAGE_PROVIDER_MAX_RETRIES=0)
    provider = OpenAIImageGenerationProvider(
        settings,
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    result = await provider.generate_image(GenerateImageInput(prompt="Test"))
    assert result.safeErrorCode == "provider_timeout"


@pytest.mark.asyncio
async def test_openai_malformed_response() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": []})

    provider = OpenAIImageGenerationProvider(
        openai_settings(),
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    result = await provider.generate_image(GenerateImageInput(prompt="Test"))
    assert result.safeErrorCode == "provider_invalid_response"


@pytest.mark.asyncio
async def test_openai_cancel_not_supported() -> None:
    provider = OpenAIImageGenerationProvider(openai_settings(), allow_live_requests=True)
    cancelled = await provider.cancel_job("job-x")
    assert cancelled.status == "cancelled"
    assert cancelled.safeErrorCode == "not_supported"


@pytest.mark.asyncio
async def test_openai_health_check() -> None:
    provider = OpenAIImageGenerationProvider(openai_settings(), allow_live_requests=False)
    health = await provider.health_check()
    assert health["provider"] == "openai"
    assert health["configured"] is True
    assert health["safeError"] is None


def test_nearest_openai_size() -> None:
    assert nearest_openai_size(1000, 1000) == "1024x1024"
    assert nearest_openai_size(800, 1600) == "1024x1792"
    assert nearest_openai_size(1600, 900) == "1792x1024"


@pytest.mark.asyncio
async def test_structured_fields_in_prompt() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(200, json={"data": [{"b64_json": _tiny_png_b64()}]})

    provider = OpenAIImageGenerationProvider(
        openai_settings(),
        client=_mock_client(httpx.MockTransport(handler)),
        allow_live_requests=True,
    )
    await provider.generate_image(
        GenerateImageInput(
            prompt="Hero visual",
            conceptTitle="Launch",
            requiredElements=["logo"],
            prohibitedElements=["celebrity"],
            brandPlacement="bottom-right",
        )
    )
    prompt = str(captured["body"]["prompt"])  # type: ignore[index]
    assert "[DATA conceptTitle]" in prompt
    assert "[DATA requiredElements]" in prompt
    assert "[POLICY]" in prompt
