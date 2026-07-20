import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const feedbackSchema = new Schema(
  {
    feedbackId: { type: String, required: true, unique: true, index: true },
    resultId: { type: String, index: true },
    jobId: { type: String, index: true },
    mediaId: { type: String, index: true },
    category: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    submittedBy: { type: String, default: "temporary-admin" },
  },
  { timestamps: true, collection: "ai_feedback" },
);

export type FeedbackDocument = InferSchemaType<typeof feedbackSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FeedbackModel =
  (mongoose.models.Feedback as Model<FeedbackDocument> | undefined) ??
  mongoose.model<FeedbackDocument>("Feedback", feedbackSchema);
