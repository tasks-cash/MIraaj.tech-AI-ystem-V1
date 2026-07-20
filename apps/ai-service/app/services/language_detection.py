from __future__ import annotations

import re

from app.models.media_schemas import DetectedLanguageScore, LanguageDetectionSummary
from app.services.ocr.language_selector import OCR_PACK_TO_LANGUAGE
from app.services.script_detection import detect_scripts

URL_ONLY_PATTERN = re.compile(r"^https?://", re.IGNORECASE)
NUMERIC_ONLY_PATTERN = re.compile(r"^[\d\s+\-().]+$")
BRAND_ONLY_PATTERN = re.compile(r"^(Miraaj\.tech|Tasks\.cash)$", re.IGNORECASE)

LANGUAGE_HINTS: dict[str, tuple[str, ...]] = {
    "Latin": ("en", "fr", "es", "de", "pt", "it", "nl", "tr"),
    "Arabic": ("ar",),
    "Cyrillic": ("ru",),
}


def detect_language(
    text: str,
    *,
    locale: str | None = None,
    country: str | None = None,
) -> LanguageDetectionSummary:
    stripped = text.strip()
    if not stripped or len(stripped) < 4:
        return LanguageDetectionSummary(
            ambiguous=True,
            requiresReview=True,
            evidence=["text_too_short"],
        )
    if URL_ONLY_PATTERN.match(stripped):
        return LanguageDetectionSummary(
            ambiguous=True,
            requiresReview=False,
            evidence=["url_only"],
        )
    if NUMERIC_ONLY_PATTERN.match(stripped):
        return LanguageDetectionSummary(
            ambiguous=True,
            requiresReview=False,
            evidence=["numeric_only"],
        )
    if BRAND_ONLY_PATTERN.match(stripped):
        return LanguageDetectionSummary(
            ambiguous=True,
            requiresReview=False,
            evidence=["brand_only"],
        )

    script_result = detect_scripts(stripped)
    detected: list[DetectedLanguageScore] = []
    evidence = [f"script:{script_result.primaryScript or 'unknown'}"]

    if locale:
        language = locale.split("-")[0].lower()
        detected.append(DetectedLanguageScore(language=language, confidence=0.8, proportion=0.5))
        evidence.append(f"locale_hint:{locale}")

    weak_language: str | None = None
    try:
        import langdetect

        langdetect.DetectorFactory.seed = 0
        weak_language = langdetect.detect(stripped)
        detected.append(
            DetectedLanguageScore(language=weak_language, confidence=0.45, proportion=0.3)
        )
        evidence.append("langdetect_fallback")
    except Exception:
        evidence.append("langdetect_unavailable")

    if not detected and script_result.primaryScript:
        for language in LANGUAGE_HINTS.get(script_result.primaryScript, ()):
            detected.append(
                DetectedLanguageScore(language=language, confidence=script_result.confidence)
            )

    if not detected:
        return LanguageDetectionSummary(
            scripts=script_result.scripts,
            direction=script_result.direction,
            isMixedLanguage=script_result.isMixed,
            ambiguous=True,
            requiresReview=True,
            evidence=evidence + ["unknown"],
        )

    merged: dict[str, float] = {}
    for item in detected:
        merged[item.language] = max(merged.get(item.language, 0.0), item.confidence)

    ranked = sorted(merged.items(), key=lambda item: item[1], reverse=True)
    primary_language = ranked[0][0]
    primary_locale = locale or primary_language
    scores = [
        DetectedLanguageScore(language=language, confidence=round(confidence, 4))
        for language, confidence in ranked[:5]
    ]
    ambiguous = len(ranked) > 1 and ranked[1][1] >= ranked[0][1] * 0.85
    requires_review = ambiguous or script_result.isMixed or ranked[0][1] < 0.55

    return LanguageDetectionSummary(
        primaryLanguage=primary_language,
        primaryLocale=primary_locale,
        detectedLanguages=scores,
        scripts=script_result.scripts,
        direction=script_result.direction,
        isMixedLanguage=script_result.isMixed,
        ambiguous=ambiguous,
        requiresReview=requires_review,
        evidence=evidence,
    )


def packs_to_languages(packs: list[str]) -> list[str]:
    return [OCR_PACK_TO_LANGUAGE[pack] for pack in packs if pack in OCR_PACK_TO_LANGUAGE]
