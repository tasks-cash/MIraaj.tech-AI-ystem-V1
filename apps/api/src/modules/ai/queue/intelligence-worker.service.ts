import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import { AI_INTELLIGENCE_JOB_NAMES } from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { AiInternalClientService } from "../ai-internal-client.service.js";
import { AnalysisResultModel } from "../models/analysis-result.schema.js";
import { BusinessIntelligenceJobModel } from "../models/business-intelligence-job.schema.js";
import { BusinessIntelligenceAttemptModel } from "../models/business-intelligence-attempt.schema.js";
import { ServiceBundleDefinitionModel } from "../models/service-bundle-definition.schema.js";
import { transitionStatus } from "../analysis/atomic-transition.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { MatchingEngineService } from "../matching/matching-engine.service.js";
import { PhasePlannerService } from "../matching/phase-planner.service.js";
import { BundleBuilderService } from "../matching/bundle-builder.service.js";
import { BusinessProfileService } from "../intelligence/business-profile.service.js";
import { RecommendationService } from "../intelligence/recommendation.service.js";
import { assertSourceEligible } from "../intelligence/intelligence-job.service.js";
import {
  IntelligenceQueueService,
  type BuildBusinessProfileJobPayload,
} from "./intelligence-queue.service.js";

@Injectable()
export class IntelligenceWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });
  private worker?: Worker<BuildBusinessProfileJobPayload>;

  constructor(
    @Inject(IntelligenceQueueService)
    private readonly queueService: IntelligenceQueueService,
    @Inject(AiInternalClientService)
    private readonly aiClient: AiInternalClientService,
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
    @Inject(MatchingEngineService)
    private readonly matchingEngine: MatchingEngineService,
    @Inject(PhasePlannerService)
    private readonly phasePlanner: PhasePlannerService,
    @Inject(BundleBuilderService)
    private readonly bundleBuilder: BundleBuilderService,
    @Inject(BusinessProfileService)
    private readonly businessProfileService: BusinessProfileService,
    @Inject(RecommendationService)
    private readonly recommendationService: RecommendationService,
  ) {}

  onModuleInit(): void {
    const connection = { url: this.environment.REDIS_URL };
    this.worker = new Worker(
      this.environment.AI_INTELLIGENCE_QUEUE_NAME,
      async (job) => this.process(job),
      { connection, concurrency: this.environment.AI_INTELLIGENCE_WORKER_CONCURRENCY },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        {
          event: "ai.intelligence.job.worker.failed",
          jobId: job?.id,
          safeError: error.message,
        },
        "Intelligence worker job failed",
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<BuildBusinessProfileJobPayload>): Promise<void> {
    const started = Date.now();
    const jobRecord = await BusinessIntelligenceJobModel.findOne({
      jobId: job.data.jobId,
    });
    if (!jobRecord || jobRecord.status === "cancelled") {
      return;
    }

    const activated = await transitionStatus(
      BusinessIntelligenceJobModel,
      { jobId: job.data.jobId },
      "queued",
      { status: "active", stage: "loading_evidence", lastHeartbeatAt: new Date() },
    );
    if (!activated) {
      return;
    }

    const analysisResult = await AnalysisResultModel.findOne({
      resultId: job.data.analysisResultId,
    }).lean();
    try {
      assertSourceEligible({
        reviewStatus: analysisResult?.reviewStatus,
        allowAwaitingReview: jobRecord.allowAwaitingReviewSource,
      });
    } catch {
      await this.failJob(
        job.data.jobId,
        "INTELLIGENCE_SOURCE_NOT_READY",
        "Source analysis result is no longer eligible for intelligence processing.",
      );
      return;
    }
    if (!analysisResult) {
      await this.failJob(
        job.data.jobId,
        "INTELLIGENCE_SOURCE_NOT_FOUND",
        "Source analysis result was not found.",
      );
      return;
    }

    const mergedOutput = analysisResult.mergedOutput as {
      mediaSummary: string | null;
      visibleTextSummary: string | null;
      businessSignals: never[];
      audienceSignals: never[];
    };

    let reasoningSuggestion:
      | {
          provider: string;
          businessType?: string;
          audienceType?: string;
          confidence?: number;
          evidence?: string[];
        }
      | null = null;
    if (this.environment.AI_REASONING_PROVIDER !== "disabled") {
      await BusinessIntelligenceJobModel.updateOne(
        { jobId: job.data.jobId },
        { stage: "reasoning" },
      );
      try {
        const reasoning = await this.aiClient.postBusinessProfile({
          evidence: {
            mediaSummary: mergedOutput.mediaSummary ?? null,
            visibleTextSummary: mergedOutput.visibleTextSummary ?? null,
            businessSignals: (mergedOutput.businessSignals ?? []),
            audienceSignals: (mergedOutput.audienceSignals ?? []),
          },
        });
        if (reasoning.accepted) {
          reasoningSuggestion = {
            provider: reasoning.provider,
            ...(reasoning.businessType ? { businessType: reasoning.businessType } : {}),
            ...(reasoning.audienceType ? { audienceType: reasoning.audienceType } : {}),
            ...(reasoning.confidence !== undefined
              ? { confidence: reasoning.confidence }
              : {}),
            ...(reasoning.evidence ? { evidence: reasoning.evidence } : {}),
          };
        }
      } catch (error: unknown) {
        this.logger.warn(
          {
            event: "ai.intelligence.reasoning.unavailable",
            jobId: job.data.jobId,
            safeError: error instanceof Error ? error.message : "unknown",
          },
          "Reasoning provider unavailable — continuing deterministically",
        );
      }
    }

    await BusinessIntelligenceJobModel.updateOne(
      { jobId: job.data.jobId },
      { stage: "profiling" },
    );
    const built = this.businessProfileService.buildProfile({
      analysisResultId: job.data.analysisResultId,
      jobId: job.data.jobId,
      mergedOutput,
      countryCode: null,
      reasoningSuggestion,
    });
    const profile = await this.businessProfileService.persistProfile({
      analysisResultId: job.data.analysisResultId,
      jobId: job.data.jobId,
      fields: built.fields,
    });

    await BusinessIntelligenceJobModel.updateOne(
      { jobId: job.data.jobId },
      { stage: "matching", profileId: profile.profileId },
    );

    let recommendationSetId: string;
    try {
      const catalogVersion = await this.catalogService.getActiveVersionOrThrow();
      const policy = await this.catalogService.getActiveMatchingPolicyOrThrow();
      const catalogItems = await this.catalogService.getActiveCatalogItems(
        catalogVersion,
      );
      const results = this.matchingEngine.rankAll(
        built.matchable,
        catalogItems.map((item) => ({
          slug: item.slug,
          categoryCode: item.categoryCode,
          supportedBusinessTypes: item.supportedBusinessTypes,
          supportedAudienceTypes: item.supportedAudienceTypes,
          targetNeeds: item.targetNeeds,
          requiresProfessionalAudience: item.requiresProfessionalAudience,
          requiresDecisionMakerEvidence: item.requiresDecisionMakerEvidence,
          isPaymentService: item.isPaymentService,
          isRegulatedDomainOnly: item.isRegulatedDomainOnly,
          providerDependency: item.providerDependency ?? null,
          prerequisiteSlugs: item.prerequisiteSlugs,
          phase: item.phase,
          availability: item.availability,
        })),
        {
          weights: policy.weights as never,
          penalties: policy.penalties as never,
          autoApproveMin: policy.autoApproveMin,
          reviewMin: policy.reviewMin,
          decisionMakerMin: policy.decisionMakerMin,
          professionalContextMin: policy.professionalContextMin,
        },
      );

      await BusinessIntelligenceJobModel.updateOne(
        { jobId: job.data.jobId },
        { stage: "bundling" },
      );
      const bundleDefinitions = await ServiceBundleDefinitionModel.find({
        status: "active",
      }).lean();
      const bundles = this.bundleBuilder.evaluateBundles(
        built.matchable.businessType,
        results,
        bundleDefinitions.map((bundle) => ({
          code: bundle.code,
          memberSlugs: bundle.memberSlugs,
          applicableBusinessTypes: bundle.applicableBusinessTypes,
        })),
      );

      await BusinessIntelligenceJobModel.updateOne(
        { jobId: job.data.jobId },
        { stage: "scoring" },
      );
      const phasePlan = this.phasePlanner.buildPlan(results);

      const recommendationSet = await this.recommendationService.createSet({
        jobId: job.data.jobId,
        analysisResultId: job.data.analysisResultId,
        profileId: profile.profileId,
        businessType: built.matchable.businessType,
        catalogVersionId: catalogVersion.versionId,
        matchingPolicyId: policy.policyId,
        results,
        bundles,
        phasePlan,
      });
      recommendationSetId = recommendationSet.setId;

      await BusinessIntelligenceAttemptModel.create({
        attemptId: randomUUID(),
        jobId: job.data.jobId,
        analysisResultId: job.data.analysisResultId,
        attemptNumber: jobRecord.retryCount + 1,
        stage: "complete",
        reasoningPayload: reasoningSuggestion,
        profilePayload: built.fields,
        matchPayload: results,
        bundlePayload: bundles,
        scorePayload: { overallScore: recommendationSet.overallScore },
        processingMs: Date.now() - started,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Matching failed.";
      await this.failJob(job.data.jobId, "SERVICE_CATALOG_NO_ACTIVE_VERSION", message);
      return;
    }

    const finalStatus =
      built.requiresReview || profile.status === "awaiting_review"
        ? "awaiting_review"
        : "completed";

    await BusinessIntelligenceJobModel.updateOne(
      { jobId: job.data.jobId },
      {
        status: finalStatus,
        stage: "complete",
        recommendationSetId,
        completedAt: finalStatus === "completed" ? new Date() : undefined,
        progress: {
          stage: "complete",
          percent: 100,
          message:
            finalStatus === "awaiting_review"
              ? "Awaiting human review"
              : "Business intelligence completed",
          updatedAt: new Date().toISOString(),
        },
      },
    );

    this.logger.info(
      {
        event: "ai.intelligence.job.completed",
        jobId: job.data.jobId,
        recommendationSetId,
        requiresReview: finalStatus === "awaiting_review",
      },
      "Business intelligence job completed",
    );
  }

  private async failJob(
    jobId: string,
    failureCode: string,
    failureMessage: string,
  ): Promise<void> {
    const job = await BusinessIntelligenceJobModel.findOne({ jobId });
    if (!job) {
      return;
    }
    if (job.retryCount >= job.maxRetries) {
      job.status = "dead_letter";
      await this.queueService.moveToDeadLetter({
        jobId,
        analysisResultId: job.analysisResultId,
        errorCode: failureCode as never,
        message: failureMessage,
      });
    } else {
      job.status = "failed";
    }
    job.failureCode = failureCode;
    job.failureMessage = failureMessage;
    await job.save();
  }
}

// Re-export the queue job-name constant for consumers wiring BullMQ manually.
export const BUILD_BUSINESS_PROFILE_JOB_NAME =
  AI_INTELLIGENCE_JOB_NAMES.BUILD_BUSINESS_PROFILE;
