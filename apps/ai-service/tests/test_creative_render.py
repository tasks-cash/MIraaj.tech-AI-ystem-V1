"""Creative local render tests — overlays, subtitles, OCR mismatch helper."""

from __future__ import annotations

import base64
import io

import pytest
from PIL import Image

from app.core.config import get_settings
from app.models.creative_schemas import (
    CreateThumbnailInput,
    MediaBytesPayload,
    OcrCheckInput,
    RenderImageVariantInput,
    RenderSubtitlesInput,
    RenderTextOverlayInput,
    SubtitleCue,
)
from app.services.creative.local_render import (
    LocalMediaRenderingProvider,
    render_srt,
    render_webvtt,
    text_similarity,
)
from tests.media_helpers import tiny_png_bytes


def _media_payload(content: bytes | None = None) -> MediaBytesPayload:
    raw = content if content is not None else tiny_png_bytes()
    return MediaBytesPayload(
        contentBase64=base64.b64encode(raw).decode("ascii"),
        mimeType="image/png",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("text", "language", "expected_direction"),
    [
        ("Book a consultation today", "en", "ltr"),
        ("Réservez une consultation", "fr", "ltr"),
        ("احجز استشارة اليوم", "ar", "rtl"),
    ],
)
async def test_text_overlay_directions(text: str, language: str, expected_direction: str) -> None:
    provider = LocalMediaRenderingProvider(get_settings())
    result = await provider.render_text_overlay(
        RenderTextOverlayInput(
            media=_media_payload(),
            text=text,
            language=language,
            direction="auto",
        )
    )
    assert result.safeError is None
    assert result.media is not None
    assert result.direction == expected_direction
    raw = base64.b64decode(result.media.contentBase64)
    with Image.open(io.BytesIO(raw)) as image:
        assert image.size[0] > 0


@pytest.mark.asyncio
async def test_image_variant_letterbox_and_thumbnail() -> None:
    provider = LocalMediaRenderingProvider(get_settings())
    variant = await provider.render_image_variant(
        RenderImageVariantInput(
            media=_media_payload(),
            targetWidth=200,
            targetHeight=100,
            mode="letterbox",
        )
    )
    assert variant.media is not None
    assert variant.media.width == 200
    assert variant.media.height == 100
    assert variant.media.metadataStripped is True

    thumb = await provider.create_thumbnail(
        CreateThumbnailInput(media=_media_payload(), maxWidth=64, maxHeight=64)
    )
    assert thumb.media is not None
    assert thumb.media.width <= 64
    assert thumb.media.height <= 64


def test_srt_and_webvtt_generation() -> None:
    cues = [
        SubtitleCue(startMs=0, endMs=1500, text="Hello Miraaj"),
        SubtitleCue(startMs=1500, endMs=3000, text="مرحبا"),
    ]
    srt = render_srt(cues)
    vtt = render_webvtt(cues)
    assert "1\n00:00:00,000 --> 00:00:01,500\nHello Miraaj" in srt
    assert "2\n00:00:01,500 --> 00:00:03,000\nمرحبا" in srt
    assert vtt.startswith("WEBVTT")
    assert "00:00:00.000 --> 00:00:01.500" in vtt
    assert "مرحبا" in vtt


@pytest.mark.asyncio
async def test_render_subtitles_route_payload() -> None:
    provider = LocalMediaRenderingProvider(get_settings())
    result = await provider.render_subtitles(
        RenderSubtitlesInput(
            cues=[SubtitleCue(startMs=0, endMs=1000, text="Bonjour")],
            formats="both",
            language="fr",
        )
    )
    assert result.safeError is None
    assert result.cueCount == 1
    assert result.srt is not None
    assert result.webvtt is not None
    assert result.direction == "ltr"


def test_text_similarity_detects_mismatch() -> None:
    assert text_similarity("Payment disclosure required", "Payment disclosure required") == 1.0
    assert text_similarity("exact match", "totally different words") < 0.5


@pytest.mark.asyncio
async def test_ocr_check_mismatch_helper_without_engine() -> None:
    provider = LocalMediaRenderingProvider(get_settings())
    # Even when Tesseract is unavailable, helper returns expected vs empty and mismatch.
    result = await provider.ocr_check(
        OcrCheckInput(
            media=_media_payload(),
            expectedText="Miraaj.tech licensed third-party provider approval",
            language="en",
            mismatchThreshold=0.9,
        )
    )
    assert result.expectedText.startswith("Miraaj.tech")
    if not result.ocrAvailable:
        assert result.observedText == ""
        assert result.mismatch is True
        assert result.usedMockFallback is True
        assert "ocr_mismatch" in result.reviewReasonCodes
    else:
        # When OCR is installed, either match or explicit mismatch signal is fine.
        assert result.similarity >= 0.0
        assert isinstance(result.mismatch, bool)
