from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

AnalysisPurpose = Literal[
    "business_context",
    "social_post_context",
    "group_context",
    "document_context",
    "general_media_context",
]

MediaKind = Literal["image", "pdf"]


class MediaRequestHints(BaseModel):
    languages: list[str] | None = None
    locale: str | None = None
    country: str | None = None
    purpose: AnalysisPurpose | None = None


class SignedMediaRequest(BaseModel):
    signedMediaUrl: HttpUrl
    hints: MediaRequestHints | None = None


class VerifiedMediaMetadata(BaseModel):
    verifiedMime: str
    kind: MediaKind
    originalBytes: int
    width: int | None = None
    height: int | None = None
    pageCount: int | None = None
    orientation: int | None = None
    colorSpace: str | None = None
    sha256: str


class SanitizationResult(BaseModel):
    actions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    metadataRemoved: bool = False
    normalizedBytes: int | None = None
    normalizedSha256: str | None = None
    normalizedWidth: int | None = None
    normalizedHeight: int | None = None
    normalizedMime: str | None = None


class DuplicateDetectionResult(BaseModel):
    duplicateStatus: Literal["none", "exact", "possible"] = "none"
    perceptualHash: str | None = None
    perceptualHashAlgorithm: str | None = None


class MediaInspectResponse(BaseModel):
    accepted: bool
    metadata: VerifiedMediaMetadata | None = None
    sanitization: SanitizationResult | None = None
    duplicate: DuplicateDetectionResult | None = None
    warnings: list[str] = Field(default_factory=list)
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


class DetectedLanguageScore(BaseModel):
    language: str
    confidence: float
    proportion: float | None = None


class LanguageDetectionSummary(BaseModel):
    primaryLanguage: str | None = None
    primaryLocale: str | None = None
    detectedLanguages: list[DetectedLanguageScore] = Field(default_factory=list)
    scripts: list[str] = Field(default_factory=list)
    direction: Literal["ltr", "rtl", "mixed", "unknown"] = "unknown"
    isMixedLanguage: bool = False
    ambiguous: bool = False
    requiresReview: bool = False
    evidence: list[str] = Field(default_factory=list)


class ScriptDetectionResult(BaseModel):
    scripts: list[str] = Field(default_factory=list)
    primaryScript: str | None = None
    direction: Literal["ltr", "rtl", "mixed", "unknown"] = "unknown"
    isMixed: bool = False
    confidence: float = 0.0


class OCRWarning(BaseModel):
    code: str
    message: str


class OCRPage(BaseModel):
    page: int
    width: int
    height: int
    rotation: int = 0
    rawText: str
    normalizedText: str
    averageConfidence: float


class OCRResultPayload(BaseModel):
    provider: str
    providerVersion: str
    languagesRequested: list[str]
    languagesAvailable: list[str]
    languagesUnavailable: list[str]
    pages: list[OCRPage]
    rawText: str
    normalizedText: str
    detectedScripts: list[str]
    languageDetection: LanguageDetectionSummary
    averageConfidence: float
    warnings: list[OCRWarning] = Field(default_factory=list)
    requiresReview: bool = False
    processingMs: int


class OCRResponse(BaseModel):
    accepted: bool
    inspect: MediaInspectResponse | None = None
    ocr: OCRResultPayload | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


class EvidenceSignal(BaseModel):
    label: str
    confidence: float
    evidence: list[str] = Field(default_factory=list)
    source: str = "merged"
    inferred: bool = True
    requiresReview: bool = False


class VisionAnalysisOutput(BaseModel):
    schemaVersion: str = "1.0"
    provider: str
    model: str
    mediaSummary: str
    contentType: str
    contentPurpose: str
    visibleTextSummary: str
    inferredLanguages: list[str] = Field(default_factory=list)
    detectedScripts: list[str] = Field(default_factory=list)
    businessSignals: list[EvidenceSignal] = Field(default_factory=list)
    audienceSignals: list[EvidenceSignal] = Field(default_factory=list)
    contentSignals: list[EvidenceSignal] = Field(default_factory=list)
    businessAudienceType: str | None = None
    professionalContext: bool = False
    publicConsumerContext: bool = False
    detectedContactSignals: list[str] = Field(default_factory=list)
    detectedPriceSignals: list[str] = Field(default_factory=list)
    detectedOfferSignals: list[str] = Field(default_factory=list)
    detectedCallToActionSignals: list[str] = Field(default_factory=list)
    locationSignals: list[str] = Field(default_factory=list)
    platformSignals: list[str] = Field(default_factory=list)
    regulatedDomainSignals: list[str] = Field(default_factory=list)
    safetyWarnings: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    providerConfidenceSignals: list[float] = Field(default_factory=list)
    requiresReview: bool = False


class ConfidenceBreakdown(BaseModel):
    mediaValidationConfidence: float
    ocrConfidence: float
    scriptConfidence: float
    languageConfidence: float
    visionSchemaConfidence: float
    businessSignalConfidence: float
    audienceSignalConfidence: float
    contentPurposeConfidence: float
    overallConfidence: float


class AnalyzeResponse(BaseModel):
    accepted: bool
    inspect: MediaInspectResponse | None = None
    ocr: OCRResultPayload | None = None
    vision: VisionAnalysisOutput | None = None
    confidence: ConfidenceBreakdown | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


class OCRStatusResponse(BaseModel):
    engine: str
    available: bool
    installedLanguagePacks: list[str]
    defaultLanguagePacks: list[str]
    maxLanguagesPerJob: int
    preliminaryLanguages: list[str]
    safeError: str | None = None


class ProviderStatusResponse(BaseModel):
    vision: dict[str, object]
    ocr: OCRStatusResponse
