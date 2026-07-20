import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  UPLOAD_SESSION_STATUSES,
  type UploadSessionStatus,
} from "@miraaj/shared-types";

const uploadSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    mediaId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: UPLOAD_SESSION_STATUSES,
      required: true,
      index: true,
    },
    originalFilename: { type: String, required: true },
    sanitizedFilename: { type: String, required: true },
    declaredMimeType: { type: String, required: true },
    declaredSizeBytes: { type: Number, required: true, min: 1 },
    objectKey: { type: String, required: true },
    bucket: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    failureCode: { type: String },
    failureMessage: { type: String },
    createdBy: { type: String, default: "temporary-admin" },
  },
  { timestamps: true, collection: "upload_sessions" },
);

uploadSessionSchema.index({ mediaId: 1, createdAt: -1 });

export type UploadSessionDocument = InferSchemaType<typeof uploadSessionSchema> & {
  _id: mongoose.Types.ObjectId;
  status: UploadSessionStatus;
};

export const UploadSessionModel =
  (mongoose.models.UploadSession as Model<UploadSessionDocument> | undefined) ??
  mongoose.model<UploadSessionDocument>("UploadSession", uploadSessionSchema);
