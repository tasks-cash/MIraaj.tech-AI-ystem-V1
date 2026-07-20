import { Injectable } from "@nestjs/common";
import {
  isConsumerAudience,
  isProfessionalAudience,
  isRegulatedBusinessType,
  PAYMENT_COMPLIANCE_DISCLAIMERS,
  type ServiceMatchPenalties,
  type ServiceMatchScoreBreakdown,
  type ServiceMatchState,
} from "@miraaj/shared-types";
import type {
  MatchableCatalogItem,
  MatchableProfile,
  MatchingPolicyInput,
  ServiceMatchResult,
} from "./matching-types.js";

function zeroBreakdown(): ServiceMatchScoreBreakdown {
  return {
    businessTypeFit: 0,
    industryFit: 0,
    organizationFit: 0,
    audienceFit: 0,
    decisionMakerFit: 0,
    professionalContextFit: 0,
    needFit: 0,
    painPointFit: 0,
    objectiveFit: 0,
    digitalMaturityFit: 0,
    businessStageFit: 0,
    marketFit: 0,
    languageFit: 0,
    channelFit: 0,
    integrationFit: 0,
    urgencyFit: 0,
    securityFit: 0,
    paymentReadinessFit: 0,
    automationReadinessFit: 0,
    capabilityAvailabilityFit: 0,
    prerequisiteFit: 0,
    complianceFit: 0,
  };
}

function zeroPenalties(): ServiceMatchPenalties {
  return {
    consumerAudiencePenalty: 0,
    audienceAmbiguityPenalty: 0,
    businessTypeAmbiguityPenalty: 0,
    contradictionPenalty: 0,
    unsupportedMarketPenalty: 0,
    unavailableCapabilityPenalty: 0,
    missingPrerequisitePenalty: 0,
    regulatedDomainPenalty: 0,
    providerDependencyPenalty: 0,
    lowEvidencePenalty: 0,
    duplicateRecommendationPenalty: 0,
    incompatibleServicePenalty: 0,
  };
}

function overlapRatio<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const setB = new Set(b);
  const intersection = a.filter((value) => setB.has(value)).length;
  return intersection / Math.max(a.length, 1);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Deterministic, reproducible scoring — NestJS is the final authority on
 * service ranking. Given the same profile/item/policy inputs it always
 * produces the same score, breakdown, and state.
 */
