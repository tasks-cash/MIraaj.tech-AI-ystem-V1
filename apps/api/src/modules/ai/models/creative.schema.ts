import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  CAMPAIGN_PLATFORMS,
  CREATIVE_ASSET_STATUSES,
  CREATIVE_ASSET_TYPES,
  CREATIVE_FEEDBACK_CATEGORIES,
  CREATIVE_GENERATION_JOB_STATUSES,
  CREATIVE_IMAGE_PROVIDERS,
  CREATIVE_PROMPT_PURPOSES,
  CREATIVE_RENDER_PROVIDERS,
  CREATIVE_REVIEW_REASON_CODES,
  CREATIVE_REVIEW_STATUSES,
  CREATIVE_RIGHTS_STATUSES,
  CREATIVE_VIDEO_PROVIDERS,
} from "@miraaj/shared-types";

const creativeJobSchema = new Schema(
  {
    creativeJobId: { type: String, required: true, unique: true, index: true },
    campaignPackageId: { type: String, required: true, index: true },
    campaignPackageRevision: { type: Number, required: true, default: 1 },
    campaignBriefId: { type: String, index: true },
    campaignId: { type: String, index: true },
    status: {
      type: String,
      enum: CREATIVE_GENERATION_JOB_STATUSES,
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
    imageProviderPreference: {
      type: String,
      enum: CREATIVE_IMAGE_PROVIDERS,
      default: "disabled",
    },
    videoProviderPreference: {
      type: String,
      enum: CREATIVE_VIDEO_PROVIDERS,
      default: "disabled",
    },
    renderProviderPreference: {
      type: String,
      enum: CREATIVE_RENDER_PROVIDERS,
      default: "local",
    },
    selectedBriefIds: { type: [String], default: [] },
    selectedAssetTypes: {
      type: [String],
      enum: CREATIVE_ASSET_TYPES,
      default: [],
    },
    selectedPlatforms: {
      type: [String],
      enum: CAMPAIGN_PLATFORMS,
      default: [],
    },
    targetLanguages: { type: [String], default: [] },
    targetLocales: { type: [String], default: [] },
    brandProfileId: { type: String },
    brandProfileVersion: { type: Number },
    platformPolicyVersion: { type: Number },
    compliancePolicyVersion: { type: Number },
    renderSpecVersion: { type: Number },
    forceRegeneration: { type: Boolean, default: false },
    manualReviewRequested: { type: Boolean, default: false },
    allowOverride: { type: Boolean, default: false },
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
    assetIds: { type: [String], default: [] },
    requiresReview: { type: Boolean, default: true },
    reviewReasonCodes: {
      type: [String],
      enum: CREATIVE_REVIEW_REASON_CODES,
      default: [],
    },
    reusedFromJobId: { type: String },
  },
  { timestamps: true, collection: "ai_creative_generation_jobs" },
);
creativeJobSchema.index({ status: 1, createdAt: -1 });
creativeJobSchema.index({
  campaignPackageId: 1,
  campaignPackageRevision: 1,
});

export type CreativeGenerationJobDocument = InferSchemaType<
  typeof creativeJobSchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeGenerationJobModel =
  (mongoose.models.AiCreativeGenerationJob as
    | Model<CreativeGenerationJobDocument>
    | undefined) ??
  mongoose.model<CreativeGenerationJobDocument>(
    "AiCreativeGenerationJob",
    creativeJobSchema,
  );

const creativeAttemptSchema = new Schema(
  {
    attemptId: { type: String, required: true, unique: true, index: true },
    creativeJobId: { type: String, required: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    workerId: { type: String, required: true },
    stages: { type: [Schema.Types.Mixed], default: [] },
    sourceSnapshotChecksum: { type: String, required: true },
    generationFingerprint: { type: String, required: true },
    imageProviderConfiguration: { type: Schema.Types.Mixed, default: {} },
    videoProviderConfiguration: { type: Schema.Types.Mixed, default: {} },
    renderConfiguration: { type: Schema.Types.Mixed, default: {} },
    brandProfileVersion: { type: Number },
    platformPolicyVersion: { type: Number },
    compliancePolicyVersion: { type: Number },
    renderSpecVersion: { type: Number },
    timing: { type: Schema.Types.Mixed, default: {} },
    usageMetadata: { type: Schema.Types.Mixed, default: {} },
    estimatedCost: { type: Number },
    warnings: { type: [String], default: [] },
    failureCode: { type: String },
    safeFailure: { type: String },
    completedAt: { type: Date },
    immutable: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "ai_creative_generation_attempts" },
);
creativeAttemptSchema.index(
  { creativeJobId: 1, attemptNumber: 1 },
  { unique: true },
);

export type CreativeGenerationAttemptDocument = InferSchemaType<
  typeof creativeAttemptSchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeGenerationAttemptModel =
  (mongoose.models.AiCreativeGenerationAttempt as
    | Model<CreativeGenerationAttemptDocument>
    | undefined) ??
  mongoose.model<CreativeGenerationAttemptDocument>(
    "AiCreativeGenerationAttempt",
    creativeAttemptSchema,
  );

const creativeAssetSchema = new Schema(
  {
    assetId: { type: String, required: true, unique: true, index: true },
    creativeJobId: { type: String, required: true, index: true },
    creativeAttemptId: { type: String, required: true, index: true },
    campaignPackageId: { type: String, required: true, index: true },
    campaignPackageRevision: { type: Number, required: true, default: 1 },
    briefId: { type: String, index: true },
    briefType: {
      type: String,
      enum: ["image", "video", "carousel", "story"],
      required: true,
    },
    assetType: {
      type: String,
      enum: CREATIVE_ASSET_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: CREATIVE_ASSET_STATUSES,
      required: true,
      default: "created",
      index: true,
    },
    currentRevision: { type: Number, required: true, default: 1 },
    platform: { type: String, enum: CAMPAIGN_PLATFORMS },
    language: { type: String },
    locale: { type: String },
    direction: { type: String, default: "ltr" },
    aspectRatio: { type: String },
    width: { type: Number },
    height: { type: Number },
    durationSeconds: { type: Number },
    mimeType: { type: String },
    objectKey: { type: String },
    bucket: { type: String },
    contentChecksum: { type: String },
    provider: { type: String },
    providerJobId: { type: String },
    providerModel: { type: String },
    textOverlay: { type: String },
    expectedText: { type: String },
    ocrText: { type: String },
    subtitleText: { type: String },
    disclosureText: { type: String },
    altText: { type: String },
    qualityBreakdown: { type: Schema.Types.Mixed, default: {} },
    penalties: { type: Schema.Types.Mixed, default: {} },
    overallQualityScore: { type: Number, min: 0, max: 1 },
    rightsRecordId: { type: String, index: true },
    provenanceManifestId: { type: String },
    requiresReview: { type: Boolean, default: true },
    reviewReasonCodes: {
      type: [String],
      enum: CREATIVE_REVIEW_REASON_CODES,
      default: [],
    },
    reviewStatus: {
      type: String,
      enum: CREATIVE_REVIEW_STATUSES,
      default: "pending",
    },
    reviewerId: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date, index: true },
    rejectedAt: { type: Date },
    supersededAt: { type: Date },
    warnings: { type: [String], default: [] },
    correlationId: { type: String, required: true },
    createdBy: { type: String, required: true },
    providerState: { type: String, default: "disabled" },
  },
  { timestamps: true, collection: "ai_creative_assets" },
);
creativeAssetSchema.index({ status: 1, createdAt: -1 });
creativeAssetSchema.index({ campaignPackageId: 1, currentRevision: 1 });

export type CreativeAssetDocument = InferSchemaType<
  typeof creativeAssetSchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeAssetModel =
  (mongoose.models.AiCreativeAsset as Model<CreativeAssetDocument> | undefined) ??
  mongoose.model<CreativeAssetDocument>("AiCreativeAsset", creativeAssetSchema);

const creativeAssetVariantSchema = new Schema(
  {
    variantId: { type: String, required: true, unique: true, index: true },
    assetId: { type: String, required: true, index: true },
    creativeJobId: { type: String, required: true, index: true },
    platform: { type: String, enum: CAMPAIGN_PLATFORMS, required: true },
    renderSpecId: { type: String, required: true },
    renderSpecVersion: { type: Number, required: true },
    aspectRatio: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    language: { type: String },
    locale: { type: String },
    direction: { type: String, default: "ltr" },
    objectKey: { type: String },
    bucket: { type: String },
    mimeType: { type: String },
    contentChecksum: { type: String },
    textOverlayApplied: { type: Boolean, default: false },
    subtitlesApplied: { type: Boolean, default: false },
    status: {
      type: String,
      enum: CREATIVE_ASSET_STATUSES,
      default: "created",
    },
    warnings: { type: [String], default: [] },
  },
  { timestamps: true, collection: "ai_creative_asset_variants" },
);
creativeAssetVariantSchema.index({ assetId: 1, platform: 1, aspectRatio: 1 });

export type CreativeAssetVariantDocument = InferSchemaType<
  typeof creativeAssetVariantSchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeAssetVariantModel =
  (mongoose.models.AiCreativeAssetVariant as
    | Model<CreativeAssetVariantDocument>
    | undefined) ??
  mongoose.model<CreativeAssetVariantDocument>(
    "AiCreativeAssetVariant",
    creativeAssetVariantSchema,
  );

const creativeAssetReviewSchema = new Schema(
  {
    reviewId: { type: String, required: true, unique: true, index: true },
    assetId: { type: String, required: true, index: true },
    assetRevision: { type: Number, required: true },
    creativeJobId: { type: String, required: true },
    reviewerId: { type: String, required: true },
    status: {
      type: String,
      enum: CREATIVE_REVIEW_STATUSES,
      required: true,
      default: "pending",
    },
    reasonCodes: {
      type: [String],
      enum: CREATIVE_REVIEW_REASON_CODES,
      default: [],
    },
    corrections: { type: Schema.Types.Mixed, default: {} },
    regenerationInstructions: { type: String },
    notes: { type: String },
    previousRevision: { type: Number },
    newRevision: { type: Number },
    reviewedAt: { type: Date },
  },
  { timestamps: true, collection: "ai_creative_asset_reviews" },
);

export type CreativeAssetReviewDocument = InferSchemaType<
  typeof creativeAssetReviewSchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeAssetReviewModel =
  (mongoose.models.AiCreativeAssetReview as
    | Model<CreativeAssetReviewDocument>
    | undefined) ??
  mongoose.model<CreativeAssetReviewDocument>(
    "AiCreativeAssetReview",
    creativeAssetReviewSchema,
  );

const creativeAssetFeedbackSchema = new Schema(
  {
    feedbackId: { type: String, required: true, unique: true, index: true },
    assetId: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: CREATIVE_FEEDBACK_CATEGORIES,
      required: true,
    },
    originalValue: { type: Schema.Types.Mixed },
    correctedValue: { type: Schema.Types.Mixed },
    reason: { type: String },
    evidence: { type: [String], default: [] },
    reviewerId: { type: String, required: true },
    language: { type: String },
    locale: { type: String },
    platform: { type: String },
    promptVersions: { type: Schema.Types.Mixed, default: {} },
    provider: { type: String },
    model: { type: String },
    brandProfileVersion: { type: Number },
  },
  { timestamps: true, collection: "ai_creative_asset_feedback" },
);

