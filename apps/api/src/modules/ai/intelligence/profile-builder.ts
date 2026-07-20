import { createHash, randomUUID } from "node:crypto";
import type {
  AudienceType,
  BusinessType,
  GroupSourceContext,
  PromotionEligibility,
} from "@miraaj/shared-types";
import {
  isConsumerAudience,
  isProfessionalAudience,
} from "@miraaj/shared-types";

export function buildIntelligenceFingerprint(input: {
  analysisResultId: string;
  analysisRevision: string;
  catalogVersionId: string;
  matchingPolicyId: string;
  allowAwaitingReviewSource: boolean;
}): string {
  return createHash("sha256")
    .update(
      [
        input.analysisResultId,
        input.analysisRevision,
        input.catalogVersionId,
        input.matchingPolicyId,
        String(input.allowAwaitingReviewSource),
      ].join("|"),
    )
    .digest("hex");
}

function asSignalCode(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim().toLowerCase();
  }
  if (
    value &&
    typeof value === "object" &&
    "code" in value &&
    typeof (value).code === "string"
  ) {
    return String((value as { code: string }).code).trim().toLowerCase();
  }
  if (
    value &&
    typeof value === "object" &&
    "label" in value &&
    typeof (value).label === "string"
  ) {
    return String((value as { label: string }).label).trim().toLowerCase();
  }
  return fallback;
}

function asConfidence(value: unknown, fallback = 0.5): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  if (
    value &&
    typeof value === "object" &&
    "confidence" in value &&
    typeof (value).confidence === "number"
  ) {
    return Math.max(0, Math.min(1, (value as { confidence: number }).confidence));
  }
  return fallback;
}

function mapBusinessType(code: string): BusinessType {
  const aliases: Record<string, BusinessType> = {
    dental_clinic: "dental_clinic",
    dental: "dental_clinic",
    restaurant: "restaurant",
    school: "school",
    hotel: "hotel",
    ecommerce: "ecommerce_business",
    ecommerce_business: "ecommerce_business",
    real_estate: "real_estate_agency",
    real_estate_agency: "real_estate_agency",
  };
  return aliases[code] ?? (code as BusinessType) ?? "unknown";
}

function mapAudience(code: string): AudienceType {
  const aliases: Record<string, AudienceType> = {
    dentist: "dentist",
    clinic_owner: "clinic_owner",
    patient: "patient",
    general_public: "general_public",
    consumer: "consumer",
    restaurant_owner: "restaurant_owner",
    school_manager: "school_manager",
    student: "student",
    hotel_manager: "hotel_manager",
    business_owner: "business_owner",
  };
  return aliases[code] ?? (code as AudienceType) ?? "unknown";
}

export function buildDeterministicProfileFromAnalysis(input: {
  analysisResultId: string;
  sourceMediaId?: string;
  jobId?: string;
  mergedOutput: Record<string, unknown>;
  reasoning?: Record<string, unknown> | null;
}) {
  const merged = input.mergedOutput;
  const businessSignals: unknown[] = Array.isArray(merged.businessSignals)
    ? merged.businessSignals
    : [];
  const audienceSignals: unknown[] = Array.isArray(merged.audienceSignals)
    ? merged.audienceSignals
    : [];
  const topBusiness: unknown = businessSignals[0];
  const topAudience: unknown = audienceSignals[0];
  const rankedBusinessTypes = input.reasoning?.rankedBusinessTypes;
  const rankedAudienceTypes = input.reasoning?.rankedAudienceTypes;
  const rankedBusiness: unknown = Array.isArray(rankedBusinessTypes)
    ? rankedBusinessTypes[0]
    : undefined;
  const rankedAudience: unknown = Array.isArray(rankedAudienceTypes)
    ? rankedAudienceTypes[0]
    : undefined;
  const businessType = mapBusinessType(
    asSignalCode(rankedBusiness ?? topBusiness, "unknown"),
  );
  const audienceType = mapAudience(
    asSignalCode(rankedAudience ?? topAudience, "unknown"),
  );

  let groupSourceContext: GroupSourceContext = "unknown";
  if (audienceType === "patient") {
    groupSourceContext = "patient_group";
  } else if (audienceType === "student") {
    groupSourceContext = "student_group";
  } else if (isConsumerAudience(audienceType)) {
    groupSourceContext = "consumer_group";
  } else if (isProfessionalAudience(audienceType)) {
    groupSourceContext = "professional_group";
  }

  const decisionMakerConfidence = isProfessionalAudience(audienceType)
    ? Math.max(0.7, asConfidence(topAudience, 0.75))
    : isConsumerAudience(audienceType)
      ? Math.min(0.25, asConfidence(topAudience, 0.2))
      : 0.4;
  const professionalContextConfidence = isProfessionalAudience(audienceType)
    ? 0.85
    : isConsumerAudience(audienceType)
      ? 0.15
      : 0.45;

  let promotionEligibility: PromotionEligibility = "unknown";
  if (isProfessionalAudience(audienceType) && decisionMakerConfidence >= 0.65) {
    promotionEligibility = "eligible_b2b";
  } else if (isConsumerAudience(audienceType)) {
    promotionEligibility = "unsuitable";
  } else {
    promotionEligibility = "review_required";
  }

  const needs: string[] = [];
  if (businessType === "dental_clinic") {
    needs.push("patient_management", "booking", "payment_tracking", "corporate_website");
  } else if (businessType === "restaurant") {
    needs.push("restaurant_management", "booking", "inventory", "corporate_website");
  } else if (businessType === "school") {
    needs.push("student_management", "attendance", "employee_management", "corporate_website");
  } else if (businessType === "ecommerce_business") {
    needs.push("ecommerce_store", "inventory", "online_checkout", "analytics");
  } else {
    needs.push("corporate_website", "crm", "reporting");
  }

  return {
    profileId: randomUUID(),
    analysisResultId: input.analysisResultId,
    sourceMediaId: input.sourceMediaId,
    jobId: input.jobId,
    status: "generated" as const,
    businessType: {
      code: businessType,
      confidence: asConfidence(topBusiness, 0.6),
      evidence: ["analysis_result"],
      provenance: "deterministic" as const,
      inferred: true,
    },
    organizationType: {
      code: "small_business",
      confidence: 0.4,
      evidence: [],
      provenance: "deterministic" as const,
      inferred: true,
    },
    businessStage: {
      code: "operating",
      confidence: 0.4,
      evidence: [],
      provenance: "deterministic" as const,
      inferred: true,
    },
    digitalMaturity: {
      code: "basic",
      confidence: 0.4,
      evidence: [],
      provenance: "deterministic" as const,
      inferred: true,
    },
    audienceType: {
      code: audienceType,
      confidence: asConfidence(topAudience, 0.6),
      evidence: ["analysis_result"],
      provenance: "deterministic" as const,
      inferred: true,
    },
    groupSourceContext: {
      code: groupSourceContext,
      confidence: 0.7,
      evidence: [],
      provenance: "deterministic" as const,
      inferred: true,
    },
    promotionEligibility: {
      code: promotionEligibility,
      confidence: 0.8,
      evidence: [],
      provenance: "deterministic" as const,
      inferred: false,
    },
    needs,
    painPoints: [],
    objectives: [],
    decisionMakerConfidence,
    professionalContextConfidence,
    reasoningProvider: input.reasoning ? "gemini" : "disabled",
    reasoningPayload: input.reasoning ?? null,
    requiresReview: false,
    reviewReasonCodes: [] as string[],
  };
}
