"""Creative image/video provider unit tests (disabled + mock)."""

from __future__ import annotations

import base64
import io

import pytest
from PIL import Image

from app.core.config import Settings, get_settings
from app.core.logging import redact_value
from app.models.creative_schemas import GenerateImageInput, GenerateVideoInput
from app.services.creative.disabled_provider import (
    DisabledImageGenerationProvider,
    DisabledVideoGenerationProvider,
)
from app.services.creative.mock_provider import (
    MockImageGenerationProvider,
    MockVideoGenerationProvider,
)


@pytest.mark.asyncio
async def test_disabled_image_returns_unavailable_without_media() -> None:
    provider = DisabledImageGenerationProvider(get_settings())
    result = await provider.generate_image(
        GenerateImageInput(prompt="Dental clinic booking funnel")
    )
    assert result.provider == "disabled"
    assert result.status == "provider_unavailable"
    assert result.media is None
    assert result.safeError == "CREATIVE_PROVIDER_DISABLED"
    assert result.requiresReview is True


@pytest.mark.asyncio
async def test_disabled_video_returns_unavailable_without_media() -> None:
    provider = DisabledVideoGenerationProvider(get_settings())
    result = await provider.generate_video(
        GenerateVideoInput(prompt="Restaurant kitchen short video")
    )
    assert result.provider == "disabled"
    assert result.status == "provider_unavailable"
    assert result.media is None
    assert result.safeError == "CREATIVE_PROVIDER_DISABLED"


@pytest.mark.asyncio
async def test_mock_image_is_deterministic_png() -> None:
    settings = get_settings()
    provider = MockImageGenerationProvider(settings)
    payload = GenerateImageInput(
        prompt="Enterprise dashboard mockup",
        width=256,
        height=128,
        seed=42,
    )
    first = await provider.generate_image(payload)
    second = await provider.generate_image(payload)

    assert first.provider == "mock"
    assert first.status == "completed"
    assert first.media is not None
    assert first.media.isMock is True
    assert first.media.mimeType == "image/png"
    assert first.media.sha256 == second.media.sha256  # type: ignore[union-attr]
    raw = base64.b64decode(first.media.contentBase64 or "")
    with Image.open(io.BytesIO(raw)) as image:
        assert image.size == (256, 128)


@pytest.mark.asyncio
async def test_mock_video_returns_mp4_or_poster_fallback() -> None:
    provider = MockVideoGenerationProvider(get_settings())
    result = await provider.generate_video(
        GenerateVideoInput(
            prompt="Product demo clip",
            width=160,
            height=90,
            durationSeconds=1.0,
            fps=4,
            seed=7,
        )
    )
    assert result.provider == "mock"
    assert result.status == "completed"
    assert result.media is not None
    assert result.media.isMock is True
    assert result.media.byteLength > 0
    assert result.media.contentBase64
    if result.media.isPosterFrameFallback:
        assert result.media.mimeType == "image/png"
        assert len(result.media.posterFramesBase64) >= 1
    else:
        assert result.media.mimeType == "video/mp4"


@pytest.mark.asyncio
async def test_mock_image_health_and_cancel() -> None:
    provider = MockImageGenerationProvider(get_settings())
    health = await provider.health_check()
    assert health["provider"] == "mock"
    assert health["safeError"] is None
    cancelled = await provider.cancel_job("job-cancel-1")
    assert cancelled.status == "cancelled"


def test_redaction_keeps_secrets_out_of_logs() -> None:
    assert redact_value("geminiApiKey", "secret-value") == "[REDACTED]"
    assert redact_value("AI_SERVICE_INTERNAL_SECRET", "x" * 40) == "[REDACTED]"
    assert redact_value("sha256", "abc123") == "abc123"


def test_settings_defaults_keep_providers_offline() -> None:
    settings = Settings(
        AI_SERVICE_INTERNAL_SECRET="test-only-internal-secret-with-32-characters",
        AI_SERVICE_URL="http://localhost:8200",
    )
    assert settings.AI_IMAGE_PROVIDER == "disabled"
    assert settings.AI_VIDEO_PROVIDER == "disabled"
    assert settings.AI_RENDER_PROVIDER == "local"
    assert settings.ai_image_provider_active is False
    assert settings.ai_video_provider_active is False
    assert settings.ai_render_provider_active is True
