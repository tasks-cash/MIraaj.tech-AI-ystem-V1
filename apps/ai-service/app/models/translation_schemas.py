"""Pydantic mirror of the provider-neutral translation contract in
``packages/shared-types/src/multilingual-contracts.ts`` (``TranslationInput``,
``TranslationOutput``, ``TranslationProviderHealth``).

``text`` is always untrusted source content: it may originate from OCR,
campaign copy, or other user-controlled media and must never be treated as
instructions by any provider that reads it.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Formality = Literal["formal", "informal", "neutral"]


class TranslationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sourceLanguage: str = Field(min_length=2, max_length=20)
    targetLanguage: str = Field(min_length=2, max_length=20)
    targetLocale: str = Field(min_length=2, max_length=20)
    countryCode: str | None = Field(default=None, max_length=10)
    text: str = Field(min_length=0, max_length=50_000)
    businessSector: str | None = Field(default=None, max_length=100)
    service: str | None = Field(default=None, max_length=200)
    platform: str | None = Field(default=None, max_length=50)
    brandTerminology: list[str] = Field(default_factory=list, max_length=20)
    protectedTerms: list[str] = Field(default_factory=list, max_length=20)
    requiredTone: str | None = Field(default=None, max_length=100)
    maximumLength: int | None = Field(default=None, ge=1, le=50_000)
    formality: Formality | None = None
    glossaryKeys: list[str] = Field(default_factory=list, max_length=20)
    complianceRules: list[str] = Field(default_factory=list, max_length=20)


class TranslationOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    translatedText: str = Field(default="", max_length=100_000)
    detectedSourceLanguage: str = Field(default="", max_length=20)
    provider: str
    model: str = ""
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list, max_length=30)
    protectedTermReport: list[str] = Field(default_factory=list, max_length=30)
    humanReviewRecommended: bool = False
    processingTimeMs: int = 0
    estimatedCost: float | None = None


class TranslationProviderHealth(BaseModel):
    providerId: str
    status: Literal["ok", "degraded", "unavailable"]
    latencyMs: int | None = None
    safeError: str | None = None
