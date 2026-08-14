/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, type Model } from "mongoose";

const notificationSchema = new Schema({
  publicId: { type: String, required: true, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  audienceId: { type: String, required: true, index: true },
  audienceType: { type: String, enum: ["participant", "operator"], required: true },
  notificationType: { type: String, required: true, index: true },
  titleKey: { type: String, required: true },
  messageKey: { type: String, required: true },
  localizedParameters: { type: Schema.Types.Mixed, default: {} },
  safeActionType: { type: String, enum: ["none", "assignment", "review", "task"], default: "none" },
  safeActionTarget: { type: String, default: "" },
  status: { type: String, enum: ["pending", "queued", "delivered", "read", "retry_scheduled", "failed", "expired", "cancelled"], default: "pending", index: true },
  readAt: { type: Date },
  deliveredAt: { type: Date },
  failedAt: { type: Date },
  attemptCount: { type: Number, default: 0, min: 0 },
  nextAttemptAt: { type: Date, index: true },
  lastSafeErrorCode: { type: String },
  correlationId: { type: String, required: true, index: true },
  deduplicationKey: { type: String, required: true },
  expiresAt: { type: Date, index: true },
}, { timestamps: true, collection: "ai_notifications" });
notificationSchema.index({ tenantId: 1, audienceId: 1, deduplicationKey: 1 }, { unique: true });
notificationSchema.index({ tenantId: 1, audienceId: 1, status: 1, createdAt: -1 });

const preferenceSchema = new Schema({
  publicId: { type: String, required: true, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  audienceId: { type: String, required: true, index: true },
  audienceType: { type: String, enum: ["participant", "operator"], required: true },
  inAppEnabled: { type: Boolean, default: true },
  emailEnabled: { type: Boolean, default: false },
  operationalEnabled: { type: Boolean, default: true },
  proofStateEnabled: { type: Boolean, default: true },
  invitationEnabled: { type: Boolean, default: true },
  recurringEnabled: { type: Boolean, default: true },
  quietHours: { type: Schema.Types.Mixed, default: null },
  preferredLanguage: { type: String, enum: ["ar", "en", "fr"], default: "en" },
}, { timestamps: true, collection: "ai_notification_preferences" });
preferenceSchema.index({ tenantId: 1, audienceId: 1 }, { unique: true });

function model(name: string, schema: Schema): Model<any> {
  return mongoose.models[name] ?? mongoose.model(name, schema);
}
export const NotificationModel = model("AiNotification", notificationSchema);
export const NotificationPreferenceModel = model("AiNotificationPreference", preferenceSchema);
