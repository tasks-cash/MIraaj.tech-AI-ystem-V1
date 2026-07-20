import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  REVIEW_DECISION_STATUSES,
  type ReviewDecisionStatus,
} from "@miraaj/shared-types";

const reviewDecisionSchema = new Schema(
  {
    decisionId: { type: String, required: true, unique: true, index: true },
    resultId: { type: String, required: true, index: true },
    jobId: { type: String, required: true, index: true },
    mediaId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: REVIEW_DECISION_STATUSES,
      required: true,
      index: true,
    },
    reviewerId: { type: String, default: "temporary-admin" },
    reasonCodes: { type: [String], default: [] },
    notes: { type: String },
    correctedOutput: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: "review_decisions" },
);

export type ReviewDecisionDocument = InferSchemaType<
  typeof reviewDecisionSchema
> & {
  _id: mongoose.Types.ObjectId;
  status: ReviewDecisionStatus;
};

export const ReviewDecisionModel =
  (mongoose.models.ReviewDecision as Model<ReviewDecisionDocument> | undefined) ??
  mongoose.model<ReviewDecisionDocument>("ReviewDecision", reviewDecisionSchema);
