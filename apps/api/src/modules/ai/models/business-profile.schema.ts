import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  BUSINESS_NEED_CODES,
  BUSINESS_PROFILE_STATUSES,
  INTELLIGENCE_REVIEW_REASON_CODES,
  type BusinessProfileStatus,
  type IntelligenceReviewReasonCode,
} from "@miraaj/shared-types";

const rankedSignalSchema = new Schema(
  {
    code: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    evidence: { type: [String], default: [] },
    contradictingEvidence: { type: [String], default: [] },
    provenance: {
      type: String,
      enum: [
        "ocr",
        "vision",
        "analysis_result",
        "user_hint",
        "provider",
        "deterministic",
        "human_review",
        "merged",
      ],
      required: true,
    },
    inferred: { type: Boolean, required: true, default: false },
    warning: { type: String },
  },
  { _id: false },
);

const businessProfileSchema = new Schema(
  {
    profileId: { type: String, required: true, unique: true, index: true },
    analysisResultId: { type: String, required: true, index: true },
    sourceMediaId: { type: String },
    jobId: { type: String, index: true },
    status: {
      type: String,
      enum: BUSINESS_PROFILE_STATUSES,
      required: true,
      default: "draft",
      index: true,
    },
    businessType: { type: rankedSignalSchema, required: true },
    organizationType: { type: rankedSignalSchema, required: true },
    businessStage: { type: rankedSignalSchema, required: true },
    digitalMaturity: { type: rankedSignalSchema, required: true },
    audienceType: { type: rankedSignalSchema, required: true },
    groupSourceContext: { type: rankedSignalSchema, required: true },
    promotionEligibility: { type: rankedSignalSchema, required: true },
    needs: {
      type: [String],
      enum: BUSINESS_NEED_CODES,
      default: [],
    },
    painPoints: { type: [String], default: [] },
    objectives: { type: [String], default: [] },
    countryCode: { type: String },
    languages: { type: [String], default: [] },
    decisionMakerConfidence: { type: Number, min: 0, max: 1, required: true, default: 0 },
    professionalContextConfidence: { type: Number, min: 0, max: 1, required: true, default: 0 },
    reasoningProvider: { type: String, default: "disabled" },
    reasoningPayload: { type: Schema.Types.Mixed, default: null },
    reviewReasonCodes: {
      type: [String],
      enum: INTELLIGENCE_REVIEW_REASON_CODES,
      default: [],
    },
    requiresReview: { type: Boolean, default: false },
    correctedFields: { type: Schema.Types.Mixed, default: null },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    supersededBy: { type: String },
    immutable: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "business_profiles" },
);

businessProfileSchema.index({ analysisResultId: 1, status: 1 });

export type BusinessProfileDocument = InferSchemaType<
  typeof businessProfileSchema
> & {
  _id: mongoose.Types.ObjectId;
  status: BusinessProfileStatus;
  reviewReasonCodes: IntelligenceReviewReasonCode[];
};

export const BusinessProfileModel =
  (mongoose.models.BusinessProfile as Model<BusinessProfileDocument> | undefined) ??
  mongoose.model<BusinessProfileDocument>("BusinessProfile", businessProfileSchema);
