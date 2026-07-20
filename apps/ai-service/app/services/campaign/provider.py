from __future__ import annotations

from typing import Protocol

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


class CampaignGenerationProvider(Protocol):
    provider_name: str

    def is_enabled(self) -> bool: ...

    async def strategy(self, payload: CampaignStrategyInput) -> CampaignStrategyOutput: ...

    async def generate(self, payload: CampaignGenerationInput) -> CampaignGenerationOutput: ...

    async def transcreate(self, payload: CampaignTranscreateInput) -> CampaignTranscreateOutput: ...

    async def quality_check(
        self, payload: CampaignQualityCheckInput
    ) -> CampaignQualityCheckOutput: ...

    async def compliance_check(
        self, payload: CampaignComplianceCheckInput
    ) -> CampaignComplianceCheckOutput: ...

    async def health_check(self) -> dict[str, object]: ...
