import { Injectable, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import { loadEnvironment } from "../../../environment.js";
import { ServiceCategoryModel } from "../models/service-category.schema.js";
import { ServiceCatalogItemModel } from "../models/service-catalog-item.schema.js";
import { ServiceCatalogVersionModel } from "../models/service-catalog-version.schema.js";
import { ServiceMatchingPolicyModel } from "../models/service-matching-policy.schema.js";
import { ServiceBundleDefinitionModel } from "../models/service-bundle-definition.schema.js";
import {
  CATALOG_SEED_BUNDLES,
  CATALOG_SEED_CATEGORIES,
  CATALOG_SEED_SERVICES,
} from "./catalog-seed-data.js";

export const CATALOG_SEED_VERSION_NUMBER = 1;
export const MATCHING_POLICY_SEED_VERSION_NUMBER = 1;

/** Default weight distribution — sums to 1.0 across all scoring dimensions. */
export const DEFAULT_MATCHING_WEIGHTS = {
  businessTypeFit: 0.16,
  industryFit: 0.05,
  organizationFit: 0.04,
  audienceFit: 0.12,
  decisionMakerFit: 0.06,
  professionalContextFit: 0.06,
  needFit: 0.14,
  painPointFit: 0.05,
  objectiveFit: 0.04,
  digitalMaturityFit: 0.03,
  businessStageFit: 0.03,
  marketFit: 0.03,
  languageFit: 0.02,
  channelFit: 0.02,
  integrationFit: 0.02,
  urgencyFit: 0.02,
  securityFit: 0.02,
  paymentReadinessFit: 0.02,
  automationReadinessFit: 0.02,
  capabilityAvailabilityFit: 0.02,
  prerequisiteFit: 0.02,
  complianceFit: 0.03,
} as const;

export const DEFAULT_MATCHING_PENALTIES = {
  consumerAudiencePenalty: 1.0,
  audienceAmbiguityPenalty: 0.1,
  businessTypeAmbiguityPenalty: 0.1,
  contradictionPenalty: 0.15,
  unsupportedMarketPenalty: 0.5,
  unavailableCapabilityPenalty: 0.5,
  missingPrerequisitePenalty: 0.2,
  regulatedDomainPenalty: 0.05,
  providerDependencyPenalty: 0.05,
  lowEvidencePenalty: 0.1,
  duplicateRecommendationPenalty: 0.1,
  incompatibleServicePenalty: 0.3,
} as const;

@Injectable()
export class CatalogSeedService implements OnModuleInit {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  async onModuleInit(): Promise<void> {
    await this.seedAll();
  }

  /** Idempotent: safe to invoke on every boot without duplicating documents. */
  async seedAll(): Promise<{
    categories: number;
    items: number;
    bundles: number;
    catalogVersionActivated: boolean;
    policyActivated: boolean;
  }> {
    await this.seedCategories();
    const itemsSeeded = await this.seedItems();
    await this.seedBundles();
    const catalogVersionActivated = await this.seedActiveCatalogVersion();
    const policyActivated = await this.seedActiveMatchingPolicy();

    this.logger.info(
      {
        event: "ai.intelligence.catalog.seeded",
        items: itemsSeeded,
        catalogVersionActivated,
        policyActivated,
      },
      "Service catalog seed reconciled",
    );

    return {
      categories: CATALOG_SEED_CATEGORIES.length,
      items: itemsSeeded,
      bundles: CATALOG_SEED_BUNDLES.length,
      catalogVersionActivated,
      policyActivated,
    };
  }

  private async seedCategories(): Promise<void> {
    for (const category of CATALOG_SEED_CATEGORIES) {
      await ServiceCategoryModel.updateOne(
        { code: category.code },
        {
          $setOnInsert: { categoryId: randomUUID(), code: category.code },
          $set: {
            name: category.name,
            description: category.description,
            sortOrder: category.sortOrder,
            status: "active",
          },
        },
        { upsert: true },
      );
    }
  }

  private async seedItems(): Promise<number> {
    for (const item of CATALOG_SEED_SERVICES) {
      await ServiceCatalogItemModel.updateOne(
        { slug: item.slug },
        {
          $setOnInsert: { itemId: randomUUID(), slug: item.slug },
          $set: {
            categoryCode: item.categoryCode,
            name: item.name,
            description: item.description,
            status: "active",
            supportedBusinessTypes: item.supportedBusinessTypes,
            supportedAudienceTypes: item.supportedAudienceTypes,
            targetNeeds: item.targetNeeds,
            requiresProfessionalAudience: item.requiresProfessionalAudience,
            requiresDecisionMakerEvidence: item.requiresDecisionMakerEvidence,
            isPaymentService: item.isPaymentService,
            isRegulatedDomainOnly: item.isRegulatedDomainOnly,
            providerDependency: item.providerDependency,
            prerequisiteSlugs: item.prerequisiteSlugs,
            phase: item.phase,
            bundleEligible: item.bundleEligible,
            tags: item.tags,
            availability: item.availability,
          },
        },
        { upsert: true },
      );
    }
    return ServiceCatalogItemModel.countDocuments({ status: "active" });
  }

  private async seedBundles(): Promise<void> {
    for (const bundle of CATALOG_SEED_BUNDLES) {
      await ServiceBundleDefinitionModel.updateOne(
        { code: bundle.code },
        {
          $setOnInsert: { bundleId: randomUUID(), code: bundle.code },
          $set: {
            name: bundle.name,
            description: bundle.description,
            memberSlugs: bundle.memberSlugs,
            applicableBusinessTypes: bundle.applicableBusinessTypes,
            status: "active",
          },
        },
        { upsert: true },
      );
    }
  }

  private async seedActiveCatalogVersion(): Promise<boolean> {
    const existingActive = await ServiceCatalogVersionModel.findOne({
      status: "active",
    }).lean();
    if (existingActive) {
      return false;
    }
    const existingVersion = await ServiceCatalogVersionModel.findOne({
      version: CATALOG_SEED_VERSION_NUMBER,
    });
    const itemSlugs = CATALOG_SEED_SERVICES.map((item) => item.slug);
    const categoryCodes = CATALOG_SEED_CATEGORIES.map((category) => category.code);
    if (existingVersion) {
      existingVersion.status = "active";
      existingVersion.itemSlugs = itemSlugs;
      existingVersion.categoryCodes = categoryCodes;
      existingVersion.activatedAt = new Date();
      await existingVersion.save();
      return true;
    }
    await ServiceCatalogVersionModel.create({
      versionId: randomUUID(),
      version: CATALOG_SEED_VERSION_NUMBER,
      status: "active",
      itemSlugs,
      categoryCodes,
      notes: "Prompt 3 initial seed — build/manage/AI/automation/payments/cybersecurity/cloud/analytics/growth/consulting.",
      activatedAt: new Date(),
    });
    return true;
  }

  private async seedActiveMatchingPolicy(): Promise<boolean> {
    const existingActive = await ServiceMatchingPolicyModel.findOne({
      status: "active",
    }).lean();
    if (existingActive) {
      return false;
    }
    const existingVersion = await ServiceMatchingPolicyModel.findOne({
      version: MATCHING_POLICY_SEED_VERSION_NUMBER,
    });
    const policyFields = {
      status: "active" as const,
      weights: DEFAULT_MATCHING_WEIGHTS,
      penalties: DEFAULT_MATCHING_PENALTIES,
      autoApproveMin: this.environment.SERVICE_MATCH_AUTO_APPROVE_MIN,
      reviewMin: this.environment.SERVICE_MATCH_REVIEW_MIN,
      decisionMakerMin: this.environment.SERVICE_MATCH_DECISION_MAKER_MIN,
      professionalContextMin: this.environment.SERVICE_MATCH_PROFESSIONAL_CONTEXT_MIN,
      primaryLimit: this.environment.SERVICE_MATCH_PRIMARY_LIMIT,
      supportingLimit: this.environment.SERVICE_MATCH_SUPPORTING_LIMIT,
      optionalLimit: this.environment.SERVICE_MATCH_OPTIONAL_LIMIT,
      futureLimit: this.environment.SERVICE_MATCH_FUTURE_LIMIT,
      activatedAt: new Date(),
    };
    if (existingVersion) {
      Object.assign(existingVersion, policyFields);
      await existingVersion.save();
      return true;
    }
    await ServiceMatchingPolicyModel.create({
      policyId: randomUUID(),
      version: MATCHING_POLICY_SEED_VERSION_NUMBER,
      notes: "Prompt 3 initial deterministic matching policy.",
      ...policyFields,
    });
    return true;
  }
}
