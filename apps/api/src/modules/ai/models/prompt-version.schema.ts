import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  PROMPT_VERSION_STATUSES,
  type PromptVersionStatus,
} from "@miraaj/shared-types";

const promptVersionSchema = new Schema(
  {
    promptVersionId: { type: String, required: true, unique: true, index: true },
    purpose: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: PROMPT_VERSION_STATUSES,
      required: true,
      index: true,
    },
    version: { type: Number, required: true, min: 1 },
    schemaVersion: { type: String, required: true, default: "1.0" },
    systemPrompt: { type: String, required: true },
    userPromptTemplate: { type: String, required: true },
    outputSchema: { type: Schema.Types.Mixed, required: true },
    activatedAt: { type: Date },
    deprecatedAt: { type: Date },
  },
  { timestamps: true, collection: "prompt_versions" },
);

promptVersionSchema.index({ purpose: 1, status: 1 });

export type PromptVersionDocument = InferSchemaType<
  typeof promptVersionSchema
> & {
  _id: mongoose.Types.ObjectId;
  status: PromptVersionStatus;
};

export const PromptVersionModel =
  (mongoose.models.PromptVersion as Model<PromptVersionDocument> | undefined) ??
  mongoose.model<PromptVersionDocument>("PromptVersion", promptVersionSchema);
