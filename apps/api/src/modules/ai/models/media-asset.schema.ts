import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  DUPLICATE_STATUSES,
  MEDIA_ASSET_STATUSES,
  MEDIA_KINDS,
  type DuplicateStatus,
  type MediaAssetStatus,
  type MediaKind,
} from "@miraaj/shared-types";

const mediaAssetSchema = new Schema(
  {
    mediaId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: MEDIA_ASSET_STATUSES,
      required: true,
      index: true,
    },
    kind: { type: String, enum: MEDIA_KINDS, required: true },
    originalFilename: { type: String, required: true },
    sanitizedFilename: { type: String, required: true },
    verifiedMime: { type: String },
    originalBytes: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    pageCount: { type: Number, min: 0 },
    sha256: { type: String, index: true },
    perceptualHash: { type: String, index: true },
    duplicateStatus: {
      type: String,
      enum: DUPLICATE_STATUSES,
      default: "none",
    },
    exactDuplicateOfMediaId: { type: String },
    originalObjectKey: { type: String },
    normalizedObjectKey: { type: String },
    normalizedVersion: { type: Number, default: 0 },
    normalizedFormat: { type: String },
    uploadSessionId: { type: String, index: true },
    failureCode: { type: String },
    failureMessage: { type: String },
    readyAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true, collection: "media_assets" },
);

mediaAssetSchema.index({ sha256: 1, status: 1 });

export type MediaAssetDocument = InferSchemaType<typeof mediaAssetSchema> & {
  _id: mongoose.Types.ObjectId;
  status: MediaAssetStatus;
  kind: MediaKind;
  duplicateStatus: DuplicateStatus;
};

export const MediaAssetModel =
  (mongoose.models.MediaAsset as Model<MediaAssetDocument> | undefined) ??
  mongoose.model<MediaAssetDocument>("MediaAsset", mediaAssetSchema);
