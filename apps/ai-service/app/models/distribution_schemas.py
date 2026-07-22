from __future__ import annotations

from pydantic import BaseModel, Field


class DistributionAssetInput(BaseModel):
    trackedUrl: str
    proofMarker: str = Field(min_length=6, max_length=64)
    headline: str = Field(min_length=1, max_length=300)
    cta: str = Field(default="", max_length=200)
    disclosure: str = Field(default="", max_length=500)
    locale: str = "en"
    direction: str = Field(default="ltr", pattern="^(ltr|rtl)$")
    width: int = Field(default=1200, ge=630, le=2048)
    height: int = Field(default=630, ge=630, le=2048)


class DistributionAssetResponse(BaseModel):
    qrPngBase64: str
    qrSha256: str
    qrDecodedPayload: str
    qrDecodeVerified: bool
    headerPngBase64: str
    headerSha256: str
    headerQrDecodedPayload: str
    headerQrDecodeVerified: bool
    width: int
    height: int


class ProofEvidenceInput(BaseModel):
    screenshotBase64: str
    sha256: str | None = None


class ProofVerifyInput(BaseModel):
    assignmentId: str
    trackedUrl: str
    proofMarker: str
    approvedPostText: str
    requiredDisclosure: str = ""
    expectedGroups: list[str] = []
    profession: str
    platform: str
    privateGroup: bool = True
    submittedBeforeDeadline: bool
    screenshotEvidence: list[ProofEvidenceInput] = Field(min_length=1, max_length=5)
    knownChecksums: list[str] = []
    knownPerceptualHashes: list[str] = []


class ProofVerifyResponse(BaseModel):
    decision: str
    scores: dict[str, float]
    mandatoryChecks: dict[str, bool]
    reasonCodes: list[str]
    extractedEvidence: dict[str, object]
    duplicateMatches: list[dict[str, object]]
    manipulationIndicators: list[dict[str, object]]
    resultChecksum: str
    durationMs: int
