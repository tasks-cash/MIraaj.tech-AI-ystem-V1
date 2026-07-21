"""Resolve creative providers from settings (disabled | mock | openai | runway | local)."""

from __future__ import annotations

import httpx

from app.core.config import Settings
from app.services.creative.disabled_provider import (
    DisabledImageGenerationProvider,
    DisabledVideoGenerationProvider,
)
from app.services.creative.local_render import (
    DisabledMediaRenderingProvider,
    LocalMediaRenderingProvider,
)
from app.services.creative.mock_provider import (
    MockImageGenerationProvider,
    MockVideoGenerationProvider,
)
from app.services.creative.openai_image_provider import OpenAIImageGenerationProvider
from app.services.creative.provider import (
    ImageGenerationProvider,
    MediaRenderingProvider,
    VideoGenerationProvider,
)
from app.services.creative.runway_video_provider import RunwayVideoGenerationProvider


def resolve_image_provider(
    settings: Settings,
    *,
    client: httpx.AsyncClient | None = None,
    allow_live_requests: bool | None = None,
) -> ImageGenerationProvider:
    if settings.AI_IMAGE_PROVIDER == "mock":
        return MockImageGenerationProvider(settings)
    if settings.AI_IMAGE_PROVIDER == "openai":
        key_present = settings.AI_IMAGE_PROVIDER_API_KEY is not None
        if allow_live_requests is None:
            # Runtime: live when key present and not in automated test env,
            # unless an injected client is supplied (mocked httpx in tests).
            allow_live = key_present and (settings.APP_ENV != "test" or client is not None)
        else:
            allow_live = allow_live_requests
        return OpenAIImageGenerationProvider(
            settings,
            client=client,
            allow_live_requests=allow_live,
        )
    return DisabledImageGenerationProvider(settings)


def resolve_video_provider(
    settings: Settings,
    *,
    client: httpx.AsyncClient | None = None,
    allow_live_requests: bool | None = None,
) -> VideoGenerationProvider:
    if settings.AI_VIDEO_PROVIDER == "mock":
        return MockVideoGenerationProvider(settings)
    if settings.AI_VIDEO_PROVIDER == "runway":
        key_present = settings.AI_VIDEO_PROVIDER_API_KEY is not None
        if allow_live_requests is None:
            allow_live = key_present and (settings.APP_ENV != "test" or client is not None)
        else:
            allow_live = allow_live_requests
        return RunwayVideoGenerationProvider(
            settings,
            client=client,
            allow_live_requests=allow_live,
        )
    return DisabledVideoGenerationProvider(settings)


def resolve_render_provider(settings: Settings) -> MediaRenderingProvider:
    if settings.AI_RENDER_PROVIDER == "local":
        return LocalMediaRenderingProvider(settings)
    return DisabledMediaRenderingProvider(settings)
