import { BadRequestException, Injectable } from "@nestjs/common";
import { loadEnvironment } from "../../../environment.js";
import {
  CreativeGenerationAttemptModel,
  CreativeGenerationJobModel,
} from "../models/creative.schema.js";

const ACTIVE_JOB_STATUSES = [
  "active",
  "generating",
  "provider_pending",
  "retrieving",
] as const;

/**
 * Concurrency and cost budget gates for live creative providers.
 * Never fabricates prices — unknown costs are tracked but not invented.
 */
@Injectable()
export class CreativeBudgetService {
  private readonly environment = loadEnvironment();

  async countActiveImageJobs(): Promise<number> {
    return CreativeGenerationJobModel.countDocuments({
      status: { $in: [...ACTIVE_JOB_STATUSES] },
      imageProviderPreference: { $in: ["openai", "mock"] },
      selectedAssetTypes: {
        $elemMatch: {
          $regex: /(image|thumbnail|banner|carousel|story_frame|mockup|infographic|poster)/,
        },
      },
    });
  }

  async countActiveVideoJobs(): Promise<number> {
    return CreativeGenerationJobModel.countDocuments({
      status: { $in: [...ACTIVE_JOB_STATUSES] },
      videoProviderPreference: { $in: ["runway", "mock"] },
      selectedAssetTypes: {
        $elemMatch: {
          $regex: /(video|reel|short|graphic)/,
        },
      },
    });
  }

  async assertWithinConcurrencyLimits(input: {
    needsImage: boolean;
    needsVideo: boolean;
    imageProvider: string;
    videoProvider: string;
  }): Promise<void> {
    const liveImage =
      input.needsImage &&
      (input.imageProvider === "openai" || input.imageProvider === "mock");
    const liveVideo =
      input.needsVideo &&
      (input.videoProvider === "runway" || input.videoProvider === "mock");

    if (liveImage) {
      const active = await this.countActiveImageJobs();
      if (active >= this.environment.AI_PROVIDER_MAX_ACTIVE_IMAGE_JOBS) {
        throw new BadRequestException({
          code: "CREATIVE_GENERATION_LIMIT_EXCEEDED",
          message: `Active image job limit reached (${this.environment.AI_PROVIDER_MAX_ACTIVE_IMAGE_JOBS}).`,
        });
      }
    }

    if (liveVideo) {
      const active = await this.countActiveVideoJobs();
      if (active >= this.environment.AI_PROVIDER_MAX_ACTIVE_VIDEO_JOBS) {
        throw new BadRequestException({
          code: "CREATIVE_GENERATION_LIMIT_EXCEEDED",
          message: `Active video job limit reached (${this.environment.AI_PROVIDER_MAX_ACTIVE_VIDEO_JOBS}).`,
        });
      }
    }
  }

  /**
   * Pre-submit daily budget: only sums known costs. If the daily limit is set
   * and known spend already meets/exceeds it, block. Unknown costs alone never
   * invent prices — they only block when a limit is set and unknown-cost
   * attempt count exceeds the concurrency budget.
   */
  async assertCostBudget(): Promise<void> {
    if (!this.environment.AI_PROVIDER_USAGE_TRACKING_ENABLED) {
      return;
    }

    const dailyLimit = this.environment.AI_PROVIDER_DAILY_COST_LIMIT;
    const monthlyLimit = this.environment.AI_PROVIDER_MONTHLY_COST_LIMIT;

    if (dailyLimit === undefined && monthlyLimit === undefined) {
      return;
    }

    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    if (dailyLimit !== undefined) {
      const todayKnown = await this.sumKnownCostsSince(startOfDay);
      if (todayKnown >= dailyLimit) {
        throw new BadRequestException({
          code: "CREATIVE_GENERATION_LIMIT_EXCEEDED",
          message: "Daily creative provider cost limit reached.",
        });
      }

      const unknownToday = await this.countUnknownCostAttemptsSince(startOfDay);
      const unknownBudget =
        this.environment.AI_PROVIDER_MAX_ACTIVE_IMAGE_JOBS +
        this.environment.AI_PROVIDER_MAX_ACTIVE_VIDEO_JOBS;
      if (unknownToday >= unknownBudget) {
        throw new BadRequestException({
          code: "CREATIVE_GENERATION_LIMIT_EXCEEDED",
          message:
            "Too many provider jobs with unknown cost under an active daily limit; human review required before more live submissions.",
        });
      }
    }

    if (monthlyLimit !== undefined) {
      const monthKnown = await this.sumKnownCostsSince(startOfMonth);
      if (monthKnown >= monthlyLimit) {
        throw new BadRequestException({
          code: "CREATIVE_GENERATION_LIMIT_EXCEEDED",
          message: "Monthly creative provider cost limit reached.",
        });
      }
    }
  }

  /**
   * Post-response job cost check. Only fails when the provider reports a
   * numeric cost that exceeds AI_PROVIDER_JOB_COST_LIMIT.
   */
  assertJobCostLimit(providerReportedCost: number | null | undefined): void {
    const limit = this.environment.AI_PROVIDER_JOB_COST_LIMIT;
    if (limit === undefined) {
      return;
    }
    if (
      typeof providerReportedCost === "number" &&
      Number.isFinite(providerReportedCost) &&
      providerReportedCost > limit
    ) {
      throw new BadRequestException({
        code: "CREATIVE_GENERATION_LIMIT_EXCEEDED",
        message: "Provider-reported job cost exceeds AI_PROVIDER_JOB_COST_LIMIT.",
      });
    }
  }

  private async sumKnownCostsSince(since: Date): Promise<number> {
    const attempts = await CreativeGenerationAttemptModel.find({
      createdAt: { $gte: since },
      "usageMetadata.costUnknown": false,
      "usageMetadata.providerReportedCost": { $type: "number" },
    })
      .select({ usageMetadata: 1 })
      .lean();

    let sum = 0;
    for (const attempt of attempts) {
      const meta = attempt.usageMetadata as
        | { providerReportedCost?: number }
        | undefined;
      if (typeof meta?.providerReportedCost === "number") {
        sum += meta.providerReportedCost;
      }
    }
    return sum;
  }

  private async countUnknownCostAttemptsSince(since: Date): Promise<number> {
    return CreativeGenerationAttemptModel.countDocuments({
      createdAt: { $gte: since },
      "usageMetadata.costUnknown": true,
    });
  }
}
