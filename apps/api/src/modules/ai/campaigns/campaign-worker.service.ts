import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import { createHash, randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import {
  CAMPAIGN_PAYMENT_DISCLOSURES,
  isRegulatedBusinessType,
  isRtlLanguage,
  type BusinessType,
  type CampaignPlatform,
  type CampaignReviewReasonCode,
  type CtaCode,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { AiInternalClientService } from "../ai-internal-client.service.js";
import { transitionStatus } from "../analysis/atomic-transition.js";
import {
  CampaignAttemptModel,
  CampaignBriefModel,
  CampaignJobModel,
  CampaignPackageModel,
} from "../models/campaign.schema.js";
import {
  BrandProfileModel,
  CompliancePolicyModel,
  PlatformPolicyModel,
  TranslationGlossaryModel,
} from "../models/campaign-policy.schema.js";
import { CampaignQualityService } from "../campaigns/campaign-quality.service.js";
import { CampaignSourceEligibilityService } from "../campaigns/campaign-source-eligibility.service.js";
import {
  CampaignValidationService,
  type PlatformLimits,
} from "../campaigns/campaign-validation.service.js";
import {
  CampaignQueueService,
  type GenerateCampaignJobPayload,
} from "../queue/campaign-queue.service.js";

/** Mutable deterministic platform-variant draft produced before validation/scoring. */
interface PlatformVariantDraft {
  platformVariantId: string;
  platform: CampaignPlatform;
  platformPolicyVersion: number;
  language: string;
  locale: string;
  direction: "rtl" | "ltr";
  format: string;
  objective: string;
  funnelStage: string;
  headline: string;
  hook: string;
  primaryText: string;
  shortText: string;
  ctaCode: CtaCode;
  ctaLabel: string;
  hashtags: string[];
  keywords: string[];
  disclosureText: string | undefined;
  qualityScore: number;
  complianceScore: number;
  brandScore: number;
  platformFitScore: number;
  warnings: string[];
  requiresReview: boolean;
  reviewReasonCodes: string[];
  contentChecksum: string;
  generatedAt: Date;
}

@Injectable()
export class CampaignWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });
  private worker?: Worker<GenerateCampaignJobPayload>;
  private reconcileTimer?: NodeJS.Timeout;

  constructor(
    @Inject(CampaignQueueService)
    private readonly queueService: CampaignQueueService,
    @Inject(AiInternalClientService)
    private readonly aiClient: AiInternalClientService,
    @Inject(CampaignSourceEligibilityService)
    private readonly eligibility: CampaignSourceEligibilityService,
    @Inject(CampaignValidationService)
    private readonly validation: CampaignValidationService,
    @Inject(CampaignQualityService)
    private readonly quality: CampaignQualityService,
  ) {}

  onModuleInit(): void {
    const connection = { url: this.environment.REDIS_URL };
    this.worker = new Worker(
      this.environment.AI_CAMPAIGN_QUEUE_NAME,
      async (job) => this.process(job),
      {
        connection,
        concurrency: this.environment.AI_CAMPAIGN_WORKER_CONCURRENCY,
      },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        {
          event: "ai.campaign.job.failed",
          campaignJobId: job?.data?.campaignJobId,
          safeError: error.message,
        },
        "Campaign worker job failed",
      );
    });
    this.reconcileTimer = setInterval(
      () => void this.reconcileStaleJobs(),
      this.environment.AI_CAMPAIGN_RECONCILE_INTERVAL_SECONDS * 1_000,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
    }
    await this.worker?.close();
  }

  private async process(job: Job<GenerateCampaignJobPayload>): Promise<void> {
    const started = Date.now();
    const campaignJobId = job.data.campaignJobId;
    const jobRecord = await CampaignJobModel.findOne({ campaignJobId });
    if (!jobRecord || jobRecord.status === "cancelled") {
      return;
    }

    const activated = await transitionStatus(
      CampaignJobModel,
      { campaignJobId },
      "queued",
      {
        status: "active",
        currentStage: "loading_source",
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    );
    if (!activated) {
      return;
    }

    const attemptId = randomUUID();
    const attemptNumber = (jobRecord.attempts ?? 0) + 1;
    await CampaignJobModel.updateOne(
      { campaignJobId },
      { attempts: attemptNumber, lastHeartbeatAt: new Date() },
    );

    try {
      const source = await this.eligibility.loadAndValidate({
        recommendationSetId: jobRecord.recommendationSetId,
        recommendationSetRevision: jobRecord.recommendationSetRevision,
        selectedServiceIds: jobRecord.selectedServiceIds,
        allowCampaignOverride: jobRecord.allowCampaignOverride,
      });

      await CampaignJobModel.updateOne(
        { campaignJobId },
        { status: "building_brief", currentStage: "building_brief", lastHeartbeatAt: new Date() },
      );

      const brand = await BrandProfileModel.findOne({
        brandName: "Miraaj.tech",
        status: "active",
      }).lean();
      const platformPolicy = await PlatformPolicyModel.findOne({
        status: "active",
      }).lean();
      const compliancePolicy = await CompliancePolicyModel.findOne({
        status: "active",
      }).lean();
      const glossary = await TranslationGlossaryModel.findOne({
        status: "active",
      }).lean();
      if (!brand || !platformPolicy || !compliancePolicy) {
        await this.failJob(
          campaignJobId,
          "PLATFORM_POLICY_NOT_FOUND",
          "Required campaign policies are not active.",
        );
        return;
      }

      const sourceChecksum = createHash("sha256")
        .update(
          JSON.stringify({
            setId: source.recommendationSet.setId,
            revision: source.recommendationSet.revision,
            services: source.selectedServices.map((item) => item.itemSlug),
          }),
        )
        .digest("hex");

      const campaignBriefId = randomUUID();
      const includesPayment = source.selectedServices.some(
        (item) => item.isPaymentService,
      );
      const regulated =
        isRegulatedBusinessType(
          source.businessProfile.businessType.code as BusinessType,
        ) || includesPayment;

      const reviewReasonCodes: CampaignReviewReasonCode[] = [
        ...source.reviewReasonCodes,
        ...(jobRecord.manualReviewRequested
          ? (["manual_review_requested"] as CampaignReviewReasonCode[])
          : []),
        ...(regulated ? (["regulated_domain"] as CampaignReviewReasonCode[]) : []),
        ...(includesPayment ? (["payment_service"] as CampaignReviewReasonCode[]) : []),
      ];

      await CampaignBriefModel.create({
        campaignBriefId,
        campaignId: jobRecord.campaignId,
        status: "generated",
        currentRevision: 1,
        recommendationSetId: source.recommendationSet.setId,
        recommendationSetRevision: source.recommendationSet.revision ?? 1,
        businessProfileId: source.businessProfile.profileId,
        catalogVersionId: source.recommendationSet.catalogVersionId,
        matchingPolicyVersionId: source.recommendationSet.matchingPolicyId,
        sourceAnalysisResultId: source.recommendationSet.analysisResultId,
        campaignSourceChecksum: sourceChecksum,
        name:
          jobRecord.campaignName ??
          `Campaign for ${source.businessProfile.businessType.code}`,
        internalName: `campaign-${campaignBriefId.slice(0, 8)}`,
        campaignType: jobRecord.campaignType,
        objective: jobRecord.objective,
        funnelStage: jobRecord.funnelStage,
        selectedServiceIds: jobRecord.selectedServiceIds,
        primaryServiceId: jobRecord.selectedServiceIds[0] ?? "",
        supportingServiceIds: jobRecord.selectedServiceIds.slice(1),
        ...(jobRecord.destinationType
          ? { destinationType: jobRecord.destinationType }
          : {}),
        ...(jobRecord.destinationReference
          ? { destinationReference: jobRecord.destinationReference }
          : {}),
        ...(jobRecord.offerDetails ? { offerDetails: jobRecord.offerDetails } : {}),
        selectedPlatforms: jobRecord.selectedPlatforms,
        selectedFormats: jobRecord.selectedFormats,
        audienceStrategy: {
          primaryAudienceType: source.businessProfile.audienceType.code,
          promotionEligibility: source.businessProfile.promotionEligibility.code,
          decisionMakerLikelihood: source.businessProfile.decisionMakerConfidence,
        },
        promotionEligibility: source.businessProfile.promotionEligibility.code,
        decisionMakerLikelihood: source.businessProfile.decisionMakerConfidence,
        professionalContextConfidence:
          source.businessProfile.professionalContextConfidence,
        targetCountries: jobRecord.targetCountries,
        targetLanguages: jobRecord.targetLanguages,
        targetLocales: jobRecord.targetLocales,
        baseLanguage: jobRecord.baseLanguage,
        sourceLocale: jobRecord.sourceLocale,
        localizationMode:
          jobRecord.targetLanguages.length > 1
            ? "transcreation"
            : "source_language_only",
        transcreationRequired: jobRecord.targetLanguages.length > 1,
        brandProfileId: brand.brandProfileId,
        brandProfileVersion: brand.version,
        toneProfile: brand.toneAttributes,
        prohibitedClaims: brand.prohibitedClaims,
        requiredDisclosures: includesPayment
          ? CAMPAIGN_PAYMENT_DISCLOSURES
          : {},
        protectedTerms: brand.protectedTerms,
        ...(glossary
          ? { glossaryVersionId: `${glossary.glossaryId}:v${glossary.version}` }
          : {}),
        requiresReview: true,
        reviewReasonCodes: [...new Set(reviewReasonCodes)],
        createdBy: jobRecord.requestedBy,
        correlationId: jobRecord.correlationId,
      });

      await CampaignJobModel.updateOne(
        { campaignJobId },
        {
          campaignBriefId,
          status: "building_strategy",
          currentStage: "building_strategy",
          lastHeartbeatAt: new Date(),
        },
      );
      this.logger.info(
        {
          event: "ai.campaign.brief.created",
          campaignJobId,
          campaignBriefId,
        },
        "Campaign brief created",
      );

      let strategy: Record<string, unknown> = {
        provider: "disabled",
        status: "provider_unavailable",
      };
      let generation: Record<string, unknown> = {
        provider: "disabled",
        status: "provider_unavailable",
        platformVariants: [],
        languageVariants: [],
        imageCreativeBriefs: [],
        videoCreativeBriefs: [],
        carouselBriefs: [],
        storySequences: [],
      };

      const providerDisabled =
        (jobRecord.providerPreference ?? this.environment.AI_CAMPAIGN_PROVIDER) ===
        "disabled";

      if (!providerDisabled) {
        try {
          strategy = (await this.aiClient.postCampaignStrategy({
            objective: jobRecord.objective,
            funnelStage: jobRecord.funnelStage,
            audience: source.businessProfile.audienceType.code,
            selectedServices: jobRecord.selectedServiceIds,
            platforms: jobRecord.selectedPlatforms,
            languages: jobRecord.targetLanguages,
          }));
          generation = (await this.aiClient.postCampaignGenerate({
            briefId: campaignBriefId,
            objective: jobRecord.objective,
            funnelStage: jobRecord.funnelStage,
            platforms: jobRecord.selectedPlatforms,
            languages: jobRecord.targetLanguages,
            locales: jobRecord.targetLocales,
            selectedServices: jobRecord.selectedServiceIds,
            includesPayment,
            brandProtectedTerms: brand.protectedTerms,
          }));
        } catch (error: unknown) {
          this.logger.warn(
            {
              event: "ai.campaign.strategy.completed",
              campaignJobId,
              safeError: error instanceof Error ? error.message : "unknown",
            },
            "Campaign provider unavailable — continuing with deterministic shell",
          );
          reviewReasonCodes.push("manual_review_requested");
        }
      } else {
        reviewReasonCodes.push("manual_review_requested");
      }

      await CampaignJobModel.updateOne(
        { campaignJobId },
        {
          status: "generating_platforms",
          currentStage: "generating_platforms",
          lastHeartbeatAt: new Date(),
        },
      );

      const platformVariants = this.buildDeterministicPlatformVariants({
        platforms: jobRecord.selectedPlatforms,
        languages: jobRecord.targetLanguages,
        locales: jobRecord.targetLocales,
        objective: jobRecord.objective,
        funnelStage: jobRecord.funnelStage,
        services: jobRecord.selectedServiceIds,
        businessType: source.businessProfile.businessType.code,
        includesPayment,
        platformPolicyVersion: platformPolicy.version,
        providerVariants: Array.isArray(generation.platformVariants)
          ? (generation.platformVariants as Array<Record<string, unknown>>)
          : [],
      });

      await CampaignJobModel.updateOne(
        { campaignJobId },
        {
          status: "transcreating",
          currentStage: "transcreating",
          lastHeartbeatAt: new Date(),
        },
      );

      const masterSourceText = [
        `Miraaj.tech can help ${source.businessProfile.businessType.code} teams explore approved digital systems.`,
        `Focus services: ${jobRecord.selectedServiceIds.slice(0, 5).join(", ")}.`,
        "No guaranteed outcomes. Discovery and consultation only.",
      ].join(" ");

      const languageVariants = await this.buildLanguageVariants({
        languages: jobRecord.targetLanguages,
        locales: jobRecord.targetLocales,
        countries: jobRecord.targetCountries,
        baseLanguage: jobRecord.baseLanguage,
        sourceText: masterSourceText,
        includesPayment,
        protectedTerms: brand.protectedTerms ?? ["Miraaj.tech", "Tasks.cash"],
        businessType: source.businessProfile.businessType.code,
        translationProviderDisabled:
          (jobRecord.translationProviderPreference ??
            this.environment.AI_TRANSLATION_PROVIDER) === "disabled",
        correlationId: jobRecord.correlationId,
        requestId: jobRecord.requestId,
      });

      if (
        languageVariants.some((variant) =>
          (variant.reviewReasonCodes as string[] | undefined)?.includes(
            "translation_unavailable",
          ),
        ) &&
        jobRecord.targetLanguages.length > 1
      ) {
        reviewReasonCodes.push("translation_unavailable");
      }
      if (
        languageVariants.some((variant) =>
          (variant.reviewReasonCodes as string[] | undefined)?.includes("semantic_drift"),
        )
      ) {
        reviewReasonCodes.push("semantic_drift");
      }

      const imageBriefs = jobRecord.selectedPlatforms.map((platform) => ({
        imageBriefId: randomUUID(),
        platform,
        language: jobRecord.baseLanguage,
        locale: jobRecord.sourceLocale,
        format: "image_brief",
        conceptTitle: `${source.businessProfile.businessType.code} professional visual`,
        visualNarrative:
          "Professional business context showing workflow tools — no fake logos or awards.",
        prohibitedElements: [
          "copyrighted characters",
          "real person likeness",
          "fake awards",
          "fake client logos",
        ],
        referenceServiceIds: jobRecord.selectedServiceIds,
        reviewStatus: "pending",
      }));

      const videoBriefs = jobRecord.selectedPlatforms
        .filter((platform) =>
          ["tiktok", "youtube", "youtube_shorts", "instagram"].includes(platform),
        )
        .map((platform) => ({
          videoBriefId: randomUUID(),
          platform,
          language: jobRecord.baseLanguage,
          locale: jobRecord.sourceLocale,
          format: "video_script",
          targetDurationSeconds: platform === "youtube" ? 90 : 30,
          hook: "Show the operational problem clearly without fear tactics.",
          concept: "Short educational walkthrough of the selected Miraaj.tech services.",
          voiceoverScript:
            "Explain capabilities factually. Invite a consultation. Do not promise outcomes.",
          CTA: "request_consultation",
          prohibitedElements: ["fake testimonials", "guaranteed results"],
          referenceServiceIds: jobRecord.selectedServiceIds,
          reviewStatus: "pending",
        }));

      const carouselBriefs = this.buildCarouselBriefs({
        platforms: jobRecord.selectedPlatforms,
        language: jobRecord.baseLanguage,
        locale: jobRecord.sourceLocale,
        businessType: source.businessProfile.businessType.code,
        services: jobRecord.selectedServiceIds,
        includesPayment,
      });

      const storySequences = this.buildStorySequences({
        platforms: jobRecord.selectedPlatforms,
        language: jobRecord.baseLanguage,
        locale: jobRecord.sourceLocale,
        businessType: source.businessProfile.businessType.code,
        objective: jobRecord.objective,
      });

      const allTexts = [
        ...platformVariants.map((variant) => variant.primaryText ?? ""),
        ...languageVariants.map((variant) => {
          const transcreated =
            typeof variant.transcreatedText === "string"
              ? variant.transcreatedText
              : "";
          const translated =
            typeof variant.translatedText === "string" ? variant.translatedText : "";
          const source =
            typeof variant.sourceText === "string" ? variant.sourceText : "";
          return transcreated || translated || source;
        }),
      ];

      await CampaignJobModel.updateOne(
        { campaignJobId },
        {
          status: "validating",
          currentStage: "validating",
          lastHeartbeatAt: new Date(),
        },
      );

      // Deterministic per-variant validation — claims, disclosures, brand,
      // platform structural limits, and CTA destination. NestJS is
      // authoritative here regardless of what any provider returned.
      const platformLimitsByPlatform = new Map<string, PlatformLimits>(
        platformPolicy.platforms.map((definition) => [
          definition.platformId,
          {
            maxHeadlineChars:
              (definition.maximumConfiguredLengths as Record<string, number> | undefined)
                ?.headline ?? 100,
            maxPrimaryTextChars:
              (definition.maximumConfiguredLengths as Record<string, number> | undefined)
                ?.primaryText ?? 2_200,
            maxShortTextChars:
              (definition.maximumConfiguredLengths as Record<string, number> | undefined)
                ?.shortText ?? 200,
            maxHashtags: this.environment.CAMPAIGN_MAX_HASHTAGS_PER_VARIANT,
            maxKeywords: this.environment.CAMPAIGN_MAX_KEYWORDS_PER_VARIANT,
          },
        ]),
      );

      const promptInjectionDetected = this.validation.detectPromptInjection(allTexts);

      const aggregatedReasonCodes = new Set<CampaignReviewReasonCode>(reviewReasonCodes);
      const validationResults = platformVariants.map((variant) => {
        const result = this.validation.validatePlatformVariant(
          {
            platform: variant.platform,
            headline: variant.headline ?? "",
            primaryText: variant.primaryText ?? "",
            shortText: variant.shortText ?? variant.primaryText ?? "",
            hashtags: variant.hashtags ?? [],
            keywords: variant.keywords ?? [],
            ctaCode: variant.ctaCode,
            destinationUrl: jobRecord.destinationReference ?? null,
          },
          {
            involvesPayment: includesPayment,
            isRegulatedDomain: regulated,
            brandProhibitedPhrases: brand.prohibitedClaims,
            verifiedStatistics: [],
            paymentDisclosureText: includesPayment ? CAMPAIGN_PAYMENT_DISCLOSURES.en : null,
            platformLimits: platformLimitsByPlatform.get(variant.platform) ?? null,
          },
        );
        variant.ctaCode = result.normalizedCtaCode;
        if (result.appliedDisclaimer) {
          variant.disclosureText = result.appliedDisclaimer;
        }
        variant.requiresReview = !result.valid || result.reasonCodes.length > 0;
        variant.reviewReasonCodes = [...result.reasonCodes];
        for (const code of result.reasonCodes) {
          aggregatedReasonCodes.add(code);
        }
        return result;
      });
      if (promptInjectionDetected) {
        aggregatedReasonCodes.add("prompt_injection_detected");
      }

      await CampaignJobModel.updateOne(
        { campaignJobId },
        { status: "scoring", currentStage: "scoring", lastHeartbeatAt: new Date() },
      );

      const languageVariantScores = languageVariants.map((variant) => ({
        semanticPreservationScore:
          typeof variant.semanticPreservationScore === "number"
            ? variant.semanticPreservationScore
            : null,
        requiresReview: Boolean(variant.requiresReview),
      }));

      const quality = this.quality.score({
        sourceQualityScore: source.recommendationSet.requiresReview ? 0.75 : 0.92,
        audienceFitScore: isRtlLanguage(jobRecord.baseLanguage) ? 0.82 : 0.88,
        decisionMakerFitScore: source.businessProfile.decisionMakerConfidence,
        objectiveFitScore: 0.85,
        funnelStageFitScore: 0.85,
        validationResults,
        languageVariantScores,
      });

      if (quality.overallQualityScore < this.environment.CAMPAIGN_QUALITY_REVIEW_MIN) {
        aggregatedReasonCodes.add("low_overall_quality");
      }
      if (quality.brandVoiceScore < this.environment.CAMPAIGN_BRAND_SCORE_MIN) {
        aggregatedReasonCodes.add("low_brand_score");
      }
      if (quality.complianceScore < this.environment.CAMPAIGN_COMPLIANCE_SCORE_MIN) {
        aggregatedReasonCodes.add("low_compliance_score");
      }
      if (quality.languageQualityScore < this.environment.CAMPAIGN_LANGUAGE_SCORE_MIN) {
        aggregatedReasonCodes.add("low_language_score");
      }

      const warnings = [
        ...new Set(
          validationResults.flatMap((result) => result.errorCodes as readonly string[]),
        ),
      ];

      const campaignPackageId = randomUUID();
      const requiredDisclosures = includesPayment ? CAMPAIGN_PAYMENT_DISCLOSURES : {};
      const masterMessageFramework = {
        targetProblem: `Operational friction for ${source.businessProfile.businessType.code}`,
        audienceContext: source.businessProfile.audienceType.code,
        primaryValueProposition:
          "Practical Miraaj.tech systems matched to approved service recommendations",
        approvedCapabilities: jobRecord.selectedServiceIds,
        requiredDisclosures,
        prohibitedClaims: brand.prohibitedClaims,
        primaryCTA: jobRecord.destinationReference
          ? "request_consultation"
          : "no_direct_cta",
        tone: brand.toneAttributes,
        protectedTerms: brand.protectedTerms,
      };

      await CampaignPackageModel.create({
        campaignPackageId,
        campaignId: jobRecord.campaignId,
        campaignBriefId,
        campaignBriefRevision: 1,
        status: "awaiting_review",
        currentRevision: 1,
        recommendationSetId: source.recommendationSet.setId,
        recommendationSetRevision: source.recommendationSet.revision ?? 1,
        businessProfileId: source.businessProfile.profileId,
        sourceAnalysisResultId: source.recommendationSet.analysisResultId,
        catalogVersionId: source.recommendationSet.catalogVersionId,
        matchingPolicyVersionId: source.recommendationSet.matchingPolicyId,
        brandProfileId: brand.brandProfileId,
        brandProfileVersion: brand.version,
        platformPolicyVersion: platformPolicy.version,
        compliancePolicyVersion: compliancePolicy.version,
        ...(glossary
          ? { glossaryVersionId: `${glossary.glossaryId}:v${glossary.version}` }
          : {}),
        objective: jobRecord.objective,
        funnelStage: jobRecord.funnelStage,
        campaignType: jobRecord.campaignType,
        primaryAudience: source.businessProfile.audienceType.code,
        promotionEligibility: source.businessProfile.promotionEligibility.code,
        selectedServices: jobRecord.selectedServiceIds,
        targetCountries: jobRecord.targetCountries,
        targetLanguages: jobRecord.targetLanguages,
        targetLocales: jobRecord.targetLocales,
        selectedPlatforms: jobRecord.selectedPlatforms,
        selectedFormats: jobRecord.selectedFormats,
        masterMessageFramework,
        strategy,
        baseLanguageVariant: languageVariants[0] ?? {},
        languageVariants,
        platformVariants,
        imageCreativeBriefs: imageBriefs,
        videoCreativeBriefs: videoBriefs,
        carouselBriefs,
        storySequences,
        ctaVariants: [
          {
            code: jobRecord.destinationReference
              ? "request_consultation"
              : "no_direct_cta",
            label: jobRecord.destinationReference
              ? "Request a consultation"
              : "No direct CTA — destination missing",
          },
        ],
        hashtagSets: [
          {
            broad: ["#DigitalSystems"],
            industry: [`#${source.businessProfile.businessType.code}`],
            branded: ["#Miraaj"],
          },
        ],
        keywordSets: [{ keywords: jobRecord.selectedServiceIds.slice(0, 10) }],
        requiredDisclosures,
        campaignConfidence: quality.overallQualityScore,
        qualityBreakdown: quality,
        penalties: {},
        overallQualityScore: quality.overallQualityScore,
        warnings,
        requiresReview: true,
        reviewReasonCodes: [...aggregatedReasonCodes],
        reviewStatus: "pending",
        campaignJobId,
        campaignAttemptId: attemptId,
        correlationId: jobRecord.correlationId,
        createdBy: jobRecord.requestedBy,
        providerState: providerDisabled ? "disabled" : "gemini",
        contentChecksum: createHash("sha256")
          .update(JSON.stringify({ platformVariants, languageVariants }))
          .digest("hex"),
      });

      await CampaignAttemptModel.create({
        attemptId,
        campaignJobId,
        attemptNumber,
        workerId: `campaign-worker-${process.pid}`,
        stages: [
          "loading_source",
          "building_brief",
          "building_strategy",
          "generating_platforms",
          "transcreating",
          "validating",
          "scoring",
        ],
        sourceSnapshotChecksum: sourceChecksum,
        generationFingerprint: jobRecord.generationFingerprint,
        providerConfiguration: {
          provider: jobRecord.providerPreference,
        },
        translationConfiguration: {
          provider: jobRecord.translationProviderPreference,
        },
        brandProfileVersion: brand.version,
        catalogVersionId: source.recommendationSet.catalogVersionId,
        platformPolicyVersion: platformPolicy.version,
        compliancePolicyVersion: compliancePolicy.version,
        timing: { totalMs: Date.now() - started },
        warnings,
        completedAt: new Date(),
        immutable: true,
      });

      await CampaignJobModel.updateOne(
        { campaignJobId },
        {
          status: "awaiting_review",
          currentStage: "awaiting_review",
          campaignPackageId,
          campaignBriefId,
          completedAt: new Date(),
          progress: 100,
          requiresReview: true,
          reviewReasonCodes: [...aggregatedReasonCodes],
          lastHeartbeatAt: new Date(),
        },
      );

      this.logger.info(
        {
          event: "ai.campaign.package.created",
          campaignJobId,
          campaignPackageId,
          campaignBriefId,
          durationMs: Date.now() - started,
        },
        "Campaign package created awaiting review",
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "unknown";
      const code =
        typeof error === "object" &&
        error &&
        "response" in error &&
        typeof (error as { response?: { code?: string } }).response?.code === "string"
          ? (error as { response: { code: string } }).response.code
          : "CAMPAIGN_PROVIDER_UNAVAILABLE";
      await this.failJob(campaignJobId, code, message);
      if (attemptNumber >= (jobRecord.maxAttempts ?? 3)) {
        await this.queueService.moveToDeadLetter({
          campaignJobId,
          errorCode: code as never,
          message,
        });
        await CampaignJobModel.updateOne(
          { campaignJobId },
          { status: "dead_letter", currentStage: "dead_letter" },
        );
        this.logger.error(
          { event: "ai.campaign.job.dead_lettered", campaignJobId },
          "Campaign job moved to dead letter",
        );
      }
      throw error;
    }
  }

  private buildDeterministicPlatformVariants(input: {
    platforms: CampaignPlatform[];
    languages: string[];
    locales: string[];
    objective: string;
    funnelStage: string;
    services: string[];
    businessType: string;
    includesPayment: boolean;
    platformPolicyVersion: number;
    providerVariants: Array<Record<string, unknown>>;
  }): PlatformVariantDraft[] {
    const language = input.languages[0] ?? "en";
    const locale = input.locales[0] ?? language;
    return input.platforms.map((platform): PlatformVariantDraft => {
      const providerVariant = input.providerVariants.find(
        (variant) => variant.platform === platform,
      );
      const primaryText =
        typeof providerVariant?.primaryText === "string"
          ? providerVariant.primaryText
          : [
              `Miraaj.tech can help ${input.businessType} teams explore approved digital systems.`,
              `Focus services: ${input.services.slice(0, 5).join(", ")}.`,
              `Objective: ${input.objective}. Stage: ${input.funnelStage}.`,
              "No guaranteed outcomes. Discovery and consultation only.",
              input.includesPayment
                ? CAMPAIGN_PAYMENT_DISCLOSURES.en
                : "",
            ]
              .filter(Boolean)
              .join(" ");

      return {
        platformVariantId: randomUUID(),
        platform,
        platformPolicyVersion: input.platformPolicyVersion,
        language,
        locale,
        direction: isRtlLanguage(language) ? "rtl" : "ltr",
        format: "short_post",
        objective: input.objective,
        funnelStage: input.funnelStage,
        headline: `Practical systems for ${input.businessType}`,
        hook: "Operational clarity without hype.",
        primaryText,
        shortText: primaryText.slice(0, 200),
        ctaCode: "request_consultation",
        ctaLabel: "Request a consultation",
        hashtags: ["#Miraaj", `#${input.businessType}`].slice(0, 8),
        keywords: input.services.slice(0, 10),
        disclosureText: (input.includesPayment
          ? CAMPAIGN_PAYMENT_DISCLOSURES.en
          : undefined),
        qualityScore: 0.8,
        complianceScore: input.includesPayment ? 0.95 : 0.9,
        brandScore: 0.88,
        platformFitScore: 0.85,
        warnings: [] as string[],
        requiresReview: true,
        reviewReasonCodes: [] as string[],
        contentChecksum: createHash("sha256").update(primaryText).digest("hex"),
        generatedAt: new Date(),
      };
    });
  }

  private async buildLanguageVariants(input: {
    languages: string[];
    locales: string[];
    countries: string[];
    baseLanguage: string;
    sourceText: string;
    includesPayment: boolean;
    protectedTerms: string[];
    businessType: string;
    translationProviderDisabled: boolean;
    correlationId?: string | null;
    requestId?: string | null;
  }) {
    const variants: Array<Record<string, unknown>> = [];
    for (let index = 0; index < input.languages.length; index += 1) {
      const language = input.languages[index]!;
      const locale = input.locales[index] ?? language;
      const countryCode = input.countries[index] ?? input.countries[0] ?? null;
      const isBase = language === input.baseLanguage;
      const disclosure =
        language === "ar"
          ? CAMPAIGN_PAYMENT_DISCLOSURES.ar
          : language === "fr"
            ? CAMPAIGN_PAYMENT_DISCLOSURES.fr
            : CAMPAIGN_PAYMENT_DISCLOSURES.en;
      const sourceWithDisclosure = input.includesPayment
        ? `${input.sourceText}\n\n${disclosure}`
        : input.sourceText;

      if (isBase) {
        variants.push({
          languageVariantId: randomUUID(),
          language,
          locale,
          direction: isRtlLanguage(language) ? "rtl" : "ltr",
          strategy: "source_language_only",
          sourceText: sourceWithDisclosure,
          translatedText: sourceWithDisclosure,
          transcreatedText: sourceWithDisclosure,
          provider: "deterministic",
          model: "none",
          qualityScore: 0.9,
          semanticPreservationScore: 1,
          compliancePreservationScore: 1,
          protectedTermChecks: input.protectedTerms.map((term) => ({
            term,
            preserved: true,
          })),
          requiresReview: false,
          reviewReasonCodes: [],
          status: "draft",
        });
        continue;
      }

      if (input.translationProviderDisabled) {
        variants.push({
          languageVariantId: randomUUID(),
          language,
          locale,
          direction: isRtlLanguage(language) ? "rtl" : "ltr",
          strategy: "unavailable",
          sourceText: sourceWithDisclosure,
          provider: "unavailable",
          qualityScore: 0,
          semanticPreservationScore: 0,
          compliancePreservationScore: 0,
          requiresReview: true,
          reviewReasonCodes: ["translation_unavailable"],
          status: "pending_review",
        });
        continue;
      }

      try {
        const response = await this.aiClient.postCampaignTranscreate(
          {
            schemaVersion: "1.0",
            sourceVariant: {
              headline: `Practical systems for ${input.businessType}`,
              primaryText: sourceWithDisclosure,
              shortText: sourceWithDisclosure.slice(0, 280),
              cta: "request_consultation",
              hashtags: ["#Miraaj"],
              keywords: [],
              disclosures: input.includesPayment ? [disclosure] : [],
              direction: isRtlLanguage(input.baseLanguage) ? "rtl" : "ltr",
            },
            sourceLanguage: input.baseLanguage,
            targetLanguage: language,
            targetLocale: locale,
            ...(countryCode ? { countryCode } : {}),
            businessSector: input.businessType,
            protectedTerms: input.protectedTerms,
            brandTerminology: input.protectedTerms,
            paymentServicePresent: input.includesPayment,
            localizationMode: "transcreation",
          },
          {
            ...(input.requestId ? { requestId: input.requestId } : {}),
            ...(input.correlationId ? { correlationId: input.correlationId } : {}),
          },
        );

        const accepted = response.accepted === true;
        const data =
          response.data && typeof response.data === "object"
            ? (response.data as Record<string, unknown>)
            : null;
        const providerVariant =
          data?.variant && typeof data.variant === "object"
            ? (data.variant as Record<string, unknown>)
            : null;
        const transcreatedText =
          typeof providerVariant?.primaryText === "string" &&
          providerVariant.primaryText.length > 0
            ? providerVariant.primaryText
            : sourceWithDisclosure;
        const reviewCodes = Array.isArray(data?.reviewReasonCodes)
          ? (data.reviewReasonCodes as string[])
          : [];
        const semanticScore =
          typeof data?.semanticPreservationScore === "number"
            ? data.semanticPreservationScore
            : 0.9;
        const requiresReview =
          Boolean(data?.requiresReview) ||
          !accepted ||
          semanticScore < this.environment.CAMPAIGN_SEMANTIC_PRESERVATION_MIN;

        if (!accepted) {
          reviewCodes.push("translation_unavailable");
        }
        if (semanticScore < this.environment.CAMPAIGN_SEMANTIC_PRESERVATION_MIN) {
          reviewCodes.push("semantic_drift");
        }

        variants.push({
          languageVariantId: randomUUID(),
          language,
          locale,
          direction: isRtlLanguage(language) ? "rtl" : "ltr",
          strategy: "transcreation",
          sourceText: sourceWithDisclosure,
          translatedText: transcreatedText,
          transcreatedText,
          provider:
            typeof data?.provider === "string" ? data.provider : "campaign-provider",
          model: typeof data?.model === "string" ? data.model : "",
          qualityScore: typeof providerVariant?.confidence === "number"
            ? providerVariant.confidence
            : 0.85,
          semanticPreservationScore: semanticScore,
          compliancePreservationScore: input.includesPayment ? 0.97 : 0.95,
          protectedTermChecks: input.protectedTerms.map((term) => ({
            term,
            preserved: transcreatedText.includes(term),
          })),
          requiresReview,
          reviewReasonCodes: [...new Set(reviewCodes)],
          status: requiresReview ? "pending_review" : "draft",
        });

        this.logger.info(
          {
            event: "ai.campaign.transcreation.completed",
            language,
            locale,
            requiresReview,
          },
          "Campaign language variant transcreated",
        );
      } catch {
        variants.push({
          languageVariantId: randomUUID(),
          language,
          locale,
          direction: isRtlLanguage(language) ? "rtl" : "ltr",
          strategy: "unavailable",
          sourceText: sourceWithDisclosure,
          provider: "unavailable",
          qualityScore: 0,
          semanticPreservationScore: 0,
          compliancePreservationScore: 0,
          requiresReview: true,
          reviewReasonCodes: ["translation_unavailable", "language_variant_failed"],
          status: "pending_review",
        });
      }
    }
    return variants;
  }

  private buildCarouselBriefs(input: {
    platforms: CampaignPlatform[];
    language: string;
    locale: string;
    businessType: string;
    services: string[];
    includesPayment: boolean;
  }) {
    return input.platforms
      .filter((platform) =>
        ["facebook", "instagram", "linkedin"].includes(platform),
      )
      .map((platform) => ({
        carouselBriefId: randomUUID(),
        carouselTitle: `${input.businessType} capability walkthrough`,
        objective: "education",
        platform,
        language: input.language,
        locale: input.locale,
        maximumSlides: 6,
        coverSlide: {
          headline: `Systems for ${input.businessType}`,
          body: "Start with approved operational foundations.",
          purpose: "cover",
        },
        educationalSlides: input.services.slice(0, 3).map((service) => ({
          headline: service,
          body: "Capability description from the approved service catalog only.",
          purpose: "education",
        })),
        ctaSlide: {
          headline: "Request a consultation",
          body: "No guaranteed outcomes. Discovery first.",
          purpose: "cta",
        },
        requiredDisclosure: input.includesPayment
          ? CAMPAIGN_PAYMENT_DISCLOSURES.en
          : null,
        reviewState: "pending",
      }));
  }

  private buildStorySequences(input: {
    platforms: CampaignPlatform[];
    language: string;
    locale: string;
    businessType: string;
    objective: string;
  }) {
    return input.platforms
      .filter((platform) =>
        ["instagram", "facebook", "whatsapp_status"].includes(platform),
      )
      .map((platform) => ({
        storySequenceId: randomUUID(),
        sequenceTitle: `${input.businessType} story sequence`,
        objective: input.objective,
        platform,
        language: input.language,
        locale: input.locale,
        direction: isRtlLanguage(input.language) ? "rtl" : "ltr",
        frameCount: 4,
        frame1Hook: "Name the operational friction clearly.",
        middleFrames: [
          "Show one approved capability.",
          "Explain the next practical step.",
        ],
        CTAFrame: "Invite a consultation without urgency claims.",
        disclosureFrame: null,
        accessibilityText: "Story sequence describing Miraaj.tech service capabilities.",
        reviewState: "pending",
      }));
  }

  private async failJob(
    campaignJobId: string,
    errorCode: string,
    safeError: string,
  ): Promise<void> {
    await CampaignJobModel.updateOne(
      { campaignJobId },
      {
        status: "failed",
        currentStage: "failed",
        failedAt: new Date(),
        errorCode,
        safeError: safeError.slice(0, 500),
        lastHeartbeatAt: new Date(),
      },
    );
  }

  private async reconcileStaleJobs(): Promise<void> {
    const staleBefore = new Date(
      Date.now() - this.environment.AI_CAMPAIGN_STALE_SECONDS * 1_000,
    );
    const stale = await CampaignJobModel.find({
      status: {
        $in: [
          "active",
          "loading_source",
          "building_brief",
          "building_strategy",
          "generating_master",
          "generating_platforms",
          "transcreating",
          "validating",
          "scoring",
        ],
      },
      lastHeartbeatAt: { $lt: staleBefore },
    }).lean();
    for (const job of stale) {
      await this.failJob(
        job.campaignJobId,
        "CAMPAIGN_PROVIDER_TIMEOUT",
        "Campaign job became stale and was reconciled.",
      );
      await this.queueService.moveToDeadLetter({
        campaignJobId: job.campaignJobId,
        errorCode: "CAMPAIGN_PROVIDER_TIMEOUT",
        message: "Stale campaign job reconciled.",
      });
    }
  }
}
