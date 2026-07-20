import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  ANALYSIS_JOB_STATUSES,
  ANALYSIS_PURPOSES,
  ANALYSIS_STAGES,
  type AnalysisJobStatus,
  type AnalysisPurpose,
  type AnalysisStage,
} from "@miraaj/shared-types";

const analysisJobSchema = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    mediaId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ANALYSIS_JOB_STATUSES,
      required: true,
      index: true,
    },
    stage: { type: String, enum: ANALYSIS_STAGES, required: true },
    purpose: { type: String, enum: ANALYSIS_PURPOSES, required: true },
    promptVersionId: { type: String, required: true },
    promptPurpose: { type: String, required: true },
    provider: { type: String, required: true, default: "gemini" },
    ocrLanguages: { type: String, required: true },
    schemaVersion: { type: String, required: true, default: "1.0" },
    hints: { type: Schema.Types.Mixed, default: {} },
    fingerprint: { type: String, required: true, index: true },
    idempotencyKey: { type: String, index: true },
    reusedFromJobId: { type: String },
    reusedFromResultId: { type: String },
    activeAttemptId: { type: String },
    resultId: { type: String, index: true },
    progress: {
      stage: { type: String, enum: ANALYSIS_STAGES },
      percent: { type: Number, min: 0, max: 100 },
      message: { type: String },
      updatedAt: { type: String },
    },
    retryCount: { type: Number, default: 0, min: 0 },
    maxRetries: { type: Number, default: 3, min: 0 },
    bullJobId: { type: String },
    queueName: { type: String },
    lastHeartbeatAt: { type: Date },
    failureCode: { type: String },
    failureMessage: { type: String },
    cancelledAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: "analysis_jobs" },
);

analysisJobSchema.index({ fingerprint: 1, status: 1 });
analysisJobSchema.index({ mediaId: 1, createdAt: -1 });
analysisJobSchema.index({ status: 1, lastHeartbeatAt: 1 });

export type AnalysisJobDocument = InferSchemaType<typeof analysisJobSchema> & {
  _id: mongoose.Types.ObjectId;
  status: AnalysisJobStatus;
  stage: AnalysisStage;
  purpose: AnalysisPurpose;
};

export const AnalysisJobModel =
  (mongoose.models.AnalysisJob as Model<AnalysisJobDocument> | undefined) ??
  mongoose.model<AnalysisJobDocument>("AnalysisJob", analysisJobSchema);
