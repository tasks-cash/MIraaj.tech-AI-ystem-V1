from __future__ import annotations

from app.models.media_schemas import VisionAnalysisOutput


class DisabledVisionProvider:
    provider_name = "disabled"

    def is_enabled(self) -> bool:
        return False

    async def analyze(
        self,
        *,
        image_bytes: bytes,
        mime_type: str,
        purpose: str | None,
        locale: str | None,
        country: str | None,
        ocr_text: str | None,
    ) -> VisionAnalysisOutput:
        raise RuntimeError("Vision provider is disabled.")
