"""Fail-safe translation provider used whenever ``AI_TRANSLATION_PROVIDER`` is
not ``gemini`` (the default). Never invents a translation: unlike the
deterministic business-reasoning provider, there is no safe rule-based way to
translate arbitrary text, so this provider always reports the translation as
unavailable rather than fabricate copy that looks like a successful result.
"""

from __future__ import annotations

from app.core.config import Settings
from app.models.translation_schemas import (
    TranslationInput,
    TranslationOutput,
    TranslationProviderHealth,
)


class DisabledTranslationProvider:
    provider_id = "disabled"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    def is_enabled(self) -> bool:
        return True

    async def translate(self, payload: TranslationInput) -> TranslationOutput:
        return TranslationOutput(
            translatedText="",
            detectedSourceLanguage=payload.sourceLanguage,
            provider=self.provider_id,
            model="",
            confidence=None,
            warnings=["TRANSLATION_PROVIDER_DISABLED"],
            protectedTermReport=[],
            humanReviewRecommended=True,
            processingTimeMs=0,
            estimatedCost=None,
        )

    async def health_check(self) -> TranslationProviderHealth:
        return TranslationProviderHealth(
            providerId=self.provider_id,
            status="ok",
            latencyMs=0,
            safeError="TRANSLATION_PROVIDER_DISABLED",
        )
