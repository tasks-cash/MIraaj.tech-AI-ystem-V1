
import { Schema, model, models } from "mongoose";

const encryptedField = {
  algorithm: String,
  keyVersion: String,
  nonce: String,
  authTag: String,
  ciphertext: String,
  wrappedDataKey: String,
  createdAt: String,
};

const tenantScoped = {
  tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, required: true, index: true },
  environment: {
    type: String,
    enum: ["development", "staging", "production"],
    required: true,
    index: true,
  },
};

export const TenantSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ProjectSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    environment: {
      type: String,
      enum: ["development", "staging", "production"],
      required: true,
    },
    enabledModules: [String],
    allowedOrigins: [String],
    allowedCallbackUrls: [String],
    allowedWebhookUrls: [String],
    allowedIpRanges: [String],
    rateLimits: { type: Schema.Types.Mixed, default: {} },
    dataRetention: { type: Schema.Types.Mixed, default: {} },
    aiProviderPolicy: { type: Schema.Types.Mixed, default: {} },
    storageQuotaBytes: { type: Number, default: 10_737_418_240 },
    monthlyAnalysisQuota: { type: Number, default: 10_000 },
    active: { type: Boolean, default: true },
    privacyMode: { type: String, enum: ["strict", "balanced", "extended"], default: "balanced" },
  },
  { timestamps: true },
);
ProjectSchema.index({ tenantId: 1, slug: 1, environment: 1 }, { unique: true });

export const UserSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    /** Previous Argon2id hashes (newest first) — blocks recent-password reuse. */
    passwordHistory: { type: [String], default: [] },
    roles: [{ type: String }],
    /** Stable role slug, e.g. "super-admin". */
    role: { type: String, default: "" },
    permissions: [{ type: String }],
    /** Project slugs this user may access ("*" = all projects). */
    projectAccess: { type: [String], default: ["*"] },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    active: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    mustEnrollTwoFactor: { type: Boolean, default: false },
    /**
     * Bumped on password reset / forced logout. Sessions store the value at
     * issue time; mismatched sessions are rejected.
     */
    securityVersion: { type: Number, default: 1 },
    totpSecretEnc: { type: encryptedField },
    totpPendingSecretEnc: { type: encryptedField },
    totpEnabled: { type: Boolean, default: false },
    totpEnrolledAt: Date,
    recoveryCodeHashes: [String],
    allowedIps: [String],
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    lastLoginIpHash: String,
    lastLoginUserAgent: String,
    lastLoginDevice: String,
    lastLoginLocation: String,
    passwordChangedAt: Date,
  },
  { timestamps: true },
);

export const SessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: String,
    ipHash: String,
    device: String,
    location: String,
    securityVersion: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ApiClientSchema = new Schema(
  {
    ...tenantScoped,
    name: { type: String, required: true },
    clientId: { type: String, required: true, unique: true },
    keyId: { type: String, required: true, unique: true },
    publicKeyPem: { type: String, required: true },
    scopes: [{ type: String }],
    status: { type: String, enum: ["active", "revoked", "expired"], default: "active" },
    allowedIps: [String],
    allowedOrigins: [String],
    mtlsEnabled: { type: Boolean, default: false },
    certificateFingerprint: String,
    certificateSubject: String,
    certificateExpiresAt: Date,
    expiresAt: Date,
    lastUsedAt: Date,
    revokedAt: Date,
    rotationOf: String,
    credentialsConfirmedAt: Date,
  },
  { timestamps: true },
);

export const RevokedTokenSchema = new Schema(
  {
    jti: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    reason: String,
  },
  { timestamps: true },
);
RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CategorySchema = new Schema(
  {
    ...tenantScoped,
    name: { type: String, required: true },
    slug: { type: String, required: true },
    localizedNames: { type: Map, of: String, default: {} },
    description: String,
    parentCategoryId: Schema.Types.ObjectId,
    icon: String,
    color: String,
    positiveKeywords: [String],
    negativeKeywords: [String],
    exampleAssetIds: [Schema.Types.ObjectId],
    allowedLanguages: [String],
    minimumConfidence: { type: Number, default: 0.5 },
    autoApproveThreshold: { type: Number, default: 0.85 },
    reviewThreshold: { type: Number, default: 0.6 },
    blockedContentRules: [String],
    active: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    createdBy: Schema.Types.ObjectId,
    updatedBy: Schema.Types.ObjectId,
  },
  { timestamps: true },
);
CategorySchema.index({ tenantId: 1, projectId: 1, slug: 1 }, { unique: true });

