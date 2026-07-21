"""Prompt 5 creative generation / render / validation Pydantic schemas.

NestJS owns jobs, rights, approval, and MinIO persistence. This service only
returns provider/render results and structured signals. Binary payloads travel
as base64 so callers never need a public media URL; optional signed URLs reuse
the Prompt 2 SSRF-safe fetch path.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.creative_enums import (
    CreativeAssetType,
    CreativeErrorCode,
    CreativeImageProviderId,
    CreativeJobStatus,
    CreativeRenderProviderId,
    CreativeVideoProviderId,
    SubtitleFormat,
    TextDirection,
)


def _strict_config() -> ConfigDict:
    return ConfigDict(extra="forbid")


class SubtitleCue(BaseModel):
    model_config = _strict_config()

    startMs: int = Field(ge=0, le=3_600_000)
    endMs: int = Field(ge=1, le=3_600_000)
    text: str = Field(min_length=1, max_length=500)


class GenerateImageInput(BaseModel):
    model_config = _strict_config()

    prompt: str = Field(min_length=1, max_length=4_000)
    negativePrompt: str = Field(default="", max_length=2_000)
    assetType: CreativeAssetType = "image_post"
    width: int = Field(default=1024, ge=64, le=4096)
    height: int = Field(default=1024, ge=64, le=4096)
    language: str | None = Field(default=None, max_length=16)
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)
    jobId: str | None = Field(default=None, max_length=128)
    briefId: str | None = Field(default=None, max_length=128)


class GenerateVideoInput(BaseModel):
    model_config = _strict_config()

    prompt: str = Field(min_length=1, max_length=4_000)
    negativePrompt: str = Field(default="", max_length=2_000)
    assetType: CreativeAssetType = "short_video"
    width: int = Field(default=640, ge=64, le=1920)
    height: int = Field(default=360, ge=64, le=1920)
    durationSeconds: float = Field(default=2.0, ge=0.5, le=30.0)
    fps: int = Field(default=8, ge=1, le=30)
    language: str | None = Field(default=None, max_length=16)
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)
    jobId: str | None = Field(default=None, max_length=128)
    briefId: str | None = Field(default=None, max_length=128)


class MediaBytesPayload(BaseModel):
    """Inline media for render/validate routes (preferred over remote URLs)."""

    model_config = _strict_config()

    contentBase64: str = Field(min_length=1, max_length=90_000_000)
    mimeType: str | None = Field(default=None, max_length=100)


class RenderImageVariantInput(BaseModel):
    model_config = _strict_config()

    media: MediaBytesPayload
    targetWidth: int = Field(ge=16, le=4096)
    targetHeight: int = Field(ge=16, le=4096)
    mode: Literal["letterbox", "crop", "stretch"] = "letterbox"
    backgroundColor: str = Field(default="#000000", max_length=32)
    outputFormat: Literal["png", "jpeg", "webp"] = "png"
    stripMetadata: bool = True
    assetType: CreativeAssetType = "image_post"


class RenderVideoVariantInput(BaseModel):
    model_config = _strict_config()

    media: MediaBytesPayload
    targetWidth: int = Field(ge=16, le=1920)
    targetHeight: int = Field(ge=16, le=1920)
    mode: Literal["letterbox", "crop", "stretch"] = "letterbox"
    assetType: CreativeAssetType = "short_video"


class RenderTextOverlayInput(BaseModel):
    model_config = _strict_config()

    media: MediaBytesPayload
    text: str = Field(min_length=1, max_length=500)
    language: str | None = Field(default=None, max_length=16)
    direction: TextDirection | Literal["auto"] = "auto"
    position: Literal["top", "center", "bottom"] = "bottom"
    fontSize: int = Field(default=28, ge=8, le=200)
    fillColor: str = Field(default="#FFFFFF", max_length=32)
    strokeColor: str = Field(default="#000000", max_length=32)
    marginPx: int = Field(default=24, ge=0, le=500)
    outputFormat: Literal["png", "jpeg", "webp"] = "png"


class RenderSubtitlesInput(BaseModel):
    model_config = _strict_config()

    cues: list[SubtitleCue] = Field(min_length=1, max_length=500)
    formats: SubtitleFormat = "both"
    language: str | None = Field(default=None, max_length=16)
    direction: TextDirection | Literal["auto"] = "auto"


class CreateThumbnailInput(BaseModel):
    model_config = _strict_config()

    media: MediaBytesPayload
    maxWidth: int = Field(default=320, ge=16, le=2048)
    maxHeight: int = Field(default=320, ge=16, le=2048)
    outputFormat: Literal["png", "jpeg", "webp"] = "jpeg"


class CreatePreviewInput(BaseModel):
    model_config = _strict_config()

    media: MediaBytesPayload
    maxWidth: int = Field(default=640, ge=16, le=2048)
    maxHeight: int = Field(default=640, ge=16, le=2048)
    outputFormat: Literal["png", "jpeg", "webp"] = "jpeg"


class ValidateMediaInput(BaseModel):
    model_config = _strict_config()

    media: MediaBytesPayload | None = None
    signedMediaUrl: str | None = Field(default=None, max_length=2_048)
    expectedKind: Literal["image", "video", "auto"] = "auto"
    maxBytes: int | None = Field(default=None, ge=1)
    maxDurationSeconds: float | None = Field(default=None, ge=0.1)

    @field_validator("signedMediaUrl")
    @classmethod
    def _empty_url_to_none(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        return value


class OcrCheckInput(BaseModel):
    model_config = _strict_config()

    media: MediaBytesPayload
    expectedText: str = Field(min_length=1, max_length=4_000)
    language: str | None = Field(default=None, max_length=16)
    languagePacks: list[str] = Field(default_factory=list, max_length=4)
    mismatchThreshold: float = Field(default=0.85, ge=0.0, le=1.0)


class GeneratedMediaArtifact(BaseModel):
    model_config = _strict_config()

    contentBase64: str | None = None
    mimeType: str | None = None
    width: int | None = None
    height: int | None = None
    durationSeconds: float | None = None
    frameCount: int | None = None
    sha256: str | None = None
    byteLength: int = 0
    isMock: bool = False
    isPosterFrameFallback: bool = False
    posterFramesBase64: list[str] = Field(default_factory=list, max_length=30)


class GenerateImageOutput(BaseModel):
    model_config = _strict_config()

    provider: CreativeImageProviderId
    model: str | None = None
    status: CreativeJobStatus
    jobId: str | None = None
    media: GeneratedMediaArtifact | None = None
    requiresReview: bool = True
    reviewReasonCodes: list[str] = Field(default_factory=list, max_length=30)
    safeError: CreativeErrorCode | None = None
    processingMs: int = 0


class GenerateVideoOutput(BaseModel):
    model_config = _strict_config()

    provider: CreativeVideoProviderId
    model: str | None = None
    status: CreativeJobStatus
    jobId: str | None = None
    media: GeneratedMediaArtifact | None = None
    requiresReview: bool = True
    reviewReasonCodes: list[str] = Field(default_factory=list, max_length=30)
    safeError: CreativeErrorCode | None = None
    processingMs: int = 0


class CreativeJobStatusOutput(BaseModel):
    model_config = _strict_config()

    jobId: str
    status: CreativeJobStatus
    provider: str
    safeError: CreativeErrorCode | None = None
    media: GeneratedMediaArtifact | None = None


class RenderedMediaArtifact(BaseModel):
    model_config = _strict_config()

    contentBase64: str
    mimeType: str
    width: int
    height: int
    sha256: str
    byteLength: int
    metadataStripped: bool = False


class RenderImageVariantOutput(BaseModel):
    model_config = _strict_config()

    provider: CreativeRenderProviderId
    media: RenderedMediaArtifact | None = None
    safeError: CreativeErrorCode | None = None
    processingMs: int = 0


class RenderVideoVariantOutput(BaseModel):
    model_config = _strict_config()

    provider: CreativeRenderProviderId
    media: GeneratedMediaArtifact | None = None
    safeError: CreativeErrorCode | None = None
    processingMs: int = 0


class RenderTextOverlayOutput(BaseModel):
    model_config = _strict_config()

    provider: CreativeRenderProviderId
    media: RenderedMediaArtifact | None = None
    direction: TextDirection = "ltr"
    safeError: CreativeErrorCode | None = None
    processingMs: int = 0


class RenderSubtitlesOutput(BaseModel):
    model_config = _strict_config()

    provider: CreativeRenderProviderId
    srt: str | None = None
    webvtt: str | None = None
    direction: TextDirection = "ltr"
    cueCount: int = 0
    safeError: CreativeErrorCode | None = None
    processingMs: int = 0


class CreateThumbnailOutput(BaseModel):
    model_config = _strict_config()

    provider: CreativeRenderProviderId
    media: RenderedMediaArtifact | None = None
    safeError: CreativeErrorCode | None = None
    processingMs: int = 0


class CreatePreviewOutput(BaseModel):
    model_config = _strict_config()

    provider: CreativeRenderProviderId
    media: RenderedMediaArtifact | None = None
    safeError: CreativeErrorCode | None = None
    processingMs: int = 0


class MediaValidationResult(BaseModel):
    model_config = _strict_config()

    accepted: bool
    kind: Literal["image", "video", "unknown"] | None = None
    mimeType: str | None = None
    width: int | None = None
    height: int | None = None
    durationSeconds: float | None = None
    byteLength: int = 0
    sha256: str | None = None
    metadataStripped: bool = False
    warnings: list[str] = Field(default_factory=list, max_length=20)
    errorCode: CreativeErrorCode | str | None = None
    safeMessage: str | None = None
    processingMs: int = 0


class OcrCheckResult(BaseModel):
    model_config = _strict_config()

    expectedText: str
    observedText: str = ""
    similarity: float = Field(ge=0.0, le=1.0, default=0.0)
    matched: bool = False
    mismatch: bool = True
    ocrAvailable: bool = False
    usedMockFallback: bool = False
    languagePacks: list[str] = Field(default_factory=list, max_length=4)
    reviewReasonCodes: list[str] = Field(default_factory=list, max_length=10)
    safeError: CreativeErrorCode | None = None
    processingMs: int = 0


class ProviderStatusBlock(BaseModel):
    model_config = _strict_config()

    provider: str
    enabled: bool
    configured: bool
    model: str | None = None
    timeoutSeconds: int | None = None
    maxRetries: int | None = None
    safeError: str | None = None


class CreativeProviderStatusResponse(BaseModel):
    model_config = _strict_config()

    imageProvider: ProviderStatusBlock
    videoProvider: ProviderStatusBlock
    renderProvider: ProviderStatusBlock


class CreativeAcceptedResponse(BaseModel):
    """Generic envelope used by creative HMAC routes."""

    model_config = _strict_config()

    accepted: bool
    data: object | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int = 0


class GenerateImageResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: GenerateImageOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int = 0


class GenerateVideoResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: GenerateVideoOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int = 0


class RenderImageVariantResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: RenderImageVariantOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int = 0


class RenderTextOverlayResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: RenderTextOverlayOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int = 0


class RenderSubtitlesResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: RenderSubtitlesOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int = 0


class CreateThumbnailResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: CreateThumbnailOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int = 0


class ValidateMediaResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: MediaValidationResult | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int = 0


class OcrCheckResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: OcrCheckResult | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int = 0
