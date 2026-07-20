from __future__ import annotations

import re
from typing import Protocol

from app.models.media_schemas import OCRResultPayload


class OCRProvider(Protocol):
    provider_name: str
    provider_version: str

    def is_available(self) -> bool: ...

    def installed_language_packs(self) -> frozenset[str]: ...

    def run_ocr(
        self,
        *,
        image_bytes: bytes,
        language_packs: tuple[str, ...],
        timeout_seconds: int,
    ) -> OCRResultPayload: ...


PROTECTED_BRAND_PATTERN = re.compile(
    r"\b(Miraaj\.tech|Tasks\.cash)\b",
    re.IGNORECASE,
)
