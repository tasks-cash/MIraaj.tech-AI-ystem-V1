/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-type-assertion */
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { loadEnvironment } from "../../../environment.js";
import { AuditEventService } from "../audit/audit-event.service.js";
import { CampaignPackageModel } from "../models/campaign.schema.js";
import {
  CampaignTaskInvitationModel,
  CampaignTaskEventModel,
  CampaignTaskModel,
  CampaignTaskReservationModel,
  CampaignTaskParticipantCapacityModel,
  DistributionParticipantModel,
} from "../models/campaign-task.schema.js";
import {
  DistributionAssignmentModel,
  DistributionCopyVariantModel,
  DistributionTaskTemplateModel,
  ProofSubmissionModel,
  ProofVerificationAttemptModel,
  ProofReviewModel,
} from "../models/distribution.schema.js";
import { DistributionService } from "../distribution/distribution.service.js";
import {
  createCampaignTaskSchema,
  invitationBatchSchema,
  participantSchema,
} from "./campaign-task.contracts.js";
import {
  assertCampaignTaskTransition,
  evaluateCampaignTaskEligibility,
  safeCampaignTask,
} from "./campaign-task.operations.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const taskInput = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.keys(createCampaignTaskSchema.shape).map((key) => {
    const item = value[key];
    return [key, (key === "startAt" || key === "endAt") && item instanceof Date ? item.toISOString() : item];
  }));
const publicValue = (value: any): Record<string, any> => {
  const item = typeof value?.toObject === "function" ? value.toObject() : value;
  const { _id, __v, opaqueTokenHash, ...safe } = item ?? {};
  void _id; void __v; void opaqueTokenHash;
  return safe;
};

@Injectable()
export class CampaignTaskService {
  private readonly environment = loadEnvironment();

  constructor(
    @Inject(DistributionService) private readonly distribution: DistributionService,
    @Inject(AuditEventService) private readonly audit: AuditEventService,
  ) {}

  private ensureEnabled(): void {
    if (!this.environment.CAMPAIGN_TASK_OPERATIONS_ENABLED) {
      throw new ConflictException("CAMPAIGN_TASK_OPERATIONS_DISABLED");
    }
  }

  private async linkedResources(input: Record<string, any>) {
    const [campaign, template, copies] = await Promise.all([
      CampaignPackageModel.findOne({
        campaignPackageId: input.campaignId,
        status: "approved",
        currentRevision: { $gte: input.campaignRevision },
      }).lean(),
      DistributionTaskTemplateModel.findOne({
        templateId: input.templateId,
        revision: input.templateRevision,
        status: { $in: ["approved", "active"] },
      }).lean(),
      DistributionCopyVariantModel.find({
        copyVariantId: { $in: input.approvedCopyVariantIds },
        templateId: input.templateId,
        status: "approved",
      }).lean(),
    ]);
    if (!campaign) throw new BadRequestException("CAMPAIGN_TASK_APPROVED_CAMPAIGN_REQUIRED");
    if (!template || template.campaignPackageId !== input.campaignId) {
      throw new BadRequestException("CAMPAIGN_TASK_APPROVED_TEMPLATE_REQUIRED");
    }
    if (copies.length !== input.approvedCopyVariantIds.length) {
      throw new BadRequestException("CAMPAIGN_TASK_APPROVED_COPY_REQUIRED");
    }
    if (
      template.platform !== input.platform ||
      input.countryAllowlist.some((value: string) => !template.countryCodes.includes(value)) ||
      input.languageAllowlist.some((value: string) => !template.languages.includes(value)) ||
      input.locales.some((value: string) => !template.locales.includes(value))
    ) {
      throw new BadRequestException("CAMPAIGN_TASK_LINK_INCOMPATIBLE");
    }
    return { campaign, template, copies };
  }

  async create(input: unknown, tenantId: string, actor: string, correlationId = randomUUID()) {
    this.ensureEnabled();
    const values = createCampaignTaskSchema.parse(input);
    await this.linkedResources(values);
    const publicId = `act_${randomUUID()}`;
    const task = await CampaignTaskModel.create({
      ...values,
      publicId,
      tenantId,
      startAt: values.startAt ? new Date(values.startAt) : undefined,
      endAt: values.endAt ? new Date(values.endAt) : undefined,
      currentRevision: 1,
      revisionHistory: [{ revision: 1, actor, changedAt: new Date(), fields: Object.keys(values) }],
      createdBy: actor,
      updatedBy: actor,
      correlationId,
    });
    await this.record(actor, "aiCampaignTask.create", publicId, correlationId, "created", 0, 1);
    return publicValue(task);
  }

