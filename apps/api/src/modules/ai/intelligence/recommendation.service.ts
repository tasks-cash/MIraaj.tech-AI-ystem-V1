import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  PAYMENT_COMPLIANCE_DISCLAIMERS,
  isRegulatedBusinessType,
  type BusinessType,
  type IntelligenceReviewReasonCode,
} from "@miraaj/shared-types";
import {
  ServiceRecommendationSetModel,
  type ServiceRecommendationSetDocument,
} from "../models/service-recommendation-set.schema.js";
import { BusinessProfileModel } from "../models/business-profile.schema.js";
import { BusinessIntelligenceJobModel } from "../models/business-intelligence-job.schema.js";
import { ServiceBundleDefinitionModel } from "../models/service-bundle-definition.schema.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { MatchingEngineService } from "../matching/matching-engine.service.js";
import { PhasePlannerService } from "../matching/phase-planner.service.js";
import { BundleBuilderService } from "../matching/bundle-builder.service.js";
import { BusinessProfileService } from "./business-profile.service.js";
import type { ServiceMatchResult } from "../matching/matching-types.js";
import type { BundleEvaluationResult } from "../matching/bundle-builder.service.js";
import type { PhaseGroup } from "../matching/phase-planner.service.js";

export interface RecommendationSetInput {
  jobId: string;
  analysisResultId: string;
  profileId: string;
  businessType: BusinessType;
  catalogVersionId: string;
  matchingPolicyId: string;
  results: ServiceMatchResult[];
  bundles: BundleEvaluationResult[];
  phasePlan: PhaseGroup[];
}

const RECOMMENDED_STATES = new Set(["recommended", "recommended_with_prerequisites"]);

@Injectable()
export class RecommendationService {
  constructor(
    @Inject(CatalogService) private readonly catalogService: CatalogService,
    @Inject(MatchingEngineService)
    private readonly matchingEngine: MatchingEngineService,
    @Inject(PhasePlannerService)
    private readonly phasePlanner: PhasePlannerService,
    @Inject(BundleBuilderService)
    private readonly bundleBuilder: BundleBuilderService,
    @Inject(BusinessProfileService)
    private readonly businessProfileService: BusinessProfileService,
  ) {}

  buildItemsPayload(results: ServiceMatchResult[]) {
    return results.map((result) => ({
      itemSlug: result.itemSlug,
      categoryCode: result.categoryCode,
      state: result.state,
      score: result.score,
      breakdown: result.breakdown,
      penalties: result.penalties,
      phase: result.phase,
      bundleCodes: [] as string[],
      reasonCodes: result.reasonCodes,
      isPaymentService: result.isPaymentService,
      complianceDisclaimer: result.isPaymentService
        ? { ...PAYMENT_COMPLIANCE_DISCLAIMERS }
        : null,
      providerDependency: result.providerDependency,
    }));
  }

  async createSet(
    input: RecommendationSetInput,
  ): Promise<ServiceRecommendationSetDocument> {
    const reviewReasonCodes = new Set<string>();
    const recommendedCount = input.results.filter((result) =>
      RECOMMENDED_STATES.has(result.state),
    ).length;

    if (recommendedCount === 0) {
      reviewReasonCodes.add("low_recommendation_confidence");
    }
    if (isRegulatedBusinessType(input.businessType)) {
      reviewReasonCodes.add("regulated_domain");
    }
    for (const result of input.results) {
      for (const reasonCode of result.reasonCodes) {
        if (
          [
            "business_type_ambiguous",
            "audience_ambiguous",
            "contradictory_evidence",
            "payment_provider_dependency",
          ].includes(reasonCode)
        ) {
          reviewReasonCodes.add(reasonCode);
        }
      }
    }

    const overallScore =
      recommendedCount === 0
        ? 0
        : input.results
            .filter((result) => RECOMMENDED_STATES.has(result.state))
            .reduce((sum, result) => sum + result.score, 0) / recommendedCount;

    const requiresReview = reviewReasonCodes.size > 0;

    const items = this.buildItemsPayload(input.results).map((item) => ({
      ...item,
      bundleCodes: input.bundles
        .filter((bundle) => bundle.recommendedMemberSlugs.includes(item.itemSlug))
        .map((bundle) => bundle.bundleCode),
    }));

    const set = await ServiceRecommendationSetModel.create({
      setId: randomUUID(),
      jobId: input.jobId,
      analysisResultId: input.analysisResultId,
      profileId: input.profileId,
      catalogVersionId: input.catalogVersionId,
      matchingPolicyId: input.matchingPolicyId,
      status: requiresReview ? "awaiting_review" : "generated",
      items,
      bundles: input.bundles.map((bundle) => ({
        bundleCode: bundle.bundleCode,
        memberSlugs: bundle.memberSlugs,
        recommendedMemberSlugs: bundle.recommendedMemberSlugs,
        coverageRatio: bundle.coverageRatio,
      })),
      phasePlan: input.phasePlan,
      overallScore,
      reviewReasonCodes: [
        ...reviewReasonCodes,
      ] as IntelligenceReviewReasonCode[],
      requiresReview,
    });
    return set.toObject();
  }

