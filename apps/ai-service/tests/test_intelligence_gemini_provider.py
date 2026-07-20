import asyncio

import pytest

from app.core.config import get_settings, reset_settings_cache
from app.models.intelligence_schemas import BusinessReasoningInput
from app.services.intelligence.gemini_provider import GeminiBusinessReasoningProvider

_VALID_OUTPUT_PAYLOAD = {
    "rankedBusinessTypes": [{"code": "dental_clinic", "confidence": 0.9}],
    "rankedAudienceTypes": [{"code": "professional_dentist", "confidence": 0.9}],
    "decisionMakerLikelihood": {
        "level": "high",
        "signal": {"code": "professional_dentist", "confidence": 0.9},
    },
    "promotionEligibility": {
        "status": "eligible_b2b",
        "signal": {"code": "professional_dentist", "confidence": 0.9},
    },
    "needs": [],
    "painPoints": [],
    "objectives": [],
    "contradictions": [],
    "regulatedDomainSignals": [],
    "evidence": [],
    "requiresReview": False,
    "reviewReasonCodes": [],
}


def test_gemini_reasoning_disabled_without_key() -> None:
    settings = get_settings()
    provider = GeminiBusinessReasoningProvider(settings, allow_live_requests=False)
    assert provider.is_enabled() is False


def test_gemini_reasoning_enabled_flag_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_REASONING_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    reset_settings_cache()
    settings = get_settings()
    provider = GeminiBusinessReasoningProvider(settings, allow_live_requests=False)
    assert provider.is_enabled() is False
    reset_settings_cache()


@pytest.mark.asyncio
async def test_gemini_mock_response_parses_schema() -> None:
    settings = get_settings()
    provider = GeminiBusinessReasoningProvider(settings, allow_live_requests=False)
    result = await provider.analyze_with_mock_response(_VALID_OUTPUT_PAYLOAD)
    assert result.provider == "gemini"
    assert result.rankedBusinessTypes[0].code == "dental_clinic"
    assert result.promotionEligibility.status == "eligible_b2b"


def test_gemini_repairs_wrapped_json() -> None:
    import json

    settings = get_settings()
    provider = GeminiBusinessReasoningProvider(settings, allow_live_requests=False)
    wrapped = "Here is the analysis:```" + json.dumps(_VALID_OUTPUT_PAYLOAD) + "```"
    parsed = provider._parse_output(wrapped, processing_ms=5)
    assert parsed.rankedAudienceTypes[0].code == "professional_dentist"


def test_gemini_raises_on_schema_validation_failure() -> None:
    import json

    settings = get_settings()
    provider = GeminiBusinessReasoningProvider(settings, allow_live_requests=False)
    invalid_payload = json.dumps({"unexpectedField": "missing required reasoning fields"})
    with pytest.raises(ValueError, match="invalid JSON"):
        provider._parse_output(invalid_payload, processing_ms=1)


def test_gemini_raises_on_unrecoverable_invalid_json() -> None:
    settings = get_settings()
    provider = GeminiBusinessReasoningProvider(settings, allow_live_requests=False)
    with pytest.raises(ValueError, match="invalid JSON"):
        provider._parse_output("not json at all, no braces here", processing_ms=1)


def test_gemini_live_requests_blocked_in_tests() -> None:
    settings = get_settings()
    provider = GeminiBusinessReasoningProvider(settings, allow_live_requests=False)

    async def _call() -> None:
        await provider.analyze(BusinessReasoningInput())

    with pytest.raises(RuntimeError, match="disabled"):
        asyncio.run(_call())


def test_gemini_never_exposes_api_key_in_repr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_REASONING_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "super-secret-key-value")
    reset_settings_cache()
    settings = get_settings()
    provider = GeminiBusinessReasoningProvider(settings, allow_live_requests=False)
    assert "super-secret-key-value" not in repr(settings.GEMINI_API_KEY)
    assert "super-secret-key-value" not in str(provider._settings.GEMINI_API_KEY)
    reset_settings_cache()
