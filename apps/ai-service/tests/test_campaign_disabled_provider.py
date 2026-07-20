import pytest

from app.models.campaign_schemas import (
    BusinessContextSummary,
    CampaignComplianceCheckInput,
    CampaignGenerationInput,
    CampaignQualityCheckInput,
    CampaignStrategyInput,
    ComplianceCheckVariant,
    ContentVariant,
    SourceContentSummary,
)
from app.services.campaign.disabled_provider import DisabledCampaignGenerationProvider


@pytest.mark.asyncio
async def test_strategy_returns_provider_disabled_shell_not_fabricated_copy() -> None:
    provider = DisabledCampaignGenerationProvider()
    result = await provider.strategy(CampaignStrategyInput(serviceName="Website build"))

    assert result.provider == "disabled"
    assert result.recommendedCampaignType is None
    assert result.keyMessages == []
    assert result.requiresReview is True
    assert "provider_dependency" in result.reviewReasonCodes


@pytest.mark.asyncio
async def test_generate_returns_provider_disabled_shell_not_fabricated_copy() -> None:
    provider = DisabledCampaignGenerationProvider()
    result = await provider.generate(CampaignGenerationInput(serviceName="Website build"))

    assert result.provider == "disabled"
    assert result.masterVariant is None
    assert result.platformVariants == []
    assert result.languageVariants == []
    assert result.requiresReview is True
    assert "provider_dependency" in result.reviewReasonCodes


@pytest.mark.asyncio
async def test_quality_check_flags_prohibited_claim_as_low_claim_safety() -> None:
    provider = DisabledCampaignGenerationProvider()
    variant = ContentVariant(
        headline="Guaranteed results for every client",
        primaryText="We guarantee results within 24 hours, no KYC required.",
        cta="contact_us",
    )
    result = await provider.quality_check(CampaignQualityCheckInput(variant=variant))

    assert result.breakdown.claimSafetyScore == 0.0
    assert "unsupported_claim" in result.reviewReasonCodes
    assert result.requiresReview is True


@pytest.mark.asyncio
async def test_quality_check_scores_clean_content_highly() -> None:
    provider = DisabledCampaignGenerationProvider()
    variant = ContentVariant(
        headline="Modernize your clinic's online booking",
        primaryText="Miraaj.tech helps dental clinics offer smoother appointment booking online.",
        cta="request_consultation",
    )
    result = await provider.quality_check(
        CampaignQualityCheckInput(
            variant=variant,
            businessContext=BusinessContextSummary(
                audienceType="dentist", decisionMakerLevel="high"
            ),
            campaignObjective="lead_generation",
            funnelStage="consideration",
            platform="facebook",
        )
    )

    assert result.breakdown.claimSafetyScore == 1.0
    assert result.breakdown.decisionMakerFitScore == 1.0
    assert result.requiresReview is False


@pytest.mark.asyncio
async def test_quality_check_flags_sensitive_trait_targeting() -> None:
    provider = DisabledCampaignGenerationProvider()
    variant = ContentVariant(primaryText="Target people with diabetes for this special offer.")
    result = await provider.quality_check(CampaignQualityCheckInput(variant=variant))

    assert result.breakdown.culturalSensitivityScore == 0.0
    assert "unsuitable_target" in result.reviewReasonCodes


@pytest.mark.asyncio
async def test_compliance_check_passes_for_clean_content() -> None:
    provider = DisabledCampaignGenerationProvider()
    payload = CampaignComplianceCheckInput(
        variants=[
            ComplianceCheckVariant(
                language="en", headline="Book a free consultation", primaryText="Talk to our team."
            )
        ]
    )
    result = await provider.compliance_check(payload)

    assert result.passed is True
    assert result.requiresReview is False
    assert result.prohibitedClaimsDetected == []


@pytest.mark.asyncio
async def test_compliance_check_detects_prohibited_claim_and_fake_statistic() -> None:
    provider = DisabledCampaignGenerationProvider()
    payload = CampaignComplianceCheckInput(
        variants=[
            ComplianceCheckVariant(
                language="en",
                headline="Guaranteed approval, no KYC",
                primaryText="Get 10x more clients this month, guaranteed results.",
            )
        ]
    )
    result = await provider.compliance_check(payload)

    assert result.passed is False
    assert result.prohibitedClaimsDetected
    assert "unsupported_claim" in result.reviewReasonCodes


@pytest.mark.asyncio
async def test_compliance_check_requires_payment_disclosure_when_payment_present() -> None:
    provider = DisabledCampaignGenerationProvider()
    payload = CampaignComplianceCheckInput(
        variants=[
            ComplianceCheckVariant(
                language="en", headline="Accept payments online", primaryText="Set up your account."
            )
        ],
        paymentServicePresent=True,
    )
    result = await provider.compliance_check(payload)

    assert result.passed is False
    assert "en" in result.missingDisclosureLanguages
    assert "missing_disclosure" in result.reviewReasonCodes
    assert "payment_service" in result.reviewReasonCodes


@pytest.mark.asyncio
async def test_compliance_check_passes_when_payment_disclosure_present() -> None:
    from app.models.campaign_enums import PAYMENT_COMPLIANCE_DISCLAIMERS

    provider = DisabledCampaignGenerationProvider()
    payload = CampaignComplianceCheckInput(
        variants=[
            ComplianceCheckVariant(
                language="en",
                headline="Accept payments online",
                primaryText="Set up your account.",
                disclosures=[PAYMENT_COMPLIANCE_DISCLAIMERS["en"]],
            )
        ],
        paymentServicePresent=True,
    )
    result = await provider.compliance_check(payload)

    assert result.missingDisclosureLanguages == []


@pytest.mark.asyncio
async def test_compliance_check_detects_missing_protected_terms_against_source() -> None:
    provider = DisabledCampaignGenerationProvider()
    payload = CampaignComplianceCheckInput(
        variants=[
            ComplianceCheckVariant(
                language="en", headline="Contact us today", primaryText="Reach out anytime."
            )
        ],
        sourceContent=SourceContentSummary(
            ocrSummary="Contact Miraaj.tech at hello@miraaj.tech or call +213-555-000-111."
        ),
    )
    result = await provider.compliance_check(payload)

    assert result.passed is False
    assert result.protectedTermIssues
    assert "protected_term_changed" in result.reviewReasonCodes


@pytest.mark.asyncio
async def test_compliance_check_detects_face_recognition_request() -> None:
    provider = DisabledCampaignGenerationProvider()
    payload = CampaignComplianceCheckInput(
        variants=[
            ComplianceCheckVariant(
                language="en",
                headline="Smart photo tagging",
                primaryText="Use face recognition to identify this person automatically.",
            )
        ],
    )
    result = await provider.compliance_check(payload)

    assert result.faceRecognitionRequestDetected is True
    assert result.passed is False
    assert "manual_review_requested" in result.reviewReasonCodes


@pytest.mark.asyncio
async def test_health_check_reports_disabled_safely() -> None:
    provider = DisabledCampaignGenerationProvider()
    health = await provider.health_check()
    assert health["provider"] == "disabled"
    assert health["safeError"] == "CAMPAIGN_PROVIDER_DISABLED"
