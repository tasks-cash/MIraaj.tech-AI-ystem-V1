/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-base-to-string, @typescript-eslint/no-explicit-any, @typescript-eslint/restrict-template-expressions */
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { loadEnvironment } from "../../../environment.js";
import { AiInternalClientService } from "../ai-internal-client.service.js";
import { CampaignPackageModel } from "../models/campaign.schema.js";
import {
  DistributionAssignmentModel,
  DistributionCopyVariantModel,
  DistributionHeaderAssetModel,
  DistributionOperationalMetricModel,
  DistributionTaskTemplateModel,
  IntegrationOutboxEventModel,
  ProofReviewModel,
  ProofSubmissionModel,
  ProofVerificationAttemptModel,
  QrAssetModel,
  TrackedLinkModel,
} from "../models/distribution.schema.js";
import { MediaStorageService } from "../media/media-storage.service.js";
import { DistributionQueueService } from "../queue/distribution-queue.service.js";
import {
  PROOF_VERIFICATION_EVENT_TYPE,
  PROOF_VERIFICATION_EVENT_VERSION,
  TASKS_CASH_DISTRIBUTION_API_VERSION,
  proofResultChecksum,
  proofVerificationCompletedEventSchema,
} from "./distribution.contracts.js";
import { assertTemplateTransition, retentionDays } from "./distribution-operations.js";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const redirectWindows = new Map<string, { startedAt: number; count: number }>();
const publicDocument = <T extends { toObject?: () => Record<string, unknown> }>(document: T) => {
  const value = document.toObject ? document.toObject() : document;
  const { _id, __v, assignmentTokenHash, opaqueTokenHash, ...safe } = value as Record<string, unknown>;
  void _id; void __v; void assignmentTokenHash; void opaqueTokenHash;
  return safe;
};

@Injectable()
export class DistributionService {
  private readonly environment = loadEnvironment();

  constructor(
    @Inject(AiInternalClientService) private readonly aiClient: AiInternalClientService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
    @Inject(DistributionQueueService) private readonly queues: DistributionQueueService,
  ) {}

  async createTemplate(input: Record<string, unknown>, actor: string, correlationId = randomUUID()) {
    const campaignPackageId = String(input.campaignPackageId ?? "");
    const campaign = await CampaignPackageModel.findOne({ campaignPackageId }).lean();
    if (!campaign || campaign.status !== "approved") {
      throw new BadRequestException("DISTRIBUTION_REQUIRES_APPROVED_CAMPAIGN");
    }
    const templateId = `dst_${randomUUID()}`;
    return DistributionTaskTemplateModel.create({
      ...input,
      templateId,
      campaignPackageRevision: Number(input.campaignPackageRevision ?? campaign.currentRevision),
      publicationWindowMinutes: Number(input.publicationWindowMinutes ?? 1_440),
      proofDeadlineMinutes: Number(input.proofDeadlineMinutes ?? this.environment.DISTRIBUTION_PROOF_DEADLINE_MINUTES),
      createdBy: actor,
      correlationId,
    });
  }

  listTemplates() { return DistributionTaskTemplateModel.find({}).sort({ createdAt: -1 }).lean(); }
  async getTemplate(templateId: string) {
    const value = await DistributionTaskTemplateModel.findOne({ templateId }).lean();
    if (!value) throw new NotFoundException("DISTRIBUTION_TEMPLATE_NOT_FOUND");
    return value;
  }
  async updateTemplate(templateId: string, patch: Record<string, unknown>) {
    const template = await DistributionTaskTemplateModel.findOne({ templateId });
    if (!template) throw new NotFoundException("DISTRIBUTION_TEMPLATE_NOT_FOUND");
    if (!["draft", "awaiting_review"].includes(template.status)) throw new ConflictException("DISTRIBUTION_TEMPLATE_IMMUTABLE");
    const forbidden = ["templateId", "campaignPackageId", "campaignPackageRevision", "createdBy", "correlationId", "status", "revision"];
    for (const key of forbidden) delete patch[key];
    template.set(patch);
    template.revision += 1;
    await template.save();
    return template;
  }
  async transitionTemplate(templateId: string, status: string, actor: string, input: Record<string, unknown> = {}) {
    const template = await DistributionTaskTemplateModel.findOne({ templateId });
    if (!template) throw new NotFoundException("DISTRIBUTION_TEMPLATE_NOT_FOUND");
    try { assertTemplateTransition(template.status, status); } catch {
      throw new ConflictException("DISTRIBUTION_TEMPLATE_TRANSITION_INVALID");
    }
    if (status === "scheduled" && !input.scheduledAt) throw new BadRequestException("DISTRIBUTION_SCHEDULE_REQUIRED");
    template.status = status;
    template.revision += 1;
    if (status === "approved") { template.approvedBy = actor; template.approvedAt = new Date(); }
    if (status === "scheduled") template.scheduledAt = new Date(String(input.scheduledAt));
    if (status === "active") template.activeAt = new Date();
    if (status === "paused") template.pausedAt = new Date();
    if (status === "completed") template.completedAt = new Date();
    if (status === "archived") template.archivedAt = new Date();
    template.revisionHistory.push({ revision: template.revision, status, actor, reason: input.reason, changedAt: new Date() });
    await template.save();
    return template;
  }