export type CreativeAssetFeedbackDocument = InferSchemaType<
  typeof creativeAssetFeedbackSchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeAssetFeedbackModel =
  (mongoose.models.AiCreativeAssetFeedback as
    | Model<CreativeAssetFeedbackDocument>
    | undefined) ??
  mongoose.model<CreativeAssetFeedbackDocument>(
    "AiCreativeAssetFeedback",
    creativeAssetFeedbackSchema,
  );

const assetRightsRecordSchema = new Schema(
  {
    rightsRecordId: { type: String, required: true, unique: true, index: true },
    assetId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: CREATIVE_RIGHTS_STATUSES,
      required: true,
      default: "unknown",
      index: true,
    },
    ownershipType: {
      type: String,
      enum: [
        "platform_synthetic",
        "provider_generated",
        "uploaded_reference",
        "licensed",
        "unknown",
      ],
      default: "unknown",
    },
    licenseSource: { type: String },
    likenessAuthorized: { type: Boolean, default: false },
    musicAuthorized: { type: Boolean, default: false },
    logoAuthorized: { type: Boolean, default: false },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    notes: { type: String },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    correlationId: { type: String, required: true },
  },
  { timestamps: true, collection: "ai_creative_asset_rights" },
);

export type AssetRightsRecordDocument = InferSchemaType<
  typeof assetRightsRecordSchema
