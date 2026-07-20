"""Shared transcreation orchestration used by both the disabled and Gemini
campaign providers. Delegates the actual text translation to a
``TranslationProvider`` (disabled or Gemini) and layers campaign-specific
safety checks (protected-term preservation, payment disclosures, RTL
metadata, semantic-drift scoring) on top — those checks never depend on
which translation backend produced the text.
"""

from __future__ import annotations

from time import perf_counter

from app.models.campaign_enums import PAYMENT_COMPLIANCE_DISCLAIMERS, direction_for_language
from app.models.campaign_schemas import (
    CampaignTranscreateInput,
    CampaignTranscreateOutput,
    LanguageVariant,
)
from app.models.translation_schemas import TranslationInput, TranslationOutput
from app.services.campaign import safety
from app.services.translation.provider import TranslationProvider


async def transcreate_variant(
    payload: CampaignTranscreateInput,
    *,
    translation_provider: TranslationProvider,
    provider_name: str,
    model: str,
) -> CampaignTranscreateOutput:
    started = perf_counter()
    source = payload.sourceVariant
    protected_terms = [*payload.protectedTerms]

    async def _translate(text: str) -> TranslationOutput | None:
        if not text:
            return None
        return await translation_provider.translate(
            TranslationInput(
                sourceLanguage=payload.sourceLanguage,
                targetLanguage=payload.targetLanguage,
                targetLocale=payload.targetLocale,
                countryCode=payload.countryCode,
                text=text,
                businessSector=payload.businessSector,
                service=payload.service,
                platform=payload.platform,
                brandTerminology=payload.brandTerminology,
                protectedTerms=protected_terms,
                requiredTone=payload.requiredTone,
                formality=payload.formality,
                glossaryKeys=payload.glossaryKeys,
            )
        )

    headline_result = await _translate(source.headline)
    primary_result = await _translate(source.primaryText)
    short_result = await _translate(source.shortText)
    hashtags_result = await _translate("\n".join(source.hashtags))
    keywords_result = await _translate("\n".join(source.keywords))
    disclosures_result = await _translate("\n".join(source.disclosures))

    all_results = [
        result
        for result in (
            headline_result,
            primary_result,
            short_result,
            hashtags_result,
            keywords_result,
            disclosures_result,
        )
        if result is not None
    ]
    warnings = sorted({warning for result in all_results for warning in result.warnings})
    protected_term_report = sorted(
        {term for result in all_results for term in result.protectedTermReport}
    )
    confidences = [result.confidence for result in all_results if result.confidence is not None]
    human_review_recommended = any(result.humanReviewRecommended for result in all_results)

    translated_headline = headline_result.translatedText if headline_result else ""
    translated_primary = primary_result.translatedText if primary_result else ""
    translated_short = short_result.translatedText if short_result else ""
    hashtag_lines = hashtags_result.translatedText.splitlines() if hashtags_result else []
    translated_hashtags = [item for item in hashtag_lines if item]
    keyword_lines = keywords_result.translatedText.splitlines() if keywords_result else []
    translated_keywords = [item for item in keyword_lines if item]
    translated_disclosures = [
        item
        for item in (disclosures_result.translatedText.splitlines() if disclosures_result else [])
        if item
    ]

    if payload.paymentServicePresent:
        target_language_key = payload.targetLanguage.strip().lower()
        required_disclosure = PAYMENT_COMPLIANCE_DISCLAIMERS.get(target_language_key)
        combined_disclosure_text = " ".join([*translated_disclosures, translated_primary])
        if required_disclosure and not safety.has_payment_disclosure(
            combined_disclosure_text, payload.targetLanguage
        ):
            translated_disclosures.append(required_disclosure)

    source_combined = " ".join(
        filter(None, [source.headline, source.primaryText, source.shortText])
    )
    output_combined = " ".join(
        filter(None, [translated_headline, translated_primary, translated_short])
    )
    semantic_score = (
        safety.estimate_semantic_preservation(source_combined, output_combined)
        if source_combined
        else None
    )
    protected_issues = (
        safety.check_protected_terms_preserved(source_combined, output_combined)
        if source_combined
        else []
    )

    review_reason_codes: list[str] = []
    if human_review_recommended or not translation_provider.is_enabled():
        review_reason_codes.append("translation_unavailable")
    if confidences and min(confidences) < 0.6:
        review_reason_codes.append("low_translation_confidence")
    if semantic_score is not None and semantic_score < 0.8:
        review_reason_codes.append("semantic_drift")
    if protected_issues:
        review_reason_codes.append("protected_term_changed")
    if payload.paymentServicePresent and not safety.has_payment_disclosure(
        " ".join(translated_disclosures), payload.targetLanguage
    ):
        review_reason_codes.append("missing_disclosure")

    variant = LanguageVariant(
        headline=translated_headline,
        primaryText=translated_primary,
        shortText=translated_short,
        cta=source.cta,
        hashtags=translated_hashtags,
        keywords=translated_keywords,
        disclosures=translated_disclosures,
        direction=direction_for_language(payload.targetLanguage),
        language=payload.targetLanguage,
        locale=payload.targetLocale,
        countryCode=payload.countryCode,
        translationStrategy=(
            "transcreation" if payload.localizationMode == "transcreation" else "direct_translation"
        ),
        provider=provider_name,
        model=model,
        confidence=min(confidences) if confidences else None,
        warnings=warnings[:20],
        protectedTermReport=sorted(set(protected_term_report + protected_issues))[:20],
        humanReviewRecommended=human_review_recommended,
    )

    return CampaignTranscreateOutput(
        provider=provider_name,
        model=model,
        variant=variant,
        semanticPreservationScore=semantic_score,
        requiresReview=bool(review_reason_codes),
        reviewReasonCodes=sorted(set(review_reason_codes)),
        processingMs=max(0, round((perf_counter() - started) * 1_000)),
    )