  async duplicateTemplate(templateId: string, actor: string) {
    const source = await this.getTemplate(templateId);
    const { _id, __v, templateId: ignored, status, approvedAt, approvedBy, archivedAt, createdAt, updatedAt, ...copy } = source as Record<string, unknown>;
    void _id; void __v; void ignored; void status; void approvedAt; void approvedBy; void archivedAt; void createdAt; void updatedAt;
    return DistributionTaskTemplateModel.create({ ...copy, templateId: `dst_${randomUUID()}`, status: "draft", revision: 1, revisionHistory: [], createdBy: actor, correlationId: randomUUID() });
  }

  async createCopy(templateId: string, input: Record<string, unknown>, actor: string, source: "manual" | "approved_campaign" = "manual") {
    const template = await this.getTemplate(templateId);
    const postText = String(input.postText ?? template.requiredPostText);
    const locale = String(input.locale ?? template.locales[0] ?? "en");
    const direction = String(input.direction ?? (locale.startsWith("ar") ? "rtl" : "ltr"));
    return DistributionCopyVariantModel.create({
      ...input,
      copyVariantId: `dcp_${randomUUID()}`,
      templateId,
      templateRevision: template.revision,
      revision: 1,
      source,
      language: String(input.language ?? template.languages[0] ?? "en"),
      locale,
      direction,
      profession: String(input.profession ?? template.profession),
      audienceType: String(input.audienceType ?? template.audienceType),
      headline: String(input.headline ?? postText.slice(0, 100)),
      postText,
      disclosure: String(input.disclosure ?? template.requiredDisclosure),
      contentChecksum: digest(postText),
      createdBy: actor,
      correlationId: randomUUID(),
    });
  }
  generateCopy(templateId: string, actor: string) { return this.createCopy(templateId, {}, actor, "approved_campaign"); }
  listCopies(templateId: string) { return DistributionCopyVariantModel.find({ templateId }).sort({ createdAt: -1 }).lean(); }
  reviewCopy(copyVariantId: string, approved: boolean, actor: string) {
    return DistributionCopyVariantModel.findOneAndUpdate(
      { copyVariantId, status: { $in: ["draft", "awaiting_review"] } },
      { $set: approved ? { status: "approved", approvedBy: actor, approvedAt: new Date() } : { status: "rejected", rejectedBy: actor, rejectedAt: new Date() } },
      { new: true },
    ).orFail(() => new ConflictException("DISTRIBUTION_COPY_TRANSITION_INVALID"));
  }

