import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const intelligenceFeedbackSchema = new Schema(
  {
    feedbackId: { type: String, required: true, unique: true, index: true },
    jobId: { type: String, index: true },
    profileId: { type: String, index: true },
    setId: { type: String, index: true },
    category: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    submittedBy: { type: String, default: "temporary-admin" },
  },
  { timestamps: true, collection: "intelligence_feedback" },
);

export type IntelligenceFeedbackDocument = InferSchemaType<
  typeof intelligenceFeedbackSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const IntelligenceFeedbackModel =
  (mongoose.models.IntelligenceFeedback as
    | Model<IntelligenceFeedbackDocument>
    | undefined) ??
  mongoose.model<IntelligenceFeedbackDocument>(
    "IntelligenceFeedback",
    intelligenceFeedbackSchema,
  );
