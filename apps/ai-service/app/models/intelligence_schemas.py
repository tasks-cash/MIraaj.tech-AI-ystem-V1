"""Prompt 3 business-reasoning schemas.

Input signals mirror the Prompt 2 vision/OCR output shape
(``app.models.media_schemas.VisionAnalysisOutput``) but are re-declared here as
their own strict, independent contract: this service must not assume the
caller sends exactly that shape, and free-text fields (``ocrSummary``,
``additionalContext``) are always untrusted source content, never
instructions.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

DecisionMakerLevel = Literal["low", "medium", "high"]
PromotionStatus = Literal["eligible_b2b", "eligible_b2c", "unsuitable", "review_required"]
ContradictionSeverity = Literal["low", "medium", "high"]


class InputEvidenceSignal(BaseModel):
    """A single structured Prompt-2-style signal. Codes are trusted taxonomy
    values; ``evidence`` strings are free text and must be treated as
    untrusted display-only content, never as instructions."""

    code: str = Field(min_length=1, max_length=100)
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list, max_length=20)
    source: str = "merged"
    inferred: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("evidence")
    @classmethod
    def truncate_evidence_items(cls, value: list[str]) -> list[str]:
        return [item[:500] for item in value]


class OcrSummaryInput(BaseModel):
    # Hard upper bound matches Settings.AI_REASONING_MAX_INPUT_CHARS' max
    # (200_000); the configured, usually-tighter limit is enforced per
    # request by the route handler so it can be tuned without a redeploy.
    normalizedTextSummary: str = Field(default="", max_length=200_000)
    primaryLanguage: str | None = None
    detectedScripts: list[str] = Field(default_factory=list, max_length=20)


class BusinessReasoningInput(BaseModel):
    """Request payload for all business-reasoning routes.

    Everything under ``ocrSummary`` and ``additionalContext`` originates from
    user-controlled media and must be handled as untrusted source content by
    every provider that reads it.
    """

    schemaVersion: str = "1.0"
    locale: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=10)
    contentPurpose: str | None = Field(default=None, max_length=100)
    businessSignals: list[InputEvidenceSignal] = Field(default_factory=list, max_length=50)
    audienceSignals: list[InputEvidenceSignal] = Field(default_factory=list, max_length=50)
    contentSignals: list[InputEvidenceSignal] = Field(default_factory=list, max_length=50)
    businessAudienceType: str | None = Field(default=None, max_length=100)
    professionalContext: bool = False
    publicConsumerContext: bool = False
    regulatedDomainSignals: list[str] = Field(default_factory=list, max_length=20)
    ocrSummary: OcrSummaryInput | None = None
    additionalContext: str | None = Field(default=None, max_length=200_000)


class ReasoningSignal(BaseModel):
    code: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list)
    contradictingEvidence: list[str] = Field(default_factory=list)
    provenance: str = "rule_engine"
    inferred: bool = True
    warning: str | None = None


class RankedBusinessType(ReasoningSignal):
    pass


class RankedAudienceType(ReasoningSignal):
    pass


class NeedSignal(ReasoningSignal):
    pass


class PainPointSignal(ReasoningSignal):
    pass


class ObjectiveSignal(ReasoningSignal):
    pass


class RegulatedDomainSignal(ReasoningSignal):
    pass


class DecisionMakerLikelihood(BaseModel):
    level: DecisionMakerLevel
    signal: ReasoningSignal


class PromotionEligibility(BaseModel):
    status: PromotionStatus
    signal: ReasoningSignal


class ContradictionSignal(BaseModel):
    code: str
    description: str
    conflictingCodes: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    severity: ContradictionSeverity = "medium"


class BusinessReasoningOutput(BaseModel):
    """Canonical full reasoning result produced by any provider implementing
    ``BusinessReasoningProvider``. Individual routes project a subset of
    these fields to callers."""

    schemaVersion: str = "1.0"
    provider: str
    model: str | None = None
    rankedBusinessTypes: list[RankedBusinessType] = Field(default_factory=list)
    rankedAudienceTypes: list[RankedAudienceType] = Field(default_factory=list)
    decisionMakerLikelihood: DecisionMakerLikelihood
    promotionEligibility: PromotionEligibility
    needs: list[NeedSignal] = Field(default_factory=list)
    painPoints: list[PainPointSignal] = Field(default_factory=list)
    objectives: list[ObjectiveSignal] = Field(default_factory=list)
    contradictions: list[ContradictionSignal] = Field(default_factory=list)
    regulatedDomainSignals: list[RegulatedDomainSignal] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    requiresReview: bool = False
    reviewReasonCodes: list[str] = Field(default_factory=list)
    processingMs: int | None = None


class BusinessProfileResponse(BaseModel):
    accepted: bool
    provider: str | None = None
    model: str | None = None
    rankedBusinessTypes: list[RankedBusinessType] = Field(default_factory=list)
    rankedAudienceTypes: list[RankedAudienceType] = Field(default_factory=list)
    decisionMakerLikelihood: DecisionMakerLikelihood | None = None
    promotionEligibility: PromotionEligibility | None = None
    regulatedDomainSignals: list[RegulatedDomainSignal] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    requiresReview: bool = False
    reviewReasonCodes: list[str] = Field(default_factory=list)
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


class NeedsResponse(BaseModel):
    accepted: bool
    provider: str | None = None
    model: str | None = None
    needs: list[NeedSignal] = Field(default_factory=list)
    painPoints: list[PainPointSignal] = Field(default_factory=list)
    objectives: list[ObjectiveSignal] = Field(default_factory=list)
    requiresReview: bool = False
    reviewReasonCodes: list[str] = Field(default_factory=list)
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


class ContradictionsResponse(BaseModel):
    accepted: bool
    provider: str | None = None
    model: str | None = None
    contradictions: list[ContradictionSignal] = Field(default_factory=list)
    regulatedDomainSignals: list[RegulatedDomainSignal] = Field(default_factory=list)
    requiresReview: bool = False
    reviewReasonCodes: list[str] = Field(default_factory=list)
    errorCode: str | None = None
    safeMessage: str | None = None
    processingMs: int


class ReasoningProviderStatusResponse(BaseModel):
    provider: str
    enabled: bool
    configured: bool
    model: str | None = None
    maxRetries: int
    timeoutSeconds: int
    maxInputChars: int
    safeError: str | None = None
