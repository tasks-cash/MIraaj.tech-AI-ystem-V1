import { Injectable } from "@nestjs/common";
import {
  CreativeAssetModel,
  CreativeGenerationAttemptModel,
} from "../models/creative.schema.js";

export interface CreativeUsageRecord {
  provider: string;
  model?: string | null;
  providerJobId?: string | null;
  usageUnavailable?: boolean;
  costUnknown?: boolean;
  providerReportedCost?: number | null;
  currency?: string | null;
  recordedAt?: string;
}

/**
 * Persists safe provider usage metadata on attempts/assets.
 * Never stores secrets, prompts, or media URLs.
 */
@Injectable()
export class CreativeUsageService {
  async recordAttemptUsage(
    attemptId: string,
    record: CreativeUsageRecord,
  ): Promise<void> {
    const usageMetadata = this.toSafeMetadata(record);
    await CreativeGenerationAttemptModel.updateOne(
      { attemptId },
      {
        $set: {
          usageMetadata,
          ...(typeof record.providerReportedCost === "number"
            ? { estimatedCost: record.providerReportedCost }
            : {}),
        },
      },
    );
  }

  async recordAssetUsage(
    assetId: string,
    record: CreativeUsageRecord,
  ): Promise<void> {
    const usageMetadata = this.toSafeMetadata(record);
    await CreativeAssetModel.updateOne(
      { assetId },
      {
        $set: {
          usageMetadata,
          ...(record.providerJobId
            ? { providerJobId: record.providerJobId }
            : {}),
          ...(record.model ? { providerModel: record.model } : {}),
        },
      },
    );
  }

  async aggregateSafeUsage(): Promise<{
    attemptCount: number;
    unknownCostCount: number;
    knownCostSum: number;
    byProvider: Record<string, number>;
  }> {
    const attempts = await CreativeGenerationAttemptModel.find({
      "usageMetadata.provider": { $exists: true },
    })
      .select({ usageMetadata: 1 })
      .lean();

    let unknownCostCount = 0;
    let knownCostSum = 0;
    const byProvider: Record<string, number> = {};

    for (const attempt of attempts) {
      const meta = (attempt.usageMetadata ?? {}) as CreativeUsageRecord;
      const provider =
        typeof meta.provider === "string" ? meta.provider : "unknown";
      byProvider[provider] = (byProvider[provider] ?? 0) + 1;
      if (meta.costUnknown !== false) {
        unknownCostCount += 1;
      }
      if (typeof meta.providerReportedCost === "number") {
        knownCostSum += meta.providerReportedCost;
      }
    }

    return {
      attemptCount: attempts.length,
      unknownCostCount,
      knownCostSum,
      byProvider,
    };
  }

  private toSafeMetadata(record: CreativeUsageRecord): CreativeUsageRecord {
    return {
      provider: record.provider,
      model: record.model ?? null,
      providerJobId: record.providerJobId ?? null,
      usageUnavailable: Boolean(record.usageUnavailable),
      costUnknown:
        record.costUnknown !== undefined
          ? Boolean(record.costUnknown)
          : typeof record.providerReportedCost !== "number",
      ...(typeof record.providerReportedCost === "number"
        ? { providerReportedCost: record.providerReportedCost }
        : {}),
      ...(record.currency ? { currency: record.currency } : {}),
      recordedAt: record.recordedAt ?? new Date().toISOString(),
    };
  }
}
