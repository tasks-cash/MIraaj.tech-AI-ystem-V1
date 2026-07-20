import pytest

from app.models.campaign_schemas import CampaignTranscreateInput, ContentVariant
from app.models.translation_schemas import (
    TranslationInput,
    TranslationOutput,
    TranslationProviderHealth,
)
from app.services.campaign.transcreation import transcreate_variant
from app.services.translation.disabled_provider import DisabledTranslationProvider


class _FaithfulTranslationProvider:
    """Test double that echoes source text back with a language marker,
    simulating a translation that preserves every protected token."""

    provider_id = "stub-faithful"

    def is_enabled(self) -> bool:
        return True

    async def translate(self, payload: TranslationInput) -> TranslationOutput:
        return TranslationOutput(
            translatedText=f"[{payload.targetLanguage}] {payload.text}",
            detectedSourceLanguage=payload.sourceLanguage,
            provider=self.provider_id,
            model="stub",
            confidence=0.95,
            processingTimeMs=1,
        )

    async def health_check(self) -> TranslationProviderHealth:
        return TranslationProviderHealth(providerId=self.provider_id, status="ok")


class _LossyTranslationProvider:
    """Test double that drops protected tokens, simulating a bad
    translation that must be caught by the safety layer."""

    provider_id = "stub-lossy"

    def is_enabled(self) -> bool:
        return True

    async def translate(self, payload: TranslationInput) -> TranslationOutput:
        return TranslationOutput(
            translatedText="Contactez-nous pour plus d'informations.",
            detectedSourceLanguage=payload.sourceLanguage,
            provider=self.provider_id,
            model="stub",
            confidence=0.9,
            processingTimeMs=1,
        )

    async def health_check(self) -> TranslationProviderHealth:
        return TranslationProviderHealth(providerId=self.provider_id, status="ok")


@pytest.mark.asyncio
async def test_transcreate_with_disabled_provider_flags_translation_unavailable() -> None:
    payload = CampaignTranscreateInput(
        sourceVariant=ContentVariant(
            headline="Book your appointment", primaryText="Call us today."
        ),
        sourceLanguage="en",
        targetLanguage="ar",
        targetLocale="ar",
    )
    result = await transcreate_variant(
        payload,
        translation_provider=DisabledTranslationProvider(),
        provider_name="disabled",
        model="",
    )

    assert result.variant is not None
    assert result.variant.headline == ""
    assert result.requiresReview is True
    assert "translation_unavailable" in result.reviewReasonCodes


@pytest.mark.asyncio
async def test_transcreate_sets_rtl_direction_for_arabic_target() -> None:
    payload = CampaignTranscreateInput(
        sourceVariant=ContentVariant(headline="Book your appointment"),
        sourceLanguage="en",
        targetLanguage="ar",
        targetLocale="ar",
    )
    result = await transcreate_variant(
        payload,
        translation_provider=_FaithfulTranslationProvider(),
        provider_name="stub-faithful",
        model="stub",
    )
    assert result.variant.direction == "rtl"


@pytest.mark.asyncio
async def test_transcreate_keeps_ltr_direction_for_french_target() -> None:
    payload = CampaignTranscreateInput(
        sourceVariant=ContentVariant(headline="Book your appointment"),
        sourceLanguage="en",
        targetLanguage="fr",
        targetLocale="fr",
    )
    result = await transcreate_variant(
        payload,
        translation_provider=_FaithfulTranslationProvider(),
        provider_name="stub-faithful",
        model="stub",
    )
    assert result.variant.direction == "ltr"


@pytest.mark.asyncio
async def test_transcreate_detects_protected_term_and_url_loss_as_semantic_drift() -> None:
    payload = CampaignTranscreateInput(
        sourceVariant=ContentVariant(
            headline="Visit Miraaj.tech",
            primaryText="Book now at https://miraaj.tech/book or call +213-555-000-111.",
        ),
        sourceLanguage="en",
        targetLanguage="fr",
        targetLocale="fr",
    )
    result = await transcreate_variant(
        payload,
        translation_provider=_LossyTranslationProvider(),
        provider_name="stub-lossy",
        model="stub",
    )

    assert result.semanticPreservationScore is not None
    assert result.semanticPreservationScore < 0.8
    assert "semantic_drift" in result.reviewReasonCodes
    assert "protected_term_changed" in result.reviewReasonCodes
    assert result.variant.protectedTermReport


@pytest.mark.asyncio
async def test_transcreate_preserves_faithful_translation_without_drift_flags() -> None:
    payload = CampaignTranscreateInput(
        sourceVariant=ContentVariant(
            headline="Visit Miraaj.tech", primaryText="Book your appointment."
        ),
        sourceLanguage="en",
        targetLanguage="fr",
        targetLocale="fr",
    )
    result = await transcreate_variant(
        payload,
        translation_provider=_FaithfulTranslationProvider(),
        provider_name="stub-faithful",
        model="stub",
    )

    assert "semantic_drift" not in result.reviewReasonCodes
    assert "protected_term_changed" not in result.reviewReasonCodes
    assert result.variant.headline == "[fr] Visit Miraaj.tech"


@pytest.mark.asyncio
async def test_transcreate_injects_payment_disclosure_when_missing() -> None:
    from app.models.campaign_enums import PAYMENT_COMPLIANCE_DISCLAIMERS

    payload = CampaignTranscreateInput(
        sourceVariant=ContentVariant(
            headline="Accept payments online", primaryText="Set up your account."
        ),
        sourceLanguage="en",
        targetLanguage="fr",
        targetLocale="fr",
        paymentServicePresent=True,
    )
    result = await transcreate_variant(
        payload,
        translation_provider=_FaithfulTranslationProvider(),
        provider_name="stub-faithful",
        model="stub",
    )

    combined_disclosures = " ".join(result.variant.disclosures)
    assert PAYMENT_COMPLIANCE_DISCLAIMERS["fr"] in combined_disclosures
    assert "missing_disclosure" not in result.reviewReasonCodes