> & { _id: mongoose.Types.ObjectId };
export const AssetRightsRecordModel =
  (mongoose.models.AiAssetRightsRecord as
    | Model<AssetRightsRecordDocument>
    | undefined) ??
  mongoose.model<AssetRightsRecordDocument>(
    "AiAssetRightsRecord",
    assetRightsRecordSchema,
  );

const creativeProvenanceManifestSchema = new Schema(
  {
    provenanceManifestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    assetId: { type: String, required: true, index: true },
    creativeJobId: { type: String, required: true },
    creativeAttemptId: { type: String, required: true },
    campaignPackageId: { type: String, required: true },
    briefId: { type: String },
    provider: { type: String },
    model: { type: String },
    promptVersionId: { type: String },
    brandProfileVersion: { type: Number },
    renderSpecVersion: { type: Number },
    sourceChecksum: { type: String },
    generationFingerprint: { type: String },
    steps: { type: [Schema.Types.Mixed], default: [] },
    immutable: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "ai_creative_provenance_manifests" },
);

export type CreativeProvenanceManifestDocument = InferSchemaType<
  typeof creativeProvenanceManifestSchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeProvenanceManifestModel =
  (mongoose.models.AiCreativeProvenanceManifest as
    | Model<CreativeProvenanceManifestDocument>
    | undefined) ??
  mongoose.model<CreativeProvenanceManifestDocument>(
    "AiCreativeProvenanceManifest",
    creativeProvenanceManifestSchema,
  );

