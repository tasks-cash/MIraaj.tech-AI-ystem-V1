from __future__ import annotations

import io
import shutil
import subprocess
from time import perf_counter

from PIL import Image

from app.core.config import Settings
from app.models.media_schemas import OCRPage, OCRResultPayload, OCRWarning
from app.services.language_detection import detect_language
from app.services.ocr.normalize_text import normalize_ocr_text
from app.services.script_detection import detect_scripts


class TesseractOCRProvider:
    provider_name = "tesseract"
    provider_version = "system"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._binary = shutil.which("tesseract")

    def is_available(self) -> bool:
        return self._binary is not None

    def installed_language_packs(self) -> frozenset[str]:
        if not self._binary:
            return frozenset()
        try:
            completed = subprocess.run(
                [self._binary, "--list-langs"],
                check=True,
                capture_output=True,
                text=True,
                timeout=5,
            )
        except (OSError, subprocess.SubprocessError):
            return frozenset()
        lines = completed.stdout.splitlines()[1:]
        return frozenset(line.strip() for line in lines if line.strip())

    def run_ocr(
        self,
        *,
        image_bytes: bytes,
        language_packs: tuple[str, ...],
        timeout_seconds: int,
        page_segmentation_mode: int = 3,
    ) -> OCRResultPayload:
        if not self._binary:
            raise RuntimeError("OCR engine unavailable.")

        available = self.installed_language_packs()
        requested = list(language_packs)
        languages_available = [pack for pack in requested if pack in available]
        languages_unavailable = [pack for pack in requested if pack not in available]
        if not languages_available:
            raise RuntimeError("No requested OCR language packs are installed.")

        started = perf_counter()
        with Image.open(io.BytesIO(image_bytes)) as image:
            width, height = image.size

        language_arg = "+".join(languages_available)
        try:
            completed = subprocess.run(
                [
                    self._binary,
                    "-",
                    "stdout",
                    "-l",
                    language_arg,
                    "--psm",
                    str(page_segmentation_mode),
                ],
                input=image_bytes,
                check=True,
                capture_output=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired as error:
            raise TimeoutError("OCR timed out.") from error
        except subprocess.CalledProcessError as error:
            raise RuntimeError("OCR failed.") from error

        raw_text = completed.stdout.decode("utf-8", errors="replace")
        normalized_text = normalize_ocr_text(raw_text)
        script_result = detect_scripts(normalized_text or raw_text)
        language_detection = detect_language(normalized_text or raw_text)
        average_confidence = 0.72 if normalized_text.strip() else 0.0
        warnings: list[OCRWarning] = []
        if languages_unavailable:
            warnings.append(
                OCRWarning(
                    code="OCR_LANGUAGE_PACK_MISSING",
                    message="Some requested OCR language packs are unavailable.",
                )
            )

        page = OCRPage(
            page=1,
            width=width,
            height=height,
            rawText=raw_text,
            normalizedText=normalized_text,
            averageConfidence=average_confidence,
        )
        requires_review = (
            average_confidence < self._settings.OCR_MIN_CONFIDENCE
            or language_detection.requiresReview
            or bool(languages_unavailable)
        )
        return OCRResultPayload(
            provider=self.provider_name,
            providerVersion=self.provider_version,
            languagesRequested=requested,
            languagesAvailable=languages_available,
            languagesUnavailable=languages_unavailable,
            pages=[page],
            rawText=raw_text,
            normalizedText=normalized_text,
            detectedScripts=script_result.scripts,
            languageDetection=language_detection,
            averageConfidence=average_confidence,
            warnings=warnings,
            requiresReview=requires_review,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )
