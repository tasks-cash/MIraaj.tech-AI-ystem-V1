"""Deterministic, local (non-Gemini) business-reasoning provider.

Classifies Prompt-2-style structured signals (``businessSignals`` /
``audienceSignals`` / OCR summary) into ranked business/audience types,
decision-maker likelihood, promotion eligibility, needs/pain
points/objectives, contradictions, and regulated-domain flags.

Security invariant: this provider NEVER parses free text (``ocrSummary``,
``additionalContext``) for decision-making. Those fields are only scanned for
prompt-injection phrasing so a review flag can be raised; all classification
is driven exclusively by structured, taxonomy ``code`` values and their
``confidence`` scores. This makes it immune-by-construction to instructions
embedded in user-controlled media text.
"""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter

from app.core.config import Settings
from app.models.intelligence_schemas import (
    BusinessReasoningInput,
    BusinessReasoningOutput,
    ContradictionSignal,
    DecisionMakerLevel,
    DecisionMakerLikelihood,
    InputEvidenceSignal,
    NeedSignal,
    ObjectiveSignal,
    PainPointSignal,
    PromotionEligibility,
    PromotionStatus,
    RankedAudienceType,
    RankedBusinessType,
    ReasoningSignal,
    RegulatedDomainSignal,
)
from app.services.intelligence.prompt_injection import scan_for_prompt_injection

_UNKNOWN_AUDIENCE_WARNING = "UNKNOWN_AUDIENCE_CODE"
_UNKNOWN_BUSINESS_WARNING = "UNKNOWN_BUSINESS_CODE"
_CONTRADICTION_CONFIDENCE_GAP = 0.25


@dataclass(frozen=True)
class _AudienceProfile:
    decision_maker_level: DecisionMakerLevel
    promotion_status: PromotionStatus
    business_type: str | None
    is_professional: bool
    regulated_domain: str | None = None


_UNKNOWN_AUDIENCE_PROFILE = _AudienceProfile(
    decision_maker_level="low",
    promotion_status="review_required",
    business_type=None,
    is_professional=False,
)

# Deterministic taxonomy mapping structured audience codes (Prompt-2-style
# signals) to decision-making context. Deliberately data-driven so new
# professional/consumer pairs can be added without branching logic.
_AUDIENCE_PROFILES: dict[str, _AudienceProfile] = {
    "professional_dentist": _AudienceProfile(
        "high", "eligible_b2b", "dental_clinic", True, "healthcare"
    ),
    "dentist": _AudienceProfile("high", "eligible_b2b", "dental_clinic", True, "healthcare"),
    "clinic_owner": _AudienceProfile("high", "eligible_b2b", "dental_clinic", True, "healthcare"),
    "dental_clinic_owner": _AudienceProfile(
        "high", "eligible_b2b", "dental_clinic", True, "healthcare"
    ),
    "clinic_manager": _AudienceProfile("high", "eligible_b2b", "dental_clinic", True, "healthcare"),
    "patient_group": _AudienceProfile("low", "unsuitable", None, False, "healthcare"),
    "patient": _AudienceProfile("low", "unsuitable", None, False, "healthcare"),
    "restaurant_owner": _AudienceProfile("high", "eligible_b2b", "restaurant", True, None),
    "restaurant_manager": _AudienceProfile("high", "eligible_b2b", "restaurant", True, None),
    "school_manager": _AudienceProfile("high", "eligible_b2b", "school", True, "education"),
    "school_administrator": _AudienceProfile("high", "eligible_b2b", "school", True, "education"),
    "school_owner": _AudienceProfile("high", "eligible_b2b", "school", True, "education"),
    "student": _AudienceProfile("low", "unsuitable", None, False, "education"),
    "hotel_manager": _AudienceProfile("high", "eligible_b2b", "hotel", True, None),
    "hotel_owner": _AudienceProfile("high", "eligible_b2b", "hotel", True, None),
    "hotel_guest": _AudienceProfile("low", "review_required", None, False, None),
    "consumer": _AudienceProfile("low", "review_required", None, False, None),
    "general_public": _AudienceProfile("low", "review_required", None, False, None),
}


@dataclass(frozen=True)
class _BusinessTypeContent:
    needs: tuple[str, ...]
    pain_points: tuple[str, ...]
    objectives: tuple[str, ...]
    regulated_domain: str | None = None


_BUSINESS_TYPE_CONTENT: dict[str, _BusinessTypeContent] = {
    "dental_clinic": _BusinessTypeContent(
        needs=("patient_acquisition", "appointment_scheduling_efficiency"),
        pain_points=("missed_appointments", "patient_retention"),
        objectives=("increase_new_patient_bookings",),
        regulated_domain="healthcare",
    ),
    "restaurant": _BusinessTypeContent(
        needs=("local_visibility", "table_reservations"),
        pain_points=("seasonal_demand_fluctuation", "online_review_management"),
        objectives=("increase_reservations",),
    ),
    "school": _BusinessTypeContent(
        needs=("enrollment_growth", "parent_communication"),
        pain_points=("enrollment_seasonality", "communication_overload"),
        objectives=("increase_enrollment_inquiries",),
        regulated_domain="education",
    ),
    "hotel": _BusinessTypeContent(
        needs=("booking_occupancy", "guest_reviews_management"),
        pain_points=("off_season_occupancy", "review_response_time"),
        objectives=("increase_direct_bookings",),
    ),
}


def _audience_profile(code: str) -> _AudienceProfile:
    return _AUDIENCE_PROFILES.get(code, _UNKNOWN_AUDIENCE_PROFILE)


def _rank_signals(signals: list[InputEvidenceSignal]) -> list[InputEvidenceSignal]:
    return sorted(signals, key=lambda signal: signal.confidence, reverse=True)


def _rank_audience(signals: list[InputEvidenceSignal]) -> list[RankedAudienceType]:
    ranked: list[RankedAudienceType] = []
    for signal in _rank_signals(signals):
        profile = _AUDIENCE_PROFILES.get(signal.code)
        ranked.append(
            RankedAudienceType(
                code=signal.code,
                confidence=signal.confidence,
                evidence=list(signal.evidence),
                provenance=signal.source,
                inferred=signal.inferred,
                warning=None if profile else _UNKNOWN_AUDIENCE_WARNING,
            )
        )
    return ranked


def _rank_business(
    signals: list[InputEvidenceSignal],
    ranked_audience: list[RankedAudienceType],
) -> list[RankedBusinessType]:
    ranked: list[RankedBusinessType] = []
    seen_codes: set[str] = set()
    for signal in _rank_signals(signals):
        if signal.code in seen_codes:
            continue
        seen_codes.add(signal.code)
        ranked.append(
            RankedBusinessType(
                code=signal.code,
                confidence=signal.confidence,
                evidence=list(signal.evidence),
                provenance=signal.source,
                inferred=signal.inferred,
                warning=None
                if signal.code in _BUSINESS_TYPE_CONTENT
                else _UNKNOWN_BUSINESS_WARNING,
            )
        )

    if ranked:
        return ranked

    # No explicit business signal supplied: infer (discounted) from the top
    # audience signal's known business type, never the reverse.
    if ranked_audience:
        top_audience = ranked_audience[0]
        profile = _audience_profile(top_audience.code)
        if profile.business_type:
            ranked.append(
                RankedBusinessType(
                    code=profile.business_type,
                    confidence=round(top_audience.confidence * 0.8, 4),
                    evidence=list(top_audience.evidence),
                    provenance="inferred_from_audience_signal",
                    inferred=True,
                    warning="INFERRED_FROM_AUDIENCE_SIGNAL",
                )
            )
    return ranked


def _decision_maker(
    ranked_audience: list[RankedAudienceType],
    contradictions: list[ContradictionSignal],
) -> DecisionMakerLikelihood:
    if not ranked_audience:
        return DecisionMakerLikelihood(
            level="low",
            signal=ReasoningSignal(
                code="no_audience_signal",
                confidence=0.0,
                provenance="rule_engine",
                inferred=True,
                warning="NO_AUDIENCE_SIGNAL",
            ),
        )

    top = ranked_audience[0]
    profile = _audience_profile(top.code)
    level = profile.decision_maker_level
    warning = None
    if contradictions and level == "high":
        # Ambiguity between a professional and non-decision-making audience
        # must not be resolved as confidently "high".
        level = "medium"
        warning = "DECISION_MAKER_LEVEL_CAPPED_BY_CONTRADICTION"

    return DecisionMakerLikelihood(
        level=level,
        signal=ReasoningSignal(
            code=top.code,
            confidence=top.confidence,
            evidence=list(top.evidence),
            provenance=top.provenance,
            inferred=top.inferred,
            warning=warning or top.warning,
        ),
    )


def _promotion_eligibility(
    ranked_audience: list[RankedAudienceType],
    contradictions: list[ContradictionSignal],
) -> PromotionEligibility:
    if not ranked_audience:
        return PromotionEligibility(
            status="review_required",
            signal=ReasoningSignal(
                code="no_audience_signal",
                confidence=0.0,
                provenance="rule_engine",
                inferred=True,
                warning="NO_AUDIENCE_SIGNAL",
            ),
        )

    top = ranked_audience[0]
    profile = _audience_profile(top.code)
    status = profile.promotion_status
    warning = None
    if contradictions and status == "eligible_b2b":
        # Never auto-treat a possible decision-maker as eligible when a
        # conflicting non-decision-maker signal is nearly as strong.
        status = "review_required"
        warning = "PROMOTION_STATUS_DOWNGRADED_BY_CONTRADICTION"

    return PromotionEligibility(
        status=status,
        signal=ReasoningSignal(
            code=top.code,
            confidence=top.confidence,
            evidence=list(top.evidence),
            provenance=top.provenance,
            inferred=top.inferred,
            warning=warning or top.warning,
        ),
    )


def _detect_contradictions(ranked_audience: list[RankedAudienceType]) -> list[ContradictionSignal]:
    if len(ranked_audience) < 2:
        return []

    contradictions: list[ContradictionSignal] = []
    top, runner_up = ranked_audience[0], ranked_audience[1]
    top_profile = _audience_profile(top.code)
    runner_up_profile = _audience_profile(runner_up.code)
    confidence_gap = top.confidence - runner_up.confidence

    if (
        top_profile.is_professional != runner_up_profile.is_professional
        and confidence_gap <= _CONTRADICTION_CONFIDENCE_GAP
    ):
        contradictions.append(
            ContradictionSignal(
                code="conflicting_decision_maker_signal",
                description=(
                    f"Audience signal '{top.code}' (decision-maker) and "
                    f"'{runner_up.code}' (non decision-maker) have close "
                    "confidence scores; audience role is ambiguous."
                ),
                conflictingCodes=[top.code, runner_up.code],
                evidence=[*top.evidence, *runner_up.evidence],
                severity="high" if confidence_gap <= 0.1 else "medium",
            )
        )
    return contradictions


def _regulated_domain_signals(
    ranked_audience: list[RankedAudienceType],
    ranked_business: list[RankedBusinessType],
    declared_regulated_domains: list[str],
) -> list[RegulatedDomainSignal]:
    signals: dict[str, RegulatedDomainSignal] = {}

    for audience in ranked_audience:
        profile = _audience_profile(audience.code)
        if profile.regulated_domain and profile.regulated_domain not in signals:
            signals[profile.regulated_domain] = RegulatedDomainSignal(
                code=profile.regulated_domain,
                confidence=audience.confidence,
                evidence=list(audience.evidence),
                provenance="rule_engine",
                inferred=True,
            )

    for business in ranked_business:
        content = _BUSINESS_TYPE_CONTENT.get(business.code)
        if content and content.regulated_domain and content.regulated_domain not in signals:
            signals[content.regulated_domain] = RegulatedDomainSignal(
                code=content.regulated_domain,
                confidence=business.confidence,
                evidence=list(business.evidence),
                provenance="rule_engine",
                inferred=True,
            )

    for domain in declared_regulated_domains:
        normalized = domain.strip().lower()
        if normalized and normalized not in signals:
            signals[normalized] = RegulatedDomainSignal(
                code=normalized,
                confidence=0.5,
                provenance="caller_declared",
                inferred=False,
            )

    return list(signals.values())


def _business_content(
    ranked_business: list[RankedBusinessType],
    decision_maker: DecisionMakerLikelihood,
) -> tuple[list[NeedSignal], list[PainPointSignal], list[ObjectiveSignal]]:
    if not ranked_business or decision_maker.level == "low":
        # Do not recommend business needs/objectives for content whose
        # audience is not a plausible decision-maker (e.g. patients,
        # students, guests, generic consumers).
        return [], [], []

    top = ranked_business[0]
    content = _BUSINESS_TYPE_CONTENT.get(top.code)
    if content is None:
        return [], [], []

    evidence = list(top.evidence)
    needs = [
        NeedSignal(
            code=code, confidence=top.confidence, evidence=evidence, provenance="rule_engine"
        )
        for code in content.needs
    ]
    pain_points = [
        PainPointSignal(
            code=code, confidence=top.confidence, evidence=evidence, provenance="rule_engine"
        )
        for code in content.pain_points
    ]
    objectives = [
        ObjectiveSignal(
            code=code, confidence=top.confidence, evidence=evidence, provenance="rule_engine"
        )
        for code in content.objectives
    ]
    return needs, pain_points, objectives


def _untrusted_text_fields(payload: BusinessReasoningInput) -> list[str]:
    fields: list[str] = []
    if payload.ocrSummary and payload.ocrSummary.normalizedTextSummary:
        fields.append(payload.ocrSummary.normalizedTextSummary)
    if payload.additionalContext:
        fields.append(payload.additionalContext)
    return fields


class DisabledBusinessReasoningProvider:
    """Rule-based provider used whenever ``AI_REASONING_PROVIDER`` is not
    ``gemini`` (the default). Never calls any external LLM."""

    provider_name = "disabled"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    def is_enabled(self) -> bool:
        return True

    async def analyze(self, payload: BusinessReasoningInput) -> BusinessReasoningOutput:
        started = perf_counter()
        review_reason_codes: set[str] = set()

        injection_hit = any(
            scan_for_prompt_injection(text).matched for text in _untrusted_text_fields(payload)
        )
        if injection_hit:
            review_reason_codes.add("PROMPT_INJECTION_SUSPECTED")

        ranked_audience = _rank_audience(payload.audienceSignals)
        ranked_business = _rank_business(payload.businessSignals, ranked_audience)
        contradictions = _detect_contradictions(ranked_audience)
        decision_maker = _decision_maker(ranked_audience, contradictions)
        promotion = _promotion_eligibility(ranked_audience, contradictions)
        regulated_domains = _regulated_domain_signals(
            ranked_audience, ranked_business, payload.regulatedDomainSignals
        )
        needs, pain_points, objectives = _business_content(ranked_business, decision_maker)

        if not ranked_audience:
            review_reason_codes.add("NO_AUDIENCE_SIGNAL")
        if not ranked_business:
            review_reason_codes.add("NO_BUSINESS_SIGNAL")
        if contradictions:
            review_reason_codes.add("CONTRADICTORY_SIGNALS")
        if promotion.status == "review_required":
            review_reason_codes.add("PROMOTION_ELIGIBILITY_UNCERTAIN")
        if any(signal.warning == _UNKNOWN_AUDIENCE_WARNING for signal in ranked_audience):
            review_reason_codes.add("UNKNOWN_AUDIENCE_CODE")
        if any(signal.warning == _UNKNOWN_BUSINESS_WARNING for signal in ranked_business):
            review_reason_codes.add("UNKNOWN_BUSINESS_CODE")

        evidence: list[str] = []
        for signal in (*ranked_audience[:1], *ranked_business[:1]):
            evidence.extend(signal.evidence)

        requires_review = bool(review_reason_codes)

        return BusinessReasoningOutput(
            provider=self.provider_name,
            model=None,
            rankedBusinessTypes=ranked_business,
            rankedAudienceTypes=ranked_audience,
            decisionMakerLikelihood=decision_maker,
            promotionEligibility=promotion,
            needs=needs,
            painPoints=pain_points,
            objectives=objectives,
            contradictions=contradictions,
            regulatedDomainSignals=regulated_domains,
            evidence=evidence,
            requiresReview=requires_review,
            reviewReasonCodes=sorted(review_reason_codes),
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )
