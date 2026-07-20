"""Deterministic quality/compliance evaluation shared by every campaign
provider (disabled and Gemini alike).

Scoring and compliance checks never require an LLM: they operate on content
the caller already supplies, so both providers run the exact same rule
engine here. This is deliberate defense-in-depth — a live LLM must never be
the sole judge of whether its own (or anyone else's) output is compliant.
"""

from __future__ import annotations

from time import perf_counter

from app.models.campaign_schemas import (
    CampaignComplianceCheckInput,
    CampaignComplianceCheckOutput,
    CampaignQualityBreakdown,
    CampaignQualityCheckInput,
    CampaignQualityCheckOutput,
)
from app.services.campaign import safety

_LOW_QUALITY_THRESHOLD = 0.7


def _variant_text(variant: object) -> str:
    parts = [
        getattr(variant, "headline", ""),
        getattr(variant, "primaryText", ""),
        getattr(variant, "shortText", ""),
        " ".join(getattr(variant, "hashtags", []) or []),
        " ".join(getattr(variant, "disclosures", []) or []),
    ]
    return " ".join(part for part in parts if part)


async def evaluate_quality(
    payload: CampaignQualityCheckInput, *, provider_name: str, model: str | None
) -> CampaignQualityCheckOutput:
    started = perf_counter()
    variant_text = _variant_text(payload.variant)
    source_text = _variant_text(payload.sourceVariant) if payload.sourceVariant else ""

    prohibited = safety.scan_prohibited_claims(
        variant_text
    ) + safety.scan_payment_prohibited_claims(variant_text)
    fake_stats = safety.scan_fake_statistics(variant_text)
    forbidden_phrases_hit = any(
        phrase and phrase.lower() in variant_text.lower()
        for phrase in (payload.brandVoice.forbiddenPhrases if payload.brandVoice else [])
    )
    sensitive_hit = safety.scan_sensitive_trait_targeting(variant_text)

    decision_maker_score = {
        "high": 1.0,
        "medium": 0.6,
        "low": 0.3,
        None: 0.5,
    }[payload.businessContext.decisionMakerLevel if payload.businessContext else None]

    semantic_score = (
        safety.estimate_semantic_preservation(source_text, variant_text) if source_text else 1.0
    )
    claim_safety_score = 0.0 if (prohibited or fake_stats) else 1.0
    cultural_sensitivity_score = 0.0 if sensitive_hit else 1.0
    brand_voice_score = 0.0 if forbidden_phrases_hit else 1.0

    breakdown = CampaignQualityBreakdown(
        sourceQualityScore=1.0 if payload.businessContext else 0.5,
        audienceFitScore=(
            1.0 if payload.businessContext and payload.businessContext.audienceType else 0.5
        ),
        decisionMakerFitScore=decision_maker_score,
        objectiveFitScore=1.0 if payload.campaignObjective else 0.5,
        funnelStageFitScore=1.0 if payload.funnelStage else 0.5,
        serviceFactScore=semantic_score if source_text else 0.5,
        valuePropositionScore=1.0 if len(payload.variant.primaryText.strip()) > 10 else 0.4,
        brandVoiceScore=brand_voice_score,
        messageClarityScore=1.0 if payload.variant.headline.strip() else 0.4,
        claimSafetyScore=claim_safety_score,
        complianceScore=claim_safety_score,
        platformFitScore=1.0 if payload.platform else 0.7,
        formatFitScore=0.7,
        ctaFitScore=1.0 if payload.variant.cta != "no_direct_cta" else 0.5,
        languageQualityScore=1.0 if variant_text.strip() else 0.0,
        semanticPreservationScore=semantic_score,
        transcreationQualityScore=semantic_score if source_text else 0.7,
        culturalSensitivityScore=cultural_sensitivity_score,
        accessibilityScore=0.7,
        contentOriginalityScore=0.6,
        overallQualityScore=0.0,
    )
    scores = [
        breakdown.sourceQualityScore,
        breakdown.audienceFitScore,
        breakdown.decisionMakerFitScore,
        breakdown.objectiveFitScore,
        breakdown.funnelStageFitScore,
        breakdown.serviceFactScore,
        breakdown.valuePropositionScore,
        breakdown.brandVoiceScore,
        breakdown.messageClarityScore,
        breakdown.claimSafetyScore,
        breakdown.complianceScore,
        breakdown.platformFitScore,
        breakdown.formatFitScore,
        breakdown.ctaFitScore,
        breakdown.languageQualityScore,
        breakdown.semanticPreservationScore,
        breakdown.transcreationQualityScore,
        breakdown.culturalSensitivityScore,
        breakdown.accessibilityScore,
        breakdown.contentOriginalityScore,
    ]
    breakdown.overallQualityScore = round(sum(scores) / len(scores), 4)

    review_reason_codes: list[str] = []
    if prohibited or fake_stats:
        review_reason_codes.append("unsupported_claim")
    if sensitive_hit:
        review_reason_codes.append("unsuitable_target")
    if breakdown.semanticPreservationScore < 0.8 and source_text:
        review_reason_codes.append("semantic_drift")
    if breakdown.overallQualityScore < _LOW_QUALITY_THRESHOLD:
        review_reason_codes.append("low_overall_quality")

    return CampaignQualityCheckOutput(
        provider=provider_name,
        model=model,
        breakdown=breakdown,
        requiresReview=bool(review_reason_codes),
        reviewReasonCodes=sorted(set(review_reason_codes)),
        processingMs=max(0, round((perf_counter() - started) * 1_000)),
    )


