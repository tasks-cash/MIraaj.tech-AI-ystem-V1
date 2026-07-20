import pytest
from pydantic import ValidationError

from app.models.campaign_schemas import (
    CampaignComplianceCheckInput,
    CampaignGenerationOutput,
    CampaignStrategyInput,
    CampaignStrategyOutput,
    ContentVariant,
    SourceContentSummary,
)


def test_campaign_strategy_input_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        CampaignStrategyInput.model_validate({"serviceName": "Website build", "notAField": "x"})


def test_content_variant_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        ContentVariant.model_validate({"headline": "Hi", "spooky": "field"})


def test_content_variant_rejects_invalid_cta_code() -> None:
    with pytest.raises(ValidationError):
        ContentVariant.model_validate({"cta": "not_a_real_cta"})


def test_content_variant_bounds_headline_length() -> None:
    with pytest.raises(ValidationError):
        ContentVariant.model_validate({"headline": "x" * 500})


def test_content_variant_truncates_hashtags_and_keywords() -> None:
    variant = ContentVariant.model_validate({"hashtags": ["x" * 200], "keywords": ["y" * 200]})
    assert len(variant.hashtags[0]) == 60
    assert len(variant.keywords[0]) == 60


def test_content_variant_bounds_array_length() -> None:
    with pytest.raises(ValidationError):
        ContentVariant.model_validate({"hashtags": [f"tag{i}" for i in range(25)]})


def test_source_content_summary_bounds_untrusted_text() -> None:
    with pytest.raises(ValidationError):
        SourceContentSummary.model_validate({"ocrSummary": "x" * 200_001})


def test_campaign_strategy_output_rejects_invalid_review_reason_code() -> None:
    with pytest.raises(ValidationError):
        CampaignStrategyOutput.model_validate(
            {"provider": "disabled", "reviewReasonCodes": ["not_a_real_code"]}
        )


def test_campaign_strategy_output_allows_minimal_disabled_shell() -> None:
    output = CampaignStrategyOutput.model_validate(
        {
            "provider": "disabled",
            "requiresReview": True,
            "reviewReasonCodes": ["provider_dependency"],
        }
    )
    assert output.recommendedCampaignType is None
    assert output.rankedObjectives == []


def test_campaign_generation_output_bounds_platform_variants() -> None:
    with pytest.raises(ValidationError):
        CampaignGenerationOutput.model_validate(
            {
                "provider": "gemini",
                "platformVariants": [
                    {"platform": "facebook", "format": "short_post"} for _ in range(41)
                ],
            }
        )


def test_compliance_check_input_requires_at_least_one_variant() -> None:
    with pytest.raises(ValidationError):
        CampaignComplianceCheckInput.model_validate({"variants": []})


def test_compliance_check_variant_requires_language() -> None:
    output = CampaignComplianceCheckInput.model_validate(
        {"variants": [{"headline": "Hi", "language": "en"}]}
    )
    assert output.variants[0].language == "en"
