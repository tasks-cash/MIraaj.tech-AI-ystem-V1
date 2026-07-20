import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const AUDIT_EVENT_OUTCOMES = ["success", "failure", "denied"] as const;

const auditEventSchema = new Schema(
  {
    auditEventId: { type: String, required: true, unique: true, index: true },
    actorId: { type: String, required: true, index: true },
    actorRole: { type: String, default: "administrator" },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    previousRevision: { type: Number },
    newRevision: { type: Number },
    reason: { type: String },
    correlationId: { type: String, required: true, index: true },
    requestId: { type: String, required: true, index: true },
    outcome: { type: String, enum: AUDIT_EVENT_OUTCOMES, default: "success", index: true },
    ipHash: { type: String },
    userAgentSummary: { type: String },
    immutable: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "ai_audit_events",
  },
);
auditEventSchema.index({ createdAt: -1 });
auditEventSchema.index({ actorId: 1, createdAt: -1 });
auditEventSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export type AuditEventDocument = InferSchemaType<typeof auditEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AuditEventModel =
  (mongoose.models.AiAuditEvent as Model<AuditEventDocument> | undefined) ??
  mongoose.model<AuditEventDocument>("AiAuditEvent", auditEventSchema);
