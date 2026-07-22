/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, type Model } from "mongoose";

const auditFields = {
  createdBy: { type: String, required: true },
  correlationId: { type: String, required: true, index: true },
};

const templateSchema = new Schema(
  {
    templateId: { type: String, required: true, unique: true, index: true },
    campaignPackageId: { type: String, required: true, index: true },
    campaignPackageRevision: { type: Number, required: true, min: 1 },
    revision: { type: Number, required: true, default: 1 },
    status: { type: String, enum: ["draft", "awaiting_review", "approved", "paused", "rejected", "archived"], default: "draft", index: true },
    platform: { type: String, required: true },
    publicationType: { type: String, required: true },
    profession: { type: String, required: true },
    industry: { type: String, required: true },
    audienceType: { type: String, required: true },
    communityType: { type: String, required: true },
    countryCodes: { type: [String], required: true },
    languages: { type: [String], required: true },
    locales: { type: [String], required: true },
    approvedGroups: { type: [String], default: [] },
    groupMatchingRules: { type: [String], default: [] },
    requiredPostText: { type: String, required: true },
    requiredDisclosure: { type: String, default: "" },
    trackedLinkRequired: { type: Boolean, default: true },
    qrRequired: { type: Boolean, default: true },
    proofMarkerRequired: { type: Boolean, default: true },
    screenshotRequired: { type: Boolean, default: true },
    postUrlRequirement: { type: String, enum: ["optional", "required", "forbidden"], default: "optional" },
    publicationWindowMinutes: { type: Number, required: true, min: 1 },
    proofDeadlineMinutes: { type: Number, required: true, min: 1 },
    verificationThresholds: { type: Schema.Types.Mixed, default: {} },
    requiresHumanReview: { type: Boolean, default: true },
    externalRewardRuleReference: { type: String, required: true },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    archivedAt: { type: Date },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_distribution_task_templates" },
);
templateSchema.index({ campaignPackageId: 1, campaignPackageRevision: 1, revision: 1 }, { unique: true });

const copyVariantSchema = new Schema(
  {
    copyVariantId: { type: String, required: true, unique: true, index: true },
    templateId: { type: String, required: true, index: true },
    templateRevision: { type: Number, required: true },
    revision: { type: Number, required: true, default: 1 },
    source: { type: String, enum: ["approved_campaign", "manual", "provider"], required: true },
    status: { type: String, enum: ["draft", "awaiting_review", "approved", "rejected"], default: "awaiting_review", index: true },
    language: { type: String, required: true },
    locale: { type: String, required: true },
    direction: { type: String, enum: ["ltr", "rtl"], required: true },
    profession: { type: String, required: true },
    audienceType: { type: String, required: true },
    headline: { type: String, required: true },
    postText: { type: String, required: true },
    cta: { type: String, default: "" },
    hashtags: { type: [String], default: [] },
    disclosure: { type: String, default: "" },
    contentChecksum: { type: String, required: true },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectedBy: { type: String },
    rejectedAt: { type: Date },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_distribution_copy_variants" },
);
copyVariantSchema.index({ templateId: 1, revision: 1, locale: 1 }, { unique: true });

const assignmentSchema = new Schema(
  {
    assignmentId: { type: String, required: true, unique: true, index: true },
    externalTaskId: { type: String, required: true, index: true },
    externalUserId: { type: String, required: true, index: true },
    externalAssignmentId: { type: String, required: true, unique: true, index: true },
    templateId: { type: String, required: true, index: true },
    templateRevision: { type: Number, required: true },
    copyVariantId: { type: String, required: true },
    copyVariantRevision: { type: Number, required: true },
    platform: { type: String, required: true },
    audienceType: { type: String, required: true },
    country: { type: String, required: true },
    language: { type: String, required: true },
    locale: { type: String, required: true },
    direction: { type: String, enum: ["ltr", "rtl"], required: true },
    status: { type: String, enum: ["active", "awaiting_proof", "verification_pending", "needs_review", "verified", "rejected", "cancelled", "expired"], default: "active", index: true },
    expiresAt: { type: Date, required: true, index: true },
    proofDeadlineAt: { type: Date, required: true, index: true },
    requiredEvidence: { type: Schema.Types.Mixed, default: {} },
    trackedLinkId: { type: String, required: true, unique: true },
    qrAssetId: { type: String, required: true, unique: true },
    headerAssetId: { type: String, required: true, unique: true },
    proofMarker: { type: String, required: true, unique: true },
    assignmentTokenHash: { type: String, required: true, unique: true, select: false },
    assignmentFingerprint: { type: String, required: true, unique: true },
    idempotencyKeyHash: { type: String, required: true, unique: true },
    latestProofSubmissionId: { type: String },
    latestVerificationDecision: { type: String },
    rewardEligibilityRecommendation: { type: String, enum: ["eligible", "not_eligible", "pending_review", "expired", "duplicate", "fraud_suspected"], default: "pending_review" },
    cancelledAt: { type: Date },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_distribution_assignments" },
);
assignmentSchema.index({ externalTaskId: 1, externalUserId: 1, templateId: 1, status: 1 });

const trackedLinkSchema = new Schema(
  {
    trackedLinkId: { type: String, required: true, unique: true, index: true },
    assignmentId: { type: String, required: true, unique: true, index: true },
    opaqueTokenHash: { type: String, required: true, unique: true, select: false },
    publicUrl: { type: String, required: true },
    targetUrl: { type: String, required: true },
    targetHostname: { type: String, required: true },
    status: { type: String, enum: ["active", "revoked", "expired"], default: "active", index: true },
    expiresAt: { type: Date, required: true, index: true },
    clickCount: { type: Number, default: 0, min: 0 },
    lastClickedAt: { type: Date },
    revokedAt: { type: Date },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_tracked_links" },
);

const assetFields = {
  assignmentId: { type: String, required: true, unique: true, index: true },
  objectKey: { type: String, required: true, unique: true },
  checksum: { type: String, required: true },
  contentType: { type: String, default: "image/png" },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date },
  provenance: { type: Schema.Types.Mixed, default: {} },
  ...auditFields,
};
const qrAssetSchema = new Schema({ qrAssetId: { type: String, required: true, unique: true, index: true }, payloadHash: { type: String, required: true, unique: true }, decodeVerified: { type: Boolean, required: true }, ...assetFields }, { timestamps: true, collection: "ai_qr_assets" });
const headerAssetSchema = new Schema({ headerAssetId: { type: String, required: true, unique: true, index: true }, qrDecodeVerified: { type: Boolean, required: true }, direction: { type: String, required: true }, ...assetFields }, { timestamps: true, collection: "ai_distribution_header_assets" });

const proofSubmissionSchema = new Schema(
  {
    proofSubmissionId: { type: String, required: true, unique: true, index: true },
    assignmentId: { type: String, required: true, index: true },
    externalAssignmentId: { type: String, required: true, index: true },
    externalUserId: { type: String, required: true, index: true },
    status: { type: String, enum: ["upload_pending", "submitted", "queued", "verifying", "needs_review", "verified", "rejected", "cancelled"], default: "upload_pending", index: true },
    evidence: { type: [Schema.Types.Mixed], default: [] },
    postUrl: { type: String },
    claimedPublicationAt: { type: Date },
    claimedGroupName: { type: String },
    userNote: { type: String },
    idempotencyKeyHash: { type: String, required: true, unique: true },
    submittedAt: { type: Date },
    retentionExpiresAt: { type: Date, required: true },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_proof_submissions" },
);
proofSubmissionSchema.index({ retentionExpiresAt: 1 }, { expireAfterSeconds: 0 });

const verificationAttemptSchema = new Schema(
  {
    verificationAttemptId: { type: String, required: true, unique: true, index: true },
    proofSubmissionId: { type: String, required: true, index: true },
    assignmentId: { type: String, required: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    decision: { type: String, enum: ["verified", "rejected", "needs_review"], required: true },
    scores: { type: Schema.Types.Mixed, required: true },
    mandatoryChecks: { type: Schema.Types.Mixed, required: true },
    reasonCodes: { type: [String], default: [] },
    duplicateMatches: { type: [Schema.Types.Mixed], default: [] },
    manipulationIndicators: { type: [Schema.Types.Mixed], default: [] },
    extractedEvidence: { type: Schema.Types.Mixed, default: {} },
    resultChecksum: { type: String, required: true },
    durationMs: { type: Number, required: true, min: 0 },
    immutable: { type: Boolean, default: true, immutable: true },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_proof_verification_attempts" },
);
verificationAttemptSchema.index({ proofSubmissionId: 1, attemptNumber: 1 }, { unique: true });

const proofReviewSchema = new Schema(
  {
    proofReviewId: { type: String, required: true, unique: true, index: true },
    proofSubmissionId: { type: String, required: true, index: true },
    verificationAttemptId: { type: String, required: true },
    decision: { type: String, enum: ["verified", "rejected", "request_more_evidence", "fraudulent", "cancelled"], required: true },
    reasonCodes: { type: [String], default: [] },
    reviewerNote: { type: String },
    rewardEligibilityRecommendation: { type: String, enum: ["eligible", "not_eligible", "pending_review", "expired", "duplicate", "fraud_suspected"], required: true },
    reviewedBy: { type: String, required: true },
    reviewedAt: { type: Date, required: true },
    immutable: { type: Boolean, default: true, immutable: true },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_proof_reviews" },
);

const outboxEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, enum: ["proof.verification.completed"], required: true },
    eventVersion: { type: Number, default: 1 },
    payload: { type: Schema.Types.Mixed, required: true },
    payloadChecksum: { type: String, required: true },
    status: { type: String, enum: ["pending", "delivering", "delivered", "retry_scheduled", "dead_letter"], default: "pending", index: true },
    deliveryAttempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, index: true },
    lastAttemptAt: { type: Date },
    deliveredAt: { type: Date },
    safeError: { type: String },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_integration_outbox_events" },
);
outboxEventSchema.index({ status: 1, nextAttemptAt: 1 });

function model(name: string, schema: Schema): Model<any> {
  return mongoose.models[name] ?? mongoose.model(name, schema);
}

export const DistributionTaskTemplateModel = model("AiDistributionTaskTemplate", templateSchema);
export const DistributionCopyVariantModel = model("AiDistributionCopyVariant", copyVariantSchema);
export const DistributionAssignmentModel = model("AiDistributionAssignment", assignmentSchema);
export const TrackedLinkModel = model("AiTrackedLink", trackedLinkSchema);
export const QrAssetModel = model("AiQrAsset", qrAssetSchema);
export const DistributionHeaderAssetModel = model("AiDistributionHeaderAsset", headerAssetSchema);
export const ProofSubmissionModel = model("AiProofSubmission", proofSubmissionSchema);
export const ProofVerificationAttemptModel = model("AiProofVerificationAttempt", verificationAttemptSchema);
export const ProofReviewModel = model("AiProofReview", proofReviewSchema);
export const IntegrationOutboxEventModel = model("AiIntegrationOutboxEvent", outboxEventSchema);
