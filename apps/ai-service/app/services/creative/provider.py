"""Prompt 5 creative media provider protocols."""

from __future__ import annotations

from typing import Protocol

from app.models.creative_schemas import (
    CreatePreviewInput,
    CreatePreviewOutput,
    CreateThumbnailInput,
    CreateThumbnailOutput,
    CreativeJobStatusOutput,
    GenerateImageInput,
    GenerateImageOutput,
    GenerateVideoInput,
    GenerateVideoOutput,
    RenderImageVariantInput,
    RenderImageVariantOutput,
    RenderSubtitlesInput,
    RenderSubtitlesOutput,
    RenderTextOverlayInput,
    RenderTextOverlayOutput,
    RenderVideoVariantInput,
    RenderVideoVariantOutput,
)


class ImageGenerationProvider(Protocol):
    provider_id: str

    async def generate_image(self, payload: GenerateImageInput) -> GenerateImageOutput: ...

    async def get_job_status(self, job_id: str) -> CreativeJobStatusOutput: ...

    async def cancel_job(self, job_id: str) -> CreativeJobStatusOutput: ...

    async def health_check(self) -> dict[str, object]: ...


class VideoGenerationProvider(Protocol):
    provider_id: str

    async def generate_video(self, payload: GenerateVideoInput) -> GenerateVideoOutput: ...

    async def get_job_status(self, job_id: str) -> CreativeJobStatusOutput: ...

    async def cancel_job(self, job_id: str) -> CreativeJobStatusOutput: ...

    async def health_check(self) -> dict[str, object]: ...


class MediaRenderingProvider(Protocol):
    provider_id: str

    async def render_image_variant(
        self, payload: RenderImageVariantInput
    ) -> RenderImageVariantOutput: ...

    async def render_video_variant(
        self, payload: RenderVideoVariantInput
    ) -> RenderVideoVariantOutput: ...

    async def render_text_overlay(
        self, payload: RenderTextOverlayInput
    ) -> RenderTextOverlayOutput: ...

    async def render_subtitles(self, payload: RenderSubtitlesInput) -> RenderSubtitlesOutput: ...

    async def create_thumbnail(self, payload: CreateThumbnailInput) -> CreateThumbnailOutput: ...

    async def create_preview(self, payload: CreatePreviewInput) -> CreatePreviewOutput: ...

    async def health_check(self) -> dict[str, object]: ...
