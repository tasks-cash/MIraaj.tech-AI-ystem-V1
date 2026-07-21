"""Resolve creative providers from settings (disabled | mock | local)."""

from __future__ import annotations

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
from app.services.creative.provider import (
    ImageGenerationProvider,
    MediaRenderingProvider,
    VideoGenerationProvider,
)


def resolve_image_provider(settings: Settings) -> ImageGenerationProvider:
    if settings.AI_IMAGE_PROVIDER == "mock":
        return MockImageGenerationProvider(settings)
    return DisabledImageGenerationProvider(settings)


def resolve_video_provider(settings: Settings) -> VideoGenerationProvider:
    if settings.AI_VIDEO_PROVIDER == "mock":
        return MockVideoGenerationProvider(settings)
    return DisabledVideoGenerationProvider(settings)


def resolve_render_provider(settings: Settings) -> MediaRenderingProvider:
    if settings.AI_RENDER_PROVIDER == "local":
        return LocalMediaRenderingProvider(settings)
    return DisabledMediaRenderingProvider(settings)