  async list(tenantId: string, filters: Record<string, unknown> = {}) {
    this.ensureEnabled();
    const query: Record<string, unknown> = { tenantId };
    for (const key of ["status", "taskMode", "campaignId", "templateId", "platform"]) {
      if (filters[key]) query[key] = String(filters[key]);
    }
    const items = await CampaignTaskModel.find(query).sort({ createdAt: -1 }).lean();
    return items.map((item) => safeCampaignTask(publicValue(item)));
  }

  async get(publicId: string, tenantId: string, includePrivate = false) {
    this.ensureEnabled();
    const task = await CampaignTaskModel.findOne({ publicId, tenantId }).select(includePrivate ? "+privateParticipantIds" : "");
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    return includePrivate ? publicValue(task) : safeCampaignTask(publicValue(task));
  }

  async update(publicId: string, input: unknown, tenantId: string, actor: string, expectedRevision: number) {
    const patch = createCampaignTaskSchema.partial().strict().parse(input);
    const task = await CampaignTaskModel.findOne({ publicId, tenantId }).select("+privateParticipantIds");
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    if (!["draft", "paused"].includes(task.status)) throw new ConflictException("CAMPAIGN_TASK_IMMUTABLE");
    if (task.currentRevision !== expectedRevision) throw new ConflictException("CAMPAIGN_TASK_REVISION_CONFLICT");
    const merged = createCampaignTaskSchema.parse(taskInput({ ...task.toObject(), ...patch }));
    await this.linkedResources(merged);
    const previous = task.currentRevision;
    for (const [key, value] of Object.entries(patch)) task.set(key, value);
    task.currentRevision += 1;
    task.updatedBy = actor;
    task.revisionHistory.push({ revision: task.currentRevision, actor, changedAt: new Date(), fields: Object.keys(patch) });
    await task.save();
    await this.record(actor, "aiCampaignTask.update", publicId, task.correlationId, "updated", previous, task.currentRevision);
    return publicValue(task);
  }

  async transition(publicId: string, target: string, tenantId: string, actor: string, reason: string, expectedRevision: number) {
    if (!reason.trim()) throw new BadRequestException("CAMPAIGN_TASK_REASON_REQUIRED");
    const task = await CampaignTaskModel.findOne({ publicId, tenantId });
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    if (task.currentRevision !== expectedRevision) throw new ConflictException("CAMPAIGN_TASK_REVISION_CONFLICT");
    try { assertCampaignTaskTransition(task.status, target); } catch { throw new ConflictException("CAMPAIGN_TASK_TRANSITION_INVALID"); }
    if (target === "active") {
      const values = createCampaignTaskSchema.parse(taskInput(task.toObject()));
      await this.linkedResources(values);
      if (task.startAt && task.startAt > new Date()) throw new ConflictException("CAMPAIGN_TASK_WINDOW_NOT_STARTED");
      if (task.endAt && task.endAt <= new Date()) throw new ConflictException("CAMPAIGN_TASK_WINDOW_ENDED");
    }
    const previousStatus = task.status;
    task.status = target;
    task.currentRevision += 1;
    task.updatedBy = actor;
    const timestamp = new Date();
    if (target === "approved") { task.approvedBy = actor; task.approvedAt = timestamp; }
    if (target === "active") task.activatedAt = timestamp;
    if (target === "paused") task.pausedAt = timestamp;
    if (target === "completed") task.completedAt = timestamp;
    if (target === "cancelled") task.cancelledAt = timestamp;
    if (target === "archived") task.archivedAt = timestamp;
    task.revisionHistory.push({ revision: task.currentRevision, transition: `${previousStatus}:${target}`, actor, reason, changedAt: timestamp });
    await task.save();
    await this.event(tenantId, publicId, "task_transitioned", actor, { from: previousStatus, to: target, reasonCode: "ADMIN_TRANSITION" });
    await this.record(actor, `aiCampaignTask.${target}`, publicId, task.correlationId, reason, expectedRevision, task.currentRevision);
    return publicValue(task);
  }

