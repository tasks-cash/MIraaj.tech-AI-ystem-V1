import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  CAMPAIGN_BRIEF_STATUSES,
  CAMPAIGN_JOB_STATUSES,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_PACKAGE_STATUSES,
  CAMPAIGN_PLATFORMS,
  CAMPAIGN_REVIEW_REASON_CODES,
  CAMPAIGN_REVIEW_STATUSES,
  CAMPAIGN_TYPES,
  CONTENT_FORMATS,
  CTA_CODES,
  FUNNEL_STAGES,
  LOCALIZATION_MODES,
} from "@miraaj/shared-types";

const campaignJobSchema = new Schema(
  {
    campaignJobId: { type: String, required: true, unique: true, index: true },
    campaignId: { type: String, required: true, index: true },
    recommendationSetId: { type: String, required: true, index: true },
    recommendationSetRevision: { type: Number, required: true, default: 1 },
    campaignBriefId: { type: String, index: true },
    status: {
      type: String,
      enum: CAMPAIGN_JOB_STATUSES,
      required: true,
      default: "created",
      index: true,
    },
    queueName: { type: String, required: true },
    bullJobId: { type: String, unique: true, sparse: true },
    requestedBy: { type: String, required: true },
    idempotencyKeyHash: { type: String, index: true },
    generationFingerprint: { type: String, required: true, index: true },
    correlationId: { type: String, required: true },
    requestId: { type: String, required: true },
    providerPreference: { type: String, default: "disabled" },
    translationProviderPreference: { type: String, default: "disabled" },
    campaignPromptVersionId: { type: String },
    translationPromptVersionId: { type: String },
    brandProfileVersion: { type: Number },
    catalogVersionId: { type: String },
    platformPolicyVersion: { type: Number },
    compliancePolicyVersion: { type: Number },
    selectedServiceIds: { type: [String], default: [] },
    campaignType: { type: String, enum: CAMPAIGN_TYPES, required: true },
    objective: { type: String, enum: CAMPAIGN_OBJECTIVES, required: true },
    funnelStage: { type: String, enum: FUNNEL_STAGES, required: true },
    selectedPlatforms: { type: [String], enum: CAMPAIGN_PLATFORMS, default: [] },
    selectedFormats: { type: [String], enum: CONTENT_FORMATS, default: [] },
    targetCountries: { type: [String], default: [] },
    targetLanguages: { type: [String], default: [] },
    targetLocales: { type: [String], default: [] },
    baseLanguage: { type: String, required: true, default: "en" },
    sourceLocale: { type: String, required: true, default: "en" },
    destinationType: { type: String },
    destinationReference: { type: String },
    offerDetails: { type: String },
    campaignName: { type: String },
    forceRegeneration: { type: Boolean, default: false },
    manualReviewRequested: { type: Boolean, default: false },
    allowCampaignOverride: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    currentStage: { type: String, default: "created" },
    lastHeartbeatAt: { type: Date, index: true },
    queuedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    cancelledAt: { type: Date },
    errorCode: { type: String },
    safeError: { type: String },
    campaignPackageId: { type: String, index: true },
    requiresReview: { type: Boolean, default: true },
    reviewReasonCodes: {
      type: [String],
      enum: CAMPAIGN_REVIEW_REASON_CODES,
      default: [],
    },
    reusedFromJobId: { type: String },
    reusedFromCampaignPackageId: { type: String },
    reuseReason: { type: String },
  },
  { timestamps: true, collection: "ai_campaign_jobs" },
);
campaignJobSchema.index({ status: 1, createdAt: -1 });
campaignJobSchema.index({ recommendationSetId: 1, recommendationSetRevision: 1 });

export type CampaignJobDocument = InferSchemaType<typeof campaignJobSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const CampaignJobModel =
  (mongoose.models.AiCampaignJob as Model<CampaignJobDocument> | undefined) ??
  mongoose.model<CampaignJobDocument>("AiCampaignJob", campaignJobSchema);

