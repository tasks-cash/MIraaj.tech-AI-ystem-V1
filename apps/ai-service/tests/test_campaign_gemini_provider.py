import asyncio

import pytest

from app.core.config import get_settings, reset_settings_cache
from app.models.campaign_schemas import CampaignStrategyInput
from app.services.campaign.gemini_provider import GeminiCampaignGenerationProvider

_VALID_STRATEGY_PAYLOAD = {
    "recommendedCampaignType": "single_service_campaign",
    "recommendedFunnelStage": "consideration",
    "rankedObjectives": [{"code": "lead_generation", "confidence": 0.8}],
    "keyMessages": ["Modernize your booking flow."],
    "requiresReview": False,
    "reviewReasonCodes": [],
}

_VALID_GENERATION_PAYLOAD = {
    "masterVariant": {
        "headline": "Modernize your clinic's booking",
        "primaryText": "Miraaj.tech helps dental clinics streamline appointment booking.",
        "cta": "request_consultation",
    },
    "platformVariants": [],
    "languageVariants": [],
    "requiresReview": False,
    "reviewReasonCodes": [],
}


def test_campaign_provider_disabled_without_key() -> None:
    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)
    assert provider.is_enabled() is False


def test_campaign_provider_enabled_flag_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_CAMPAIGN_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    reset_settings_cache()
    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)
    assert provider.is_enabled() is False
    reset_settings_cache()


@pytest.mark.asyncio
async def test_strategy_mock_response_parses_schema() -> None:
    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)
    result = await provider.strategy_with_mock_response(_VALID_STRATEGY_PAYLOAD)
    assert result.provider == "gemini"
    assert result.recommendedCampaignType == "single_service_campaign"
    assert result.rankedObjectives[0].code == "lead_generation"


@pytest.mark.asyncio
async def test_generate_mock_response_parses_schema() -> None:
    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)
    result = await provider.generate_with_mock_response(_VALID_GENERATION_PAYLOAD)
    assert result.provider == "gemini"
    assert result.masterVariant is not None
    assert result.masterVariant.cta == "request_consultation"


def test_generate_and_validate_repairs_wrapped_json() -> None:
    import json

    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)
    from app.models.campaign_schemas import CampaignStrategyOutput

    wrapped = "Here it is:```" + json.dumps(_VALID_STRATEGY_PAYLOAD) + "```"
    parsed = provider._parse_output(wrapped, CampaignStrategyOutput, processing_ms=5)
    assert parsed.recommendedCampaignType == "single_service_campaign"


def test_generate_and_validate_raises_on_unrecoverable_invalid_json() -> None:
    from app.models.campaign_schemas import CampaignStrategyOutput

    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)
    with pytest.raises(ValueError, match="invalid JSON"):
        provider._parse_output("not json, no braces", CampaignStrategyOutput, processing_ms=1)


def test_campaign_live_requests_blocked_in_tests() -> None:
    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)

    async def _call() -> None:
        await provider.strategy(CampaignStrategyInput())

    with pytest.raises(RuntimeError, match="disabled"):
        asyncio.run(_call())


def test_campaign_never_exposes_api_key_in_repr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_CAMPAIGN_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "super-secret-campaign-key")
    reset_settings_cache()
    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)
    assert "super-secret-campaign-key" not in repr(settings.GEMINI_API_KEY)
    assert "super-secret-campaign-key" not in str(provider._settings.GEMINI_API_KEY)
    reset_settings_cache()


@pytest.mark.asyncio
async def test_prompt_injection_in_source_content_forces_review_even_if_model_says_no() -> None:
    """Defense in depth: even if the (mocked) model output claims the
    content needed no review, an injection match in the untrusted source
    text must still force ``requiresReview``."""

    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)

    from app.services.campaign.gemini_provider import _flag_injection

    clean_output = await provider.strategy_with_mock_response(_VALID_STRATEGY_PAYLOAD)
    assert clean_output.requiresReview is False

    flagged = _flag_injection(clean_output, matched=True)
    assert flagged.requiresReview is True
    assert "prompt_injection_detected" in flagged.reviewReasonCodes


@pytest.mark.asyncio
async def test_health_check_reflects_disabled_state() -> None:
    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)
    health = await provider.health_check()
    assert health["status"] == "unavailable"
    assert health["safeError"] == "CAMPAIGN_PROVIDER_DISABLED"


@pytest.mark.asyncio
async def test_quality_and_compliance_check_never_require_live_requests() -> None:
    """quality_check/compliance_check are deterministic and must work even
    when live Gemini calls are disallowed — they never hit the network."""
    from app.models.campaign_schemas import (
        CampaignComplianceCheckInput,
        CampaignQualityCheckInput,
        ComplianceCheckVariant,
        ContentVariant,
    )

    settings = get_settings()
    provider = GeminiCampaignGenerationProvider(settings, allow_live_requests=False)

    variant = ContentVariant(headline="Book now", primaryText="Great offer")
    quality = await provider.quality_check(CampaignQualityCheckInput(variant=variant))
    assert quality.provider == "gemini"

    compliance = await provider.compliance_check(
        CampaignComplianceCheckInput(
            variants=[ComplianceCheckVariant(language="en", headline="Book now")]
        )
    )
    assert compliance.provider == "gemini"
    assert compliance.passed is True