  async getSet(setId: string): Promise<ServiceRecommendationSetDocument> {
    const set = await ServiceRecommendationSetModel.findOne({ setId }).lean();
    if (!set) {
      throw new NotFoundException({
        code: "RECOMMENDATION_NOT_FOUND",
        message: "Recommendation set was not found.",
      });
    }
    return set;
  }

  async listSets(input?: { jobId?: string; status?: string; limit?: number }) {
    const query: Record<string, unknown> = {};
    if (input?.jobId) query.jobId = input.jobId;
    if (input?.status) query.status = input.status;
    const limit = Math.min(input?.limit ?? 20, 100);
    const items = await ServiceRecommendationSetModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return { items, limit };
  }

  /** Recomputes recommendations for an existing job's approved profile without re-queuing evidence loading. */
  async recompute(jobId: string): Promise<ServiceRecommendationSetDocument> {
    const job = await BusinessIntelligenceJobModel.findOne({ jobId }).lean();
    if (!job?.profileId) {
      throw new BadRequestException({
        code: "BUSINESS_PROFILE_NOT_FOUND",
        message: "Job has no associated business profile to recompute from.",
      });
    }
    const profile = await BusinessProfileModel.findOne({
      profileId: job.profileId,
    }).lean();
    if (!profile) {
      throw new NotFoundException({
        code: "BUSINESS_PROFILE_NOT_FOUND",
        message: "Business profile was not found.",
      });
    }
    if (profile.status === "rejected") {
      throw new BadRequestException({
        code: "BUSINESS_PROFILE_REVIEW_REQUIRED",
        message: "Business profile was rejected and cannot drive recommendations.",
      });
    }

    const catalogVersion = await this.catalogService.getActiveVersionOrThrow();
    const policy = await this.catalogService.getActiveMatchingPolicyOrThrow();
    const catalogItems = await this.catalogService.getActiveCatalogItems(
      catalogVersion,
    );
    const matchable = this.businessProfileService.toMatchable(
      profile,
    );
    const results = this.matchingEngine.rankAll(
      matchable,
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
    const bundleDefinitions = await ServiceBundleDefinitionModel.find({
      status: "active",
    }).lean();
    const bundles = this.bundleBuilder.evaluateBundles(
      matchable.businessType,
      results,
      bundleDefinitions.map((bundle) => ({
        code: bundle.code,
        memberSlugs: bundle.memberSlugs,
        applicableBusinessTypes: bundle.applicableBusinessTypes,
      })),
    );
    const phasePlan = this.phasePlanner.buildPlan(results);

    await ServiceRecommendationSetModel.updateMany(
      { jobId, status: { $in: ["generated", "awaiting_review"] } },
      { status: "superseded" },
    );

    return this.createSet({
      jobId,
      analysisResultId: job.analysisResultId,
      profileId: profile.profileId,
      businessType: matchable.businessType,
      catalogVersionId: catalogVersion.versionId,
      matchingPolicyId: policy.policyId,
      results,
      bundles,
      phasePlan,
    });
  }
}
