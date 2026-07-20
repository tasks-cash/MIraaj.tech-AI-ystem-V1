import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const RECOMMENDATION_REVIEW_STATUSES = [
  "pending",
  "approved",
  "corrected",
  "rejected",
] as const;
export type RecommendationReviewStatus =
  (typeof RECOMMENDATION_REVIEW_STATUSES)[number];

const recommendationReviewSchema = new Schema(
  {
    decisionId: { type: String, required: true, unique: true, index: true },
    targetType: {
      type: String,
      enum: ["business_profile", "recommendation_set"],
      required: true,
      index: true,
    },
    targetId: { type: String, required: true, index: true },
    jobId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: RECOMMENDATION_REVIEW_STATUSES,
      required: true,
      index: true,
    },
    reviewerId: { type: String, default: "temporary-admin" },
    reasonCodes: { type: [String], default: [] },
    notes: { type: String },
    correctedPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: "recommendation_reviews" },
);

export type RecommendationReviewDocument = InferSchemaType<
  typeof recommendationReviewSchema
> & {
  _id: mongoose.Types.ObjectId;
  status: RecommendationReviewStatus;
};

export const RecommendationReviewModel =
  (mongoose.models.RecommendationReview as
    | Model<RecommendationReviewDocument>
    | undefined) ??
  mongoose.model<RecommendationReviewDocument>(
    "RecommendationReview",
    recommendationReviewSchema,
  );
