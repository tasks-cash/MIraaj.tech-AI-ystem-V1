import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  AudienceType,
  BusinessNeedCode,
  BusinessType,
  ServiceCategoryCode,
} from "@miraaj/shared-types";
import { ServiceCategoryModel } from "../models/service-category.schema.js";
import {
  ServiceCatalogItemModel,
  type ServiceCatalogItemDocument,
} from "../models/service-catalog-item.schema.js";
import {
  ServiceCatalogVersionModel,
  type ServiceCatalogVersionDocument,
} from "../models/service-catalog-version.schema.js";
import {
  ServiceMatchingPolicyModel,
  type ServiceMatchingPolicyDocument,
} from "../models/service-matching-policy.schema.js";
import { ServiceBundleDefinitionModel } from "../models/service-bundle-definition.schema.js";

export interface CreateServiceCatalogItemInput {
  slug: string;
  categoryCode: ServiceCategoryCode;
  name: string;
  description: string;
  supportedBusinessTypes: BusinessType[];
  supportedAudienceTypes: AudienceType[];
  targetNeeds: BusinessNeedCode[];
  requiresProfessionalAudience?: boolean;
  requiresDecisionMakerEvidence?: boolean;
  isPaymentService?: boolean;
  isRegulatedDomainOnly?: boolean;
  providerDependency?: string | null;
  phase?: number;
  bundleEligible?: boolean;
  tags?: string[];
}

export interface PatchServiceCatalogItemInput {
  name?: string;
  description?: string;
  status?: "draft" | "active" | "paused" | "deprecated" | "archived";
  supportedBusinessTypes?: BusinessType[];
  supportedAudienceTypes?: AudienceType[];
  targetNeeds?: BusinessNeedCode[];
  requiresProfessionalAudience?: boolean;
  requiresDecisionMakerEvidence?: boolean;
  isPaymentService?: boolean;
  isRegulatedDomainOnly?: boolean;
  providerDependency?: string | null;
  phase?: number;
  bundleEligible?: boolean;
  tags?: string[];
}

@Injectable()
export class CatalogService {
  async listCategories() {
    const categories = await ServiceCategoryModel.find()
      .sort({ sortOrder: 1 })
      .lean();
    return { items: categories };
  }

  async listServices(filter?: {
    categoryCode?: ServiceCategoryCode;
    status?: string;
    businessType?: BusinessType;
    limit?: number;
  }) {
    const query: Record<string, unknown> = {};
    if (filter?.categoryCode) {
      query.categoryCode = filter.categoryCode;
    }
    if (filter?.status) {
      query.status = filter.status;
    }
    if (filter?.businessType) {
      query.supportedBusinessTypes = filter.businessType;
    }
    const limit = Math.min(filter?.limit ?? 200, 500);
    const items = await ServiceCatalogItemModel.find(query)
      .sort({ categoryCode: 1, slug: 1 })
      .limit(limit)
      .lean();
    return { items, total: items.length };
  }

  async getService(slug: string) {
    const item = await ServiceCatalogItemModel.findOne({ slug }).lean();
    if (!item) {
      throw new NotFoundException({
        code: "SERVICE_CATALOG_ITEM_NOT_FOUND",
        message: "Service catalog item was not found.",
      });
    }
    return item;
  }

  async createService(input: CreateServiceCatalogItemInput) {
    const existing = await ServiceCatalogItemModel.findOne({
      slug: input.slug,
    }).lean();
    if (existing) {
      throw new BadRequestException({
        code: "SERVICE_CATALOG_ITEM_ALREADY_EXISTS",
        message: "A service with this slug already exists.",
      });
    }
    const item = await ServiceCatalogItemModel.create({
      itemId: randomUUID(),
      slug: input.slug,
      categoryCode: input.categoryCode,
      name: input.name,
      description: input.description,
      status: "draft",
      supportedBusinessTypes: input.supportedBusinessTypes,
      supportedAudienceTypes: input.supportedAudienceTypes,
      targetNeeds: input.targetNeeds,
      requiresProfessionalAudience: input.requiresProfessionalAudience ?? true,
      requiresDecisionMakerEvidence: input.requiresDecisionMakerEvidence ?? false,
      isPaymentService: input.isPaymentService ?? false,
      isRegulatedDomainOnly: input.isRegulatedDomainOnly ?? false,
      providerDependency: input.providerDependency ?? null,
      phase: input.phase ?? 1,
      bundleEligible: input.bundleEligible ?? true,
      tags: input.tags ?? [],
    });
    return item.toObject();
  }

