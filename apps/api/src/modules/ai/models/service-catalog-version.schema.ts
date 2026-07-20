import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  CATALOG_VERSION_STATUSES,
  type CatalogVersionStatus,
} from "@miraaj/shared-types";

const serviceCatalogVersionSchema = new Schema(
  {
    versionId: { type: String, required: true, unique: true, index: true },
    version: { type: Number, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: CATALOG_VERSION_STATUSES,
      required: true,
      default: "draft",
      index: true,
    },
    itemSlugs: { type: [String], required: true, default: [] },
    categoryCodes: { type: [String], required: true, default: [] },
    notes: { type: String, default: "" },
    activatedAt: { type: Date },
    deprecatedAt: { type: Date },
  },
  { timestamps: true, collection: "service_catalog_versions" },
);

export type ServiceCatalogVersionDocument = InferSchemaType<
  typeof serviceCatalogVersionSchema
> & {
  _id: mongoose.Types.ObjectId;
  status: CatalogVersionStatus;
};

export const ServiceCatalogVersionModel =
  (mongoose.models.ServiceCatalogVersion as
    | Model<ServiceCatalogVersionDocument>
    | undefined) ??
  mongoose.model<ServiceCatalogVersionDocument>(
    "ServiceCatalogVersion",
    serviceCatalogVersionSchema,
  );
