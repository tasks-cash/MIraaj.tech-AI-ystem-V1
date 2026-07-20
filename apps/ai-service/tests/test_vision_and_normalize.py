import pytest

from app.core.config import get_settings, reset_settings_cache
from app.services.ocr.normalize_text import normalize_ocr_text
from app.services.vision.gemini_provider import GeminiVisionProvider


def test_normalize_text_preserves_brand_and_url() -> None:
    raw = "Visit https://Miraaj.tech   now. Tasks.cash support@tasks.cash +213 555 0101"
    normalized = normalize_ocr_text(raw)
    assert "https://Miraaj.tech" in normalized
    assert "Tasks.cash" in normalized
    assert "support@tasks.cash" in normalized


def test_gemini_disabled_without_key() -> None:
    settings = get_settings()
    provider = GeminiVisionProvider(settings, allow_live_requests=False)
    assert provider.is_enabled() is False


@pytest.mark.asyncio
async def test_gemini_mock_response_parses_schema() -> None:
    settings = get_settings()
    provider = GeminiVisionProvider(settings, allow_live_requests=False)
    payload = {
        "mediaSummary": "A simple test image",
        "contentType": "image",
        "contentPurpose": "general_media_context",
        "visibleTextSummary": "TEST",
        "requiresReview": False,
    }
    result = await provider.analyze_with_mock_response(payload)
    assert result.provider == "gemini"
    assert result.mediaSummary == "A simple test image"


def test_gemini_repairs_wrapped_json() -> None:
    settings = get_settings()
    provider = GeminiVisionProvider(settings, allow_live_requests=False)
    payload = (
        'analysis```{"mediaSummary":"x","contentType":"image",'
        '"contentPurpose":"general_media_context","visibleTextSummary":"y",'
        '"requiresReview":false}```'
    )
    parsed = provider._parse_output(payload, processing_ms=1)
    assert parsed.mediaSummary == "x"


def test_gemini_live_requests_blocked_in_tests() -> None:
    settings = get_settings()
    provider = GeminiVisionProvider(settings, allow_live_requests=False)

    async def _call() -> None:
        await provider.analyze(
            image_bytes=b"abc",
            mime_type="image/png",
            purpose=None,
            locale=None,
            country=None,
            ocr_text=None,
        )

    import asyncio

    with pytest.raises(RuntimeError, match="disabled"):
        asyncio.run(_call())


def test_gemini_enabled_flag_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VISION_PROVIDER_ENABLED", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    reset_settings_cache()
    settings = get_settings()
    provider = GeminiVisionProvider(settings, allow_live_requests=False)
    assert provider.is_enabled() is False
    reset_settings_cache()