  async patchService(slug: string, input: PatchServiceCatalogItemInput) {
    const item = await ServiceCatalogItemModel.findOne({ slug });
    if (!item) {
      throw new NotFoundException({
        code: "SERVICE_CATALOG_ITEM_NOT_FOUND",
        message: "Service catalog item was not found.",
      });
    }
    Object.assign(item, input);
    item.version += 1;
    await item.save();
    return item.toObject();
  }

  async listVersions() {
    const versions = await ServiceCatalogVersionModel.find()
      .sort({ version: -1 })
      .lean();
    return { items: versions };
  }

  async createVersion(input?: { notes?: string }) {
    const activeItems = await ServiceCatalogItemModel.find({
      status: "active",
    })
      .select("slug categoryCode")
      .lean();
    const latest = await ServiceCatalogVersionModel.findOne()
      .sort({ version: -1 })
      .lean();
    const nextVersion = (latest?.version ?? 0) + 1;
    const version = await ServiceCatalogVersionModel.create({
      versionId: randomUUID(),
      version: nextVersion,
      status: "draft",
      itemSlugs: activeItems.map((item) => item.slug),
      categoryCodes: [...new Set(activeItems.map((item) => item.categoryCode))],
      notes: input?.notes ?? "",
    });
    return version.toObject();
  }

  async activateVersion(versionId: string) {
    const version = await ServiceCatalogVersionModel.findOne({ versionId });
    if (!version) {
      throw new NotFoundException({
        code: "SERVICE_CATALOG_NOT_FOUND",
        message: "Catalog version was not found.",
      });
    }
    await ServiceCatalogVersionModel.updateMany(
      { status: "active" },
      { status: "deprecated", deprecatedAt: new Date() },
    );
    version.status = "active";
    version.activatedAt = new Date();
    await version.save();
    return version.toObject();
  }

  async getActiveVersionOrThrow(): Promise<ServiceCatalogVersionDocument> {
    const version = await ServiceCatalogVersionModel.findOne({
      status: "active",
    });
    if (!version) {
      throw new BadRequestException({
        code: "SERVICE_CATALOG_NO_ACTIVE_VERSION",
        message: "No active service catalog version is configured.",
      });
    }
    return version;
  }

  async getActiveMatchingPolicyOrThrow(): Promise<ServiceMatchingPolicyDocument> {
    const policy = await ServiceMatchingPolicyModel.findOne({
      status: "active",
    });
    if (!policy) {
      throw new BadRequestException({
        code: "MATCHING_POLICY_NOT_FOUND",
        message: "No active service matching policy is configured.",
      });
    }
    return policy;
  }

  async getActiveCatalogItems(
    catalogVersion: ServiceCatalogVersionDocument,
  ): Promise<ServiceCatalogItemDocument[]> {
    return ServiceCatalogItemModel.find({
      slug: { $in: catalogVersion.itemSlugs },
      status: "active",
    }).lean();
  }

  async listMatchingPolicies() {
    const policies = await ServiceMatchingPolicyModel.find()
      .sort({ version: -1 })
      .lean();
    return { items: policies };
  }

  async listBundles() {
    const bundles = await ServiceBundleDefinitionModel.find()
      .sort({ code: 1 })
      .lean();
    return { items: bundles };
  }
}
