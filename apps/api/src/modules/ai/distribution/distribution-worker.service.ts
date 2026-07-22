/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { loadEnvironment } from "../../../environment.js";
import { AiInternalClientService } from "../ai-internal-client.service.js";
import {
  DistributionAssignmentModel,
  DistributionCopyVariantModel,
  DistributionTaskTemplateModel,
  IntegrationOutboxEventModel,
  ProofSubmissionModel,
  ProofVerificationAttemptModel,
  TrackedLinkModel,
} from "../models/distribution.schema.js";
import { MediaStorageService } from "../media/media-storage.service.js";
import { DistributionQueueService } from "../queue/distribution-queue.service.js";
import { DistributionService } from "./distribution.service.js";
import { signProofCallback } from "./distribution.contracts.js";

@Injectable()
export class DistributionWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly workers: Worker[] = [];
  private reconcileTimer?: ReturnType<typeof setInterval>;
  constructor(
    @Inject(AiInternalClientService) private readonly aiClient: AiInternalClientService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
    @Inject(DistributionQueueService) private readonly queues: DistributionQueueService,
    @Inject(DistributionService) private readonly service: DistributionService,
  ) {}

  onModuleInit() {
    const connection = { url: this.environment.REDIS_URL };
    const contentWorker = new Worker(
      this.environment.AI_DISTRIBUTION_CONTENT_QUEUE_NAME,
      async () => {
        await Promise.resolve();
        return { status: "content-ready-for-human-review" };
      },
      { connection, concurrency: 1 },
    );
    const proofWorker = new Worker(
      this.environment.AI_PROOF_VERIFICATION_QUEUE_NAME,
      (job) => this.verifyProof(job),
      { connection, concurrency: this.environment.AI_PROOF_WORKER_CONCURRENCY },
    );
    proofWorker.on("failed", (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) void this.queues.moveProofToDeadLetter(String(job.data.proofSubmissionId), error.message.slice(0, 200));
    });
    const outboxWorker = new Worker(
      this.environment.TASKS_CASH_OUTBOX_QUEUE_NAME,
      (job) => this.deliverOutbox(job),
      { connection, concurrency: 1 },
    );
    this.workers.push(contentWorker, proofWorker, outboxWorker);
    this.reconcileTimer = setInterval(() => void this.reconcileStaleProofs(), 60_000);
    this.reconcileTimer.unref();
  }

  private async reconcileStaleProofs() {
    const staleBefore = new Date(Date.now() - this.environment.AI_PROOF_STALE_SECONDS * 1_000);
    const stale = await ProofSubmissionModel.find({ status: "verifying", updatedAt: { $lt: staleBefore } }).select("proofSubmissionId").lean();
    for (const proof of stale) {
      await ProofSubmissionModel.updateOne({ proofSubmissionId: proof.proofSubmissionId, status: "verifying" }, { $set: { status: "queued" } });
      await this.queues.enqueueProof(proof.proofSubmissionId);
    }
  }

  private async verifyProof(job: Job<{ proofSubmissionId: string }>) {
    const proof = await ProofSubmissionModel.findOneAndUpdate(
      { proofSubmissionId: job.data.proofSubmissionId, status: { $in: ["queued", "submitted"] } },
      { $set: { status: "verifying" } }, { new: true },
    );
    if (!proof) return;
    const [assignment, template] = await Promise.all([
      DistributionAssignmentModel.findOne({ assignmentId: proof.assignmentId }).lean(),
      DistributionAssignmentModel.findOne({ assignmentId: proof.assignmentId }).lean().then((value) => value ? DistributionTaskTemplateModel.findOne({ templateId: value.templateId }).lean() : null),
    ]);
    if (!assignment || !template) throw new Error("PROOF_ASSIGNMENT_CONTEXT_MISSING");
    const [copy, link, knownAttempts] = await Promise.all([
      DistributionCopyVariantModel.findOne({ copyVariantId: assignment.copyVariantId }).lean(),
      TrackedLinkModel.findOne({ trackedLinkId: assignment.trackedLinkId }).lean(),
      ProofVerificationAttemptModel.find({ assignmentId: { $ne: assignment.assignmentId } }).select("extractedEvidence").lean(),
    ]);
    if (!copy || !link) throw new Error("PROOF_ASSIGNMENT_CONTEXT_MISSING");
    const screenshots = await Promise.all((proof.evidence as Array<{ objectKey: string }>).map(async (item) => {
      const content = await this.storage.getBinaryObject(item.objectKey);
      return { screenshotBase64: content.toString("base64") };
    }));
    const knownChecksums = knownAttempts.flatMap((attempt) => ((attempt.extractedEvidence as { checksums?: string[] })?.checksums ?? []));
    const knownPerceptualHashes = knownAttempts.flatMap((attempt) => ((attempt.extractedEvidence as { perceptualHashes?: string[] })?.perceptualHashes ?? []));
    const result = await this.aiClient.verifyDistributionProof({
      assignmentId: assignment.assignmentId,
      trackedUrl: link.publicUrl,
      proofMarker: assignment.proofMarker,
      approvedPostText: copy.postText,
      requiredDisclosure: copy.disclosure,
      expectedGroups: template.approvedGroups,
      profession: template.profession,
      platform: template.platform,
      privateGroup: template.requiresHumanReview,
      submittedBeforeDeadline: Boolean(proof.submittedAt && proof.submittedAt <= assignment.proofDeadlineAt),
      screenshotEvidence: screenshots,
      knownChecksums,
      knownPerceptualHashes,
    }, { correlationId: proof.correlationId, idempotencyKey: `proof-attempt:${proof.proofSubmissionId}:${job.attemptsMade + 1}` });
    const attemptNumber = await ProofVerificationAttemptModel.countDocuments({ proofSubmissionId: proof.proofSubmissionId }) + 1;
    const attempt = await ProofVerificationAttemptModel.create({
      verificationAttemptId: `dva_${randomUUID()}`, proofSubmissionId: proof.proofSubmissionId, assignmentId: assignment.assignmentId,
      attemptNumber, decision: result.decision, scores: result.scores, mandatoryChecks: result.mandatoryChecks,
      reasonCodes: result.reasonCodes, duplicateMatches: result.duplicateMatches, manipulationIndicators: result.manipulationIndicators,
      extractedEvidence: result.extractedEvidence, resultChecksum: result.resultChecksum, durationMs: result.durationMs,
      createdBy: "proof-worker", correlationId: proof.correlationId,
    });
    const decision = String(result.decision);
    const status = decision === "verified" ? "verified" : decision === "rejected" ? "rejected" : "needs_review";
    const reward = decision === "verified" ? "eligible" : (result.reasonCodes as string[]).includes("EXACT_PROOF_REUSED") ? "duplicate" : decision === "rejected" ? "not_eligible" : "pending_review";
    await Promise.all([
      ProofSubmissionModel.updateOne({ proofSubmissionId: proof.proofSubmissionId }, { $set: { status } }),
      DistributionAssignmentModel.updateOne({ assignmentId: assignment.assignmentId }, { $set: { status, latestVerificationDecision: decision, rewardEligibilityRecommendation: reward } }),
    ]);
    if (decision !== "needs_review") await this.service.createOutboxEvent(proof.toObject(), decision, reward, attempt.toObject());
  }

  private async deliverOutbox(job: Job<{ eventId: string }>) {
    if (!this.environment.TASKS_CASH_INTEGRATION_ENABLED) return;
    const event = await IntegrationOutboxEventModel.findOneAndUpdate({ eventId: job.data.eventId, status: { $in: ["pending", "retry_scheduled"] } }, { $set: { status: "delivering", lastAttemptAt: new Date() }, $inc: { deliveryAttempts: 1 } }, { new: true });
    if (!event) return;
    const body = JSON.stringify(event.payload);
    const timestamp = Date.now().toString();
    const signature = signProofCallback(this.environment.TASKS_CASH_HMAC_SECRET, Number(timestamp), body);
    try {
      const response = await fetch(this.environment.TASKS_CASH_CALLBACK_URL, { method: "POST", headers: { "content-type": "application/json", "x-miraaj-event-id": event.eventId, "x-miraaj-timestamp": timestamp, "x-miraaj-signature": signature }, body, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`CALLBACK_HTTP_${response.status}`);
      await IntegrationOutboxEventModel.updateOne({ eventId: event.eventId }, { $set: { status: "delivered", deliveredAt: new Date() }, $unset: { safeError: 1, nextAttemptAt: 1 } });
    } catch (error) {
      const terminal = event.deliveryAttempts >= this.environment.TASKS_CASH_CALLBACK_MAX_RETRIES;
      await IntegrationOutboxEventModel.updateOne({ eventId: event.eventId }, { $set: { status: terminal ? "dead_letter" : "retry_scheduled", safeError: error instanceof Error ? error.message.slice(0, 200) : "CALLBACK_FAILED", nextAttemptAt: new Date(Date.now() + Math.min(3_600_000, 5_000 * 2 ** event.deliveryAttempts)) } });
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    await Promise.allSettled(this.workers.map((worker) => worker.close()));
  }
}
