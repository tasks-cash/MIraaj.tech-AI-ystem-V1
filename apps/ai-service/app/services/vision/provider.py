from __future__ import annotations

from typing import Protocol

from app.models.media_schemas import VisionAnalysisOutput


class VisionProvider(Protocol):
    provider_name: str

    def is_enabled(self) -> bool: ...

    async def analyze(
        self,
        *,
        image_bytes: bytes,
        mime_type: str,
        purpose: str | None,
        locale: str | None,
        country: str | None,
        ocr_text: str | None,
    ) -> VisionAnalysisOutput: ...
