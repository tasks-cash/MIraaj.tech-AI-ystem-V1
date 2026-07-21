"""Prompt 5 creative-media enums.

Mirrors the subset of ``packages/shared-types/src/creative-media.ts`` that the
FastAPI providers need. NestJS remains the authority over jobs, rights, and
approval — this module only keeps request/response contracts aligned.
"""

from __future__ import annotations

import re
from typing import Literal

CreativeAssetType = Literal[
    "image_post",
    "square_image",
    "portrait_image",
    "landscape_image",
    "story_frame",
    "carousel_slide",
    "carousel_cover",
    "thumbnail",
    "banner",
    "infographic",
    "product_mockup",
    "interface_mockup",
    "short_video",
    "vertical_video",
    "landscape_video",
    "square_video",
    "reel",
    "short",
    "story_video",
    "explainer_video",
    "product_demo_video",
    "animated_graphic",
    "motion_graphic",
    "video_thumbnail",
    "poster_frame",
    "subtitle_file",
    "caption_file",
    "transcript_file",
    "preview_image",
    "preview_video",
]

CreativeImageProviderId = Literal["disabled", "mock"]
CreativeVideoProviderId = Literal["disabled", "mock"]
CreativeRenderProviderId = Literal["local", "disabled"]

TextDirection = Literal["ltr", "rtl"]

CreativeJobStatus = Literal[
    "created",
    "queued",
    "active",
    "generating",
    "provider_pending",
    "completed",
    "failed",
    "cancelled",
    "provider_unavailable",
]

CreativeErrorCode = Literal[
    "CREATIVE_PROVIDER_DISABLED",
    "CREATIVE_PROVIDER_UNAVAILABLE",
    "CREATIVE_PROVIDER_TIMEOUT",
    "CREATIVE_PROVIDER_JOB_FAILED",
    "CREATIVE_PROVIDER_JOB_CANCELLED",
    "CREATIVE_MEDIA_SIGNATURE_INVALID",
    "CREATIVE_MEDIA_DECODE_FAILED",
    "CREATIVE_MEDIA_DIMENSIONS_INVALID",
    "CREATIVE_MEDIA_DURATION_INVALID",
    "CREATIVE_MEDIA_CORRUPTED",
    "CREATIVE_OCR_MISMATCH",
    "CREATIVE_INPUT_TOO_LARGE",
    "CREATIVE_RENDER_DISABLED",
    "INTERNAL_MEDIA_FETCH_REJECTED",
]

SubtitleFormat = Literal["srt", "webvtt", "both"]

RTL_LANGUAGES: frozenset[str] = frozenset({"ar", "he", "fa", "ur"})

PROHIBITED_CREATIVE_VISUAL_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"fake\s+testimonial", re.IGNORECASE),
    re.compile(r"before\s+and\s+after", re.IGNORECASE),
    re.compile(r"guaranteed\s+(results?|approval|cure)", re.IGNORECASE),
    re.compile(r"celebrity\s+(endorsement|likeness)", re.IGNORECASE),
    re.compile(r"deepfake", re.IGNORECASE),
    re.compile(r"unhackable", re.IGNORECASE),
)


def direction_for_language(language: str | None) -> TextDirection:
    if not language:
        return "ltr"
    return "rtl" if language.strip().lower().split("-")[0] in RTL_LANGUAGES else "ltr"


def contains_prohibited_creative_visual_claim(text: str) -> bool:
    return any(pattern.search(text) for pattern in PROHIBITED_CREATIVE_VISUAL_PATTERNS)
