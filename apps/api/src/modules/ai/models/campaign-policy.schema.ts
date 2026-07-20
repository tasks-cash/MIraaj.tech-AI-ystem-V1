import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_PLATFORMS,
  CAMPAIGN_TYPES,
  CONTENT_FORMATS,
  CTA_CODES,
  FUNNEL_STAGES,
} from "@miraaj/shared-types";

/** Brand profile statuses used until shared enum is expanded if needed. */
export const BRAND_PROFILE_STATUS_VALUES = [
  "draft",
  "active",
  "deprecated",
] as const;

const brandProfileSchema = new Schema(
  {
    brandProfileId: { type: String, required: true, index: true },
    brandName: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: BRAND_PROFILE_STATUS_VALUES,
      required: true,
      index: true,
    },
    primaryDomain: { type: String, required: true, default: "miraaj.tech" },
    brandAliases: { type: [String], default: [] },
    protectedTerms: { type: [String], default: ["Miraaj.tech", "Tasks.cash"] },
    prohibitedSpellings: { type: [String], default: [] },
    toneAttributes: { type: [String], default: [] },
    toneRestrictions: { type: [String], default: [] },
    approvedValuePropositions: { type: [String], default: [] },
    approvedCapabilities: { type: [String], default: [] },
    approvedProofTypes: { type: [String], default: [] },
    prohibitedClaims: { type: [String], default: [] },
    approvedDisclosures: { type: Schema.Types.Mixed, default: {} },
    contactPolicies: { type: Schema.Types.Mixed, default: {} },
    platformToneOverrides: { type: Schema.Types.Mixed, default: {} },
    languageToneOverrides: { type: Schema.Types.Mixed, default: {} },
    terminologyGlossary: { type: Schema.Types.Mixed, default: [] },
    visualLanguageGuidance: { type: [String], default: [] },
    imageRestrictions: { type: [String], default: [] },
    videoRestrictions: { type: [String], default: [] },
    accessibilityGuidance: { type: [String], default: [] },
    complianceRules: { type: [String], default: [] },
    createdBy: { type: String, required: true },
    approvedBy: { type: String },
    publishedAt: { type: Date },
    deprecatedAt: { type: Date },
  },
  { timestamps: true, collection: "ai_brand_profiles" },
);
brandProfileSchema.index({ brandProfileId: 1, version: 1 }, { unique: true });
brandProfileSchema.index(
  { brandName: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  },
);

export type BrandProfileDocument = InferSchemaType<typeof brandProfileSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const BrandProfileModel =
  (mongoose.models.AiBrandProfile as Model<BrandProfileDocument> | undefined) ??
  mongoose.model<BrandProfileDocument>("AiBrandProfile", brandProfileSchema);

const policyBase = {
  policyId: { type: String, required: true, index: true },
  version: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ["draft", "active", "deprecated"],
    required: true,
    index: true,
  },
  checksum: { type: String, required: true },
  changeSummary: { type: String, default: "" },
  publishedAt: { type: Date },
  deprecatedAt: { type: Date },
  createdBy: { type: String, required: true },
  approvedBy: { type: String },
};

const campaignPolicySchema = new Schema(
  {
    ...policyBase,
    objectives: { type: [String], enum: CAMPAIGN_OBJECTIVES, default: [...CAMPAIGN_OBJECTIVES] },
    funnelStages: { type: [String], enum: FUNNEL_STAGES, default: [...FUNNEL_STAGES] },
    campaignTypes: { type: [String], enum: CAMPAIGN_TYPES, default: [...CAMPAIGN_TYPES] },
    ctaCodes: { type: [String], enum: CTA_CODES, default: [...CTA_CODES] },
    contentFormats: { type: [String], enum: CONTENT_FORMATS, default: [...CONTENT_FORMATS] },
    maxServices: { type: Number, required: true },
    maxPlatforms: { type: Number, required: true },
    maxLanguages: { type: Number, required: true },
    autoApproveEnabled: { type: Boolean, default: false },
    qualityThresholds: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: "ai_campaign_policies" },
);
campaignPolicySchema.index({ policyId: 1, version: 1 }, { unique: true });

export type CampaignPolicyDocument = InferSchemaType<typeof campaignPolicySchema> & {
  _id: mongoose.Types.ObjectId;
};
export const CampaignPolicyModel =
  (mongoose.models.AiCampaignPolicy as Model<CampaignPolicyDocument> | undefined) ??
  mongoose.model<CampaignPolicyDocument>("AiCampaignPolicy", campaignPolicySchema);