const campaignAttemptSchema = new Schema(
  {
    attemptId: { type: String, required: true, unique: true, index: true },
    campaignJobId: { type: String, required: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    workerId: { type: String, required: true },
    stages: { type: [Schema.Types.Mixed], default: [] },
    sourceSnapshotChecksum: { type: String, required: true },
    generationFingerprint: { type: String, required: true },
    providerConfiguration: { type: Schema.Types.Mixed, default: {} },
    translationConfiguration: { type: Schema.Types.Mixed, default: {} },
    campaignPromptVersionId: { type: String },
    translationPromptVersionId: { type: String },
    brandProfileVersion: { type: Number },
    catalogVersionId: { type: String },
    platformPolicyVersion: { type: Number },
    compliancePolicyVersion: { type: Number },
    timing: { type: Schema.Types.Mixed, default: {} },
    usageMetadata: { type: Schema.Types.Mixed, default: {} },
    estimatedCost: { type: Number },
    warnings: { type: [String], default: [] },
    failureCode: { type: String },
    safeFailure: { type: String },
    completedAt: { type: Date },
    immutable: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "ai_campaign_attempts" },
);
campaignAttemptSchema.index({ campaignJobId: 1, attemptNumber: 1 }, { unique: true });

export type CampaignAttemptDocument = InferSchemaType<
  typeof campaignAttemptSchema
> & { _id: mongoose.Types.ObjectId };
export const CampaignAttemptModel =
  (mongoose.models.AiCampaignAttempt as
    | Model<CampaignAttemptDocument>
    | undefined) ??
  mongoose.model<CampaignAttemptDocument>(
    "AiCampaignAttempt",
    campaignAttemptSchema,
  );

const campaignBriefSchema = new Schema(
  {
    campaignBriefId: { type: String, required: true, unique: true, index: true },
    campaignId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: CAMPAIGN_BRIEF_STATUSES,
      required: true,
      default: "draft",
      index: true,
    },
    schemaVersion: { type: String, default: "1.0" },
    currentRevision: { type: Number, required: true, default: 1 },
    recommendationSetId: { type: String, required: true, index: true },
    recommendationSetRevision: { type: Number, required: true, default: 1 },
    businessProfileId: { type: String, required: true },
    businessProfileRevision: { type: Number, default: 1 },
    catalogVersionId: { type: String, required: true },
    matchingPolicyVersionId: { type: String, required: true },
    sourceAnalysisResultId: { type: String },
    sourceAnalysisRevision: { type: Number },
    campaignSourceChecksum: { type: String, required: true },
    name: { type: String, required: true },
    internalName: { type: String, required: true },
    campaignType: { type: String, enum: CAMPAIGN_TYPES, required: true },
    objective: { type: String, enum: CAMPAIGN_OBJECTIVES, required: true },
    funnelStage: { type: String, enum: FUNNEL_STAGES, required: true },
    selectedServiceIds: { type: [String], required: true },
    primaryServiceId: { type: String, required: true },
    supportingServiceIds: { type: [String], default: [] },
    campaignGoal: { type: String },
    desiredAction: { type: String },
    destinationType: { type: String },
    destinationReference: { type: String },
    offerType: { type: String },
    offerDetails: { type: String },
    urgencyPolicy: { type: String, default: "no_fake_urgency" },
    proofPolicy: { type: String, default: "evidence_required" },
    selectedPlatforms: { type: [String], enum: CAMPAIGN_PLATFORMS, default: [] },
    selectedFormats: { type: [String], enum: CONTENT_FORMATS, default: [] },
    audienceStrategy: { type: Schema.Types.Mixed, default: {} },
    promotionEligibility: { type: String },
    decisionMakerLikelihood: { type: Number, min: 0, max: 1 },
    professionalContextConfidence: { type: Number, min: 0, max: 1 },
    consumerContextConfidence: { type: Number, min: 0, max: 1 },
    excludedAudienceTypes: { type: [String], default: [] },
    targetCountries: { type: [String], default: [] },
    targetRegions: { type: [String], default: [] },
    targetLanguages: { type: [String], default: [] },
    targetLocales: { type: [String], default: [] },
    baseLanguage: { type: String, required: true },
    sourceLocale: { type: String, required: true },
    localizationMode: {
      type: String,
      enum: LOCALIZATION_MODES,
      default: "source_language_only",
    },
    transcreationRequired: { type: Boolean, default: false },
    brandProfileId: { type: String, required: true },
    brandProfileVersion: { type: Number, required: true },
    toneProfile: { type: [String], default: [] },
    prohibitedClaims: { type: [String], default: [] },
    requiredDisclosures: { type: Schema.Types.Mixed, default: {} },
    protectedTerms: { type: [String], default: [] },
    glossaryVersionId: { type: String },
    requiresReview: { type: Boolean, default: true },
    reviewReasonCodes: {
      type: [String],
      enum: CAMPAIGN_REVIEW_REASON_CODES,
      default: [],
    },
    complianceStatus: { type: String, default: "pending" },
    qualityStatus: { type: String, default: "pending" },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    createdBy: { type: String, required: true },
    correlationId: { type: String, required: true },
  },
  { timestamps: true, collection: "ai_campaign_briefs" },
);
campaignBriefSchema.index({ status: 1, createdAt: -1 });
campaignBriefSchema.index({ recommendationSetId: 1, recommendationSetRevision: 1 });

