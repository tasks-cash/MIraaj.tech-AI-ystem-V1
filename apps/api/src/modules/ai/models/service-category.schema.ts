import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  SERVICE_CATEGORIES,
  type ServiceCategoryCode,
} from "@miraaj/shared-types";

const serviceCategorySchema = new Schema(
  {
    categoryId: { type: String, required: true, unique: true, index: true },
    code: {
      type: String,
      enum: SERVICE_CATEGORIES,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true },
    localizedName: { type: Schema.Types.Mixed, default: {} },
    description: { type: String, required: true },
    sortOrder: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["active", "archived"],
      required: true,
      default: "active",
    },
  },
  { timestamps: true, collection: "service_categories" },
);

export type ServiceCategoryDocument = InferSchemaType<
  typeof serviceCategorySchema
> & {
  _id: mongoose.Types.ObjectId;
  code: ServiceCategoryCode;
};

export const ServiceCategoryModel =
  (mongoose.models.ServiceCategory as Model<ServiceCategoryDocument> | undefined) ??
  mongoose.model<ServiceCategoryDocument>(
    "ServiceCategory",
    serviceCategorySchema,
  );