  private allowedTarget(targetUrl: string): URL {
    let parsed: URL;
    try { parsed = new URL(targetUrl); } catch { throw new BadRequestException("TRACKED_LINK_TARGET_INVALID"); }
    if (parsed.protocol !== "https:") throw new BadRequestException("TRACKED_LINK_TARGET_HTTPS_REQUIRED");
    const allowed = this.environment.DISTRIBUTION_TARGET_DOMAIN_ALLOWLIST.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(parsed.hostname.toLowerCase())) throw new BadRequestException("TRACKED_LINK_TARGET_NOT_ALLOWLISTED");
    return parsed;
  }

  async createAssignment(input: Record<string, unknown>, actor: string, idempotencyKey: string) {
    if (!this.environment.DISTRIBUTION_ASSIGNMENT_CREATION_ENABLED || this.environment.DISTRIBUTION_EMERGENCY_ASSIGNMENT_STOP) {
      throw new ConflictException("DISTRIBUTION_ASSIGNMENT_CREATION_DISABLED");
    }
    if (!idempotencyKey) throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
    const idempotencyKeyHash = digest(idempotencyKey);
    const existing = await DistributionAssignmentModel.findOne({ idempotencyKeyHash });
    if (existing) return this.assignmentPackage(existing.assignmentId);
    const template = await DistributionTaskTemplateModel.findOne({ templateId: String(input.templateId), status: { $in: ["approved", "active"] } }).lean();
    if (!template) throw new BadRequestException("APPROVED_DISTRIBUTION_TEMPLATE_REQUIRED");
    await this.enforcePilotLimits(template, input);
    const copy = await DistributionCopyVariantModel.findOne({ copyVariantId: String(input.copyVariantId), templateId: template.templateId, status: "approved" }).lean();
    if (!copy) throw new BadRequestException("APPROVED_DISTRIBUTION_COPY_REQUIRED");
    const target = this.allowedTarget(String(input.targetUrl ?? ""));
    if (!this.environment.DISTRIBUTION_TRACKED_LINK_DOMAIN) throw new BadRequestException("TRACKED_LINK_DOMAIN_NOT_CONFIGURED");
    const assignmentId = `das_${randomUUID()}`;
    const externalAssignmentId = String(input.externalAssignmentId ?? `ext_${randomUUID()}`);
    const assignmentToken = randomBytes(this.environment.DISTRIBUTION_ASSIGNMENT_TOKEN_BYTES).toString("base64url");
    const opaqueToken = randomBytes(32).toString("base64url");
    const proofMarker = `MJR-${randomBytes(8).toString("hex").toUpperCase()}`;
    const trackedLinkId = `dtl_${randomUUID()}`;
    const qrAssetId = `dqr_${randomUUID()}`;
    const headerAssetId = `dha_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + this.environment.DISTRIBUTION_ASSIGNMENT_DEFAULT_TTL_MINUTES * 60_000);
    const proofDeadlineAt = new Date(Date.now() + template.proofDeadlineMinutes * 60_000);
    const baseDomain = this.environment.DISTRIBUTION_TRACKED_LINK_DOMAIN.replace(/\/$/, "");
    const trackedUrl = `${baseDomain}/r/${opaqueToken}`;
    const correlationId = String(input.correlationId ?? randomUUID());
    const assets = await this.aiClient.createDistributionAssets({ trackedUrl, proofMarker, headline: copy.headline, cta: copy.cta, disclosure: copy.disclosure, locale: copy.locale, direction: copy.direction, width: Number(input.headerWidth ?? 1200), height: Number(input.headerHeight ?? 630) }, { correlationId, idempotencyKey: `assets-${assignmentId}` });
    const qrBytes = Buffer.from(String(assets.qrPngBase64), "base64");
    const headerBytes = Buffer.from(String(assets.headerPngBase64), "base64");
    const qrObjectKey = `distribution/qr/${assignmentId}/${qrAssetId}.png`;
    const headerObjectKey = `distribution/headers/${assignmentId}/${headerAssetId}.png`;
    await Promise.all([
      this.storage.putBinaryObject({ objectKey: qrObjectKey, body: qrBytes, contentType: "image/png" }),
      this.storage.putBinaryObject({ objectKey: headerObjectKey, body: headerBytes, contentType: "image/png" }),
    ]);
    const assignmentFingerprint = digest(`${input.externalTaskId}|${input.externalUserId}|${template.templateId}|${template.revision}|${copy.copyVariantId}|${copy.revision}`);
    await DistributionAssignmentModel.create({
      assignmentId, externalTaskId: String(input.externalTaskId), externalUserId: String(input.externalUserId), externalAssignmentId,
      templateId: template.templateId, templateRevision: template.revision, copyVariantId: copy.copyVariantId, copyVariantRevision: copy.revision,
      platform: template.platform, audienceType: template.audienceType, country: String(input.country ?? template.countryCodes[0]), language: copy.language, locale: copy.locale, direction: copy.direction,
      expiresAt, proofDeadlineAt, requiredEvidence: { screenshot: template.screenshotRequired, qr: template.qrRequired, proofMarker: template.proofMarkerRequired, postUrl: template.postUrlRequirement },
      trackedLinkId, qrAssetId, headerAssetId, proofMarker, assignmentTokenHash: digest(assignmentToken), assignmentFingerprint, idempotencyKeyHash,
      createdBy: actor, correlationId,
    });
    await Promise.all([
      TrackedLinkModel.create({ trackedLinkId, assignmentId, opaqueTokenHash: digest(opaqueToken), publicUrl: trackedUrl, targetUrl: target.toString(), targetHostname: target.hostname, expiresAt, createdBy: actor, correlationId }),
      QrAssetModel.create({ qrAssetId, assignmentId, objectKey: qrObjectKey, checksum: String(assets.qrSha256), payloadHash: digest(trackedUrl), decodeVerified: assets.qrDecodeVerified === true, width: this.environment.DISTRIBUTION_QR_WIDTH, height: this.environment.DISTRIBUTION_QR_WIDTH, expiresAt, provenance: { renderer: "opencv-local", trackedLinkId }, createdBy: actor, correlationId }),
      DistributionHeaderAssetModel.create({ headerAssetId, assignmentId, objectKey: headerObjectKey, checksum: String(assets.headerSha256), qrDecodeVerified: assets.headerQrDecodeVerified === true, direction: copy.direction, width: Number(assets.width), height: Number(assets.height), expiresAt, provenance: { renderer: "pillow-local", qrAssetId, proofMarker }, createdBy: actor, correlationId }),
    ]);
    return this.assignmentPackage(assignmentId);
  }

  private async enforcePilotLimits(template: Record<string, any>, input: Record<string, unknown>) {
    if (!this.environment.DISTRIBUTION_PILOT_ENABLED) return;
    const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
    const campaignAllowlist = list(this.environment.DISTRIBUTION_PILOT_CAMPAIGN_ALLOWLIST);
    const countries = list(this.environment.DISTRIBUTION_PILOT_ALLOWED_COUNTRIES);
    const languages = list(this.environment.DISTRIBUTION_PILOT_ALLOWED_LANGUAGES);
    const platforms = list(this.environment.DISTRIBUTION_PILOT_ALLOWED_PLATFORMS);
    const country = String(input.country ?? template.countryCodes[0] ?? "");
    const language = String(template.languages[0] ?? "");
    if (campaignAllowlist.length && !campaignAllowlist.includes(String(template.campaignPackageId))) throw new BadRequestException("PILOT_CAMPAIGN_NOT_ALLOWLISTED");
    if (countries.length && !countries.includes(country)) throw new BadRequestException("PILOT_COUNTRY_NOT_ALLOWED");
    if (languages.length && !languages.includes(language)) throw new BadRequestException("PILOT_LANGUAGE_NOT_ALLOWED");
    if (platforms.length && !platforms.includes(String(template.platform))) throw new BadRequestException("PILOT_PLATFORM_NOT_ALLOWED");
    const active = { status: { $in: ["active", "awaiting_proof", "verification_pending", "needs_review"] } };
    const [all, task, user] = await Promise.all([
      DistributionAssignmentModel.countDocuments(active),
      DistributionAssignmentModel.countDocuments({ ...active, externalTaskId: String(input.externalTaskId) }),
      DistributionAssignmentModel.countDocuments({ ...active, externalUserId: String(input.externalUserId) }),
    ]);
    const exceeded = (current: number, maximum: number) => maximum > 0 && current >= maximum;
    if (exceeded(all, this.environment.DISTRIBUTION_PILOT_MAX_ACTIVE_ASSIGNMENTS) ||
        exceeded(task, this.environment.DISTRIBUTION_PILOT_MAX_ASSIGNMENTS_PER_EXTERNAL_TASK) ||
        exceeded(user, this.environment.DISTRIBUTION_PILOT_MAX_ASSIGNMENTS_PER_EXTERNAL_USER)) {
      throw new ConflictException("DISTRIBUTION_PILOT_CAPACITY_REACHED");
    }
  }

  async assignmentPackage(id: string, externalUserId?: string) {
    const assignment = await DistributionAssignmentModel.findOne({
      $or: [{ assignmentId: id }, { externalAssignmentId: id }],
      ...(externalUserId ? { externalUserId } : {}),
    });
    if (!assignment) throw new NotFoundException("DISTRIBUTION_ASSIGNMENT_NOT_FOUND");
    const [template, copy, link, qr, header] = await Promise.all([
      DistributionTaskTemplateModel.findOne({ templateId: assignment.templateId }).lean(),
      DistributionCopyVariantModel.findOne({ copyVariantId: assignment.copyVariantId }).lean(),
      TrackedLinkModel.findOne({ trackedLinkId: assignment.trackedLinkId }).lean(),
      QrAssetModel.findOne({ qrAssetId: assignment.qrAssetId }).lean(),
      DistributionHeaderAssetModel.findOne({ headerAssetId: assignment.headerAssetId }).lean(),
    ]);
    if (!template || !copy || !link || !qr || !header) throw new NotFoundException("DISTRIBUTION_PACKAGE_INCOMPLETE");
    return {
      apiVersion: TASKS_CASH_DISTRIBUTION_API_VERSION,
      externalAssignmentId: assignment.externalAssignmentId, status: assignment.status, platform: assignment.platform,
      targetAudience: assignment.audienceType, communityRules: template.groupMatchingRules, approvedPostText: copy.postText,
      headline: copy.headline, cta: copy.cta, hashtags: copy.hashtags, requiredDisclosure: copy.disclosure,
      uniqueTrackedLink: link.publicUrl,
      proofMarker: assignment.proofMarker,
      qrDownloadUrl: await this.storage.createPresignedReadUrl(qr.objectKey),
      headerDownloadUrl: await this.storage.createPresignedReadUrl(header.objectKey),
      postingInstructions: "Publish manually. Do not alter the tracked link, QR, marker, or disclosure.",
      screenshotRequirements: assignment.requiredEvidence, postUrlRequirement: template.postUrlRequirement,
      proofDeadline: assignment.proofDeadlineAt, assignmentExpiration: assignment.expiresAt,
      rewardEligibilityRecommendation: assignment.rewardEligibilityRecommendation,
    };
  }

  listAssignments() { return DistributionAssignmentModel.find({}).select("-assignmentTokenHash").sort({ createdAt: -1 }).lean(); }
  async cancelAssignment(id: string, externalUserId?: string) {
    const assignment = await DistributionAssignmentModel.findOneAndUpdate({ $or: [{ assignmentId: id }, { externalAssignmentId: id }], ...(externalUserId ? { externalUserId } : {}), status: { $nin: ["verified", "rejected", "cancelled", "expired"] } }, { $set: { status: "cancelled", cancelledAt: new Date(), rewardEligibilityRecommendation: "not_eligible" } }, { new: true }).orFail(() => new ConflictException("DISTRIBUTION_ASSIGNMENT_CANCEL_INVALID"));
    await TrackedLinkModel.updateOne({ trackedLinkId: assignment.trackedLinkId }, { $set: { status: "revoked", revokedAt: new Date() } });
    if (externalUserId) return {
      apiVersion: TASKS_CASH_DISTRIBUTION_API_VERSION,
      externalAssignmentId: assignment.externalAssignmentId,
      status: "cancelled",
      rewardEligibilityRecommendation: assignment.rewardEligibilityRecommendation,
    };
    return publicDocument(assignment);
  }

  async resolveTrackedLink(opaqueToken: string) {
    const tokenHash = digest(opaqueToken);
    const now = Date.now();
    const window = redirectWindows.get(tokenHash);
    if (window && now - window.startedAt < 60_000 && window.count >= 100) {
      throw new BadRequestException("TRACKED_LINK_RATE_LIMITED");
    }
    redirectWindows.set(tokenHash, window && now - window.startedAt < 60_000 ? { ...window, count: window.count + 1 } : { startedAt: now, count: 1 });
    const link = await TrackedLinkModel.findOne({ opaqueTokenHash: tokenHash, status: "active", expiresAt: { $gt: new Date() } }).select("+opaqueTokenHash");
    if (!link) throw new NotFoundException("TRACKED_LINK_INVALID_OR_EXPIRED");
    this.allowedTarget(link.targetUrl);
    await TrackedLinkModel.updateOne({ trackedLinkId: link.trackedLinkId }, { $inc: { clickCount: 1 }, $set: { lastClickedAt: new Date() } });
    return link.targetUrl;
  }
  getTrackedLink(id: string) { return TrackedLinkModel.findOne({ trackedLinkId: id }).lean().orFail(() => new NotFoundException("TRACKED_LINK_NOT_FOUND")); }
  revokeTrackedLink(id: string) { return TrackedLinkModel.findOneAndUpdate({ trackedLinkId: id }, { $set: { status: "revoked", revokedAt: new Date() } }, { new: true }).orFail(() => new NotFoundException("TRACKED_LINK_NOT_FOUND")); }

  async createProofUploadSession(input: Record<string, unknown>, actor: string, idempotencyKey: string) {
    if (!this.environment.DISTRIBUTION_PROOF_PROCESSING_ENABLED || this.environment.DISTRIBUTION_EMERGENCY_PROOF_STOP) {
      throw new ConflictException("DISTRIBUTION_PROOF_PROCESSING_DISABLED");
    }
    const assignment = await DistributionAssignmentModel.findOne({ externalAssignmentId: String(input.externalAssignmentId), externalUserId: String(input.externalUserId), status: { $in: ["active", "awaiting_proof"] }, proofDeadlineAt: { $gt: new Date() } }).lean();
    if (!assignment) throw new BadRequestException("PROOF_ASSIGNMENT_INVALID_OR_EXPIRED");
    const screenshotCount = Number(input.screenshotCount ?? 1);
    if (screenshotCount < 1 || screenshotCount > this.environment.DISTRIBUTION_MAX_SCREENSHOTS) throw new BadRequestException("PROOF_SCREENSHOT_COUNT_INVALID");
    const hash = digest(idempotencyKey);
    const existing = await ProofSubmissionModel.findOne({ idempotencyKeyHash: hash }).lean();
    if (existing) return existing;
    const proofSubmissionId = `dps_${randomUUID()}`;
    const evidence = await Promise.all(Array.from({ length: screenshotCount }, async (_, index) => {
      const objectKey = `distribution/proofs/${assignment.assignmentId}/${proofSubmissionId}/screenshot-${index + 1}`;
      const upload = await this.storage.createPresignedUpload({ objectKey, contentType: "image/png", contentLength: Number(input.contentLength ?? this.environment.DISTRIBUTION_MAX_SCREENSHOT_BYTES) });
      return { evidenceId: `ev_${randomUUID()}`, kind: "screenshot", objectKey, contentType: "image/png", uploadUrl: upload.uploadUrl, uploadExpiresAt: upload.expiresAt };
    }));
    const retentionExpiresAt = new Date(Date.now() + this.environment.DISTRIBUTION_PROOF_RETENTION_DAYS * 86_400_000);
    await ProofSubmissionModel.create({ proofSubmissionId, assignmentId: assignment.assignmentId, externalAssignmentId: assignment.externalAssignmentId, externalUserId: assignment.externalUserId, evidence, evidenceAttempts: [{ revision: 1, evidence: evidence.map((item) => ({ evidenceId: item.evidenceId, kind: item.kind, objectKey: item.objectKey, contentType: item.contentType, uploadExpiresAt: item.uploadExpiresAt })), createdAt: new Date(), actor }], postUrl: input.postUrl, claimedPublicationAt: input.claimedPublicationAt, claimedGroupName: input.claimedGroupName, userNote: input.userNote, idempotencyKeyHash: hash, retentionExpiresAt, createdBy: actor, correlationId: String(input.correlationId ?? randomUUID()) });
    return {
      apiVersion: TASKS_CASH_DISTRIBUTION_API_VERSION,
      proofSubmissionId,
      evidence: evidence.map((item) => ({
        evidenceId: item.evidenceId,
        kind: item.kind,
        contentType: item.contentType,
        uploadUrl: item.uploadUrl,
        uploadExpiresAt: item.uploadExpiresAt,
      })),
      expiresAt: evidence[0]?.uploadExpiresAt,
    };
  }

  async addEvidence(proofSubmissionId: string, input: Record<string, unknown>, actor: string) {
    const proof = await ProofSubmissionModel.findOne({ proofSubmissionId, status: "more_evidence_required" });
    if (!proof) throw new ConflictException("PROOF_ADDITIONAL_EVIDENCE_NOT_REQUESTED");
    const count = Number(input.screenshotCount ?? 1);
    if (count < 1 || count > this.environment.DISTRIBUTION_MAX_SCREENSHOTS) throw new BadRequestException("PROOF_SCREENSHOT_COUNT_INVALID");
    const revision = proof.evidenceRevision + 1;
    const evidence = await Promise.all(Array.from({ length: count }, async (_, index) => {
      const objectKey = `distribution/proofs/${proof.assignmentId}/${proofSubmissionId}/revision-${revision}-${index + 1}`;
      const upload = await this.storage.createPresignedUpload({ objectKey, contentType: "image/png", contentLength: Number(input.contentLength ?? this.environment.DISTRIBUTION_MAX_SCREENSHOT_BYTES) });
      return { evidenceId: `ev_${randomUUID()}`, kind: "screenshot", objectKey, contentType: "image/png", uploadUrl: upload.uploadUrl, uploadExpiresAt: upload.expiresAt, revision };
    }));
    proof.evidenceRevision = revision;
    proof.evidence.push(...evidence);
    proof.evidenceAttempts.push({ revision, evidence: evidence.map((item) => ({ evidenceId: item.evidenceId, kind: item.kind, objectKey: item.objectKey, contentType: item.contentType, uploadExpiresAt: item.uploadExpiresAt, revision: item.revision })), createdAt: new Date(), actor });
    proof.status = "upload_pending";
    await proof.save();
    return { proofSubmissionId, evidenceRevision: revision, evidence: evidence.map((item) => ({ evidenceId: item.evidenceId, kind: item.kind, contentType: item.contentType, uploadUrl: item.uploadUrl, uploadExpiresAt: item.uploadExpiresAt, revision: item.revision })) };
  }

  async completeProof(proofSubmissionId: string, externalUserId: string) {
    const proof = await ProofSubmissionModel.findOne({ proofSubmissionId, externalUserId, status: "upload_pending" });
    if (!proof) throw new BadRequestException("PROOF_SUBMISSION_INVALID");
    for (const evidence of proof.evidence as Array<{ objectKey: string }>) {
      const head = await this.storage.headObject(evidence.objectKey);
      if (!head.exists || !head.contentLength || head.contentLength > this.environment.DISTRIBUTION_MAX_SCREENSHOT_BYTES) throw new BadRequestException("PROOF_EVIDENCE_INVALID");
    }
    proof.status = "queued";
    proof.submittedAt = new Date();
    await proof.save();
    await DistributionAssignmentModel.updateOne({ assignmentId: proof.assignmentId }, { $set: { status: "verification_pending", latestProofSubmissionId: proof.proofSubmissionId } });
    await this.queues.enqueueProof(proof.proofSubmissionId);
    return {
      apiVersion: TASKS_CASH_DISTRIBUTION_API_VERSION,
      proofSubmissionId: proof.proofSubmissionId,
      externalAssignmentId: proof.externalAssignmentId,
      status: proof.status,
      submittedAt: proof.submittedAt,
    };
  }

  getProof(id: string) { return ProofSubmissionModel.findOne({ proofSubmissionId: id }).lean().orFail(() => new NotFoundException("PROOF_SUBMISSION_NOT_FOUND")); }
  async getProofForExternalUser(id: string, externalUserId: string) {
    const proof = await ProofSubmissionModel.findOne({ proofSubmissionId: id, externalUserId })
      .select("proofSubmissionId externalAssignmentId status submittedAt createdAt updatedAt")
      .lean();
    if (!proof) throw new NotFoundException("PROOF_SUBMISSION_NOT_FOUND");
    return {
      apiVersion: TASKS_CASH_DISTRIBUTION_API_VERSION,
      proofSubmissionId: proof.proofSubmissionId,
      externalAssignmentId: proof.externalAssignmentId,
      status: proof.status,
      submittedAt: proof.submittedAt,
      createdAt: proof.createdAt,
      updatedAt: proof.updatedAt,
    };
  }
  listProofs() { return ProofSubmissionModel.find({}).sort({ createdAt: -1 }).lean(); }
  async retryProof(proofSubmissionId: string) {
    const proof = await ProofSubmissionModel.findOne({ proofSubmissionId });
    if (!proof) throw new NotFoundException("PROOF_SUBMISSION_NOT_FOUND");
    proof.status = "queued";
    await proof.save();
    await this.queues.enqueueProof(proofSubmissionId);
    return { proofSubmissionId, status: "queued" };
  }

  async reviewProof(proofSubmissionId: string, input: Record<string, unknown>, actor: string) {
    if (!this.environment.DISTRIBUTION_HUMAN_REVIEW_ENABLED) throw new ConflictException("DISTRIBUTION_HUMAN_REVIEW_DISABLED");
    if (!String(input.reason ?? input.reviewerNote ?? "").trim()) throw new BadRequestException("REVIEW_REASON_REQUIRED");
    const current = await ProofSubmissionModel.findOne({ proofSubmissionId, status: "needs_review" }).lean();
    if (!current) throw new ConflictException("PROOF_NOT_AWAITING_REVIEW");
    const evidenceRevision = Number(input.evidenceRevision ?? current.evidenceRevision);
    if (!Number.isInteger(evidenceRevision) || evidenceRevision !== current.evidenceRevision) {
      throw new ConflictException("PROOF_REVIEW_REVISION_CONFLICT");
    }
    const idempotencyKeyHash = digest(String(input.idempotencyKey ?? `${proofSubmissionId}:${evidenceRevision}:${String(input.decision)}:${actor}`));
    const existingReview = await ProofReviewModel.findOne({ idempotencyKeyHash }).lean();
    if (existingReview) return existingReview;
    const proof = await ProofSubmissionModel.findOneAndUpdate(
      { proofSubmissionId, status: "needs_review", evidenceRevision },
      { $set: { status: "verifying" } },
      { new: true },
    );
    if (!proof) throw new ConflictException("PROOF_REVIEW_CONCURRENT_DECISION");
    const attempt = await ProofVerificationAttemptModel.findOne({ proofSubmissionId }).sort({ attemptNumber: -1 }).lean();
    if (!attempt) {
      await ProofSubmissionModel.updateOne({ proofSubmissionId, status: "verifying" }, { $set: { status: "needs_review" } });
      throw new ConflictException("PROOF_ATTEMPT_MISSING");
    }
    const decision = String(input.decision);
    const reward = decision === "verified" ? "eligible" : decision === "fraudulent" ? "fraud_suspected" : decision === "duplicate" ? "duplicate" : decision === "request_more_evidence" ? "pending_review" : "not_eligible";
    const review = await ProofReviewModel.create({ proofReviewId: `dpr_${randomUUID()}`, proofSubmissionId, verificationAttemptId: attempt.verificationAttemptId, evidenceRevision, idempotencyKeyHash, decision, reasonCodes: input.reasonCodes ?? [], reviewerNote: input.reviewerNote, rewardEligibilityRecommendation: reward, reviewedBy: actor, reviewedAt: new Date(), createdBy: actor, correlationId: proof.correlationId });
    const finalStatus = decision === "verified" ? "verified" : decision === "request_more_evidence" ? "more_evidence_required" : decision === "duplicate" ? "duplicate" : decision === "fraudulent" ? "fraudulent" : "rejected";
    const retentionClass = decision === "verified" ? "accepted" : decision === "duplicate" ? "duplicate" : decision === "fraudulent" ? "fraud" : decision === "request_more_evidence" ? "pending" : "rejected";
    const days = retentionDays(retentionClass === "pending" ? "accepted" : retentionClass, {
      accepted: this.environment.DISTRIBUTION_PROOF_RETENTION_DAYS,
      rejected: this.environment.DISTRIBUTION_REJECTED_PROOF_RETENTION_DAYS,
      duplicate: this.environment.DISTRIBUTION_DUPLICATE_PROOF_RETENTION_DAYS,
      fraud: this.environment.DISTRIBUTION_FRAUD_PROOF_RETENTION_DAYS,
    });
    await Promise.all([
      ProofSubmissionModel.updateOne({ proofSubmissionId }, { $set: { status: finalStatus, retentionClass, retentionExpiresAt: new Date(Date.now() + days * 86_400_000) } }),
      DistributionAssignmentModel.updateOne({ assignmentId: proof.assignmentId }, { $set: { status: finalStatus, latestVerificationDecision: decision, rewardEligibilityRecommendation: reward } }),
    ]);
    const eventDecision = decision === "verified" ? "verified" : decision === "request_more_evidence" ? "needs_review" : "rejected";
    await this.createOutboxEvent(proof, eventDecision, reward, attempt);
    return review;
  }

  async operationalMetrics(filters: Record<string, unknown> = {}) {
    const assignmentFilter: Record<string, unknown> = {};
    for (const key of ["templateId", "platform", "country", "language"]) if (filters[key]) assignmentFilter[key] = filters[key];
    const [assignmentStatuses, proofStatuses, outboxStatuses, queueHealth] = await Promise.all([
      DistributionAssignmentModel.aggregate([{ $match: assignmentFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      ProofSubmissionModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      IntegrationOutboxEventModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      this.queues.getQueueStats(),
    ]);
    const counters = {
      assignments: Object.fromEntries(assignmentStatuses.map((item) => [item._id, item.count])),
      proofs: Object.fromEntries(proofStatuses.map((item) => [item._id, item.count])),
      outbox: Object.fromEntries(outboxStatuses.map((item) => [item._id, item.count])),
    };
    if (this.environment.DISTRIBUTION_HISTORICAL_METRICS_ENABLED) {
      await DistributionOperationalMetricModel.create({ metricId: `dom_${randomUUID()}`, capturedAt: new Date(), ...filters, counters, queueHealth, storageHealth: { privateBucket: this.storage.bucket }, createdBy: "metrics", correlationId: randomUUID() });
    }
    return { counters, queueHealth, callbackEnabled: this.environment.TASKS_CASH_INTEGRATION_ENABLED, autoVerifyEnabled: this.environment.DISTRIBUTION_AUTO_VERIFY_ENABLED };
  }

  async pilotStatus() {
    const metrics = await this.operationalMetrics();
    return {
      enabled: this.environment.DISTRIBUTION_PILOT_ENABLED,
      mandatoryHumanReview: true,
      assignmentStop: this.environment.DISTRIBUTION_EMERGENCY_ASSIGNMENT_STOP,
      proofStop: this.environment.DISTRIBUTION_EMERGENCY_PROOF_STOP,
      outboxStop: this.environment.DISTRIBUTION_EMERGENCY_OUTBOX_STOP,
      tasksCashCallbackEnabled: this.environment.TASKS_CASH_INTEGRATION_ENABLED,
      ...metrics,
    };
  }

  async cleanupExpiredProofs(actor: string) {
    const expired = await ProofSubmissionModel.find({ retentionExpiresAt: { $lte: new Date() }, retentionHold: false, legalHold: false, status: { $nin: ["needs_review", "more_evidence_required", "verifying"] }, cleanupState: { $ne: "metadata_minimized" } });
    let objectsDeleted = 0;
    for (const proof of expired) {
      for (const item of proof.evidence as Array<{ objectKey?: string }>) {
        if (item.objectKey) { await this.storage.deletePrivateObject(item.objectKey); objectsDeleted += 1; }
      }
      proof.evidence = [];
      proof.cleanupState = "metadata_minimized";
      proof.evidenceAttempts = proof.evidenceAttempts.map((attempt: Record<string, unknown>) => ({ ...attempt, evidence: "deleted_by_retention_policy" }));
      await proof.save();
    }
    return { actor, proofsMinimized: expired.length, objectsDeleted };
  }

  async createOutboxEvent(proof: Record<string, any>, decision: string, reward: string, attempt: Record<string, any>) {
    const assignment = await DistributionAssignmentModel.findOne({ assignmentId: proof.assignmentId }).lean();
    if (!assignment) return;
    const eventId = `evt_${randomUUID()}`;
    const verificationConfidence = attempt.scores?.overallVerificationScore ?? 0;
    const reasonCodes = attempt.reasonCodes ?? [];
    const resultChecksum = proofResultChecksum({
      decision,
      reasons: reasonCodes,
      scores: { overallVerificationScore: verificationConfidence },
    });
    const payload = proofVerificationCompletedEventSchema.parse({ eventId, eventVersion: PROOF_VERIFICATION_EVENT_VERSION, eventType: PROOF_VERIFICATION_EVENT_TYPE, occurredAt: new Date().toISOString(), externalTaskId: assignment.externalTaskId, externalUserId: assignment.externalUserId, externalAssignmentId: assignment.externalAssignmentId, proofSubmissionId: proof.proofSubmissionId, verificationDecision: decision, verificationConfidence, rewardEligibilityRecommendation: reward, reasonCodes, resultChecksum, correlationId: proof.correlationId });
    await IntegrationOutboxEventModel.create({ eventId, eventType: "proof.verification.completed", payload, payloadChecksum: digest(JSON.stringify(payload)), nextAttemptAt: new Date(), createdBy: "proof-verification", correlationId: proof.correlationId });
    if (this.environment.TASKS_CASH_INTEGRATION_ENABLED) await this.queues.enqueueOutbox(eventId);
  }
}