const creativeRenderSpecificationSchema = new Schema(
  {
    renderSpecId: { type: String, required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["draft", "active", "deprecated"],
      required: true,
      index: true,
    },
    platform: { type: String, enum: CAMPAIGN_PLATFORMS, required: true },
    aspectRatio: {
      type: String,
      enum: ["1:1", "4:5", "9:16", "16:9"],
      required: true,
    },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    maxDurationSeconds: { type: Number },
    safeZoneInsets: { type: Schema.Types.Mixed, default: {} },
    textOverlayRules: { type: Schema.Types.Mixed, default: {} },
    subtitleRules: { type: Schema.Types.Mixed, default: {} },
    checksum: { type: String, required: true },
    publishedAt: { type: Date },
    deprecatedAt: { type: Date },
  },
  { timestamps: true, collection: "ai_creative_render_specifications" },
);
creativeRenderSpecificationSchema.index(
  { renderSpecId: 1, version: 1 },
  { unique: true },
);
creativeRenderSpecificationSchema.index(
  { platform: 1, aspectRatio: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  },
);

export type CreativeRenderSpecificationDocument = InferSchemaType<
  typeof creativeRenderSpecificationSchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeRenderSpecificationModel =
  (mongoose.models.AiCreativeRenderSpecification as
    | Model<CreativeRenderSpecificationDocument>
    | undefined) ??
  mongoose.model<CreativeRenderSpecificationDocument>(
    "AiCreativeRenderSpecification",
    creativeRenderSpecificationSchema,
  );

