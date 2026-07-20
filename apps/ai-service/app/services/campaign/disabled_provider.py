"""Fail-safe campaign provider used whenever ``AI_CAMPAIGN_PROVIDER`` is not
``gemini`` (the default).

Creative generation (``strategy`` / ``generate``) has no safe deterministic
substitute — unlike Prompt 3's rule-based reasoning provider, there is no
taxonomy that lets us "write" campaign copy without an LLM. Those two methods
therefore return clear, minimal, empty structured shells with
``provider="disabled"`` and ``requiresReview=True`` rather than ever
fabricate marketing copy that could be mistaken for a real result.

``quality_check`` and ``compliance_check`` operate on content the caller
already supplies, so they run the shared deterministic rule engine in
``app.services.campaign.evaluation`` and never call an LLM.
"""

from __future__ import annotations

from time import perf_counter

from app.core.config import Settings
from app.models.campaign_schemas import (
    CampaignComplianceCheckInput,
    CampaignComplianceCheckOutput,
    CampaignGenerationInput,
    CampaignGenerationOutput,
    CampaignQualityCheckInput,
    CampaignQualityCheckOutput,
    CampaignStrategyInput,
    CampaignStrategyOutput,
    CampaignTranscreateInput,
    CampaignTranscreateOutput,
)
from app.services.campaign.evaluation import evaluate_compliance, evaluate_quality
from app.services.campaign.transcreation import transcreate_variant
from app.services.translation.disabled_provider import DisabledTranslationProvider


class DisabledCampaignGenerationProvider:
    provider_name = "disabled"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    def is_enabled(self) -> bool:
        return True

    async def strategy(self, payload: CampaignStrategyInput) -> CampaignStrategyOutput:  # noqa: ARG002
        started = perf_counter()
        return CampaignStrategyOutput(
            provider=self.provider_name,
            model=None,
            requiresReview=True,
            reviewReasonCodes=["provider_dependency"],
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    async def generate(self, payload: CampaignGenerationInput) -> CampaignGenerationOutput:  # noqa: ARG002
        started = perf_counter()
        return CampaignGenerationOutput(
            provider=self.provider_name,
            model=None,
            requiresReview=True,
            reviewReasonCodes=["provider_dependency"],
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    async def transcreate(self, payload: CampaignTranscreateInput) -> CampaignTranscreateOutput:
        return await transcreate_variant(
            payload,
            translation_provider=DisabledTranslationProvider(self._settings),
            provider_name=self.provider_name,
            model="",
        )

    async def quality_check(self, payload: CampaignQualityCheckInput) -> CampaignQualityCheckOutput:
        return await evaluate_quality(payload, provider_name=self.provider_name, model=None)

    async def compliance_check(
        self, payload: CampaignComplianceCheckInput
    ) -> CampaignComplianceCheckOutput:
        return await evaluate_compliance(payload, provider_name=self.provider_name, model=None)

    async def health_check(self) -> dict[str, object]:
        return {
            "provider": self.provider_name,
            "status": "ok",
            "safeError": "CAMPAIGN_PROVIDER_DISABLED",
        }