const platformDefinitionSchema = new Schema(
  {
    platformId: { type: String, enum: CAMPAIGN_PLATFORMS, required: true },
    version: { type: Number, required: true, default: 1 },
    status: { type: String, enum: ["active", "deprecated"], default: "active" },
    supportedCampaignObjectives: { type: [String], default: [] },
    supportedContentFormats: { type: [String], default: [] },
    supportedLanguages: { type: [String], default: ["ar", "en", "fr"] },
    textFieldDefinitions: { type: Schema.Types.Mixed, default: {} },
    maximumConfiguredLengths: { type: Schema.Types.Mixed, default: {} },
    recommendedConfiguredLengths: { type: Schema.Types.Mixed, default: {} },
    hashtagSupport: { type: Boolean, default: true },
    linkSupport: { type: Boolean, default: true },
    titleSupport: { type: Boolean, default: true },
    descriptionSupport: { type: Boolean, default: true },
    captionSupport: { type: Boolean, default: true },
    threadSupport: { type: Boolean, default: false },
    carouselSupport: { type: Boolean, default: false },
    storySupport: { type: Boolean, default: false },
    shortVideoSupport: { type: Boolean, default: false },
    longVideoSupport: { type: Boolean, default: false },
    thumbnailSupport: { type: Boolean, default: false },
    ctaSupport: { type: Boolean, default: true },
    accessibilityRequirements: { type: [String], default: [] },
    complianceNotes: { type: [String], default: [] },
    versionSource: { type: String, default: "miraaj-platform-policy-v1" },
    lastReviewedAt: { type: Date },
  },
  { _id: false },
);

const platformPolicySchema = new Schema(
  {
    ...policyBase,
    platforms: { type: [platformDefinitionSchema], required: true, default: [] },
  },
  { timestamps: true, collection: "ai_platform_policies" },
);
platformPolicySchema.index({ policyId: 1, version: 1 }, { unique: true });

export type PlatformPolicyDocument = InferSchemaType<typeof platformPolicySchema> & {
  _id: mongoose.Types.ObjectId;
};
export const PlatformPolicyModel =
  (mongoose.models.AiPlatformPolicy as Model<PlatformPolicyDocument> | undefined) ??
  mongoose.model<PlatformPolicyDocument>("AiPlatformPolicy", platformPolicySchema);

const compliancePolicySchema = new Schema(
  {
    ...policyBase,
    paymentDisclosures: { type: Schema.Types.Mixed, required: true },
    regulatedDomains: { type: [String], default: [] },
    prohibitedClaimPatterns: { type: [String], default: [] },
    alwaysRequireReviewFor: { type: [String], default: ["payment", "regulated"] },
  },
  { timestamps: true, collection: "ai_compliance_policies" },
);
compliancePolicySchema.index({ policyId: 1, version: 1 }, { unique: true });

export type CompliancePolicyDocument = InferSchemaType<
  typeof compliancePolicySchema
> & { _id: mongoose.Types.ObjectId };
export const CompliancePolicyModel =
  (mongoose.models.AiCompliancePolicy as
    | Model<CompliancePolicyDocument>
    | undefined) ??
  mongoose.model<CompliancePolicyDocument>(
    "AiCompliancePolicy",
    compliancePolicySchema,
  );

const glossarySchema = new Schema(
  {
    glossaryId: { type: String, required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["draft", "active", "deprecated"],
      required: true,
      index: true,
    },
    protectedTerms: { type: [String], default: ["Miraaj.tech", "Tasks.cash"] },
    entries: { type: [Schema.Types.Mixed], default: [] },
    checksum: { type: String, required: true },
    publishedAt: { type: Date },
    createdBy: { type: String, required: true },
    approvedBy: { type: String },
  },
  { timestamps: true, collection: "ai_translation_glossaries" },
);
glossarySchema.index({ glossaryId: 1, version: 1 }, { unique: true });

export type TranslationGlossaryDocument = InferSchemaType<typeof glossarySchema> & {
  _id: mongoose.Types.ObjectId;
};
export const TranslationGlossaryModel =
  (mongoose.models.AiTranslationGlossary as
    | Model<TranslationGlossaryDocument>
    | undefined) ??
  mongoose.model<TranslationGlossaryDocument>(
    "AiTranslationGlossary",
    glossarySchema,
  );
