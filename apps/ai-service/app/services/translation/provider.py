from __future__ import annotations

from typing import Protocol

from app.models.translation_schemas import (
    TranslationInput,
    TranslationOutput,
    TranslationProviderHealth,
)


class TranslationProvider(Protocol):
    provider_id: str

    def is_enabled(self) -> bool: ...

    async def translate(self, payload: TranslationInput) -> TranslationOutput: ...

    async def health_check(self) -> TranslationProviderHealth: ...
