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
  transitionTemplate(templateId: string, status: "approved" | "paused" | "archived", actor: string) {
    const allowed = status === "approved" ? ["draft", "awaiting_review"] : status === "paused" ? ["approved"] : ["draft", "awaiting_review", "approved", "paused", "rejected"];
    return DistributionTaskTemplateModel.findOneAndUpdate(
      { templateId, status: { $in: allowed } },
      { $set: { status, ...(status === "approved" ? { approvedBy: actor, approvedAt: new Date() } : {}), ...(status === "archived" ? { archivedAt: new Date() } : {}) } },
      { new: true },
    ).orFail(() => new ConflictException("DISTRIBUTION_TEMPLATE_TRANSITION_INVALID"));
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
    if (!idempotencyKey) throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
    const idempotencyKeyHash = digest(idempotencyKey);
    const existing = await DistributionAssignmentModel.findOne({ idempotencyKeyHash });
    if (existing) return this.assignmentPackage(existing.assignmentId);
    const template = await DistributionTaskTemplateModel.findOne({ templateId: String(input.templateId), status: "approved" }).lean();
    if (!template) throw new BadRequestException("APPROVED_DISTRIBUTION_TEMPLATE_REQUIRED");
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
    await ProofSubmissionModel.create({ proofSubmissionId, assignmentId: assignment.assignmentId, externalAssignmentId: assignment.externalAssignmentId, externalUserId: assignment.externalUserId, evidence, postUrl: input.postUrl, claimedPublicationAt: input.claimedPublicationAt, claimedGroupName: input.claimedGroupName, userNote: input.userNote, idempotencyKeyHash: hash, retentionExpiresAt, createdBy: actor, correlationId: String(input.correlationId ?? randomUUID()) });
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
    const proof = await ProofSubmissionModel.findOne({ proofSubmissionId, status: "needs_review" });
    if (!proof) throw new ConflictException("PROOF_NOT_AWAITING_REVIEW");
    const attempt = await ProofVerificationAttemptModel.findOne({ proofSubmissionId }).sort({ attemptNumber: -1 }).lean();
    if (!attempt) throw new ConflictException("PROOF_ATTEMPT_MISSING");
    const decision = String(input.decision);
    const reward = decision === "verified" ? "eligible" : decision === "fraudulent" ? "fraud_suspected" : decision === "request_more_evidence" ? "pending_review" : "not_eligible";
    const review = await ProofReviewModel.create({ proofReviewId: `dpr_${randomUUID()}`, proofSubmissionId, verificationAttemptId: attempt.verificationAttemptId, decision, reasonCodes: input.reasonCodes ?? [], reviewerNote: input.reviewerNote, rewardEligibilityRecommendation: reward, reviewedBy: actor, reviewedAt: new Date(), createdBy: actor, correlationId: proof.correlationId });
    const finalStatus = decision === "verified" ? "verified" : decision === "request_more_evidence" ? "awaiting_proof" : "rejected";
    await Promise.all([
      ProofSubmissionModel.updateOne({ proofSubmissionId }, { $set: { status: finalStatus === "awaiting_proof" ? "submitted" : finalStatus } }),
      DistributionAssignmentModel.updateOne({ assignmentId: proof.assignmentId }, { $set: { status: finalStatus, latestVerificationDecision: decision, rewardEligibilityRecommendation: reward } }),
    ]);
    const eventDecision = decision === "verified" ? "verified" : decision === "request_more_evidence" ? "needs_review" : "rejected";
    await this.createOutboxEvent(proof, eventDecision, reward, attempt);
    return review;
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
