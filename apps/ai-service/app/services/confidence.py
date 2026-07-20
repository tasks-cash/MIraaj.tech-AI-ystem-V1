from __future__ import annotations

from app.models.media_schemas import (
    ConfidenceBreakdown,
    LanguageDetectionSummary,
    MediaInspectResponse,
    OCRResultPayload,
    ScriptDetectionResult,
    VisionAnalysisOutput,
)


def compute_confidence_breakdown(
    *,
    inspect: MediaInspectResponse | None,
    ocr: OCRResultPayload | None,
    script: ScriptDetectionResult | None,
    language: LanguageDetectionSummary | None,
    vision: VisionAnalysisOutput | None,
) -> ConfidenceBreakdown:
    media_validation = 1.0 if inspect and inspect.accepted else 0.0
    ocr_confidence = ocr.averageConfidence if ocr else 0.0
    script_confidence = script.confidence if script else 0.0
    language_confidence = 0.0
    if language and language.detectedLanguages:
        language_confidence = language.detectedLanguages[0].confidence
    vision_schema = 0.0
    business_signal = 0.0
    audience_signal = 0.0
    content_purpose = 0.0
    if vision:
        if vision.providerConfidenceSignals:
            vision_schema = max(vision.providerConfidenceSignals)
        else:
            vision_schema = 0.75
        business_signal = max(
            (signal.confidence for signal in vision.businessSignals),
            default=0.0,
        )
        audience_signal = max(
            (signal.confidence for signal in vision.audienceSignals),
            default=0.0,
        )
        content_purpose = 0.7 if vision.contentPurpose else 0.0

    weights = {
        "media": 0.15,
        "ocr": 0.25,
        "script": 0.1,
        "language": 0.15,
        "vision_schema": 0.1,
        "business": 0.1,
        "audience": 0.1,
        "purpose": 0.05,
    }
    overall = (
        media_validation * weights["media"]
        + ocr_confidence * weights["ocr"]
        + script_confidence * weights["script"]
        + language_confidence * weights["language"]
        + vision_schema * weights["vision_schema"]
        + business_signal * weights["business"]
        + audience_signal * weights["audience"]
        + content_purpose * weights["purpose"]
    )
    return ConfidenceBreakdown(
        mediaValidationConfidence=round(media_validation, 4),
        ocrConfidence=round(ocr_confidence, 4),
        scriptConfidence=round(script_confidence, 4),
        languageConfidence=round(language_confidence, 4),
        visionSchemaConfidence=round(vision_schema, 4),
        businessSignalConfidence=round(business_signal, 4),
        audienceSignalConfidence=round(audience_signal, 4),
        contentPurposeConfidence=round(content_purpose, 4),
        overallConfidence=round(min(1.0, overall), 4),
    )
