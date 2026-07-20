import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CATALOG_VERSION_STATUSES, type CatalogVersionStatus } from "@miraaj/shared-types";

const serviceMatchingPolicySchema = new Schema(
  {
    policyId: { type: String, required: true, unique: true, index: true },
    version: { type: Number, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: CATALOG_VERSION_STATUSES,
      required: true,
      default: "draft",
      index: true,
    },
    weights: { type: Schema.Types.Mixed, required: true },
    penalties: { type: Schema.Types.Mixed, required: true },
    autoApproveMin: { type: Number, required: true, min: 0, max: 1 },
    reviewMin: { type: Number, required: true, min: 0, max: 1 },
    decisionMakerMin: { type: Number, required: true, min: 0, max: 1 },
    professionalContextMin: { type: Number, required: true, min: 0, max: 1 },
    primaryLimit: { type: Number, required: true, min: 1 },
    supportingLimit: { type: Number, required: true, min: 1 },
    optionalLimit: { type: Number, required: true, min: 1 },
    futureLimit: { type: Number, required: true, min: 1 },
    notes: { type: String, default: "" },
    activatedAt: { type: Date },
    deprecatedAt: { type: Date },
  },
  { timestamps: true, collection: "service_matching_policies" },
);

export type ServiceMatchingPolicyDocument = InferSchemaType<
  typeof serviceMatchingPolicySchema
> & {
  _id: mongoose.Types.ObjectId;
  status: CatalogVersionStatus;
};

export const ServiceMatchingPolicyModel =
  (mongoose.models.ServiceMatchingPolicy as
    | Model<ServiceMatchingPolicyDocument>
    | undefined) ??
  mongoose.model<ServiceMatchingPolicyDocument>(
    "ServiceMatchingPolicy",
    serviceMatchingPolicySchema,
  );
