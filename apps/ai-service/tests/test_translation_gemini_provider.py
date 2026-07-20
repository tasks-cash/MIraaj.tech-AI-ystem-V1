import asyncio

import pytest

from app.core.config import get_settings, reset_settings_cache
from app.models.translation_schemas import TranslationInput
from app.services.translation.gemini_provider import GeminiTranslationProvider

_VALID_OUTPUT_PAYLOAD = {
    "translatedText": "Réservez votre rendez-vous dentaire aujourd'hui.",
    "confidence": 0.92,
    "warnings": [],
    "protectedTermReport": [],
    "humanReviewRecommended": False,
}


def test_translation_disabled_without_key() -> None:
    settings = get_settings()
    provider = GeminiTranslationProvider(settings, allow_live_requests=False)
    assert provider.is_enabled() is False


def test_translation_enabled_flag_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_TRANSLATION_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    reset_settings_cache()
    settings = get_settings()
    provider = GeminiTranslationProvider(settings, allow_live_requests=False)
    assert provider.is_enabled() is False
    reset_settings_cache()


@pytest.mark.asyncio
async def test_translation_mock_response_parses_schema() -> None:
    settings = get_settings()
    provider = GeminiTranslationProvider(settings, allow_live_requests=False)
    result = await provider.translate_with_mock_response(_VALID_OUTPUT_PAYLOAD)
    assert result.provider == "gemini"
    assert "rendez-vous" in result.translatedText


def test_translation_repairs_wrapped_json() -> None:
    import json

    settings = get_settings()
    provider = GeminiTranslationProvider(settings, allow_live_requests=False)
    wrapped = "Sure, here it is:```" + json.dumps(_VALID_OUTPUT_PAYLOAD) + "```"
    parsed = provider._parse_output(wrapped, source_language="en", processing_ms=5)
    assert parsed.confidence == 0.92


def test_translation_raises_on_unrecoverable_invalid_json() -> None:
    settings = get_settings()
    provider = GeminiTranslationProvider(settings, allow_live_requests=False)
    with pytest.raises(ValueError, match="invalid JSON"):
        provider._parse_output("no braces at all", source_language="en", processing_ms=1)


def test_translation_live_requests_blocked_in_tests() -> None:
    settings = get_settings()
    provider = GeminiTranslationProvider(settings, allow_live_requests=False)

    async def _call() -> None:
        await provider.translate(
            TranslationInput(sourceLanguage="en", targetLanguage="ar", targetLocale="ar", text="hi")
        )

    with pytest.raises(RuntimeError, match="disabled"):
        asyncio.run(_call())


def test_translation_never_exposes_api_key_in_repr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_TRANSLATION_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "super-secret-translation-key")
    reset_settings_cache()
    settings = get_settings()
    provider = GeminiTranslationProvider(settings, allow_live_requests=False)
    assert "super-secret-translation-key" not in repr(settings.GEMINI_API_KEY)
    assert "super-secret-translation-key" not in str(provider._settings.GEMINI_API_KEY)
    reset_settings_cache()


@pytest.mark.asyncio
async def test_translation_health_check_reflects_enabled_state() -> None:
    settings = get_settings()
    provider = GeminiTranslationProvider(settings, allow_live_requests=False)
    health = await provider.health_check()
    assert health.status == "unavailable"
    assert health.safeError == "TRANSLATION_PROVIDER_DISABLED"