async def evaluate_compliance(
    payload: CampaignComplianceCheckInput, *, provider_name: str, model: str | None
) -> CampaignComplianceCheckOutput:
    started = perf_counter()

    prohibited_claims: set[str] = set()
    sensitive_hit = False
    face_hit = False
    source_text = ""
    if payload.sourceContent:
        source_text = " ".join(
            [payload.sourceContent.ocrSummary, payload.sourceContent.additionalContext]
        )
    protected_term_issues: list[str] = []
    texts_by_language: dict[str, str] = {}

    for variant in payload.variants:
        text = _variant_text(variant)
        texts_by_language[variant.language] = " ".join(
            filter(None, [texts_by_language.get(variant.language, ""), text])
        )
        prohibited_claims.update(safety.scan_prohibited_claims(text))
        prohibited_claims.update(safety.scan_payment_prohibited_claims(text))
        prohibited_claims.update(safety.scan_fake_statistics(text))
        sensitive_hit = sensitive_hit or safety.scan_sensitive_trait_targeting(text)
        face_hit = face_hit or safety.scan_face_recognition_request(text)
        if source_text:
            protected_term_issues.extend(safety.check_protected_terms_preserved(source_text, text))

    missing_disclosure_languages: list[str] = []
    if payload.paymentServicePresent:
        missing_disclosure_languages = safety.missing_payment_disclosure_languages(
            texts_by_language, sorted(texts_by_language.keys())
        )

    review_reason_codes: list[str] = []
    if prohibited_claims:
        review_reason_codes.append("unsupported_claim")
    if sensitive_hit:
        review_reason_codes.append("unsuitable_target")
    if face_hit:
        review_reason_codes.append("manual_review_requested")
    if missing_disclosure_languages:
        review_reason_codes.append("missing_disclosure")
    if protected_term_issues:
        review_reason_codes.append("protected_term_changed")
    if payload.paymentServicePresent:
        review_reason_codes.append("payment_service")
    if payload.regulatedDomainSignals:
        review_reason_codes.append("regulated_domain")

    passed = not (
        prohibited_claims
        or sensitive_hit
        or face_hit
        or missing_disclosure_languages
        or protected_term_issues
    )

    return CampaignComplianceCheckOutput(
        provider=provider_name,
        model=model,
        passed=passed,
        prohibitedClaimsDetected=sorted(prohibited_claims),
        sensitiveTraitTargetingDetected=sensitive_hit,
        faceRecognitionRequestDetected=face_hit,
        missingDisclosureLanguages=missing_disclosure_languages,
        protectedTermIssues=sorted(set(protected_term_issues)),
        requiresReview=not passed,
        reviewReasonCodes=sorted(set(review_reason_codes)),
        processingMs=max(0, round((perf_counter() - started) * 1_000)),
    )
