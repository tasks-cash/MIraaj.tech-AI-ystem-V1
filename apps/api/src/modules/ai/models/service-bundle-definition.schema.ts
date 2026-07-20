import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BUSINESS_TYPES, type BusinessType } from "@miraaj/shared-types";

export const SERVICE_BUNDLE_CODES = [
  "dental",
  "restaurant",
  "school",
  "real_estate",
  "ecommerce",
  "multi_branch",
] as const;
export type ServiceBundleCode = (typeof SERVICE_BUNDLE_CODES)[number];

const serviceBundleDefinitionSchema = new Schema(
  {
    bundleId: { type: String, required: true, unique: true, index: true },
    code: {
      type: String,
      enum: SERVICE_BUNDLE_CODES,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    memberSlugs: { type: [String], required: true, default: [] },
    applicableBusinessTypes: {
      type: [String],
      enum: BUSINESS_TYPES,
      required: true,
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      required: true,
      default: "active",
    },
  },
  { timestamps: true, collection: "service_bundle_definitions" },
);

export type ServiceBundleDefinitionDocument = InferSchemaType<
  typeof serviceBundleDefinitionSchema
> & {
  _id: mongoose.Types.ObjectId;
  code: ServiceBundleCode;
  applicableBusinessTypes: BusinessType[];
};

export const ServiceBundleDefinitionModel =
  (mongoose.models.ServiceBundleDefinition as
    | Model<ServiceBundleDefinitionDocument>
    | undefined) ??
  mongoose.model<ServiceBundleDefinitionDocument>(
    "ServiceBundleDefinition",
    serviceBundleDefinitionSchema,
  );
