import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import type { CampaignReviewStatus } from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { AuditEventService } from "../audit/audit-event.service.js";
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
  ) {}

  async listPackages(input?: {
    status?: string | undefined;
    language?: string | undefined;
    platform?: string | undefined;
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
      case "corrected":
        pkg.status = "corrected";
        break;
      default:
        pkg.status = "awaiting_review";
        break;
    }
    await pkg.save();

    await CampaignReviewModel.create({
      reviewId: randomUUID(),
      campaignPackageId: pkg.campaignPackageId,
      campaignRevision: pkg.currentRevision,
      campaignBriefId: pkg.campaignBriefId,
      reviewerId: input.reviewerId,
      status: input.status,
      reasonCodes: pkg.reviewReasonCodes ?? [],
      corrections: input.corrections ?? {},
      ...(input.regenerationInstructions
        ? { regenerationInstructions: input.regenerationInstructions }
        : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      previousRevision: pkg.currentRevision,
      reviewedAt: new Date(),
    });

    if (input.notes || input.corrections) {
      await CampaignFeedbackModel.create({
        feedbackId: randomUUID(),
        campaignPackageId: pkg.campaignPackageId,
        category: "package_review",
        originalValue: null,
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
        previousRevision: pkg.currentRevision,
        newRevision: pkg.currentRevision,
        ...(input.notes ? { reason: input.notes } : {}),
        correlationId: pkg.correlationId ?? randomUUID(),
        requestId: randomUUID(),
        outcome: input.status === "rejected" ? "failure" : "success",
      },
      { failClosed: input.status === "approved" },
    );

    return pkg.toObject();
  }
}
