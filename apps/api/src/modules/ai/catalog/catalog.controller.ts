import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import type {
  AudienceType,
  BusinessNeedCode,
  BusinessType,
  ServiceCategoryCode,
} from "@miraaj/shared-types";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import {
  CatalogService,
  type CreateServiceCatalogItemInput,
  type PatchServiceCatalogItemInput,
} from "./catalog.service.js";

@Controller("api/admin/ai/service-catalog")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class CatalogController {
  constructor(
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
  ) {}

  @Get("categories")
  @RequireAiPermission(AI_PERMISSIONS.SERVICE_CATALOG_READ)
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Get("services")
  @RequireAiPermission(AI_PERMISSIONS.SERVICE_CATALOG_READ)
  listServices(
    @Query("categoryCode") categoryCode?: ServiceCategoryCode,
    @Query("status") status?: string,
    @Query("businessType") businessType?: BusinessType,
    @Query("limit") limit?: string,
  ) {
    const params: Parameters<CatalogService["listServices"]>[0] = {};
    if (categoryCode) params.categoryCode = categoryCode;
    if (status) params.status = status;
    if (businessType) params.businessType = businessType;
    if (limit) params.limit = Number(limit);
    return this.catalogService.listServices(params);
  }

  @Get("services/:slug")
  @RequireAiPermission(AI_PERMISSIONS.SERVICE_CATALOG_READ)
  getService(@Param("slug") slug: string) {
    return this.catalogService.getService(slug);
  }

  @Post("services")
  @RequireAiPermission(AI_PERMISSIONS.SERVICE_CATALOG_CREATE)
  createService(
    @Body()
    body: CreateServiceCatalogItemInput & {
      supportedBusinessTypes: BusinessType[];
      supportedAudienceTypes: AudienceType[];
      targetNeeds: BusinessNeedCode[];
    },
  ) {
    return this.catalogService.createService(body);
  }

  @Patch("services/:slug")
  @RequireAiPermission(AI_PERMISSIONS.SERVICE_CATALOG_UPDATE)
  patchService(
    @Param("slug") slug: string,
    @Body() body: PatchServiceCatalogItemInput,
  ) {
    return this.catalogService.patchService(slug, body);
  }

  @Get("versions")
  @RequireAiPermission(AI_PERMISSIONS.SERVICE_CATALOG_READ)
  listVersions() {
    return this.catalogService.listVersions();
  }

  @Post("versions")
  @RequireAiPermission(AI_PERMISSIONS.SERVICE_CATALOG_CREATE)
  createVersion(@Body() body: { notes?: string }) {
    return this.catalogService.createVersion(body);
  }

  @Post("versions/:versionId/activate")
  @RequireAiPermission(AI_PERMISSIONS.SERVICE_CATALOG_PUBLISH)
  activateVersion(@Param("versionId") versionId: string) {
    return this.catalogService.activateVersion(versionId);
  }

  @Get("bundles")
  @RequireAiPermission(AI_PERMISSIONS.SERVICE_CATALOG_READ)
  listBundles() {
    return this.catalogService.listBundles();
  }

  @Get("matching-policies")
  @RequireAiPermission(AI_PERMISSIONS.MATCHING_POLICIES_READ)
  listMatchingPolicies() {
    return this.catalogService.listMatchingPolicies();
  }
}
