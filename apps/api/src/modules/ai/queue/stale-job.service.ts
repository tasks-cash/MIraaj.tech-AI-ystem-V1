import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createLogger } from "@miraaj/shared-logging";
import { loadEnvironment } from "../../../environment.js";
import { AnalysisJobModel } from "../models/analysis-job.schema.js";
import { BusinessIntelligenceJobModel } from "../models/business-intelligence-job.schema.js";

@Injectable()
export class StaleJobService implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });
  private interval?: NodeJS.Timeout;

  onModuleInit(): void {
    const intervalSeconds = Math.min(
      this.environment.MEDIA_STALE_JOB_HEARTBEAT_SECONDS,
      this.environment.AI_INTELLIGENCE_RECONCILE_INTERVAL_SECONDS,
    );
    this.interval = setInterval(() => {
      void this.reconcileStaleJobs();
    }, intervalSeconds * 1_000);
  }

  async reconcileStaleJobs(): Promise<number> {
    const mediaCount = await this.reconcileStaleAnalysisJobs();
    const intelligenceCount = await this.reconcileStaleIntelligenceJobs();
    return mediaCount + intelligenceCount;
  }

  private async reconcileStaleAnalysisJobs(): Promise<number> {
    const cutoff = new Date(
      Date.now() - this.environment.MEDIA_STALE_JOB_HEARTBEAT_SECONDS * 2_000,
    );
    const staleJobs = await AnalysisJobModel.find({
      status: "active",
      lastHeartbeatAt: { $lt: cutoff },
    }).limit(50);
    for (const job of staleJobs) {
      job.status = "failed";
      job.failureCode = "VISION_PROVIDER_TIMEOUT";
      job.failureMessage = "Job heartbeat expired.";
      await job.save();
      this.logger.warn(
        {
          event: "ai.analysis.job.stale",
          jobId: job.jobId,
        },
        "Stale analysis job reconciled",
      );
    }
    return staleJobs.length;
  }

  private async reconcileStaleIntelligenceJobs(): Promise<number> {
    const cutoff = new Date(
      Date.now() - this.environment.AI_INTELLIGENCE_STALE_SECONDS * 1_000,
    );
    const staleJobs = await BusinessIntelligenceJobModel.find({
      status: "active",
      lastHeartbeatAt: { $lt: cutoff },
    }).limit(50);
    for (const job of staleJobs) {
      job.status = "failed";
      job.stage = "failed";
      job.failureCode = "INTELLIGENCE_PROVIDER_TIMEOUT";
      job.failureMessage = "Intelligence job heartbeat expired.";
      await job.save();
      this.logger.warn(
        {
          event: "ai.intelligence.job.dead_lettered",
          jobId: job.jobId,
        },
        "Stale intelligence job reconciled",
      );
    }
    return staleJobs.length;
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
