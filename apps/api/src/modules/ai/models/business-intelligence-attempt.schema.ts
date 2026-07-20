import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const businessIntelligenceAttemptSchema = new Schema(
  {
    attemptId: { type: String, required: true, unique: true, index: true },
    jobId: { type: String, required: true, index: true },
    analysisResultId: { type: String, required: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    stage: { type: String, required: true },
    reasoningPayload: { type: Schema.Types.Mixed, default: null },
    profilePayload: { type: Schema.Types.Mixed, default: null },
    matchPayload: { type: Schema.Types.Mixed, default: null },
    bundlePayload: { type: Schema.Types.Mixed, default: null },
    scorePayload: { type: Schema.Types.Mixed, default: null },
    processingMs: { type: Number, min: 0 },
    failureCode: { type: String },
    failureMessage: { type: String },
    immutable: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "business_intelligence_attempts" },
);

businessIntelligenceAttemptSchema.index(
  { jobId: 1, attemptNumber: 1 },
  { unique: true },
);

export type BusinessIntelligenceAttemptDocument = InferSchemaType<
  typeof businessIntelligenceAttemptSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const BusinessIntelligenceAttemptModel =
  (mongoose.models.BusinessIntelligenceAttempt as
    | Model<BusinessIntelligenceAttemptDocument>
    | undefined) ??
  mongoose.model<BusinessIntelligenceAttemptDocument>(
    "BusinessIntelligenceAttempt",
    businessIntelligenceAttemptSchema,
  );