@Injectable()
export class MatchingEngineService {
  scoreItem(
    profile: MatchableProfile,
    item: MatchableCatalogItem,
    policy: MatchingPolicyInput,
  ): ServiceMatchResult {
    const reasonCodes = new Set<string>();
    const penalties = zeroPenalties();

    const marketSupported =
      item.availability.global ||
      !profile.countryCode ||
      item.availability.countries.includes(profile.countryCode);
    if (!marketSupported) {
      penalties.unsupportedMarketPenalty = policy.penalties.unsupportedMarketPenalty;
      reasonCodes.add("country_availability_unknown");
      return this.buildResult(item, "unavailable", 0, zeroBreakdown(), penalties, reasonCodes);
    }

    const consumerBlocked =
      isConsumerAudience(profile.audienceType) && item.requiresProfessionalAudience;
    if (consumerBlocked) {
      penalties.consumerAudiencePenalty = policy.penalties.consumerAudiencePenalty;
      reasonCodes.add("SERVICE_MATCH_AUDIENCE_INELIGIBLE");
      reasonCodes.add("consumer_context_detected");
      reasonCodes.add("unsuitable_b2b_target");
      return this.buildResult(item, "excluded", 0, zeroBreakdown(), penalties, reasonCodes);
    }

    if (
      item.requiresDecisionMakerEvidence &&
      profile.decisionMakerConfidence < policy.decisionMakerMin &&
      isConsumerAudience(profile.audienceType)
    ) {
      penalties.consumerAudiencePenalty = policy.penalties.consumerAudiencePenalty;
      reasonCodes.add("SERVICE_MATCH_AUDIENCE_INELIGIBLE");
      return this.buildResult(item, "excluded", 0, zeroBreakdown(), penalties, reasonCodes);
    }

    const businessTypeMatches = item.supportedBusinessTypes.includes(
      profile.businessType,
    );
    const businessTypeFit = businessTypeMatches ? 1 : 0;
    if (!businessTypeMatches && profile.businessTypeConfidence < 0.5) {
      reasonCodes.add("business_type_ambiguous");
      penalties.businessTypeAmbiguityPenalty =
        policy.penalties.businessTypeAmbiguityPenalty;
    }

    const audienceMatches = item.supportedAudienceTypes.includes(
      profile.audienceType,
    );
    const audienceFit = audienceMatches ? 1 : 0;
    if (!audienceMatches && !isProfessionalAudience(profile.audienceType)) {
      reasonCodes.add("audience_ambiguous");
      penalties.audienceAmbiguityPenalty = policy.penalties.audienceAmbiguityPenalty;
    }

    const needFit = overlapRatio(item.targetNeeds, profile.needs);
    const painPointFit = needFit;
    const objectiveFit = overlapRatio(profile.objectives, item.targetNeeds);

    const decisionMakerFit = item.requiresDecisionMakerEvidence
      ? clamp01(profile.decisionMakerConfidence / Math.max(policy.decisionMakerMin, 0.01))
      : 1;
    if (item.requiresDecisionMakerEvidence && decisionMakerFit < 1) {
      reasonCodes.add("decision_maker_uncertain");
    }

    const professionalContextFit = clamp01(
      profile.professionalContextConfidence /
        Math.max(policy.professionalContextMin, 0.01),
    );
    if (professionalContextFit < 1) {
      reasonCodes.add("professional_context_uncertain");
    }

    const digitalMaturityFit =
      item.phase >= 3 && ["none", "basic"].includes(profile.digitalMaturity)
        ? 0.5
        : 1;
    const businessStageFit =
      item.phase >= 3 && ["idea", "pre_launch"].includes(profile.businessStage)
        ? 0.5
        : 1;

    const regulatedMismatch =
      item.isRegulatedDomainOnly && !isRegulatedBusinessType(profile.businessType);
    const complianceFit = regulatedMismatch ? 0.6 : 1;
    if (item.isRegulatedDomainOnly && isRegulatedBusinessType(profile.businessType)) {
      reasonCodes.add("regulated_domain");
      penalties.regulatedDomainPenalty = policy.penalties.regulatedDomainPenalty;
    }

    const paymentReadinessFit = 1;
    if (item.isPaymentService) {
      penalties.providerDependencyPenalty = policy.penalties.providerDependencyPenalty;
      reasonCodes.add("payment_provider_dependency");
    }

    const prerequisiteFit = item.prerequisiteSlugs.length === 0 ? 1 : 0.7;
    if (item.prerequisiteSlugs.length > 0) {
      reasonCodes.add("prerequisite_unknown");
    }

    const breakdown: ServiceMatchScoreBreakdown = {
      businessTypeFit,
      industryFit: businessTypeFit,
      organizationFit: 1,
      audienceFit,
      decisionMakerFit,
      professionalContextFit,
      needFit,
      painPointFit,
      objectiveFit,
      digitalMaturityFit,
      businessStageFit,
      marketFit: 1,
      languageFit: 1,
      channelFit: 1,
      integrationFit: 1,
      urgencyFit: 1,
      securityFit: regulatedMismatch ? 0.7 : 1,
      paymentReadinessFit,
      automationReadinessFit: 1,
      capabilityAvailabilityFit: 1,
      prerequisiteFit,
      complianceFit,
    };

    const weightedScore = (
      Object.keys(breakdown) as (keyof ServiceMatchScoreBreakdown)[]
    ).reduce(
      (sum, key) => sum + breakdown[key] * policy.weights[key],
      0,
    );

    const penaltyTotal = (
      Object.keys(penalties) as (keyof ServiceMatchPenalties)[]
    ).reduce((sum, key) => sum + penalties[key], 0);

    const score = clamp01(weightedScore - penaltyTotal);

    let state: ServiceMatchState;
    if (score >= policy.autoApproveMin) {
      state = item.prerequisiteSlugs.length > 0
        ? "recommended_with_prerequisites"
        : "recommended";
    } else if (score >= policy.reviewMin) {
      state = "optional";
    } else if (item.phase >= 3) {
      state = "future_phase";
    } else {
      state = "blocked";
    }

    if (score < policy.reviewMin) {
      reasonCodes.add("low_recommendation_confidence");
    }

    return this.buildResult(item, state, score, breakdown, penalties, reasonCodes);
  }

  private buildResult(
    item: MatchableCatalogItem,
    state: ServiceMatchState,
    score: number,
    breakdown: ServiceMatchScoreBreakdown,
    penalties: ServiceMatchPenalties,
    reasonCodes: Set<string>,
  ): ServiceMatchResult {
    return {
      itemSlug: item.slug,
      categoryCode: item.categoryCode,
      state,
      score,
      breakdown,
      penalties,
      reasonCodes: [...reasonCodes],
      phase: item.phase,
      isPaymentService: item.isPaymentService,
      providerDependency: item.providerDependency,
      complianceDisclaimer: item.isPaymentService
        ? { ...PAYMENT_COMPLIANCE_DISCLAIMERS }
        : null,
    };
  }

  rankAll(
    profile: MatchableProfile,
    items: readonly MatchableCatalogItem[],
    policy: MatchingPolicyInput,
  ): ServiceMatchResult[] {
    return items
      .map((item) => this.scoreItem(profile, item, policy))
      .sort((a, b) => b.score - a.score);
  }
}