  async upsertParticipant(input: unknown, tenantId: string, actor: string) {
    const values = participantSchema.parse(input);
    const participant = await DistributionParticipantModel.findOneAndUpdate(
      { tenantId, externalSystem: values.externalSystem, externalParticipantId: values.externalParticipantId },
      {
        $set: { ...values, updatedBy: actor },
        $setOnInsert: { publicId: `adp_${randomUUID()}`, tenantId, status: "active", createdBy: actor, correlationId: randomUUID() },
      },
      { new: true, upsert: true },
    );
    return publicValue(participant);
  }

  async createInvitations(publicId: string, input: unknown, tenantId: string, actor: string) {
    if (!this.environment.CAMPAIGN_TASK_INVITATIONS_ENABLED) throw new ConflictException("CAMPAIGN_TASK_INVITATIONS_DISABLED");
    const values = invitationBatchSchema.parse(input);
    const task = await CampaignTaskModel.findOne({ publicId, tenantId });
    if (!task || !["private", "invite_only", "pilot"].includes(task.taskMode)) throw new BadRequestException("CAMPAIGN_TASK_INVITATION_INVALID");
    const participants = await DistributionParticipantModel.find({ tenantId, publicId: { $in: values.participantIds }, status: "active" }).lean();
    if (participants.length !== values.participantIds.length) throw new BadRequestException("CAMPAIGN_TASK_PARTICIPANT_INVALID");
    const expiresAt = new Date(values.expiresAt);
    if (expiresAt <= new Date()) throw new BadRequestException("CAMPAIGN_TASK_INVITATION_EXPIRED");
    return Promise.all(values.participantIds.map(async (participantId) => {
      const token = randomBytes(32).toString("base64url");
      const invitation = await CampaignTaskInvitationModel.create({
        publicId: `aci_${randomUUID()}`, tenantId, taskId: publicId, participantId,
        opaqueTokenHash: digest(token), expiresAt, createdBy: actor, updatedBy: actor, correlationId: randomUUID(),
      });
      await this.event(tenantId, publicId, "invitation_created", actor, { participantId }, participantId);
      return { ...publicValue(invitation), token };
    }));
  }

  listInvitations(publicId: string, tenantId: string) {
    return CampaignTaskInvitationModel.find({ tenantId, taskId: publicId }).select("-opaqueTokenHash").sort({ createdAt: -1 }).lean();
  }

  async cancelInvitation(publicId: string, invitationId: string, tenantId: string, actor: string) {
    const invitation = await CampaignTaskInvitationModel.findOneAndUpdate(
      { publicId: invitationId, taskId: publicId, tenantId, status: "pending" },
      { $set: { status: "cancelled", cancelledAt: new Date(), updatedBy: actor } },
      { new: true },
    ).orFail(() => new ConflictException("CAMPAIGN_TASK_INVITATION_CANCEL_INVALID"));
    await this.event(tenantId, publicId, "invitation_cancelled", actor, { invitationId }, invitation.participantId);
    return invitation;
  }

  async acceptInvitation(token: string, participantId: string, tenantId: string, accepted: boolean) {
    const status = accepted ? "accepted" : "declined";
    const invitation = await CampaignTaskInvitationModel.findOneAndUpdate(
      { opaqueTokenHash: digest(token), participantId, tenantId, status: "pending", expiresAt: { $gt: new Date() } },
      { $set: { status, ...(accepted ? { acceptedAt: new Date() } : { declinedAt: new Date() }), updatedBy: participantId } },
      { new: true },
    ).select("-opaqueTokenHash").orFail(() => new BadRequestException("CAMPAIGN_TASK_INVITATION_INVALID_OR_EXPIRED"));
    await this.event(tenantId, invitation.taskId, accepted ? "invitation_accepted" : "invitation_declined", participantId, {}, participantId);
    return invitation;
  }

  async available(tenantId: string, participantId: string) {
    if (!this.environment.CAMPAIGN_TASK_GENERAL_DISCOVERY_ENABLED) throw new ConflictException("CAMPAIGN_TASK_DISCOVERY_DISABLED");
    const participant = await DistributionParticipantModel.findOne({ tenantId, publicId: participantId }).lean();
    if (!participant) throw new NotFoundException("CAMPAIGN_TASK_PARTICIPANT_NOT_FOUND");
    const tasks = await CampaignTaskModel.find({ tenantId, status: "active", taskMode: { $in: ["general", "targeted", "limited_capacity", "recurring"] } }).select("+privateParticipantIds").lean();
    return tasks.filter((task) => evaluateCampaignTaskEligibility(task as any, participant as any).eligible).map((task) => safeCampaignTask(publicValue(task)));
  }

  async claim(publicId: string, tenantId: string, participantId: string, idempotencyKey: string, actor = participantId) {
    if (!idempotencyKey.trim()) throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
    const task = await CampaignTaskModel.findOne({ publicId, tenantId }).select("+privateParticipantIds").lean();
    const participant = await DistributionParticipantModel.findOne({ publicId: participantId, tenantId }).lean();
    if (!task || !participant) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    const invitation = await CampaignTaskInvitationModel.findOne({ tenantId, taskId: publicId, participantId, status: { $in: ["accepted", "pending"] }, expiresAt: { $gt: new Date() } }).lean();
    if (["invite_only", "private"].includes(task.taskMode) && !invitation && !task.privateParticipantIds?.includes(participantId)) {
      throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    }
    const eligibility = evaluateCampaignTaskEligibility(task as any, participant as any);
    if (!eligibility.eligible) throw new ConflictException(eligibility.code);
    const hash = digest(`${tenantId}:${publicId}:${participantId}:${idempotencyKey}`);
    const existing = await CampaignTaskReservationModel.findOne({ tenantId, taskId: publicId, idempotencyKeyHash: hash }).lean();
    if (existing?.assignmentId) return this.distribution.assignmentPackage(existing.assignmentId, participantId);
    const dayKey = new Date().toISOString().slice(0, 10);
    try {
      await CampaignTaskParticipantCapacityModel.updateOne(
        { tenantId, taskId: publicId, participantId },
        { $setOnInsert: { publicId: `acp_${randomUUID()}`, tenantId, taskId: publicId, participantId, activeCount: 0, dailyDay: dayKey, dailyCount: 0, createdBy: actor, updatedBy: actor, correlationId: randomUUID() } },
        { upsert: true },
      );
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
    const participantCapacity = await CampaignTaskParticipantCapacityModel.findOneAndUpdate(
      {
        tenantId, taskId: publicId, participantId,
        activeCount: { $lt: task.perParticipantLimit },
        $or: [{ dailyDay: { $ne: dayKey } }, { dailyCount: { $lt: task.dailyParticipantLimit } }],
      },
      [
        { $set: {
          activeCount: { $add: ["$activeCount", 1] },
          dailyCount: { $cond: [{ $eq: ["$dailyDay", dayKey] }, { $add: ["$dailyCount", 1] }, 1] },
          dailyDay: dayKey,
          updatedBy: actor,
        } },
      ],
      { new: true },
    );
    if (!participantCapacity) throw new ConflictException("CAMPAIGN_TASK_PARTICIPANT_OR_DAILY_LIMIT");

    const countryPath = `countryCapacityUsed.${participant.country}`;
    const configuredCountryCapacity = Number((task.capacityByCountry as Record<string, number> | undefined)?.[participant.country] ?? 0);
    const capacityFilter: Record<string, unknown> = {
      publicId, tenantId, status: "active", emergencyStop: false,
      $expr: { $lt: ["$activeAssignmentCount", "$totalCapacity"] },
    };
    if (configuredCountryCapacity > 0) capacityFilter[countryPath] = { $lt: configuredCountryCapacity };
    const reserved = await CampaignTaskModel.findOneAndUpdate(
      capacityFilter,
      { $inc: { activeAssignmentCount: 1, [countryPath]: 1 }, $set: { updatedBy: actor } },
      { new: true },
    );
    if (!reserved) {
      await CampaignTaskParticipantCapacityModel.updateOne(
        { tenantId, taskId: publicId, participantId, activeCount: { $gt: 0 } },
        { $inc: { activeCount: -1, dailyCount: -1 }, $set: { updatedBy: actor } },
      );
      throw new ConflictException("CAPACITY_UNAVAILABLE");
    }
    const reservationId = `acr_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    try {
      await CampaignTaskReservationModel.create({
        publicId: reservationId, tenantId, taskId: publicId, participantId, country: participant.country,
        idempotencyKeyHash: hash, reservedAt: new Date(), expiresAt, createdBy: actor, updatedBy: actor, correlationId: randomUUID(),
      });
      const copyVariantId = task.approvedCopyVariantIds[0];
      const assignment = await this.distribution.createAssignment({
        apiVersion: "v1", templateId: task.templateId, copyVariantId,
        externalTaskId: task.publicId, externalUserId: participant.publicId,
        externalAssignmentId: `cta_${reservationId}`, targetUrl: task.targetUrl,
        country: participant.country, correlationId: randomUUID(),
      }, actor, `campaign-task:${hash}`);
      await CampaignTaskReservationModel.updateOne({ publicId: reservationId, tenantId }, { $set: { status: "assigned", assignmentId: assignment.externalAssignmentId, updatedBy: actor } });
      if (invitation) await CampaignTaskInvitationModel.updateOne({ publicId: invitation.publicId }, { $set: { status: "assignment_created", assignmentId: assignment.externalAssignmentId, updatedBy: actor } });
      if (reserved.activeAssignmentCount >= reserved.totalCapacity) {
        await CampaignTaskModel.updateOne({ publicId, tenantId, status: "active" }, { $set: { status: "capacity_reached", updatedBy: actor } });
      }
      await this.event(tenantId, publicId, "assignment_ready", actor, { status: assignment.status }, participantId, assignment.externalAssignmentId);
      return assignment;
    } catch (error) {
      await Promise.all([
        CampaignTaskReservationModel.updateOne({ publicId: reservationId }, { $set: { status: "failed", failureCode: "ASSIGNMENT_CREATION_FAILED", updatedBy: actor } }),
        CampaignTaskModel.updateOne({ publicId, tenantId }, { $inc: { activeAssignmentCount: -1, [countryPath]: -1 }, $set: { updatedBy: actor } }),
        CampaignTaskParticipantCapacityModel.updateOne(
          { tenantId, taskId: publicId, participantId, activeCount: { $gt: 0 } },
          { $inc: { activeCount: -1, dailyCount: -1 }, $set: { updatedBy: actor } },
        ),
      ]);
      await this.event(tenantId, publicId, "assignment_failed", actor, { safeErrorCode: "ASSIGNMENT_CREATION_FAILED" }, participantId);
      throw error;
    }
  }

  async manualAssignment(publicId: string, tenantId: string, participantId: string, idempotencyKey: string, actor: string) {
    if (!this.environment.CAMPAIGN_TASK_MANUAL_ASSIGNMENTS_ENABLED) {
      throw new ConflictException("CAMPAIGN_TASK_MANUAL_ASSIGNMENTS_DISABLED");
    }
    const task = await CampaignTaskModel.findOne({ publicId, tenantId }).lean();
    if (!task || task.taskMode !== "manual_assignment") {
      throw new BadRequestException("CAMPAIGN_TASK_MANUAL_ASSIGNMENT_INVALID");
    }
    return this.claim(publicId, tenantId, participantId, idempotencyKey, actor);
  }

  async statistics(publicId: string, tenantId: string) {
    const task = await CampaignTaskModel.findOne({ publicId, tenantId }).lean();
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    const [reservations, invitations, assignments] = await Promise.all([
      CampaignTaskReservationModel.aggregate([{ $match: { tenantId, taskId: publicId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      CampaignTaskInvitationModel.aggregate([{ $match: { tenantId, taskId: publicId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      DistributionAssignmentModel.aggregate([{ $match: { externalTaskId: publicId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    return {
      taskId: publicId,
      capacity: { total: task.totalCapacity, used: task.activeAssignmentCount, remaining: Math.max(0, task.totalCapacity - task.activeAssignmentCount), byCountry: task.countryCapacityUsed },
      reservations: Object.fromEntries(reservations.map((item) => [item._id, item.count])),
      invitations: Object.fromEntries(invitations.map((item) => [item._id, item.count])),
      assignments: Object.fromEntries(assignments.map((item) => [item._id, item.count])),
    };
  }

  async assignments(publicId: string, tenantId: string) {
    const task = await CampaignTaskModel.exists({ publicId, tenantId });
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    return DistributionAssignmentModel.find({ externalTaskId: publicId })
      .select("-assignmentTokenHash")
      .sort({ createdAt: -1 })
      .lean();
  }

  async participantTask(publicId: string, tenantId: string, participantId: string) {
    const task = await CampaignTaskModel.findOne({ publicId, tenantId }).select("+privateParticipantIds").lean();
    const participant = await DistributionParticipantModel.findOne({ publicId: participantId, tenantId }).lean();
    if (!task || !participant) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    const invitation = await CampaignTaskInvitationModel.exists({
      tenantId, taskId: publicId, participantId, status: { $in: ["pending", "accepted", "assignment_created"] }, expiresAt: { $gt: new Date() },
    });
    if (["private", "invite_only"].includes(task.taskMode) && !invitation && !task.privateParticipantIds?.includes(participantId)) {
      throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    }
    const result = evaluateCampaignTaskEligibility(task as any, participant as any);
    if (!result.eligible && result.code !== "CAPACITY_UNAVAILABLE") throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    return safeCampaignTask(publicValue(task));
  }

  async proofs(publicId: string, tenantId: string) {
    const task = await CampaignTaskModel.exists({ publicId, tenantId });
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    const assignments = await DistributionAssignmentModel.find({ externalTaskId: publicId }).select("assignmentId").lean();
    const assignmentIds = assignments.map((value) => value.assignmentId);
    const proofs = await ProofSubmissionModel.find({ assignmentId: { $in: assignmentIds } }).sort({ createdAt: -1 }).lean();
    return Promise.all(proofs.map(async (proof) => {
      const [attempt, review] = await Promise.all([
        ProofVerificationAttemptModel.findOne({ proofSubmissionId: proof.proofSubmissionId }).sort({ attemptNumber: -1 }).lean(),
        ProofReviewModel.findOne({ proofSubmissionId: proof.proofSubmissionId }).sort({ reviewedAt: -1 }).lean(),
      ]);
      const safe = publicValue(proof);
      delete safe.evidence;
      return { ...safe, latestAttempt: attempt ? publicValue(attempt) : null, latestReview: review ? publicValue(review) : null };
    }));
  }

  async reviewProof(publicId: string, proofSubmissionId: string, tenantId: string, actor: string, input: Record<string, unknown>) {
    const task = await CampaignTaskModel.exists({ publicId, tenantId });
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    const proof = await ProofSubmissionModel.findOne({ proofSubmissionId }).select("assignmentId").lean();
    const assignment = proof ? await DistributionAssignmentModel.exists({ assignmentId: proof.assignmentId, externalTaskId: publicId }) : null;
    if (!proof || !assignment) {
      throw new NotFoundException("CAMPAIGN_TASK_PROOF_NOT_FOUND");
    }
    const review = await this.distribution.reviewProof(proofSubmissionId, input, actor);
    await this.event(tenantId, publicId, String(input.decision) === "verified" ? "proof_verified" : String(input.decision) === "request_more_evidence" ? "more_evidence_requested" : String(input.decision) === "duplicate" ? "proof_duplicate" : String(input.decision) === "fraudulent" ? "proof_suspicious" : "proof_rejected", actor, { proofSubmissionId });
    return review;
  }

  async reconcile(publicId: string, tenantId: string, actor: string) {
    const task = await CampaignTaskModel.findOne({ publicId, tenantId });
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    const now = new Date();
    const expired = await CampaignTaskReservationModel.find({ tenantId, taskId: publicId, status: "reserved", expiresAt: { $lte: now } });
    for (const reservation of expired) {
      reservation.status = "expired";
      reservation.updatedBy = actor;
      await reservation.save();
    }
    const assigned = await CampaignTaskReservationModel.find({ tenantId, taskId: publicId, status: "assigned" }).lean();
    const byCountry = assigned.reduce<Record<string, number>>((counts, value) => {
      counts[value.country] = (counts[value.country] ?? 0) + 1;
      return counts;
    }, {});
    task.activeAssignmentCount = assigned.length;
    task.countryCapacityUsed = byCountry;
    task.updatedBy = actor;
    await task.save();
    await CampaignTaskInvitationModel.updateMany({ tenantId, taskId: publicId, status: "pending", expiresAt: { $lte: now } }, { $set: { status: "expired", updatedBy: actor } });
    return { taskId: publicId, expiredReservations: expired.length, activeAssignmentCount: assigned.length, countryCapacityUsed: byCountry };
  }

  private async record(actor: string, action: string, targetId: string, correlationId: string, reason: string, previousRevision: number, newRevision: number) {
    await this.audit.record({
      actorId: actor, action, targetType: "aiCampaignTask", targetId, correlationId,
      requestId: correlationId, reason, previousRevision, newRevision,
    }, { failClosed: true });
  }

  private async event(
    tenantId: string,
    taskId: string,
    eventType: string,
    actor: string,
    safePayload: Record<string, unknown>,
    participantId?: string,
    assignmentId?: string,
  ) {
    return CampaignTaskEventModel.create({
      publicId: `ace_${randomUUID()}`, tenantId, taskId, eventType, safePayload,
      ...(participantId ? { participantId } : {}), ...(assignmentId ? { assignmentId } : {}),
      occurredAt: new Date(), createdBy: actor, updatedBy: actor, correlationId: randomUUID(),
    });
  }
}
