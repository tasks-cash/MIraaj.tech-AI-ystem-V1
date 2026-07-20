import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  INTELLIGENCE_REVIEW_REASON_CODES,
  RECOMMENDATION_SET_STATUSES,
  SERVICE_MATCH_STATES,
  type IntelligenceReviewReasonCode,
  type RecommendationSetStatus,
  type ServiceMatchState,
} from "@miraaj/shared-types";

const scoreBreakdownSchema = new Schema(
  {
    businessTypeFit: { type: Number, required: true },
    industryFit: { type: Number, required: true },
    organizationFit: { type: Number, required: true },
    audienceFit: { type: Number, required: true },
    decisionMakerFit: { type: Number, required: true },
    professionalContextFit: { type: Number, required: true },
    needFit: { type: Number, required: true },
    painPointFit: { type: Number, required: true },
    objectiveFit: { type: Number, required: true },
    digitalMaturityFit: { type: Number, required: true },
    businessStageFit: { type: Number, required: true },
    marketFit: { type: Number, required: true },
    languageFit: { type: Number, required: true },
    channelFit: { type: Number, required: true },
    integrationFit: { type: Number, required: true },
    urgencyFit: { type: Number, required: true },
    securityFit: { type: Number, required: true },
    paymentReadinessFit: { type: Number, required: true },
    automationReadinessFit: { type: Number, required: true },
    capabilityAvailabilityFit: { type: Number, required: true },
    prerequisiteFit: { type: Number, required: true },
    complianceFit: { type: Number, required: true },
  },
  { _id: false },
);

const penaltiesSchema = new Schema(
  {
    consumerAudiencePenalty: { type: Number, required: true, default: 0 },
    audienceAmbiguityPenalty: { type: Number, required: true, default: 0 },
    businessTypeAmbiguityPenalty: { type: Number, required: true, default: 0 },
    contradictionPenalty: { type: Number, required: true, default: 0 },
    unsupportedMarketPenalty: { type: Number, required: true, default: 0 },
    unavailableCapabilityPenalty: { type: Number, required: true, default: 0 },
    missingPrerequisitePenalty: { type: Number, required: true, default: 0 },
    regulatedDomainPenalty: { type: Number, required: true, default: 0 },
    providerDependencyPenalty: { type: Number, required: true, default: 0 },
    lowEvidencePenalty: { type: Number, required: true, default: 0 },
    duplicateRecommendationPenalty: { type: Number, required: true, default: 0 },
    incompatibleServicePenalty: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const recommendationItemSchema = new Schema(
  {
    itemSlug: { type: String, required: true },
    categoryCode: { type: String, required: true },
    state: { type: String, enum: SERVICE_MATCH_STATES, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    breakdown: { type: scoreBreakdownSchema, required: true },
    penalties: { type: penaltiesSchema, required: true },
    phase: { type: Number, required: true, min: 0, max: 5 },
    bundleCodes: { type: [String], default: [] },
    reasonCodes: { type: [String], default: [] },
    isPaymentService: { type: Boolean, default: false },
    complianceDisclaimer: { type: Schema.Types.Mixed, default: null },
    providerDependency: { type: String, default: null },
  },
  { _id: false },
);

const bundleResultSchema = new Schema(
  {
    bundleCode: { type: String, required: true },
    memberSlugs: { type: [String], required: true },
    recommendedMemberSlugs: { type: [String], required: true, default: [] },
    coverageRatio: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const serviceRecommendationSetSchema = new Schema(
  {
    setId: { type: String, required: true, unique: true, index: true },
    jobId: { type: String, required: true, index: true },
    analysisResultId: { type: String, required: true, index: true },
    profileId: { type: String, required: true, index: true },
    catalogVersionId: { type: String, required: true },
    matchingPolicyId: { type: String, required: true },
    status: {
      type: String,
      enum: RECOMMENDATION_SET_STATUSES,
      required: true,
      default: "generated",
      index: true,
    },
    items: { type: [recommendationItemSchema], required: true, default: [] },
    bundles: { type: [bundleResultSchema], required: true, default: [] },
    phasePlan: { type: Schema.Types.Mixed, default: null },
    overallScore: { type: Number, min: 0, max: 1, required: true, default: 0 },
    reviewReasonCodes: {
      type: [String],
      enum: INTELLIGENCE_REVIEW_REASON_CODES,
      default: [],
    },
    requiresReview: { type: Boolean, default: false },
    correctedItems: { type: Schema.Types.Mixed, default: null },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    supersededBy: { type: String },
    immutable: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "service_recommendation_sets" },
);

serviceRecommendationSetSchema.index({ jobId: 1, status: 1 });

export type ServiceRecommendationSetDocument = InferSchemaType<
  typeof serviceRecommendationSetSchema
> & {
  _id: mongoose.Types.ObjectId;
  status: RecommendationSetStatus;
  reviewReasonCodes: IntelligenceReviewReasonCode[];
  items: Array<{
    itemSlug: string;
    categoryCode: string;
    state: ServiceMatchState;
    score: number;
    breakdown: Record<string, number>;
    penalties: Record<string, number>;
    phase: number;
    bundleCodes: string[];
    reasonCodes: string[];
    isPaymentService: boolean;
    complianceDisclaimer: Record<string, string> | null;
    providerDependency: string | null;
  }>;
};

export const ServiceRecommendationSetModel =
  (mongoose.models.ServiceRecommendationSet as
    | Model<ServiceRecommendationSetDocument>
    | undefined) ??
  mongoose.model<ServiceRecommendationSetDocument>(
    "ServiceRecommendationSet",
    serviceRecommendationSetSchema,
  );