export type CampaignBriefDocument = InferSchemaType<typeof campaignBriefSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const CampaignBriefModel =
  (mongoose.models.AiCampaignBrief as Model<CampaignBriefDocument> | undefined) ??
  mongoose.model<CampaignBriefDocument>("AiCampaignBrief", campaignBriefSchema);

const platformVariantSchema = new Schema(
  {
    platformVariantId: { type: String, required: true },
    platform: { type: String, enum: CAMPAIGN_PLATFORMS, required: true },
    platformPolicyVersion: { type: Number, required: true },
    language: { type: String, required: true },
    locale: { type: String, required: true },
    direction: { type: String, default: "ltr" },
    format: { type: String, enum: CONTENT_FORMATS, required: true },
    objective: { type: String, enum: CAMPAIGN_OBJECTIVES },
    funnelStage: { type: String, enum: FUNNEL_STAGES },
    title: { type: String },
    headline: { type: String },
    hook: { type: String },
    primaryText: { type: String },
    shortText: { type: String },
    longText: { type: String },
    description: { type: String },
    cta: { type: String },
    ctaCode: { type: String, enum: CTA_CODES },
    ctaLabel: { type: String },
    hashtags: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    disclosureText: { type: String },
    accessibilityText: { type: String },
    altText: { type: String },
    qualityScore: { type: Number, min: 0, max: 1 },
    complianceScore: { type: Number, min: 0, max: 1 },
    brandScore: { type: Number, min: 0, max: 1 },
    platformFitScore: { type: Number, min: 0, max: 1 },
    warnings: { type: [String], default: [] },
    requiresReview: { type: Boolean, default: false },
    reviewReasonCodes: { type: [String], default: [] },
    contentChecksum: { type: String },
    generatedAt: { type: Date },
  },
  { _id: false },
);

const languageVariantSchema = new Schema(
  {
    languageVariantId: { type: String, required: true },
    language: { type: String, required: true },
    locale: { type: String, required: true },
    direction: { type: String, default: "ltr" },
    strategy: { type: String, default: "transcreation" },
    sourceText: { type: String },
    translatedText: { type: String },
    transcreatedText: { type: String },
    provider: { type: String },
    model: { type: String },
    promptVersionId: { type: String },
    glossaryVersionId: { type: String },
    qualityScore: { type: Number, min: 0, max: 1 },
    semanticPreservationScore: { type: Number, min: 0, max: 1 },
    compliancePreservationScore: { type: Number, min: 0, max: 1 },
    protectedTermChecks: { type: Schema.Types.Mixed, default: [] },
    requiresReview: { type: Boolean, default: false },
    reviewReasonCodes: { type: [String], default: [] },
    status: { type: String, default: "draft" },
  },
  { _id: false },
);

