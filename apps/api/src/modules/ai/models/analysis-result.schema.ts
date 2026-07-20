import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  ANALYSIS_PURPOSES,
  REVIEW_STATUSES,
  type AnalysisPurpose,
  type ReviewStatus,
} from "@miraaj/shared-types";

const analysisResultSchema = new Schema(
  {
    resultId: { type: String, required: true, unique: true, index: true },
    jobId: { type: String, required: true, index: true },
    mediaId: { type: String, required: true, index: true },
    attemptId: { type: String, required: true, index: true },
    purpose: { type: String, enum: ANALYSIS_PURPOSES, required: true },
    fingerprint: { type: String, required: true, index: true },
    reviewStatus: {
      type: String,
      enum: REVIEW_STATUSES,
      required: true,
      index: true,
    },
    overallConfidence: { type: Number, required: true, min: 0, max: 1 },
    confidence: { type: Schema.Types.Mixed, required: true },
    mergedOutput: { type: Schema.Types.Mixed, required: true },
    ocrSummary: { type: Schema.Types.Mixed },
    visionSummary: { type: Schema.Types.Mixed },
    reviewReasonCodes: { type: [String], default: [] },
    requiresReview: { type: Boolean, default: false },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    immutable: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "analysis_results" },
);

analysisResultSchema.index({ fingerprint: 1, reviewStatus: 1 });

export type AnalysisResultDocument = InferSchemaType<
  typeof analysisResultSchema
> & {
  _id: mongoose.Types.ObjectId;
  purpose: AnalysisPurpose;
  reviewStatus: ReviewStatus;
};

export const AnalysisResultModel =
  (mongoose.models.AnalysisResult as Model<AnalysisResultDocument> | undefined) ??
  mongoose.model<AnalysisResultDocument>("AnalysisResult", analysisResultSchema);
