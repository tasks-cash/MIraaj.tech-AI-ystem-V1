import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  AUDIENCE_TYPES,
  BUSINESS_NEED_CODES,
  BUSINESS_TYPES,
  SERVICE_CATALOG_ITEM_STATUSES,
  SERVICE_CATEGORIES,
  type AudienceType,
  type BusinessNeedCode,
  type BusinessType,
  type ServiceCatalogItemStatus,
  type ServiceCategoryCode,
} from "@miraaj/shared-types";

const availabilitySchema = new Schema(
  {
    global: { type: Boolean, required: true, default: true },
    countries: { type: [String], default: [] },
  },
  { _id: false },
);

const serviceCatalogItemSchema = new Schema(
  {
    itemId: { type: String, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    categoryCode: {
      type: String,
      enum: SERVICE_CATEGORIES,
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    localizedName: { type: Schema.Types.Mixed, default: {} },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: SERVICE_CATALOG_ITEM_STATUSES,
      required: true,
      default: "active",
      index: true,
    },
    supportedBusinessTypes: {
      type: [String],
      enum: BUSINESS_TYPES,
      required: true,
      default: [],
    },
    supportedAudienceTypes: {
      type: [String],
      enum: AUDIENCE_TYPES,
      required: true,
      default: [],
    },
    targetNeeds: {
      type: [String],
      enum: BUSINESS_NEED_CODES,
      required: true,
      default: [],
    },
    requiresProfessionalAudience: { type: Boolean, required: true, default: true },
    requiresDecisionMakerEvidence: { type: Boolean, required: true, default: false },
    isPaymentService: { type: Boolean, required: true, default: false },
    isRegulatedDomainOnly: { type: Boolean, required: true, default: false },
    providerDependency: { type: String, default: null },
    prerequisiteSlugs: { type: [String], default: [] },
    phase: { type: Number, min: 0, max: 5, required: true, default: 1 },
    bundleEligible: { type: Boolean, required: true, default: true },
    tags: { type: [String], default: [] },
    availability: { type: availabilitySchema, required: true, default: () => ({ global: true, countries: [] }) },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true, collection: "service_catalog_items" },
);

serviceCatalogItemSchema.index({ categoryCode: 1, status: 1 });
serviceCatalogItemSchema.index({ supportedBusinessTypes: 1 });
serviceCatalogItemSchema.index({ supportedAudienceTypes: 1 });

export type ServiceCatalogItemDocument = InferSchemaType<
  typeof serviceCatalogItemSchema
> & {
  _id: mongoose.Types.ObjectId;
  categoryCode: ServiceCategoryCode;
  status: ServiceCatalogItemStatus;
  supportedBusinessTypes: BusinessType[];
  supportedAudienceTypes: AudienceType[];
  targetNeeds: BusinessNeedCode[];
};

export const ServiceCatalogItemModel =
  (mongoose.models.ServiceCatalogItem as
    | Model<ServiceCatalogItemDocument>
    | undefined) ??
  mongoose.model<ServiceCatalogItemDocument>(
    "ServiceCatalogItem",
    serviceCatalogItemSchema,
  );
