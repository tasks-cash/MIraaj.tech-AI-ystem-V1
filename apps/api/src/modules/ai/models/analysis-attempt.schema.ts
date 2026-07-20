import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ANALYSIS_STAGES, type AnalysisStage } from "@miraaj/shared-types";

const analysisAttemptSchema = new Schema(
  {
    attemptId: { type: String, required: true, unique: true, index: true },
    jobId: { type: String, required: true, index: true },
    mediaId: { type: String, required: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    stage: { type: String, enum: ANALYSIS_STAGES, required: true },
    provider: { type: String, required: true },
    promptVersionId: { type: String, required: true },
    ocrObjectKey: { type: String },
    inspectPayload: { type: Schema.Types.Mixed },
    ocrPayload: { type: Schema.Types.Mixed },
    visionPayload: { type: Schema.Types.Mixed },
    mergePayload: { type: Schema.Types.Mixed },
    confidencePayload: { type: Schema.Types.Mixed },
    processingMs: { type: Number, min: 0 },
    failureCode: { type: String },
    failureMessage: { type: String },
    immutable: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "analysis_attempts" },
);

analysisAttemptSchema.index({ jobId: 1, attemptNumber: 1 }, { unique: true });

export type AnalysisAttemptDocument = InferSchemaType<
  typeof analysisAttemptSchema
> & {
  _id: mongoose.Types.ObjectId;
  stage: AnalysisStage;
};

export const AnalysisAttemptModel =
  (mongoose.models.AnalysisAttempt as Model<AnalysisAttemptDocument> | undefined) ??
  mongoose.model<AnalysisAttemptDocument>("AnalysisAttempt", analysisAttemptSchema);
