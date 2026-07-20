import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  AudienceSignalLabel,
  BusinessNeedCode,
  BusinessSignalLabel,
  BusinessType,
  EvidenceSignal,
  RankedCodeSignal,
} from "@miraaj/shared-types";
import { isProfessionalAudience } from "@miraaj/shared-types";
import {
  BusinessProfileModel,
  type BusinessProfileDocument,
} from "../models/business-profile.schema.js";
import {
  BUSINESS_SIGNAL_TO_BUSINESS_TYPE,
  BUSINESS_TYPE_DEFAULT_NEEDS,
  inferGroupSourceContext,
  inferPromotionEligibility,
  mapAudienceSignalToAudienceType,
} from "./business-profile-mapping.js";
import type { MatchableProfile } from "../matching/matching-types.js";

export interface AnalysisMergedOutputShape {
  mediaSummary: string | null;
  visibleTextSummary: string | null;
  businessSignals: readonly EvidenceSignal<BusinessSignalLabel>[];
  audienceSignals: readonly EvidenceSignal<AudienceSignalLabel>[];
  languageDetection?: { primaryLanguage?: string } | null;
}

export interface BuildProfileInput {
  analysisResultId: string;
  jobId: string;
  mergedOutput: AnalysisMergedOutputShape;
  professionalContext?: boolean;
  publicConsumerContext?: boolean;
  countryCode?: string | null;
  hints?: {
    needs?: BusinessNeedCode[];
    painPoints?: string[];
    objectives?: string[];
    countryCode?: string;
    languages?: string[];
  };
  reasoningSuggestion?: {
    provider: string;
    businessType?: string;
    audienceType?: string;
    confidence?: number;
    evidence?: string[];
  } | null;
}

function topSignal<TLabel extends string>(
  signals: readonly EvidenceSignal<TLabel>[],
): EvidenceSignal<TLabel> | null {
  if (signals.length === 0) {
    return null;
  }
  return [...signals].sort((a, b) => b.confidence - a.confidence)[0] ?? null;
}

function toRankedSignal<TCode extends string>(input: {
  code: TCode;
  confidence: number;
  evidence: readonly string[];
  contradictingEvidence?: readonly string[];
  provenance: RankedCodeSignal["provenance"];
  inferred: boolean;
}): RankedCodeSignal<TCode> {
  return {
    code: input.code,
    confidence: input.confidence,
    evidence: input.evidence,
    ...(input.contradictingEvidence
      ? { contradictingEvidence: input.contradictingEvidence }
      : {}),
    provenance: input.provenance,
    inferred: input.inferred,
  };
}

