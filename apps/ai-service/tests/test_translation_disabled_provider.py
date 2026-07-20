import pytest

from app.models.translation_schemas import TranslationInput
from app.services.translation.disabled_provider import DisabledTranslationProvider


@pytest.mark.asyncio
async def test_disabled_translation_never_fabricates_translated_text() -> None:
    provider = DisabledTranslationProvider()
    result = await provider.translate(
        TranslationInput(
            sourceLanguage="en",
            targetLanguage="ar",
            targetLocale="ar",
            text="Book your dental appointment today.",
        )
    )

    assert result.translatedText == ""
    assert result.provider == "disabled"
    assert result.confidence is None
    assert result.humanReviewRecommended is True
    assert "TRANSLATION_PROVIDER_DISABLED" in result.warnings


@pytest.mark.asyncio
async def test_disabled_translation_reports_detected_source_language() -> None:
    provider = DisabledTranslationProvider()
    result = await provider.translate(
        TranslationInput(
            sourceLanguage="fr", targetLanguage="en", targetLocale="en", text="Bonjour"
        )
    )
    assert result.detectedSourceLanguage == "fr"


def test_disabled_translation_is_always_enabled() -> None:
    provider = DisabledTranslationProvider()
    assert provider.is_enabled() is True


@pytest.mark.asyncio
async def test_disabled_translation_health_check_reports_safe_error() -> None:
    provider = DisabledTranslationProvider()
    health = await provider.health_check()
    assert health.status == "ok"
    assert health.safeError == "TRANSLATION_PROVIDER_DISABLED"