export const GroupSchema = new Schema(
  {
    ...tenantScoped,
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: String,
    destinationType: { type: String, required: true },
    destinationConfigEnc: { type: encryptedField },
    allowedCategoryIds: [Schema.Types.ObjectId],
    blockedCategoryIds: [Schema.Types.ObjectId],
    allowedLanguages: [String],
    minimumConfidence: { type: Number, default: 0.5 },
    autoPublish: { type: Boolean, default: false },
    requiresReview: { type: Boolean, default: true },
    publishingTemplate: String,
    headerTemplate: String,
    socialCardTemplate: String,
    qrEnabled: { type: Boolean, default: true },
    trackingEnabled: { type: Boolean, default: true },
    dailyLimit: Number,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
GroupSchema.index({ tenantId: 1, projectId: 1, slug: 1 }, { unique: true });

export const AssetSchema = new Schema(
  {
    ...tenantScoped,
    objectKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    width: Number,
    height: Number,
    sha256: { type: String, index: true },
    perceptualHash: { type: String, index: true },
    status: {
      type: String,
      enum: ["pending", "scanning", "ready", "rejected", "processing"],
      default: "pending",
    },
    thumbnailKey: String,
    normalizedKey: String,
    malwareScan: {
      status: String,
      engine: String,
      scannedAt: Date,
    },
    uploadedBy: Schema.Types.ObjectId,
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);
AssetSchema.index({ tenantId: 1, projectId: 1, createdAt: -1 });

export const PostSchema = new Schema(
  {
    ...tenantScoped,
    source: String,
    sourceReference: String,
    title: { type: String, required: true },
    slug: String,
    publicCode: { type: String, unique: true, sparse: true },
    description: String,
    localizedContent: { type: Map, of: Schema.Types.Mixed, default: {} },
    assetIds: [Schema.Types.ObjectId],
    primaryAssetId: Schema.Types.ObjectId,
    headerImageId: Schema.Types.ObjectId,
    socialCardIds: [Schema.Types.ObjectId],
    categoryId: Schema.Types.ObjectId,
    secondaryCategoryIds: [Schema.Types.ObjectId],
    groupId: Schema.Types.ObjectId,
    tags: [String],
    destinationUrl: String,
    destinationDomain: String,
    moderationStatus: { type: String, default: "pending" },
    analysisStatus: { type: String, default: "none" },
    publicationStatus: {
      type: String,
      enum: [
        "draft", "uploaded", "queued", "analyzing", "needs_review", "approved",
        "rejected", "scheduled", "publishing", "published", "failed", "expired", "archived",
      ],
      default: "draft",
      index: true,
    },
    qrSettings: { type: Schema.Types.Mixed, default: {} },
    trackingSettings: { type: Schema.Types.Mixed, default: {} },
    seo: { type: Schema.Types.Mixed, default: {} },
    createdBy: Schema.Types.ObjectId,
    reviewedBy: Schema.Types.ObjectId,
    publishedBy: Schema.Types.ObjectId,
    scheduledAt: Date,
    publishedAt: { type: Date, index: true },
    expiresAt: { type: Date, index: true },
    version: { type: Number, default: 1 },
    trustScore: { type: Number, default: 50 },
    legalHold: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true },
);
PostSchema.index({ tenantId: 1, projectId: 1, source: 1, sourceReference: 1 });
PostSchema.index({ tenantId: 1, projectId: 1, slug: 1 });

export const PostVersionSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, required: true, index: true },
    version: Number,
    snapshot: Schema.Types.Mixed,
    changedBy: Schema.Types.ObjectId,
  },
  { timestamps: true },
);

export const AnalysisSchema = new Schema(
  {
    ...tenantScoped,
    analysisId: { type: String, required: true, unique: true },
    postId: { type: Schema.Types.ObjectId, index: true },
    assetId: { type: Schema.Types.ObjectId, index: true },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    providerResults: [Schema.Types.Mixed],
    ocrText: String,
    detectedLanguage: String,
    primaryCategory: String,
    secondaryCategories: [String],
    suggestedGroup: String,
    tags: [String],
    entities: [Schema.Types.Mixed],
    imageDescription: String,
    safetyFlags: [String],
    duplicateMatches: [Schema.Types.Mixed],
    confidenceScores: Schema.Types.Mixed,
    finalConfidence: Number,
    requiresReview: { type: Boolean, default: false },
    reviewReasons: [String],
    modelVersions: Schema.Types.Mixed,
    providerCost: Number,
    processingTimeMs: Number,
    stage: { type: String, default: "queued" },
  },
  { timestamps: true },
);

