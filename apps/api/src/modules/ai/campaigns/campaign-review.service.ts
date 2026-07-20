import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import type { CampaignReviewReasonCode, CampaignReviewStatus } from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { AuditEventService } from "../audit/audit-event.service.js";
import { CampaignQueueService } from "../queue/campaign-queue.service.js";
import {
  CampaignFeedbackModel,
  CampaignJobModel,
  CampaignPackageModel,
  CampaignReviewModel,
  type CampaignPackageDocument,
} from "../models/campaign.schema.js";

const TERMINAL_PACKAGE_STATUSES = new Set(["approved", "rejected", "superseded"]);

export interface CampaignPackageReviewInput {
  campaignPackageId: string;
  reviewerId: string;
  status: CampaignReviewStatus;
  notes?: string | undefined;
  corrections?: Record<string, unknown> | undefined;
  regenerationInstructions?: string | undefined;
}

/**
 * Human review decisions for campaign packages. Payment-service and
 * regulated-domain packages always start `awaiting_review` and can only
 * move forward through an explicit, permission-gated administrator action
 * here — never silently, and never by the AI provider.
 */
@Injectable()
export class CampaignReviewService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  constructor(
    @Inject(AuditEventService)
    private readonly auditEvents: AuditEventService,
    @Inject(CampaignQueueService)
    private readonly campaignQueue: CampaignQueueService,
  ) {}

  async listPackages(input?: {
    status?: string | undefined;
    language?: string | undefined;
    platform?: string | undefined;
    objective?: string | undefined;
    requiresReview?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }) {
    const limit = Math.min(input?.limit ?? 25, 100);
    const offset = input?.offset ?? 0;
    const filter: Record<string, unknown> = {};
    if (input?.status) {
      filter.status = input.status;
    }
    if (input?.language) {
      filter.targetLanguages = input.language;
    }
    if (input?.platform) {
      filter.selectedPlatforms = input.platform;
    }
    if (input?.objective) {
      filter.objective = input.objective;
    }
    if (input?.requiresReview === "true") {
      filter.requiresReview = true;
    }
    if (input?.requiresReview === "false") {
      filter.requiresReview = false;
    }
    const [items, total] = await Promise.all([
      CampaignPackageModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      CampaignPackageModel.countDocuments(filter),
    ]);
    return { items, total, limit, offset };
  }

  async getPackage(campaignPackageId: string): Promise<CampaignPackageDocument> {
    const pkg = await CampaignPackageModel.findOne({ campaignPackageId }).lean();
    if (!pkg) {
      throw new NotFoundException({
        code: "CAMPAIGN_PACKAGE_NOT_FOUND",
        message: "Campaign package was not found.",
      });
    }
    return pkg;
  }

  async review(input: CampaignPackageReviewInput): Promise<CampaignPackageDocument> {
    const pkg = await CampaignPackageModel.findOne({
      campaignPackageId: input.campaignPackageId,
    });
    if (!pkg) {
      throw new NotFoundException({
        code: "CAMPAIGN_PACKAGE_NOT_FOUND",
        message: "Campaign package was not found.",
      });
    }
    if (TERMINAL_PACKAGE_STATUSES.has(pkg.status)) {
      throw new BadRequestException({
        code: "CAMPAIGN_REVISION_CONFLICT",
        message: "Campaign package review is already finalized.",
      });
    }
    if (input.status === "corrected" && !input.corrections) {
      throw new BadRequestException({
        code: "CAMPAIGN_REVISION_CONFLICT",
        message: "A corrections payload is required to mark a package as corrected.",
      });
    }

    const previousRevision = pkg.currentRevision;
    let newRevision = previousRevision;

    pkg.reviewStatus = input.status;
    pkg.reviewerId = input.reviewerId;
    switch (input.status) {
      case "approved":
        pkg.status = "approved";
        pkg.approvedBy = input.reviewerId;
        pkg.approvedAt = new Date();
        break;
      case "rejected":
        pkg.status = "rejected";
        pkg.rejectedAt = new Date();
        break;
      case "corrected": {
        newRevision = previousRevision + 1;
        pkg.currentRevision = newRevision;
        pkg.status = "corrected";
        if (input.corrections) {
          const allowed = [
            "masterMessageFramework",
            "platformVariants",
            "languageVariants",
            "imageCreativeBriefs",
            "videoCreativeBriefs",
            "requiredDisclosures",
            "warnings",
          ] as const;
          for (const key of allowed) {
            if (key in input.corrections) {
              (pkg as unknown as Record<string, unknown>)[key] = input.corrections[key];
            }
          }
        }
        break;
      }
      case "needs_regeneration":
        pkg.status = "awaiting_review";
        pkg.reviewStatus = "needs_regeneration";
        break;
      default:
        pkg.status = "awaiting_review";
        break;
    }
    await pkg.save();

    await CampaignReviewModel.create({
      reviewId: randomUUID(),
      campaignPackageId: pkg.campaignPackageId,
      campaignRevision: newRevision,
      campaignBriefId: pkg.campaignBriefId,
      reviewerId: input.reviewerId,
      status: input.status,
      reasonCodes: pkg.reviewReasonCodes ?? [],
      corrections: input.corrections ?? {},
      ...(input.regenerationInstructions
        ? { regenerationInstructions: input.regenerationInstructions }
        : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      previousRevision,
      newRevision,
      reviewedAt: new Date(),
    });

    if (input.notes || input.corrections) {
      await CampaignFeedbackModel.create({
        feedbackId: randomUUID(),
        campaignPackageId: pkg.campaignPackageId,
        category:
          input.status === "corrected"
            ? "message_correction"
            : input.status === "approved"
              ? "campaign_approved"
              : input.status === "rejected"
                ? "campaign_rejected"
                : "package_review",
        originalValue: { revision: previousRevision },
        correctedValue: input.corrections ?? null,
        reason: input.notes ?? null,
        reviewerId: input.reviewerId,
      });
    }

    await CampaignJobModel.updateOne(
      { campaignJobId: pkg.campaignJobId },
      {
        status:
          input.status === "approved"
            ? "completed"
            : input.status === "rejected"
              ? "failed"
              : "awaiting_review",
        currentStage:
          input.status === "approved"
            ? "completed"
            : input.status === "rejected"
              ? "failed"
              : "awaiting_review",
        completedAt: input.status === "approved" ? new Date() : undefined,
        failedAt: input.status === "rejected" ? new Date() : undefined,
      },
    );

    this.logger.info(
      {
        event: `ai.campaign.package.${input.status}`,
        campaignPackageId: pkg.campaignPackageId,
        reviewerId: input.reviewerId,
        previousRevision,
        newRevision,
      },
      "Campaign package review updated",
    );

    await this.auditEvents.record(
      {
        actorId: input.reviewerId,
        action:
          input.status === "approved"
            ? "campaign.package.approved"
            : input.status === "rejected"
              ? "campaign.package.rejected"
              : input.status === "corrected"
                ? "campaign.package.corrected"
                : "campaign.package.reviewed",
        targetType: "campaign_package",
        targetId: pkg.campaignPackageId,
        previousRevision,
        newRevision,
        ...(input.notes ? { reason: input.notes } : {}),
        correlationId: pkg.correlationId ?? randomUUID(),
        requestId: randomUUID(),
        outcome: input.status === "rejected" ? "failure" : "success",
      },
      { failClosed: input.status === "approved" },
    );

    return pkg.toObject();
  }

  /**
   * Supersede the current package revision and re-enqueue the parent campaign
   * job so a new immutable attempt/package can be generated.
   */
  async regeneratePackage(input: {
    campaignPackageId: string;
    reviewerId: string;
    regenerationInstructions?: string;
  }) {
    const pkg = await CampaignPackageModel.findOne({
      campaignPackageId: input.campaignPackageId,
    });
    if (!pkg) {
      throw new NotFoundException({
        code: "CAMPAIGN_PACKAGE_NOT_FOUND",
        message: "Campaign package was not found.",
      });
    }
    if (pkg.status === "superseded") {
      throw new BadRequestException({
        code: "CAMPAIGN_REVISION_CONFLICT",
        message: "Campaign package is already superseded.",
      });
    }

    const previousRevision = pkg.currentRevision;
    pkg.status = "superseded";
    pkg.supersededAt = new Date();
    pkg.reviewStatus = "needs_regeneration";
    pkg.reviewerId = input.reviewerId;
    await pkg.save();

    await CampaignReviewModel.create({
      reviewId: randomUUID(),
      campaignPackageId: pkg.campaignPackageId,
      campaignRevision: previousRevision,
      campaignBriefId: pkg.campaignBriefId,
      reviewerId: input.reviewerId,
      status: "needs_regeneration",
      reasonCodes: ["manual_review_requested"],
      ...(input.regenerationInstructions
        ? { regenerationInstructions: input.regenerationInstructions }
        : {}),
      previousRevision,
      newRevision: previousRevision + 1,
      reviewedAt: new Date(),
    });

    await CampaignFeedbackModel.create({
      feedbackId: randomUUID(),
      campaignPackageId: pkg.campaignPackageId,
      category: "package_review",
      originalValue: { revision: previousRevision },
      correctedValue: null,
      reason: input.regenerationInstructions ?? "regeneration_requested",
      reviewerId: input.reviewerId,
    });

    const job = await CampaignJobModel.findOne({ campaignJobId: pkg.campaignJobId });
    if (!job) {
      throw new NotFoundException({
        code: "CAMPAIGN_JOB_NOT_RETRYABLE",
        message: "Parent campaign job was not found for regeneration.",
      });
    }

    job.status = "queued";
    job.currentStage = "queued";
    job.campaignPackageId = null;
    job.errorCode = null;
    job.safeError = null;
    job.queuedAt = new Date();
    job.requiresReview = true;
    job.reviewReasonCodes = Array.from(
      new Set<CampaignReviewReasonCode>([
        ...(job.reviewReasonCodes ?? []),
        "manual_review_requested",
      ]),
    );
    const bullJob = await this.campaignQueue.enqueueBuildCampaign(
      {
        campaignJobId: job.campaignJobId,
        recommendationSetId: job.recommendationSetId,
      },
      { uniqueJobId: true },
    );
    job.bullJobId = String(bullJob.id);
    await job.save();

    this.logger.info(
      {
        event: "ai.campaign.regeneration.requested",
        campaignPackageId: pkg.campaignPackageId,
        campaignJobId: job.campaignJobId,
        previousRevision,
      },
      "Campaign package regeneration enqueued",
    );

    await this.auditEvents.record({
      actorId: input.reviewerId,
      action: "campaign.package.reviewed",
      targetType: "campaign_package",
      targetId: pkg.campaignPackageId,
      previousRevision,
      newRevision: previousRevision + 1,
      reason: "regeneration_requested",
      correlationId: pkg.correlationId ?? randomUUID(),
      requestId: randomUUID(),
      outcome: "success",
    });

    return {
      campaignPackageId: pkg.campaignPackageId,
      status: "superseded",
      campaignJobId: job.campaignJobId,
      jobStatus: job.status,
      previousRevision,
      queued: true,
    };
  }
}