const campaignPackageSchema = new Schema(
  {
    campaignPackageId: { type: String, required: true, unique: true, index: true },
    campaignId: { type: String, required: true, index: true },
    campaignBriefId: { type: String, required: true, index: true },
    campaignBriefRevision: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: CAMPAIGN_PACKAGE_STATUSES,
      required: true,
      default: "generated",
      index: true,
    },
    operationalStatus: {
      type: String,
      enum: ["draft", "approved", "active", "paused", "archived"],
      default: "draft",
      index: true,
    },
    operations: { type: Schema.Types.Mixed, default: {} },
    revisionHistory: { type: [Schema.Types.Mixed], default: [] },
    activeRevision: { type: Number, default: 1 },
    schemaVersion: { type: String, default: "1.0" },
    currentRevision: { type: Number, required: true, default: 1 },
    recommendationSetId: { type: String, required: true, index: true },
    recommendationSetRevision: { type: Number, required: true },
    businessProfileId: { type: String, required: true },
    businessProfileRevision: { type: Number, default: 1 },
    sourceAnalysisResultId: { type: String },
    sourceAnalysisRevision: { type: Number },
    catalogVersionId: { type: String, required: true },
    matchingPolicyVersionId: { type: String, required: true },
    brandProfileId: { type: String, required: true },
    brandProfileVersion: { type: Number, required: true },
    platformPolicyVersion: { type: Number, required: true },
    compliancePolicyVersion: { type: Number, required: true },
    campaignPromptVersionId: { type: String },
    translationPromptVersionId: { type: String },
    glossaryVersionId: { type: String },
    objective: { type: String, enum: CAMPAIGN_OBJECTIVES, required: true },
    funnelStage: { type: String, enum: FUNNEL_STAGES, required: true },
    campaignType: { type: String, enum: CAMPAIGN_TYPES, required: true },
    primaryAudience: { type: String },
    decisionMakerTypes: { type: [String], default: [] },
    promotionEligibility: { type: String },
    selectedServices: { type: [String], default: [] },
    targetCountries: { type: [String], default: [] },
    targetLanguages: { type: [String], default: [] },
    targetLocales: { type: [String], default: [] },
    selectedPlatforms: { type: [String], enum: CAMPAIGN_PLATFORMS, default: [] },
    selectedFormats: { type: [String], enum: CONTENT_FORMATS, default: [] },
    masterMessageFramework: { type: Schema.Types.Mixed, default: {} },
    strategy: { type: Schema.Types.Mixed, default: {} },
    baseLanguageVariant: { type: Schema.Types.Mixed, default: {} },
    languageVariants: { type: [languageVariantSchema], default: [] },
    platformVariants: { type: [platformVariantSchema], default: [] },
    imageCreativeBriefs: { type: [Schema.Types.Mixed], default: [] },
    videoCreativeBriefs: { type: [Schema.Types.Mixed], default: [] },
    carouselBriefs: { type: [Schema.Types.Mixed], default: [] },
    storySequences: { type: [Schema.Types.Mixed], default: [] },
    ctaVariants: { type: [Schema.Types.Mixed], default: [] },
    hashtagSets: { type: [Schema.Types.Mixed], default: [] },
    keywordSets: { type: [Schema.Types.Mixed], default: [] },
    requiredDisclosures: { type: Schema.Types.Mixed, default: {} },
    campaignConfidence: { type: Number, min: 0, max: 1 },
    qualityBreakdown: { type: Schema.Types.Mixed, default: {} },
    penalties: { type: Schema.Types.Mixed, default: {} },
    overallQualityScore: { type: Number, min: 0, max: 1 },
    warnings: { type: [String], default: [] },
    contradictions: { type: [String], default: [] },
    requiresReview: { type: Boolean, default: true },
    reviewReasonCodes: {
      type: [String],
      enum: CAMPAIGN_REVIEW_REASON_CODES,
      default: [],
    },
    reviewStatus: {
      type: String,
      enum: CAMPAIGN_REVIEW_STATUSES,
      default: "pending",
    },
    reviewerId: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date, index: true },
    rejectedAt: { type: Date },
    supersededAt: { type: Date },
    campaignJobId: { type: String, required: true, index: true },
    campaignAttemptId: { type: String, required: true },
    correlationId: { type: String, required: true },
    createdBy: { type: String, required: true },
    providerState: { type: String, default: "disabled" },
    contentChecksum: { type: String },
  },
  { timestamps: true, collection: "ai_campaign_packages" },
);
campaignPackageSchema.index({ status: 1, createdAt: -1 });
campaignPackageSchema.index({ campaignBriefId: 1, currentRevision: 1 });

