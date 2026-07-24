/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, type Model } from "mongoose";

const auditFields = {
  tenantId: { type: String, required: true, index: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  correlationId: { type: String, required: true, index: true },
};

const campaignTaskSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    internalName: { type: String, required: true },
    publicTitle: { type: String, required: true },
    description: { type: String, required: true },
    instructions: { type: String, required: true },
    campaignId: { type: String, required: true, index: true },
    campaignRevision: { type: Number, required: true, min: 1 },
    templateId: { type: String, required: true, index: true },
    templateRevision: { type: Number, required: true, min: 1 },
    approvedCopyVariantIds: { type: [String], required: true },
    externalTaskReference: { type: String, default: "" },
    externalRewardRuleReference: { type: String, default: "" },
    targetUrl: { type: String, required: true },
    taskMode: {
      type: String,
      enum: ["general", "targeted", "private", "invite_only", "pilot", "manual_assignment", "limited_capacity", "recurring"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "awaiting_review", "approved", "scheduled", "active", "paused", "capacity_reached", "completed", "cancelled", "archived"],
      default: "draft",
      index: true,
    },
    platform: { type: String, required: true },
    publicationType: { type: String, required: true },
    countryAllowlist: { type: [String], default: [] },
    languageAllowlist: { type: [String], default: [] },
    locales: { type: [String], default: [] },
    professionAllowlist: { type: [String], default: [] },
    industryAllowlist: { type: [String], default: [] },
    audienceSegments: { type: [String], default: [] },
    communityType: { type: String, required: true },
    communityRules: { type: [String], default: [] },
    requiredDisclosure: { type: String, default: "" },
    qrRequired: { type: Boolean, default: true },
    trackedLinkRequired: { type: Boolean, default: true },
    proofMarkerRequired: { type: Boolean, default: true },
    headerRequired: { type: Boolean, default: true },
    screenshotRequired: { type: Boolean, default: true },
    postUrlRequirement: { type: String, enum: ["optional", "required", "forbidden"], default: "optional" },
    timestampRequirement: { type: String, enum: ["optional", "required", "forbidden"], default: "optional" },
    assignmentDurationMinutes: { type: Number, required: true, min: 1 },
    proofDeadlineMinutes: { type: Number, required: true, min: 1 },
    humanReviewPolicy: { type: String, enum: ["always", "risk_based", "never"], default: "always" },
    startAt: { type: Date },
    endAt: { type: Date },
    totalCapacity: { type: Number, required: true, min: 1 },
    activeAssignmentCount: { type: Number, default: 0, min: 0 },
    completedAssignmentCount: { type: Number, default: 0, min: 0 },
    capacityByCountry: { type: Schema.Types.Mixed, default: {} },
    countryCapacityUsed: { type: Schema.Types.Mixed, default: {} },
    perParticipantLimit: { type: Number, default: 1, min: 1 },
    dailyParticipantLimit: { type: Number, default: 1, min: 1 },
    privateParticipantIds: { type: [String], default: [], select: false },
    pilotConfiguration: { type: Schema.Types.Mixed, default: {} },
    recurrenceConfiguration: { type: Schema.Types.Mixed, default: {} },
    emergencyStop: { type: Boolean, default: false },
    currentRevision: { type: Number, default: 1, min: 1 },
    revisionHistory: { type: [Schema.Types.Mixed], default: [] },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    activatedAt: { type: Date },
    pausedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    archivedAt: { type: Date },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_campaign_tasks" },
);
campaignTaskSchema.index({ tenantId: 1, publicId: 1 }, { unique: true });
campaignTaskSchema.index({ tenantId: 1, status: 1, startAt: 1, endAt: 1 });

const participantSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    externalSystem: { type: String, required: true },
    externalParticipantId: { type: String, required: true },
    country: { type: String, required: true },
    preferredLanguage: { type: String, required: true },
    locale: { type: String, required: true },
    profession: { type: String, default: "" },
    industry: { type: String, default: "" },
    audienceSegments: { type: [String], default: [] },
    status: { type: String, enum: ["active", "restricted", "disabled"], default: "active", index: true },
    eligibilityMetadata: { type: Schema.Types.Mixed, default: {} },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_distribution_participants" },
);
participantSchema.index({ tenantId: 1, externalSystem: 1, externalParticipantId: 1 }, { unique: true });

const invitationSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    taskId: { type: String, required: true, index: true },
    participantId: { type: String, required: true, index: true },
    opaqueTokenHash: { type: String, required: true, unique: true, select: false },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired", "cancelled", "assignment_created", "completed"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date },
    declinedAt: { type: Date },
    cancelledAt: { type: Date },
    assignmentId: { type: String },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_campaign_task_invitations" },
);
invitationSchema.index({ tenantId: 1, taskId: 1, participantId: 1, status: 1 });

const reservationSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    taskId: { type: String, required: true, index: true },
    participantId: { type: String, required: true, index: true },
    country: { type: String, required: true },
    idempotencyKeyHash: { type: String, required: true },
    status: { type: String, enum: ["reserved", "assigned", "released", "expired", "failed"], default: "reserved", index: true },
    assignmentId: { type: String },
    reservedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    releasedAt: { type: Date },
    failureCode: { type: String },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_campaign_task_reservations" },
);
reservationSchema.index({ tenantId: 1, taskId: 1, idempotencyKeyHash: 1 }, { unique: true });
reservationSchema.index({ tenantId: 1, taskId: 1, participantId: 1, status: 1 });

const campaignTaskEventSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    taskId: { type: String, required: true, index: true },
    participantId: { type: String, index: true },
    assignmentId: { type: String, index: true },
    eventType: {
      type: String,
      enum: [
        "invitation_created", "invitation_cancelled", "invitation_accepted", "invitation_declined",
        "assignment_ready", "assignment_failed", "assignment_cancelled", "proof_deadline_approaching",
        "proof_received", "proof_verification_started", "more_evidence_requested", "proof_verified",
        "proof_rejected", "proof_duplicate", "proof_suspicious", "assignment_expired", "task_transitioned",
      ],
      required: true,
      index: true,
    },
    safePayload: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true, index: true },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_campaign_task_events" },
);
campaignTaskEventSchema.index({ tenantId: 1, taskId: 1, occurredAt: -1 });

const participantCapacitySchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    taskId: { type: String, required: true, index: true },
    participantId: { type: String, required: true, index: true },
    activeCount: { type: Number, default: 0, min: 0 },
    dailyDay: { type: String, required: true },
    dailyCount: { type: Number, default: 0, min: 0 },
    ...auditFields,
  },
  { timestamps: true, collection: "ai_campaign_task_participant_capacity" },
);
participantCapacitySchema.index({ tenantId: 1, taskId: 1, participantId: 1 }, { unique: true });

function model(name: string, schema: Schema): Model<any> {
  return mongoose.models[name] ?? mongoose.model(name, schema);
}

export const CampaignTaskModel = model("AiCampaignTask", campaignTaskSchema);
export const DistributionParticipantModel = model("AiDistributionParticipant", participantSchema);
export const CampaignTaskInvitationModel = model("AiCampaignTaskInvitation", invitationSchema);
export const CampaignTaskReservationModel = model("AiCampaignTaskReservation", reservationSchema);
export const CampaignTaskEventModel = model("AiCampaignTaskEvent", campaignTaskEventSchema);
export const CampaignTaskParticipantCapacityModel = model("AiCampaignTaskParticipantCapacity", participantCapacitySchema);
