"""Prompt 4 campaign generation, transcreation, quality, and compliance schemas.

Mirrors ``packages/shared-types/src/campaign-intelligence.ts``. NestJS owns
approval/publishing and remains the final authority; this service only
produces suggested content and structured safety signals for other internal
services to act on. ``sourceContent`` (OCR summaries / free-text context) is
always untrusted source content, never instructions — the same invariant
enforced by ``app/models/intelligence_schemas.py``.

Every model uses ``extra="forbid"`` and bounded strings/arrays so a
misbehaving provider (or a malformed caller payload) is rejected by schema
validation rather than silently accepted.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.campaign_enums import (
    CampaignObjective,
    CampaignPlatform,
    CampaignReviewReasonCode,
    CampaignType,
    ContentFormat,
    CtaCode,
    FunnelStage,
    LocalizationMode,
    TranslationStrategy,
)

Direction = Literal["ltr", "rtl"]


def _strict_config() -> ConfigDict:
    return ConfigDict(extra="forbid")


class BrandVoiceProfile(BaseModel):
    model_config = _strict_config()

    brandName: str = Field(default="Miraaj.tech", max_length=100)
    tone: str | None = Field(default=None, max_length=100)
    toneKeywords: list[str] = Field(default_factory=list, max_length=20)
    forbiddenPhrases: list[str] = Field(default_factory=list, max_length=20)
    requiredDisclaimers: list[str] = Field(default_factory=list, max_length=10)
    preferredCtaCodes: list[CtaCode] = Field(default_factory=list, max_length=10)

    @field_validator("toneKeywords", "forbiddenPhrases", "requiredDisclaimers")
    @classmethod
    def _bound_items(cls, value: list[str]) -> list[str]:
        return [item[:300] for item in value]


class BusinessContextSummary(BaseModel):
    """Caller-supplied, structured subset of the Prompt 3 reasoning output.
    Trusted taxonomy codes only — never free text."""

    model_config = _strict_config()

    businessType: str | None = Field(default=None, max_length=100)
    audienceType: str | None = Field(default=None, max_length=100)
    decisionMakerLevel: Literal["low", "medium", "high"] | None = None
    promotionEligibilityStatus: str | None = Field(default=None, max_length=50)
    regulatedDomains: list[str] = Field(default_factory=list, max_length=10)
    serviceName: str = Field(default="", max_length=200)
    valueProposition: str = Field(default="", max_length=1_000)


class SourceContentSummary(BaseModel):
    """Untrusted free text extracted from user-controlled media. Never parsed
    for instructions by any provider; only scanned for prompt-injection
    phrasing so a review flag can be raised."""

    model_config = _strict_config()

    ocrSummary: str = Field(default="", max_length=200_000)
    additionalContext: str = Field(default="", max_length=200_000)


class ContentVariant(BaseModel):
    model_config = _strict_config()

    headline: str = Field(default="", max_length=150)
    primaryText: str = Field(default="", max_length=2_000)
    shortText: str = Field(default="", max_length=300)
    cta: CtaCode = "no_direct_cta"
    hashtags: list[str] = Field(default_factory=list, max_length=20)
    keywords: list[str] = Field(default_factory=list, max_length=30)
    disclosures: list[str] = Field(default_factory=list, max_length=10)
    direction: Direction = "ltr"

    @field_validator("hashtags", "keywords")
    @classmethod
    def _bound_tag_items(cls, value: list[str]) -> list[str]:
        return [item[:60] for item in value]

    @field_validator("disclosures")
    @classmethod
    def _bound_disclosure_items(cls, value: list[str]) -> list[str]:
        return [item[:2_000] for item in value]


class PlatformVariant(ContentVariant):
    platform: CampaignPlatform
    format: ContentFormat


class LanguageVariant(ContentVariant):
    language: str = Field(min_length=2, max_length=20)
    locale: str = Field(min_length=2, max_length=20)
    countryCode: str | None = Field(default=None, max_length=10)
    translationStrategy: TranslationStrategy = "transcreation"
    provider: str = ""
    model: str = ""
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list, max_length=20)
    protectedTermReport: list[str] = Field(default_factory=list, max_length=20)
    humanReviewRecommended: bool = False


class ImageCreativeBrief(BaseModel):
    model_config = _strict_config()

    concept: str = Field(default="", max_length=500)
    visualDescription: str = Field(default="", max_length=1_000)
    textOverlay: str = Field(default="", max_length=200)
    aspectRatio: str = Field(default="1:1", max_length=10)
    altText: str = Field(default="", max_length=300)
    brandElements: list[str] = Field(default_factory=list, max_length=10)


class VideoCreativeBrief(BaseModel):
    model_config = _strict_config()

    concept: str = Field(default="", max_length=500)
    scriptOutline: str = Field(default="", max_length=2_000)
    durationSeconds: int = Field(default=30, ge=1, le=1_800)
    shotList: list[str] = Field(default_factory=list, max_length=20)
    voiceoverScript: str = Field(default="", max_length=2_000)
    subtitlesRequired: bool = True
    aspectRatio: str = Field(default="9:16", max_length=10)


class CarouselSlide(BaseModel):
    model_config = _strict_config()

    headline: str = Field(default="", max_length=150)
    body: str = Field(default="", max_length=500)
    imageDescription: str = Field(default="", max_length=500)


class CarouselBrief(BaseModel):
    model_config = _strict_config()

    slides: list[CarouselSlide] = Field(default_factory=list, max_length=10)


class StoryFrame(BaseModel):
    model_config = _strict_config()

    text: str = Field(default="", max_length=200)
    visualDescription: str = Field(default="", max_length=500)
    durationSeconds: int = Field(default=5, ge=1, le=60)


class StorySequence(BaseModel):
    model_config = _strict_config()

    frames: list[StoryFrame] = Field(default_factory=list, max_length=10)


class HashtagSet(BaseModel):
    model_config = _strict_config()

    platform: CampaignPlatform | None = None
    hashtags: list[str] = Field(default_factory=list, max_length=20)


class KeywordSet(BaseModel):
    model_config = _strict_config()

    platform: CampaignPlatform | None = None
    keywords: list[str] = Field(default_factory=list, max_length=30)


class CtaVariant(BaseModel):
    model_config = _strict_config()

    code: CtaCode
    label: str = Field(default="", max_length=100)
    platform: CampaignPlatform | None = None


class LocalizedDisclaimer(BaseModel):
    model_config = _strict_config()

    language: str = Field(min_length=2, max_length=20)
    text: str = Field(default="", max_length=2_000)


class CampaignQualityBreakdown(BaseModel):
    """Mirrors ``CampaignQualityBreakdown`` in campaign-intelligence.ts."""

    model_config = _strict_config()

    sourceQualityScore: float = Field(default=0.0, ge=0.0, le=1.0)
    audienceFitScore: float = Field(default=0.0, ge=0.0, le=1.0)
    decisionMakerFitScore: float = Field(default=0.0, ge=0.0, le=1.0)
    objectiveFitScore: float = Field(default=0.0, ge=0.0, le=1.0)
    funnelStageFitScore: float = Field(default=0.0, ge=0.0, le=1.0)
    serviceFactScore: float = Field(default=0.0, ge=0.0, le=1.0)
    valuePropositionScore: float = Field(default=0.0, ge=0.0, le=1.0)
    brandVoiceScore: float = Field(default=0.0, ge=0.0, le=1.0)
    messageClarityScore: float = Field(default=0.0, ge=0.0, le=1.0)
    claimSafetyScore: float = Field(default=0.0, ge=0.0, le=1.0)
    complianceScore: float = Field(default=0.0, ge=0.0, le=1.0)
    platformFitScore: float = Field(default=0.0, ge=0.0, le=1.0)
    formatFitScore: float = Field(default=0.0, ge=0.0, le=1.0)
    ctaFitScore: float = Field(default=0.0, ge=0.0, le=1.0)
    languageQualityScore: float = Field(default=0.0, ge=0.0, le=1.0)
    semanticPreservationScore: float = Field(default=0.0, ge=0.0, le=1.0)
    transcreationQualityScore: float = Field(default=0.0, ge=0.0, le=1.0)
    culturalSensitivityScore: float = Field(default=0.0, ge=0.0, le=1.0)
    accessibilityScore: float = Field(default=0.0, ge=0.0, le=1.0)
    contentOriginalityScore: float = Field(default=0.0, ge=0.0, le=1.0)
    overallQualityScore: float = Field(default=0.0, ge=0.0, le=1.0)


class ComplianceSignals(BaseModel):
    model_config = _strict_config()

    passed: bool = True
    prohibitedClaimsDetected: list[str] = Field(default_factory=list, max_length=20)
    missingDisclosureLanguages: list[str] = Field(default_factory=list, max_length=10)
    protectedTermIssues: list[str] = Field(default_factory=list, max_length=20)


# --------------------------------------------------------------------------
# Strategy
# --------------------------------------------------------------------------


class CampaignStrategyInput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    campaignType: CampaignType | None = None
    objectives: list[CampaignObjective] = Field(default_factory=list, max_length=5)
    funnelStage: FunnelStage | None = None
    targetPlatforms: list[CampaignPlatform] = Field(default_factory=list, max_length=13)
    targetLanguages: list[str] = Field(default_factory=list, max_length=10)
    serviceName: str = Field(default="", max_length=200)
    valueProposition: str = Field(default="", max_length=1_000)
    brandVoice: BrandVoiceProfile | None = None
    businessContext: BusinessContextSummary | None = None
    paymentServicePresent: bool = False
    regulatedDomainSignals: list[str] = Field(default_factory=list, max_length=20)
    sourceContent: SourceContentSummary | None = None
    locale: str | None = Field(default=None, max_length=20)
    countryCode: str | None = Field(default=None, max_length=10)


class RankedObjective(BaseModel):
    model_config = _strict_config()

    code: CampaignObjective
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = Field(default="", max_length=500)


class PlatformRecommendation(BaseModel):
    model_config = _strict_config()

    platform: CampaignPlatform
    recommendedFormats: list[ContentFormat] = Field(default_factory=list, max_length=10)
    rationale: str = Field(default="", max_length=300)


class CampaignStrategyOutput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    provider: str
    model: str | None = None
    recommendedCampaignType: CampaignType | None = None
    recommendedFunnelStage: FunnelStage | None = None
    rankedObjectives: list[RankedObjective] = Field(default_factory=list, max_length=10)
    keyMessages: list[str] = Field(default_factory=list, max_length=10)
    valuePropositions: list[str] = Field(default_factory=list, max_length=10)
    audienceInsights: list[str] = Field(default_factory=list, max_length=10)
    contentPillars: list[str] = Field(default_factory=list, max_length=10)
    platformRecommendations: list[PlatformRecommendation] = Field(
        default_factory=list, max_length=13
    )
    riskFlags: list[str] = Field(default_factory=list, max_length=20)
    requiresReview: bool = False
    reviewReasonCodes: list[CampaignReviewReasonCode] = Field(default_factory=list, max_length=28)
    processingMs: int | None = None

    @field_validator(
        "keyMessages", "valuePropositions", "audienceInsights", "contentPillars", "riskFlags"
    )
    @classmethod
    def _bound_string_list(cls, value: list[str]) -> list[str]:
        return [item[:300] for item in value]


class CampaignStrategyResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: CampaignStrategyOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


# --------------------------------------------------------------------------
# Generation
# --------------------------------------------------------------------------


class AdditionalLanguageRequest(BaseModel):
    model_config = _strict_config()

    language: str = Field(min_length=2, max_length=20)
    locale: str = Field(min_length=2, max_length=20)
    countryCode: str | None = Field(default=None, max_length=10)


class CampaignGenerationInput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    strategy: CampaignStrategyOutput | None = None
    serviceName: str = Field(default="", max_length=200)
    valueProposition: str = Field(default="", max_length=1_000)
    brandVoice: BrandVoiceProfile | None = None
    targetPlatforms: list[CampaignPlatform] = Field(default_factory=list, max_length=13)
    targetFormats: list[ContentFormat] = Field(default_factory=list, max_length=20)
    primaryLanguage: str = Field(default="en", max_length=20)
    primaryLocale: str = Field(default="en", max_length=20)
    additionalLanguages: list[AdditionalLanguageRequest] = Field(
        default_factory=list, max_length=10
    )
    includeImageBriefs: bool = False
    includeVideoBriefs: bool = False
    includeCarouselBriefs: bool = False
    includeStorySequences: bool = False
    paymentServicePresent: bool = False
    regulatedDomainSignals: list[str] = Field(default_factory=list, max_length=20)
    businessContext: BusinessContextSummary | None = None
    sourceContent: SourceContentSummary | None = None
    countryCode: str | None = Field(default=None, max_length=10)


class CampaignGenerationOutput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    provider: str
    model: str | None = None
    masterVariant: ContentVariant | None = None
    platformVariants: list[PlatformVariant] = Field(default_factory=list, max_length=40)
    languageVariants: list[LanguageVariant] = Field(default_factory=list, max_length=20)
    imageCreativeBriefs: list[ImageCreativeBrief] = Field(default_factory=list, max_length=20)
    videoCreativeBriefs: list[VideoCreativeBrief] = Field(default_factory=list, max_length=10)
    carouselBriefs: list[CarouselBrief] = Field(default_factory=list, max_length=10)
    storySequences: list[StorySequence] = Field(default_factory=list, max_length=10)
    hashtagSets: list[HashtagSet] = Field(default_factory=list, max_length=10)
    keywordSets: list[KeywordSet] = Field(default_factory=list, max_length=10)
    ctaVariants: list[CtaVariant] = Field(default_factory=list, max_length=20)
    disclaimers: list[LocalizedDisclaimer] = Field(default_factory=list, max_length=10)
    qualitySignals: CampaignQualityBreakdown | None = None
    complianceSignals: ComplianceSignals | None = None
    requiresReview: bool = False
    reviewReasonCodes: list[CampaignReviewReasonCode] = Field(default_factory=list, max_length=28)
    processingMs: int | None = None


class CampaignGenerationResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: CampaignGenerationOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


# --------------------------------------------------------------------------
# Transcreation
# --------------------------------------------------------------------------


class CampaignTranscreateInput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    sourceVariant: ContentVariant
    sourceLanguage: str = Field(min_length=2, max_length=20)
    targetLanguage: str = Field(min_length=2, max_length=20)
    targetLocale: str = Field(min_length=2, max_length=20)
    countryCode: str | None = Field(default=None, max_length=10)
    businessSector: str | None = Field(default=None, max_length=100)
    service: str | None = Field(default=None, max_length=200)
    platform: CampaignPlatform | None = None
    brandTerminology: list[str] = Field(default_factory=list, max_length=20)
    protectedTerms: list[str] = Field(default_factory=list, max_length=20)
    requiredTone: str | None = Field(default=None, max_length=100)
    formality: Literal["formal", "informal", "neutral"] | None = None
    glossaryKeys: list[str] = Field(default_factory=list, max_length=20)
    paymentServicePresent: bool = False
    localizationMode: LocalizationMode = "transcreation"


class CampaignTranscreateOutput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    provider: str
    model: str = ""
    variant: LanguageVariant | None = None
    semanticPreservationScore: float | None = Field(default=None, ge=0.0, le=1.0)
    requiresReview: bool = False
    reviewReasonCodes: list[CampaignReviewReasonCode] = Field(default_factory=list, max_length=28)
    processingMs: int | None = None


class CampaignTranscreateResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: CampaignTranscreateOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


# --------------------------------------------------------------------------
# Quality check
# --------------------------------------------------------------------------


class CampaignQualityCheckInput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    variant: ContentVariant
    sourceVariant: ContentVariant | None = None
    platform: CampaignPlatform | None = None
    language: str | None = Field(default=None, max_length=20)
    businessContext: BusinessContextSummary | None = None
    campaignObjective: CampaignObjective | None = None
    funnelStage: FunnelStage | None = None
    brandVoice: BrandVoiceProfile | None = None


class CampaignQualityCheckOutput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    provider: str
    model: str | None = None
    breakdown: CampaignQualityBreakdown
    requiresReview: bool = False
    reviewReasonCodes: list[CampaignReviewReasonCode] = Field(default_factory=list, max_length=28)
    processingMs: int | None = None


class CampaignQualityCheckResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: CampaignQualityCheckOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


# --------------------------------------------------------------------------
# Compliance check
# --------------------------------------------------------------------------


class ComplianceCheckVariant(ContentVariant):
    language: str = Field(default="en", max_length=20)


class CampaignComplianceCheckInput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    variants: list[ComplianceCheckVariant] = Field(
        default_factory=list, max_length=20, min_length=1
    )
    paymentServicePresent: bool = False
    regulatedDomainSignals: list[str] = Field(default_factory=list, max_length=20)
    sourceContent: SourceContentSummary | None = None


class CampaignComplianceCheckOutput(BaseModel):
    model_config = _strict_config()

    schemaVersion: str = "1.0"
    provider: str
    model: str | None = None
    passed: bool = True
    prohibitedClaimsDetected: list[str] = Field(default_factory=list, max_length=20)
    sensitiveTraitTargetingDetected: bool = False
    faceRecognitionRequestDetected: bool = False
    missingDisclosureLanguages: list[str] = Field(default_factory=list, max_length=10)
    protectedTermIssues: list[str] = Field(default_factory=list, max_length=20)
    requiresReview: bool = False
    reviewReasonCodes: list[CampaignReviewReasonCode] = Field(default_factory=list, max_length=28)
    processingMs: int | None = None


class CampaignComplianceCheckResponse(BaseModel):
    model_config = _strict_config()

    accepted: bool
    data: CampaignComplianceCheckOutput | None = None
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


# --------------------------------------------------------------------------
# Provider status
# --------------------------------------------------------------------------


class ProviderStatusBlock(BaseModel):
    model_config = _strict_config()

    provider: str
    enabled: bool
    configured: bool
    model: str | None = None
    timeoutSeconds: int
    maxRetries: int
    maxInputChars: int | None = None
    maxOutputChars: int | None = None
    safeError: str | None = None


class CampaignProviderStatusResponse(BaseModel):
    model_config = _strict_config()

    campaignProvider: ProviderStatusBlock
    translationProvider: ProviderStatusBlock