export const ReviewTaskSchema = new Schema(
  {
    ...tenantScoped,
    postId: { type: Schema.Types.ObjectId, required: true, index: true },
    analysisId: String,
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "escalated"],
      default: "pending",
      index: true,
    },
    assigneeId: Schema.Types.ObjectId,
    notes: String,
    priority: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const TrainingFeedbackSchema = new Schema(
  {
    ...tenantScoped,
    assetId: Schema.Types.ObjectId,
    postId: Schema.Types.ObjectId,
    predictedCategory: String,
    correctedCategory: String,
    predictedGroup: String,
    correctedGroup: String,
    originalOcr: String,
    correctedOcr: String,
    predictedTags: [String],
    correctedTags: [String],
    provider: String,
    modelVersion: String,
    confidence: Number,
    reviewerId: Schema.Types.ObjectId,
    reason: String,
  },
  { timestamps: true },
);

export const AiProviderSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["vision", "ocr", "moderation", "embedding", "text", "translation"],
      required: true,
    },
    adapter: String,
    credentialsEnc: { type: encryptedField },
    priority: { type: Number, default: 100 },
    enabled: { type: Boolean, default: true },
    dailyQuota: Number,
    monthlyQuota: Number,
    costLimits: Schema.Types.Mixed,
    timeoutMs: { type: Number, default: 30_000 },
    healthStatus: { type: String, default: "unknown" },
    lastHealthCheckAt: Date,
  },
  { timestamps: true },
);

