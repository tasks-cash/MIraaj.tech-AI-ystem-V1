import type {
  AudienceType,
  BusinessNeedCode,
  BusinessStage,
  BusinessType,
  DigitalMaturity,
  GroupSourceContext,
  OrganizationType,
  ServiceMatchPenalties,
  ServiceMatchScoreBreakdown,
  ServiceMatchState,
} from "@miraaj/shared-types";

/** Minimal, deterministic projection of a BusinessProfile used for scoring. */
export interface MatchableProfile {
  businessType: BusinessType;
  businessTypeConfidence: number;
  organizationType: OrganizationType;
  businessStage: BusinessStage;
  digitalMaturity: DigitalMaturity;
  audienceType: AudienceType;
  audienceConfidence: number;
  groupSourceContext: GroupSourceContext;
  needs: BusinessNeedCode[];
  painPoints: string[];
  objectives: string[];
  decisionMakerConfidence: number;
  professionalContextConfidence: number;
  countryCode: string | null;
  languages: string[];
}

export interface MatchableCatalogItem {
  slug: string;
  categoryCode: string;
  supportedBusinessTypes: BusinessType[];
  supportedAudienceTypes: AudienceType[];
  targetNeeds: BusinessNeedCode[];
  requiresProfessionalAudience: boolean;
  requiresDecisionMakerEvidence: boolean;
  isPaymentService: boolean;
  isRegulatedDomainOnly: boolean;
  providerDependency: string | null;
  prerequisiteSlugs: string[];
  phase: number;
  availability: { global: boolean; countries: string[] };
}

export interface MatchingPolicyInput {
  weights: ServiceMatchScoreBreakdown;
  penalties: ServiceMatchPenalties;
  autoApproveMin: number;
  reviewMin: number;
  decisionMakerMin: number;
  professionalContextMin: number;
}

export interface ServiceMatchResult {
  itemSlug: string;
  categoryCode: string;
  state: ServiceMatchState;
  score: number;
  breakdown: ServiceMatchScoreBreakdown;
  penalties: ServiceMatchPenalties;
  reasonCodes: string[];
  phase: number;
  isPaymentService: boolean;
  providerDependency: string | null;
  complianceDisclaimer: {
    en: string;
    ar: string;
    fr: string;
  } | null;
}
