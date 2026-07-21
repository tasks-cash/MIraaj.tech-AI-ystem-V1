"""Local media rendering provider (Pillow + optional OCR).

Handles resize/letterbox, metadata strip (same pattern as media_inspect),
LTR/RTL text overlays, WebVTT/SRT generation, thumbnails/previews, and an
OCR round-trip helper for Nest to decide review on text mismatch.
"""

from __future__ import annotations

import base64
import hashlib
import io
import re
from time import perf_counter
from typing import Literal

from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError

from app.core.config import Settings
from app.models.creative_enums import TextDirection, direction_for_language
from app.models.creative_schemas import (
    CreatePreviewInput,
    CreatePreviewOutput,
    CreateThumbnailInput,
    CreateThumbnailOutput,
    GeneratedMediaArtifact,
    MediaBytesPayload,
    OcrCheckInput,
    OcrCheckResult,
    RenderedMediaArtifact,
    RenderImageVariantInput,
    RenderImageVariantOutput,
    RenderSubtitlesInput,
    RenderSubtitlesOutput,
    RenderTextOverlayInput,
    RenderTextOverlayOutput,
    RenderVideoVariantInput,
    RenderVideoVariantOutput,
    SubtitleCue,
)
from app.services.media_inspect import MediaInspectError


def _strip_metadata(image: Image.Image) -> tuple[Image.Image, bool]:
    """Same approach as ``media_inspect._strip_exif`` — copy pixels, drop info."""
    cleaned = Image.new(image.mode, image.size)
    if hasattr(image, "get_flattened_data"):
        pixels = list(image.get_flattened_data())
    else:
        pixels = list(image.getdata())
    cleaned.putdata(pixels)  # type: ignore[arg-type]
    cleaned.info.clear()
    had_metadata = bool(image.info) or hasattr(image, "getexif")
    return cleaned, had_metadata


def _decode_media(payload: MediaBytesPayload) -> bytes:
    try:
        return base64.b64decode(payload.contentBase64, validate=False)
    except Exception as error:
        raise ValueError("Invalid base64 media payload.") from error


def _open_image(content: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(content))
        image.load()
        return image.convert("RGBA")
    except UnidentifiedImageError as error:
        raise MediaInspectError(
            "CREATIVE_MEDIA_DECODE_FAILED",
            "Image could not be decoded.",
        ) from error


def _parse_color(value: str) -> tuple[int, int, int]:
    raw = value.strip()
    if raw.startswith("#") and len(raw) in {4, 7}:
        if len(raw) == 4:
            raw = f"#{raw[1] * 2}{raw[2] * 2}{raw[3] * 2}"
        return int(raw[1:3], 16), int(raw[3:5], 16), int(raw[5:7], 16)
    return 0, 0, 0


def _letterbox(
    image: Image.Image,
    target_width: int,
    target_height: int,
    *,
    mode: Literal["letterbox", "crop", "stretch"],
    background: tuple[int, int, int] = (0, 0, 0),
) -> Image.Image:
    if mode == "stretch":
        return image.resize((target_width, target_height), Image.Resampling.LANCZOS)

    src_w, src_h = image.size
    if mode == "crop":
        scale = max(target_width / src_w, target_height / src_h)
        resized = image.resize(
            (max(1, int(src_w * scale)), max(1, int(src_h * scale))),
            Image.Resampling.LANCZOS,
        )
        left = max(0, (resized.width - target_width) // 2)
        top = max(0, (resized.height - target_height) // 2)
        return resized.crop((left, top, left + target_width, top + target_height))

    scale = min(target_width / src_w, target_height / src_h)
    resized = image.resize(
        (max(1, int(src_w * scale)), max(1, int(src_h * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (target_width, target_height), (*background, 255))
    offset = ((target_width - resized.width) // 2, (target_height - resized.height) // 2)
    canvas.paste(resized, offset, resized if resized.mode == "RGBA" else None)
    return canvas


def _encode_image(
    image: Image.Image,
    *,
    output_format: Literal["png", "jpeg", "webp"],
    strip_metadata: bool,
) -> RenderedMediaArtifact:
    working = image
    metadata_stripped = False
    if strip_metadata:
        if working.mode not in {"RGB", "RGBA", "L"}:
            working = working.convert("RGBA")
        if output_format == "jpeg" and working.mode != "RGB":
            working = working.convert("RGB")
        working, metadata_stripped = _strip_metadata(working)

    if output_format == "jpeg" and working.mode != "RGB":
        working = working.convert("RGB")

    buffer = io.BytesIO()
    format_name = output_format.upper()
    if output_format in {"jpeg", "webp"}:
        working.save(buffer, format=format_name, quality=90)
    else:
        working.save(buffer, format=format_name)
    raw = buffer.getvalue()
    mime = f"image/{'jpeg' if output_format == 'jpeg' else output_format}"
    return RenderedMediaArtifact(
        contentBase64=base64.b64encode(raw).decode("ascii"),
        mimeType=mime,
        width=working.size[0],
        height=working.size[1],
        sha256=hashlib.sha256(raw).hexdigest(),
        byteLength=len(raw),
        metadataStripped=metadata_stripped or strip_metadata,
    )


def _format_srt_timestamp(ms: int) -> str:
    hours, rem = divmod(ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    seconds, millis = divmod(rem, 1_000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def _format_vtt_timestamp(ms: int) -> str:
    hours, rem = divmod(ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    seconds, millis = divmod(rem, 1_000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"


def render_srt(cues: list[SubtitleCue]) -> str:
    blocks: list[str] = []
    for index, cue in enumerate(cues, start=1):
        blocks.append(
            f"{index}\n{_format_srt_timestamp(cue.startMs)} --> "
            f"{_format_srt_timestamp(cue.endMs)}\n{cue.text.strip()}\n"
        )
    return "\n".join(blocks).rstrip() + "\n"


def render_webvtt(cues: list[SubtitleCue]) -> str:
    blocks = ["WEBVTT", ""]
    for cue in cues:
        blocks.append(
            f"{_format_vtt_timestamp(cue.startMs)} --> {_format_vtt_timestamp(cue.endMs)}"
        )
        blocks.append(cue.text.strip())
        blocks.append("")
    return "\n".join(blocks)


def _normalize_compare_text(value: str) -> str:
    collapsed = re.sub(r"\s+", " ", value.strip().lower())
    return collapsed


def text_similarity(expected: str, observed: str) -> float:
    left = _normalize_compare_text(expected)
    right = _normalize_compare_text(observed)
    if not left and not right:
        return 1.0
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    # Token Jaccard — good enough for OCR mismatch gating without extra deps.
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    if not left_tokens or not right_tokens:
        return 0.0
    intersection = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    return intersection / union if union else 0.0


class LocalMediaRenderingProvider:
    provider_id = "local"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def render_image_variant(
        self, payload: RenderImageVariantInput
    ) -> RenderImageVariantOutput:
        started = perf_counter()
        try:
            content = _decode_media(payload.media)
            if len(content) > self._settings.CREATIVE_MAX_IMAGE_BYTES:
                raise ValueError("Image exceeds creative byte limit.")
            image = _open_image(content)
            background = _parse_color(payload.backgroundColor)
            rendered = _letterbox(
                image,
                payload.targetWidth,
                payload.targetHeight,
                mode=payload.mode,
                background=background,
            )
            artifact = _encode_image(
                rendered,
                output_format=payload.outputFormat,
                strip_metadata=payload.stripMetadata,
            )
            return RenderImageVariantOutput(
                provider="local",
                media=artifact,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        except (ValueError, MediaInspectError, OSError):
            return RenderImageVariantOutput(
                provider="local",
                safeError="CREATIVE_MEDIA_DECODE_FAILED",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

    async def render_video_variant(
        self, payload: RenderVideoVariantInput
    ) -> RenderVideoVariantOutput:
        """Video variant rendering is limited to poster-frame letterbox locally."""
        started = perf_counter()
        try:
            content = _decode_media(payload.media)
            image = _open_image(content)
            rendered = _letterbox(
                image,
                payload.targetWidth,
                payload.targetHeight,
                mode=payload.mode,
            )
            artifact_img = _encode_image(rendered, output_format="png", strip_metadata=True)
            return RenderVideoVariantOutput(
                provider="local",
                media=GeneratedMediaArtifact(
                    contentBase64=artifact_img.contentBase64,
                    mimeType=artifact_img.mimeType,
                    width=artifact_img.width,
                    height=artifact_img.height,
                    sha256=artifact_img.sha256,
                    byteLength=artifact_img.byteLength,
                    isMock=False,
                    isPosterFrameFallback=True,
                ),
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        except (ValueError, MediaInspectError, OSError):
            return RenderVideoVariantOutput(
                provider="local",
                safeError="CREATIVE_MEDIA_DECODE_FAILED",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

    async def render_text_overlay(self, payload: RenderTextOverlayInput) -> RenderTextOverlayOutput:
        started = perf_counter()
        direction: TextDirection = (
            direction_for_language(payload.language)
            if payload.direction == "auto"
            else payload.direction
        )
        try:
            content = _decode_media(payload.media)
            image = _open_image(content).convert("RGBA")
            draw = ImageDraw.Draw(image)
            try:
                font = ImageFont.load_default()
            except OSError:
                font = None

            fill = (*_parse_color(payload.fillColor), 255)
            stroke = (*_parse_color(payload.strokeColor), 255)
            text = payload.text
            bbox = draw.textbbox((0, 0), text, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            margin = payload.marginPx
            x = max(margin, image.width - margin - text_w) if direction == "rtl" else margin

            if payload.position == "top":
                y = margin
            elif payload.position == "center":
                y = max(margin, int((image.height - text_h) // 2))
            else:
                y = max(margin, int(image.height - margin - text_h))

            draw.text(
                (x, y),
                text,
                fill=fill,
                font=font,
                stroke_width=1,
                stroke_fill=stroke,
            )
            artifact = _encode_image(image, output_format=payload.outputFormat, strip_metadata=True)
            return RenderTextOverlayOutput(
                provider="local",
                media=artifact,
                direction=direction,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        except (ValueError, MediaInspectError, OSError):
            return RenderTextOverlayOutput(
                provider="local",
                direction=direction,
                safeError="CREATIVE_MEDIA_DECODE_FAILED",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

    async def render_subtitles(self, payload: RenderSubtitlesInput) -> RenderSubtitlesOutput:
        started = perf_counter()
        direction: TextDirection = (
            direction_for_language(payload.language)
            if payload.direction == "auto"
            else payload.direction
        )
        ordered = sorted(payload.cues, key=lambda cue: cue.startMs)
        for cue in ordered:
            if cue.endMs <= cue.startMs:
                return RenderSubtitlesOutput(
                    provider="local",
                    direction=direction,
                    safeError="CREATIVE_MEDIA_DURATION_INVALID",
                    processingMs=max(0, round((perf_counter() - started) * 1_000)),
                )

        srt = render_srt(ordered) if payload.formats in {"srt", "both"} else None
        webvtt = render_webvtt(ordered) if payload.formats in {"webvtt", "both"} else None
        return RenderSubtitlesOutput(
            provider="local",
            srt=srt,
            webvtt=webvtt,
            direction=direction,
            cueCount=len(ordered),
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    async def create_thumbnail(self, payload: CreateThumbnailInput) -> CreateThumbnailOutput:
        started = perf_counter()
        try:
            content = _decode_media(payload.media)
            image = _open_image(content)
            image.thumbnail((payload.maxWidth, payload.maxHeight), Image.Resampling.LANCZOS)
            artifact = _encode_image(image, output_format=payload.outputFormat, strip_metadata=True)
            return CreateThumbnailOutput(
                provider="local",
                media=artifact,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        except (ValueError, MediaInspectError, OSError):
            return CreateThumbnailOutput(
                provider="local",
                safeError="CREATIVE_MEDIA_DECODE_FAILED",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

    async def create_preview(self, payload: CreatePreviewInput) -> CreatePreviewOutput:
        started = perf_counter()
        try:
            content = _decode_media(payload.media)
            image = _open_image(content)
            image.thumbnail((payload.maxWidth, payload.maxHeight), Image.Resampling.LANCZOS)
            artifact = _encode_image(image, output_format=payload.outputFormat, strip_metadata=True)
            return CreatePreviewOutput(
                provider="local",
                media=artifact,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        except (ValueError, MediaInspectError, OSError):
            return CreatePreviewOutput(
                provider="local",
                safeError="CREATIVE_MEDIA_DECODE_FAILED",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

    async def ocr_check(self, payload: OcrCheckInput) -> OcrCheckResult:
        started = perf_counter()
        packs = tuple(payload.languagePacks) or self._settings.ocr_languages_default_packs
        try:
            from app.services.ocr.tesseract_provider import TesseractOCRProvider

            provider = TesseractOCRProvider(self._settings)
            if not provider.is_available():
                return OcrCheckResult(
                    expectedText=payload.expectedText,
                    observedText="",
                    similarity=0.0,
                    matched=False,
                    mismatch=True,
                    ocrAvailable=False,
                    usedMockFallback=True,
                    languagePacks=list(packs),
                    reviewReasonCodes=["ocr_mismatch"],
                    safeError="CREATIVE_OCR_MISMATCH",
                    processingMs=max(0, round((perf_counter() - started) * 1_000)),
                )

            content = _decode_media(payload.media)
            result = provider.run_ocr(
                image_bytes=content,
                language_packs=packs,
                timeout_seconds=min(30, self._settings.MEDIA_OCR_TIMEOUT_SECONDS),
            )
            observed = result.normalizedText or result.rawText or ""
            similarity = text_similarity(payload.expectedText, observed)
            matched = similarity >= payload.mismatchThreshold
            return OcrCheckResult(
                expectedText=payload.expectedText,
                observedText=observed[:4_000],
                similarity=round(similarity, 4),
                matched=matched,
                mismatch=not matched,
                ocrAvailable=True,
                usedMockFallback=False,
                languagePacks=list(packs),
                reviewReasonCodes=[] if matched else ["ocr_mismatch"],
                safeError=None if matched else "CREATIVE_OCR_MISMATCH",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        except Exception:
            return OcrCheckResult(
                expectedText=payload.expectedText,
                observedText="",
                similarity=0.0,
                matched=False,
                mismatch=True,
                ocrAvailable=False,
                usedMockFallback=True,
                languagePacks=list(packs),
                reviewReasonCodes=["ocr_mismatch"],
                safeError="CREATIVE_OCR_MISMATCH",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

    async def health_check(self) -> dict[str, object]:
        return {"provider": self.provider_id, "status": "ok", "safeError": None}


class DisabledMediaRenderingProvider:
    provider_id = "disabled"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    async def render_image_variant(
        self,
        payload: RenderImageVariantInput,  # noqa: ARG002
    ) -> RenderImageVariantOutput:
        return RenderImageVariantOutput(provider="disabled", safeError="CREATIVE_RENDER_DISABLED")

    async def render_video_variant(
        self,
        payload: RenderVideoVariantInput,  # noqa: ARG002
    ) -> RenderVideoVariantOutput:
        return RenderVideoVariantOutput(provider="disabled", safeError="CREATIVE_RENDER_DISABLED")

    async def render_text_overlay(
        self,
        payload: RenderTextOverlayInput,  # noqa: ARG002
    ) -> RenderTextOverlayOutput:
        return RenderTextOverlayOutput(provider="disabled", safeError="CREATIVE_RENDER_DISABLED")

    async def render_subtitles(
        self,
        payload: RenderSubtitlesInput,  # noqa: ARG002
    ) -> RenderSubtitlesOutput:
        return RenderSubtitlesOutput(provider="disabled", safeError="CREATIVE_RENDER_DISABLED")

    async def create_thumbnail(
        self,
        payload: CreateThumbnailInput,  # noqa: ARG002
    ) -> CreateThumbnailOutput:
        return CreateThumbnailOutput(provider="disabled", safeError="CREATIVE_RENDER_DISABLED")

    async def create_preview(
        self,
        payload: CreatePreviewInput,  # noqa: ARG002
    ) -> CreatePreviewOutput:
        return CreatePreviewOutput(provider="disabled", safeError="CREATIVE_RENDER_DISABLED")

    async def health_check(self) -> dict[str, object]:
        return {
            "provider": self.provider_id,
            "status": "ok",
            "safeError": "CREATIVE_RENDER_DISABLED",
        }
