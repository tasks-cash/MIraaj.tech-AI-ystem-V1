import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  INTELLIGENCE_JOB_STATUSES,
  type IntelligenceJobStatus,
} from "@miraaj/shared-types";

const businessIntelligenceJobSchema = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    analysisResultId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: INTELLIGENCE_JOB_STATUSES,
      required: true,
      default: "created",
      index: true,
    },
    stage: { type: String, required: true, default: "created" },
    fingerprint: { type: String, required: true, index: true },
    catalogVersionId: { type: String, required: true },
    matchingPolicyId: { type: String, required: true },
    allowAwaitingReviewSource: { type: Boolean, required: true, default: false },
    profileId: { type: String, index: true },
    recommendationSetId: { type: String, index: true },
    reusedFromJobId: { type: String },
    idempotencyKey: { type: String, index: true },
    progress: {
      stage: { type: String },
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
  { timestamps: true, collection: "business_intelligence_jobs" },
);

businessIntelligenceJobSchema.index({ fingerprint: 1, status: 1 });
businessIntelligenceJobSchema.index({ analysisResultId: 1, createdAt: -1 });
businessIntelligenceJobSchema.index({ status: 1, lastHeartbeatAt: 1 });

export type BusinessIntelligenceJobDocument = InferSchemaType<
  typeof businessIntelligenceJobSchema
> & {
  _id: mongoose.Types.ObjectId;
  status: IntelligenceJobStatus;
};

export const BusinessIntelligenceJobModel =
  (mongoose.models.BusinessIntelligenceJob as
    | Model<BusinessIntelligenceJobDocument>
    | undefined) ??
  mongoose.model<BusinessIntelligenceJobDocument>(
    "BusinessIntelligenceJob",
    businessIntelligenceJobSchema,
  );
