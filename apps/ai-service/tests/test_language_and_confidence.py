from app.models.media_schemas import DetectedLanguageScore, LanguageDetectionSummary
from app.services.confidence import compute_confidence_breakdown
from app.services.language_detection import detect_language
from app.services.script_detection import detect_scripts


def test_language_detection_marks_short_text_unknown() -> None:
    result = detect_language("123")
    assert result.primaryLanguage is None
    assert result.ambiguous is True


def test_language_detection_preserves_brand_only() -> None:
    result = detect_language("Tasks.cash")
    assert result.evidence == ["brand_only"]


def test_confidence_breakdown_weights_inspect_and_ocr() -> None:
    from app.models.media_schemas import (
        MediaInspectResponse,
        OCRPage,
        OCRResultPayload,
        VerifiedMediaMetadata,
    )

    inspect = MediaInspectResponse(
        accepted=True,
        metadata=VerifiedMediaMetadata(
            verifiedMime="image/png",
            kind="image",
            originalBytes=100,
            sha256="abc",
        ),
        processingMs=1,
    )
    ocr = OCRResultPayload(
        provider="tesseract",
        providerVersion="system",
        languagesRequested=["eng"],
        languagesAvailable=["eng"],
        languagesUnavailable=[],
        pages=[
            OCRPage(
                page=1,
                width=10,
                height=10,
                rawText="hello",
                normalizedText="hello",
                averageConfidence=0.8,
            )
        ],
        rawText="hello",
        normalizedText="hello",
        detectedScripts=["Latin"],
        languageDetection=LanguageDetectionSummary(
            primaryLanguage="en",
            detectedLanguages=[DetectedLanguageScore(language="en", confidence=0.8)],
        ),
        averageConfidence=0.8,
        processingMs=1,
    )
    script = detect_scripts("hello")
    breakdown = compute_confidence_breakdown(
        inspect=inspect,
        ocr=ocr,
        script=script,
        language=ocr.languageDetection,
        vision=None,
    )
    assert breakdown.mediaValidationConfidence == 1.0
    assert breakdown.overallConfidence > 0.5