export type CampaignPackageDocument = InferSchemaType<
  typeof campaignPackageSchema
> & { _id: mongoose.Types.ObjectId };
export const CampaignPackageModel =
  (mongoose.models.AiCampaignPackage as
    | Model<CampaignPackageDocument>
    | undefined) ??
  mongoose.model<CampaignPackageDocument>(
    "AiCampaignPackage",
    campaignPackageSchema,
  );

const campaignReviewSchema = new Schema(
  {
    reviewId: { type: String, required: true, unique: true, index: true },
    campaignPackageId: { type: String, required: true, index: true },
    campaignRevision: { type: Number, required: true },
    campaignBriefId: { type: String, required: true },
    reviewerId: { type: String, required: true },
    status: {
      type: String,
      enum: CAMPAIGN_REVIEW_STATUSES,
      required: true,
      default: "pending",
    },
    reasonCodes: {
      type: [String],
      enum: CAMPAIGN_REVIEW_REASON_CODES,
      default: [],
    },
    corrections: { type: Schema.Types.Mixed, default: {} },
    regenerationInstructions: { type: String },
    notes: { type: String },
    previousRevision: { type: Number },
    newRevision: { type: Number },
    reviewedAt: { type: Date },
  },
  { timestamps: true, collection: "ai_campaign_reviews" },
);

export type CampaignReviewDocument = InferSchemaType<
  typeof campaignReviewSchema
> & { _id: mongoose.Types.ObjectId };
export const CampaignReviewModel =
  (mongoose.models.AiCampaignReview as Model<CampaignReviewDocument> | undefined) ??
  mongoose.model<CampaignReviewDocument>("AiCampaignReview", campaignReviewSchema);

const campaignFeedbackSchema = new Schema(
  {
    feedbackId: { type: String, required: true, unique: true, index: true },
    campaignPackageId: { type: String, required: true, index: true },
    category: { type: String, required: true },
    originalValue: { type: Schema.Types.Mixed },
    correctedValue: { type: Schema.Types.Mixed },
    reason: { type: String },
    evidence: { type: [String], default: [] },
    reviewerId: { type: String, required: true },
    language: { type: String },
    locale: { type: String },
    platform: { type: String },
    serviceIds: { type: [String], default: [] },
    promptVersions: { type: Schema.Types.Mixed, default: {} },
    provider: { type: String },
    model: { type: String },
    brandProfileVersion: { type: Number },
    catalogVersionId: { type: String },
  },
  { timestamps: true, collection: "ai_campaign_feedback" },
);

export type CampaignFeedbackDocument = InferSchemaType<
  typeof campaignFeedbackSchema
> & { _id: mongoose.Types.ObjectId };
export const CampaignFeedbackModel =
  (mongoose.models.AiCampaignFeedback as
    | Model<CampaignFeedbackDocument>
    | undefined) ??
  mongoose.model<CampaignFeedbackDocument>(
    "AiCampaignFeedback",
    campaignFeedbackSchema,
  );
