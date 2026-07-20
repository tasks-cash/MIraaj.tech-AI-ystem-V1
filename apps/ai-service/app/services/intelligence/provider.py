from __future__ import annotations

from typing import Protocol

from app.models.intelligence_schemas import BusinessReasoningInput, BusinessReasoningOutput


class BusinessReasoningProvider(Protocol):
    provider_name: str

    def is_enabled(self) -> bool: ...

    async def analyze(self, payload: BusinessReasoningInput) -> BusinessReasoningOutput: ...