@Injectable()
export class BusinessProfileService {
  /**
   * Deterministically derives the profile from Prompt 2 evidence. A provider
   * reasoning suggestion (FastAPI) may only add corroborating evidence or a
   * review flag — it can never silently override the deterministic result.
   */
  buildProfile(input: BuildProfileInput): {
    fields: Record<string, unknown>;
    matchable: MatchableProfile;
    requiresReview: boolean;
    reviewReasonCodes: string[];
  } {
    const reviewReasonCodes = new Set<string>();

    const topBusiness = topSignal(input.mergedOutput.businessSignals);
    const topAudience = topSignal(input.mergedOutput.audienceSignals);

    const businessTypeCode: BusinessType = topBusiness
      ? BUSINESS_SIGNAL_TO_BUSINESS_TYPE[topBusiness.label] ?? "unknown"
      : "unknown";
    const businessTypeConfidence = topBusiness?.confidence ?? 0;
    if (businessTypeCode === "unknown" || businessTypeConfidence < 0.5) {
      reviewReasonCodes.add("business_type_ambiguous");
    }

    const audienceTypeCode = topAudience
      ? mapAudienceSignalToAudienceType(topAudience.label)
      : "unknown";
    const audienceConfidence = topAudience?.confidence ?? 0;
    if (audienceTypeCode === "unknown" || audienceTypeCode === "mixed") {
      reviewReasonCodes.add("audience_ambiguous");
    }

    let contradictingEvidence: string[] | undefined;
    if (
      input.reasoningSuggestion?.businessType &&
      input.reasoningSuggestion.businessType !== businessTypeCode
    ) {
      contradictingEvidence = [
        `provider(${input.reasoningSuggestion.provider}) suggested ${input.reasoningSuggestion.businessType}`,
      ];
      reviewReasonCodes.add("contradictory_evidence");
    }

    const professionalContext = input.professionalContext ?? isProfessionalAudience(audienceTypeCode);
    const decisionMakerConfidence = professionalContext
      ? audienceConfidence
      : audienceConfidence * 0.5;
    const professionalContextConfidence = input.professionalContext === true
      ? Math.max(0.85, audienceConfidence)
      : input.publicConsumerContext === true
        ? Math.min(0.2, audienceConfidence)
        : audienceConfidence;
    if (professionalContextConfidence < 0.65) {
      reviewReasonCodes.add("professional_context_uncertain");
    }
    if (input.publicConsumerContext === true) {
      reviewReasonCodes.add("consumer_context_detected");
    }

    const groupSourceContext = inferGroupSourceContext(audienceTypeCode);
    const promotionEligibility = inferPromotionEligibility(
      audienceTypeCode,
      businessTypeConfidence,
    );
    if (promotionEligibility === "review_required" || promotionEligibility === "unsuitable") {
      reviewReasonCodes.add("promotion_eligibility_unknown");
    }

    const defaultNeeds = BUSINESS_TYPE_DEFAULT_NEEDS[businessTypeCode] ?? [];
    const needs = [...new Set([...defaultNeeds, ...(input.hints?.needs ?? [])])];

    const requiresReview = reviewReasonCodes.size > 0;

    const fields = {
      businessType: toRankedSignal({
        code: businessTypeCode,
        confidence: businessTypeConfidence,
        evidence: topBusiness?.evidence ?? [],
        ...(contradictingEvidence ? { contradictingEvidence } : {}),
        provenance: "deterministic" as const,
        inferred: Boolean(topBusiness?.inferred),
      }),
      organizationType: toRankedSignal({
        code: "unknown" as const,
        confidence: 0,
        evidence: [],
        provenance: "deterministic" as const,
        inferred: true,
      }),
      businessStage: toRankedSignal({
        code: "unknown" as const,
        confidence: 0,
        evidence: [],
        provenance: "deterministic" as const,
        inferred: true,
      }),
      digitalMaturity: toRankedSignal({
        code: "unknown" as const,
        confidence: 0,
        evidence: [],
        provenance: "deterministic" as const,
        inferred: true,
      }),
      audienceType: toRankedSignal({
        code: audienceTypeCode,
        confidence: audienceConfidence,
        evidence: topAudience?.evidence ?? [],
        provenance: "deterministic" as const,
        inferred: Boolean(topAudience?.inferred),
      }),
      groupSourceContext: toRankedSignal({
        code: groupSourceContext,
        confidence: audienceConfidence,
        evidence: [],
        provenance: "deterministic" as const,
        inferred: true,
      }),
      promotionEligibility: toRankedSignal({
        code: promotionEligibility,
        confidence: businessTypeConfidence,
        evidence: [],
        provenance: "deterministic" as const,
        inferred: true,
      }),
      needs,
      painPoints: input.hints?.painPoints ?? [],
      objectives: input.hints?.objectives ?? [],
      countryCode: input.hints?.countryCode ?? input.countryCode ?? null,
      languages: input.hints?.languages ?? [],
      decisionMakerConfidence,
      professionalContextConfidence,
      reasoningProvider: input.reasoningSuggestion?.provider ?? "disabled",
      reasoningPayload: input.reasoningSuggestion ?? null,
      reviewReasonCodes: [...reviewReasonCodes],
      requiresReview,
      status: (requiresReview ? "awaiting_review" : "generated"),
    };

    const matchable: MatchableProfile = {
      businessType: businessTypeCode,
      businessTypeConfidence,
      organizationType: "unknown",
      businessStage: "unknown",
      digitalMaturity: "unknown",
      audienceType: audienceTypeCode,
      audienceConfidence,
      groupSourceContext,
      needs,
      painPoints: fields.painPoints,
      objectives: fields.objectives,
      decisionMakerConfidence,
      professionalContextConfidence,
      countryCode: fields.countryCode ?? null,
      languages: fields.languages,
    };

    return {
      fields,
      matchable,
      requiresReview,
      reviewReasonCodes: [...reviewReasonCodes],
    };
  }

  async persistProfile(input: {
    analysisResultId: string;
    jobId: string;
    fields: Record<string, unknown>;
  }): Promise<BusinessProfileDocument> {
    const profile = await BusinessProfileModel.create({
      profileId: randomUUID(),
      analysisResultId: input.analysisResultId,
      jobId: input.jobId,
      ...input.fields,
    });
    return profile.toObject();
  }

  async getProfile(profileId: string): Promise<BusinessProfileDocument> {
    const profile = await BusinessProfileModel.findOne({ profileId }).lean();
    if (!profile) {
      throw new NotFoundException({
        code: "BUSINESS_PROFILE_NOT_FOUND",
        message: "Business profile was not found.",
      });
    }
    return profile;
  }

  async listProfiles(input?: { status?: string; limit?: number }) {
    const query: Record<string, unknown> = {};
    if (input?.status) {
      query.status = input.status;
    }
    const limit = Math.min(input?.limit ?? 20, 100);
    const items = await BusinessProfileModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return { items, limit };
  }

  toMatchable(profile: BusinessProfileDocument): MatchableProfile {
    return {
      businessType: profile.businessType.code as BusinessType,
      businessTypeConfidence: profile.businessType.confidence,
      organizationType: profile.organizationType.code as never,
      businessStage: profile.businessStage.code as never,
      digitalMaturity: profile.digitalMaturity.code as never,
      audienceType: profile.audienceType.code as never,
      audienceConfidence: profile.audienceType.confidence,
      groupSourceContext: profile.groupSourceContext.code as never,
      needs: profile.needs,
      painPoints: profile.painPoints ?? [],
      objectives: profile.objectives ?? [],
      decisionMakerConfidence: profile.decisionMakerConfidence,
      professionalContextConfidence: profile.professionalContextConfidence,
      countryCode: profile.countryCode ?? null,
      languages: profile.languages ?? [],
    };
  }
}