const creativeProviderCapabilitySchema = new Schema(
  {
    capabilityId: { type: String, required: true, unique: true, index: true },
    providerType: {
      type: String,
      enum: ["image", "video", "render"],
      required: true,
      index: true,
    },
    providerName: { type: String, required: true },
    status: {
      type: String,
      enum: ["disabled", "mock", "local", "active"],
      required: true,
      default: "disabled",
    },
    supportedAssetTypes: {
      type: [String],
      enum: CREATIVE_ASSET_TYPES,
      default: [],
    },
    supportedPlatforms: {
      type: [String],
      enum: CAMPAIGN_PLATFORMS,
      default: [],
    },
    maxWidth: { type: Number },
    maxHeight: { type: Number },
    maxDurationSeconds: { type: Number },
    maxBytes: { type: Number },
    notes: { type: String },
  },
  { timestamps: true, collection: "ai_creative_provider_capabilities" },
);

export type CreativeProviderCapabilityDocument = InferSchemaType<
  typeof creativeProviderCapabilitySchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeProviderCapabilityModel =
  (mongoose.models.AiCreativeProviderCapability as
    | Model<CreativeProviderCapabilityDocument>
    | undefined) ??
  mongoose.model<CreativeProviderCapabilityDocument>(
    "AiCreativeProviderCapability",
    creativeProviderCapabilitySchema,
  );

const creativeModelPolicySchema = new Schema(
  {
    policyId: { type: String, required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["draft", "active", "deprecated"],
      required: true,
      index: true,
    },
    imageProvider: {
      type: String,
      enum: CREATIVE_IMAGE_PROVIDERS,
      default: "disabled",
    },
    videoProvider: {
      type: String,
      enum: CREATIVE_VIDEO_PROVIDERS,
      default: "disabled",
    },
    renderProvider: {
      type: String,
      enum: CREATIVE_RENDER_PROVIDERS,
      default: "local",
    },
    autoApproveEnabled: { type: Boolean, default: false },
    maxBriefsPerJob: { type: Number, default: 20 },
    maxVariantsPerBrief: { type: Number, default: 4 },
    maxTotalAssetsPerJob: { type: Number, default: 40 },
    qualityHighMin: { type: Number, default: 0.88 },
    qualityReviewMin: { type: Number, default: 0.65 },
    brandScoreMin: { type: Number, default: 0.85 },
    complianceScoreMin: { type: Number, default: 0.95 },
    publishedAt: { type: Date },
    deprecatedAt: { type: Date },
  },
  { timestamps: true, collection: "ai_creative_model_policies" },
);
creativeModelPolicySchema.index({ policyId: 1, version: 1 }, { unique: true });
creativeModelPolicySchema.index(
  { status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  },
);

export type CreativeModelPolicyDocument = InferSchemaType<
  typeof creativeModelPolicySchema
> & { _id: mongoose.Types.ObjectId };
export const CreativeModelPolicyModel =
  (mongoose.models.AiCreativeModelPolicy as
    | Model<CreativeModelPolicyDocument>
    | undefined) ??
  mongoose.model<CreativeModelPolicyDocument>(
    "AiCreativeModelPolicy",
    creativeModelPolicySchema,
  );

const creativePromptVersionSchema = new Schema(
  {
    promptVersionId: { type: String, required: true, unique: true, index: true },
    purpose: {
      type: String,
      enum: CREATIVE_PROMPT_PURPOSES,
      required: true,
      index: true,
    },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["draft", "active", "deprecated"],
      required: true,
      default: "active",
    },
    template: { type: String, required: true },
    checksum: { type: String, required: true },
    publishedAt: { type: Date },
  },
  { timestamps: true, collection: "ai_creative_prompt_versions" },
);
creativePromptVersionSchema.index({ purpose: 1, version: 1 }, { unique: true });

export type CreativePromptVersionDocument = InferSchemaType<
  typeof creativePromptVersionSchema
> & { _id: mongoose.Types.ObjectId };
export const CreativePromptVersionModel =
  (mongoose.models.AiCreativePromptVersion as
    | Model<CreativePromptVersionDocument>
    | undefined) ??
  mongoose.model<CreativePromptVersionDocument>(
    "AiCreativePromptVersion",
    creativePromptVersionSchema,
  );
