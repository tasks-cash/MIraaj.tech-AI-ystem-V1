import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import type {
  CreativeReviewReasonCode,
  CreativeReviewStatus,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { AuditEventService } from "../audit/audit-event.service.js";
import { CreativeQueueService } from "../queue/creative-queue.service.js";
import {
  AssetRightsRecordModel,
  CreativeAssetFeedbackModel,
  CreativeAssetModel,
  CreativeAssetReviewModel,
  CreativeGenerationJobModel,
  type CreativeAssetDocument,
} from "../models/creative.schema.js";

const TERMINAL_ASSET_STATUSES = new Set([
  "approved",
  "rejected",
  "superseded",
  "quarantined",
]);

export interface CreativeAssetReviewInput {
  assetId: string;
  reviewerId: string;
  status: CreativeReviewStatus;
  notes?: string | undefined;
  corrections?: Record<string, unknown> | undefined;
  regenerationInstructions?: string | undefined;
}

/**
 * Human review for creative assets. Unknown/prohibited rights always block
 * approval. Auto-approve remains disabled for Prompt 5.
 */
@Injectable()
export class CreativeReviewService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  constructor(
    @Inject(AuditEventService)
    private readonly auditEvents: AuditEventService,
    @Inject(CreativeQueueService)
    private readonly creativeQueue: CreativeQueueService,
  ) {}

  async listAssets(input?: {
    status?: string | undefined;
    campaignPackageId?: string | undefined;
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
    if (input?.campaignPackageId) {
      filter.campaignPackageId = input.campaignPackageId;
    }
    if (input?.requiresReview === "true") {
      filter.requiresReview = true;
    }
    if (input?.requiresReview === "false") {
      filter.requiresReview = false;
    }
    const [items, total] = await Promise.all([
      CreativeAssetModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      CreativeAssetModel.countDocuments(filter),
    ]);
    return { items, total, limit, offset };
  }

  async getAsset(assetId: string): Promise<CreativeAssetDocument> {
    const asset = await CreativeAssetModel.findOne({ assetId }).lean();
    if (!asset) {
      throw new NotFoundException({
        code: "CREATIVE_ASSET_NOT_FOUND",
        message: "Creative asset was not found.",
      });
    }
    return asset;
  }

  async review(input: CreativeAssetReviewInput): Promise<CreativeAssetDocument> {
    const asset = await CreativeAssetModel.findOne({ assetId: input.assetId });
    if (!asset) {
      throw new NotFoundException({
        code: "CREATIVE_ASSET_NOT_FOUND",
        message: "Creative asset was not found.",
      });
    }
    if (TERMINAL_ASSET_STATUSES.has(asset.status)) {
      throw new BadRequestException({
        code: "CREATIVE_REVISION_CONFLICT",
        message: "Creative asset review is already finalized.",
      });
    }

    if (input.status === "approved") {
      await this.assertRightsAllowApproval(asset.rightsRecordId);
    }
    if (input.status === "corrected" && !input.corrections) {
      throw new BadRequestException({
        code: "CREATIVE_REVISION_CONFLICT",
        message: "A corrections payload is required to mark an asset as corrected.",
      });
    }

    // Prompt 5: auto-approve is never honored even if misconfigured.
    if (this.environment.CREATIVE_AUTO_APPROVE_ENABLED) {
      throw new BadRequestException({
        code: "CREATIVE_REVIEW_REQUIRED",
        message: "CREATIVE_AUTO_APPROVE_ENABLED must remain false.",
      });
    }

    const previousRevision = asset.currentRevision;
    let newRevision = previousRevision;

    asset.reviewStatus = input.status;
    asset.reviewerId = input.reviewerId;
    switch (input.status) {
      case "approved":
        asset.status = "approved";
        asset.approvedBy = input.reviewerId;
        asset.approvedAt = new Date();
        break;
      case "rejected":
        asset.status = "rejected";
        asset.rejectedAt = new Date();
        break;
      case "corrected": {
        newRevision = previousRevision + 1;
        asset.currentRevision = newRevision;
        asset.status = "corrected";
        if (input.corrections) {
          const allowed = [
            "textOverlay",
            "expectedText",
            "disclosureText",
            "altText",
            "warnings",
          ] as const;
          for (const key of allowed) {
            if (key in input.corrections) {
              (asset as unknown as Record<string, unknown>)[key] =
                input.corrections[key];
            }
          }
        }
        break;
      }
      case "needs_regeneration":
        asset.status = "awaiting_review";
        asset.reviewStatus = "needs_regeneration";
        break;
      default:
        asset.status = "awaiting_review";
        break;
    }
    await asset.save();

    await CreativeAssetReviewModel.create({
      reviewId: randomUUID(),
      assetId: asset.assetId,
      assetRevision: newRevision,
      creativeJobId: asset.creativeJobId,
      reviewerId: input.reviewerId,
      status: input.status,
      reasonCodes: asset.reviewReasonCodes ?? [],
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
      await CreativeAssetFeedbackModel.create({
        feedbackId: randomUUID(),
        assetId: asset.assetId,
        category:
          input.status === "corrected"
            ? "concept_correction"
            : input.status === "approved"
              ? "asset_approved"
              : input.status === "rejected"
                ? "asset_rejected"
                : "quality_correction",
        originalValue: { revision: previousRevision },
        correctedValue: input.corrections ?? null,
        reason: input.notes ?? null,
        reviewerId: input.reviewerId,
      });
    }

    await this.auditEvents.record(
      {
        actorId: input.reviewerId,
        action:
          input.status === "approved"
            ? "creative.asset.approved"
            : input.status === "rejected"
              ? "creative.asset.rejected"
              : input.status === "corrected"
                ? "creative.asset.corrected"
                : "creative.asset.reviewed",
        targetType: "creative_asset",
        targetId: asset.assetId,
        previousRevision,
        newRevision,
        ...(input.notes ? { reason: input.notes } : {}),
        correlationId: asset.correlationId ?? randomUUID(),
        requestId: randomUUID(),
        outcome: input.status === "rejected" ? "failure" : "success",
      },
      { failClosed: input.status === "approved" },
    );

    this.logger.info(
      {
        event: `ai.creative.asset.${input.status}`,
        assetId: asset.assetId,
        reviewerId: input.reviewerId,
        previousRevision,
        newRevision,
      },
      "Creative asset review updated",
    );

    return asset.toObject();
  }

  /**
   * Supersede the asset and re-enqueue the parent creative job with a unique
   * BullMQ job id so a new immutable attempt can be generated.
   */
  async regenerateAsset(input: {
    assetId: string;
    reviewerId: string;
    regenerationInstructions?: string;
  }) {
    const asset = await CreativeAssetModel.findOne({ assetId: input.assetId });
    if (!asset) {
      throw new NotFoundException({
        code: "CREATIVE_ASSET_NOT_FOUND",
        message: "Creative asset was not found.",
      });
    }
    if (asset.status === "superseded") {
      throw new BadRequestException({
        code: "CREATIVE_REVISION_CONFLICT",
        message: "Creative asset is already superseded.",
      });
    }

    const previousRevision = asset.currentRevision;
    asset.status = "superseded";
    asset.supersededAt = new Date();
    asset.reviewStatus = "needs_regeneration";
    asset.reviewerId = input.reviewerId;
    await asset.save();

    await CreativeAssetReviewModel.create({
      reviewId: randomUUID(),
      assetId: asset.assetId,
      assetRevision: previousRevision,
      creativeJobId: asset.creativeJobId,
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

    await CreativeAssetFeedbackModel.create({
      feedbackId: randomUUID(),
      assetId: asset.assetId,
      category: "concept_correction",
      originalValue: { revision: previousRevision },
      correctedValue: null,
      reason: input.regenerationInstructions ?? "regeneration_requested",
      reviewerId: input.reviewerId,
    });

    const job = await CreativeGenerationJobModel.findOne({
      creativeJobId: asset.creativeJobId,
    });
    if (!job) {
      throw new NotFoundException({
        code: "CREATIVE_JOB_NOT_RETRYABLE",
        message: "Parent creative job was not found for regeneration.",
      });
    }

    job.status = "queued";
    job.currentStage = "queued";
    job.errorCode = null;
    job.safeError = null;
    job.queuedAt = new Date();
    job.requiresReview = true;
    job.forceRegeneration = true;
    job.reviewReasonCodes = Array.from(
      new Set<CreativeReviewReasonCode>([
        ...(job.reviewReasonCodes ?? []),
        "manual_review_requested",
      ]),
    );
    const bullJob = await this.creativeQueue.enqueueBuildCreativeJob(
      {
        creativeJobId: job.creativeJobId,
        campaignPackageId: job.campaignPackageId,
      },
      { uniqueJobId: true },
    );
    job.bullJobId = String(bullJob.id);
    await job.save();

    this.logger.info(
      {
        event: "ai.creative.regeneration.requested",
        assetId: asset.assetId,
        creativeJobId: job.creativeJobId,
        previousRevision,
      },
      "Creative asset regeneration enqueued",
    );

    await this.auditEvents.record({
      actorId: input.reviewerId,
      action: "creative.asset.reviewed",
      targetType: "creative_asset",
      targetId: asset.assetId,
      previousRevision,
      newRevision: previousRevision + 1,
      reason: "regeneration_requested",
      correlationId: asset.correlationId ?? randomUUID(),
      requestId: randomUUID(),
      outcome: "success",
    });

    return {
      assetId: asset.assetId,
      status: "superseded",
      creativeJobId: job.creativeJobId,
      jobStatus: job.status,
      previousRevision,
      queued: true,
    };
  }

  private async assertRightsAllowApproval(
    rightsRecordId: string | null | undefined,
  ): Promise<void> {
    if (!rightsRecordId) {
      throw new BadRequestException({
        code: "CREATIVE_RIGHTS_UNKNOWN",
        message: "Creative asset cannot be approved without a rights record.",
      });
    }
    const rights = await AssetRightsRecordModel.findOne({ rightsRecordId }).lean();
    if (!rights) {
      throw new BadRequestException({
        code: "CREATIVE_RIGHTS_UNKNOWN",
        message: "Creative asset rights record was not found.",
      });
    }
    if (rights.status === "unknown") {
      throw new BadRequestException({
        code: "CREATIVE_RIGHTS_UNKNOWN",
        message: "Creative asset cannot be approved while rights are unknown.",
      });
    }
    if (rights.status === "prohibited" || rights.status === "restricted") {
      throw new BadRequestException({
        code:
          rights.status === "prohibited"
            ? "CREATIVE_COPYRIGHT_RISK"
            : "CREATIVE_RIGHTS_RESTRICTED",
        message: `Creative asset cannot be approved while rights are ${rights.status}.`,
      });
    }
  }
}
