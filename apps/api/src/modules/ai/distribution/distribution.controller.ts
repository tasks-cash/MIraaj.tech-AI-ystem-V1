import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import { DistributionService } from "./distribution.service.js";

@Controller("api/admin/ai/distribution")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class DistributionController {
  constructor(@Inject(DistributionService) private readonly service: DistributionService) {}
  private actor(request: { adminUserId?: string }) { return request.adminUserId ?? "temporary-admin"; }

  @Post("templates") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_TEMPLATES_CREATE)
  createTemplate(@Body() body: Record<string, unknown>, @Req() req: { adminUserId?: string }) { return this.service.createTemplate(body, this.actor(req)); }
  @Get("templates") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_TEMPLATES_READ)
  listTemplates() { return this.service.listTemplates(); }
  @Get("templates/:id") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_TEMPLATES_READ)
  getTemplate(@Param("id") id: string) { return this.service.getTemplate(id); }
  @Patch("templates/:id") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_TEMPLATES_UPDATE)
  updateTemplate(@Param("id") id: string, @Body() body: Record<string, unknown>) { return this.service.updateTemplate(id, body); }
  @Post("templates/:id/approve") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_TEMPLATES_APPROVE)
  approveTemplate(@Param("id") id: string, @Req() req: { adminUserId?: string }) { return this.service.transitionTemplate(id, "approved", this.actor(req)); }
  @Post("templates/:id/pause") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_TEMPLATES_PAUSE)
  pauseTemplate(@Param("id") id: string, @Req() req: { adminUserId?: string }) { return this.service.transitionTemplate(id, "paused", this.actor(req)); }
  @Post("templates/:id/archive") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_TEMPLATES_ARCHIVE)
  archiveTemplate(@Param("id") id: string, @Req() req: { adminUserId?: string }) { return this.service.transitionTemplate(id, "archived", this.actor(req)); }

  @Post("templates/:id/copy-variants/generate") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_COPY_GENERATE)
  generateCopy(@Param("id") id: string, @Req() req: { adminUserId?: string }) { return this.service.generateCopy(id, this.actor(req)); }
  @Post("templates/:id/copy-variants") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_COPY_CREATE)
  createCopy(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: { adminUserId?: string }) { return this.service.createCopy(id, body, this.actor(req)); }
  @Get("templates/:id/copy-variants") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_COPY_READ)
  listCopy(@Param("id") id: string) { return this.service.listCopies(id); }
  @Post("copy-variants/:id/approve") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_COPY_APPROVE)
  approveCopy(@Param("id") id: string, @Req() req: { adminUserId?: string }) { return this.service.reviewCopy(id, true, this.actor(req)); }
  @Post("copy-variants/:id/reject") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_COPY_REJECT)
  rejectCopy(@Param("id") id: string, @Req() req: { adminUserId?: string }) { return this.service.reviewCopy(id, false, this.actor(req)); }

  @Post("assignments") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_ASSIGNMENTS_CREATE)
  createAssignment(@Body() body: Record<string, unknown>, @Req() req: { adminUserId?: string; headers: Record<string, string | undefined> }) { return this.service.createAssignment(body, this.actor(req), req.headers["idempotency-key"] ?? ""); }
  @Get("assignments") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_ASSIGNMENTS_READ)
  listAssignments() { return this.service.listAssignments(); }
  @Get("assignments/:id") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_ASSIGNMENTS_READ)
  getAssignment(@Param("id") id: string) { return this.service.assignmentPackage(id); }
  @Post("assignments/:id/cancel") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_ASSIGNMENTS_CANCEL)
  cancelAssignment(@Param("id") id: string) { return this.service.cancelAssignment(id); }
  @Post("assignments/:id/regenerate-package") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_ASSIGNMENTS_REGENERATE_PACKAGE)
  regeneratePackage(@Param("id") id: string) { return this.service.assignmentPackage(id); }

  @Get("proofs") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_PROOFS_READ)
  listProofs() { return this.service.listProofs(); }
  @Get("proofs/:id") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_PROOFS_READ)
  getProof(@Param("id") id: string) { return this.service.getProof(id); }
  @Post("proofs/:id/retry-verification") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_PROOFS_RETRY)
  retryProof(@Param("id") id: string) { return this.service.retryProof(id); }
  @Post("proofs/:id/review") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_PROOFS_REVIEW)
  reviewProof(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: { adminUserId?: string }) { return this.service.reviewProof(id, body, this.actor(req)); }
  @Post("proofs/:id/request-more-evidence") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_PROOFS_REQUEST_EVIDENCE)
  requestEvidence(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: { adminUserId?: string }) { return this.service.reviewProof(id, { ...body, decision: "request_more_evidence" }, this.actor(req)); }

  @Get("tracked-links/:id") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_TRACKING_READ)
  getTracked(@Param("id") id: string) { return this.service.getTrackedLink(id); }
  @Post("tracked-links/:id/revoke") @RequireAiPermission(AI_PERMISSIONS.DISTRIBUTION_TRACKING_REVOKE)
  revokeTracked(@Param("id") id: string) { return this.service.revokeTrackedLink(id); }
}