export const SocialTemplateSchema = new Schema(
  {
    ...tenantScoped,
    name: { type: String, required: true },
    slug: { type: String, required: true },
    categoryHint: String,
    palette: Schema.Types.Mixed,
    layout: Schema.Types.Mixed,
    version: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const SocialCardSchema = new Schema(
  {
    ...tenantScoped,
    postId: { type: Schema.Types.ObjectId, index: true },
    format: String,
    width: Number,
    height: Number,
    locale: String,
    objectKey: String,
    templateVersion: Number,
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const QrCodeSchema = new Schema(
  {
    ...tenantScoped,
    postId: Schema.Types.ObjectId,
    publicCode: { type: String, required: true, unique: true },
    destinationType: String,
    destinationId: Schema.Types.ObjectId,
    active: { type: Boolean, default: true },
    expiresAt: Date,
    campaign: String,
    source: String,
    medium: String,
    content: String,
    scanCount: { type: Number, default: 0 },
    uniqueVisitorCount: { type: Number, default: 0 },
    designObjectKey: String,
  },
  { timestamps: true },
);

export const VisitorEventSchema = new Schema(
  {
    ...tenantScoped,
    eventId: { type: String, required: true, unique: true },
    postId: Schema.Types.ObjectId,
    qrId: Schema.Types.ObjectId,
    type: String,
    anonymizedVisitorId: String,
    sessionId: String,
    referrer: String,
    source: String,
    medium: String,
    campaign: String,
    countryApprox: String,
    deviceCategory: String,
    browserFamily: String,
    osFamily: String,
    botClassification: String,
    consentState: String,
    conversionType: String,
    ipHash: String,
  },
  { timestamps: true },
);
VisitorEventSchema.index({ tenantId: 1, projectId: 1, createdAt: -1 });

export const WebhookSchema = new Schema(
  {
    ...tenantScoped,
    url: { type: String, required: true },
    events: [String],
    secretEnc: { type: encryptedField },
    active: { type: Boolean, default: true },
    allowedDomains: [String],
  },
  { timestamps: true },
);

export const WebhookDeliverySchema = new Schema(
  {
    webhookId: { type: Schema.Types.ObjectId, required: true, index: true },
    deliveryId: { type: String, required: true, unique: true },
    event: String,
    status: {
      type: String,
      enum: ["pending", "success", "failed", "dead"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    responseStatus: Number,
    lastError: String,
    payloadHash: String,
  },
  { timestamps: true },
);

export const LinkCheckSchema = new Schema(
  {
    ...tenantScoped,
    url: { type: String, required: true },
    finalUrl: String,
    finalDomain: String,
    redirectChain: [String],
    httpStatus: Number,
    tlsValid: Boolean,
    safe: { type: Boolean, default: false },
    reasons: [String],
    checkedAt: Date,
    nextCheckAt: Date,
  },
  { timestamps: true },
);

export const AuditLogSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    timestamp: { type: Date, required: true, index: true },
    tenantId: Schema.Types.ObjectId,
    projectId: Schema.Types.ObjectId,
    actorType: String,
    actorId: String,
    action: String,
    entityType: String,
    entityId: String,
    previousValues: Schema.Types.Mixed,
    newValues: Schema.Types.Mixed,
    ipHash: String,
    userAgent: String,
    correlationId: String,
    requestId: String,
    severity: String,
    metadata: Schema.Types.Mixed,
    previousHash: String,
    eventHash: { type: String, required: true },
  },
  { timestamps: false },
);

export const SecurityEventSchema = new Schema(
  {
    tenantId: Schema.Types.ObjectId,
    projectId: Schema.Types.ObjectId,
    type: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: ["informational", "low", "medium", "high", "critical"],
      index: true,
    },
    message: String,
    clientId: String,
    userId: Schema.Types.ObjectId,
    ipHash: String,
    metadata: Schema.Types.Mixed,
    status: {
      type: String,
      enum: ["open", "acknowledged", "investigating", "resolved"],
      default: "open",
    },
    notes: [String],
  },
  { timestamps: true },
);

export const SystemSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: Schema.Types.Mixed,
    encrypted: { type: Boolean, default: false },
    valueEnc: { type: encryptedField },
  },
  { timestamps: true },
);

export const UsageRecordSchema = new Schema(
  {
    ...tenantScoped,
    metric: String,
    amount: Number,
    period: String,
  },
  { timestamps: true },
);
UsageRecordSchema.index({ tenantId: 1, projectId: 1, metric: 1, period: 1 });

export const ReportSchema = new Schema(
  {
    publicCode: String,
    reason: String,
    details: String,
    status: { type: String, default: "open" },
  },
  { timestamps: true },
);

export const ModelVersionSchema = new Schema(
  {
    name: String,
    version: String,
    provider: String,
    active: { type: Boolean, default: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const EncryptionKeyMetadataSchema = new Schema(
  {
    keyVersion: { type: String, required: true, unique: true },
    provider: String,
    status: { type: String, enum: ["active", "rotating", "retired"], default: "active" },
    createdAt: { type: Date, default: Date.now },
    retiredAt: Date,
  },
  { timestamps: false },
);

// Models are intentionally typed loosely for cross-package NestJS usage.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function m(name: string, schema: Schema): any {
  return models[name] || model(name, schema);
}

export const Tenant = m("Tenant", TenantSchema);
export const Project = m("Project", ProjectSchema);
export const User = m("User", UserSchema);
export const Session = m("Session", SessionSchema);
export const ApiClient = m("ApiClient", ApiClientSchema);
export const RevokedToken = m("RevokedToken", RevokedTokenSchema);
export const Category = m("Category", CategorySchema);
export const Group = m("Group", GroupSchema);
export const Asset = m("Asset", AssetSchema);
export const Post = m("Post", PostSchema);
export const PostVersion = m("PostVersion", PostVersionSchema);
export const Analysis = m("Analysis", AnalysisSchema);
export const ReviewTask = m("ReviewTask", ReviewTaskSchema);
export const TrainingFeedback = m("TrainingFeedback", TrainingFeedbackSchema);
export const AiProvider = m("AiProvider", AiProviderSchema);
export const SocialTemplate = m("SocialTemplate", SocialTemplateSchema);
export const SocialCard = m("SocialCard", SocialCardSchema);
export const QrCode = m("QrCode", QrCodeSchema);
export const VisitorEvent = m("VisitorEvent", VisitorEventSchema);
export const Webhook = m("Webhook", WebhookSchema);
export const WebhookDelivery = m("WebhookDelivery", WebhookDeliverySchema);
export const LinkCheck = m("LinkCheck", LinkCheckSchema);
export const AuditLog = m("AuditLog", AuditLogSchema);
export const SecurityEvent = m("SecurityEvent", SecurityEventSchema);
export const SystemSetting = m("SystemSetting", SystemSettingSchema);
export const UsageRecord = m("UsageRecord", UsageRecordSchema);
export const Report = m("Report", ReportSchema);
export const ModelVersion = m("ModelVersion", ModelVersionSchema);
export const EncryptionKeyMetadata = m("EncryptionKeyMetadata", EncryptionKeyMetadataSchema);
