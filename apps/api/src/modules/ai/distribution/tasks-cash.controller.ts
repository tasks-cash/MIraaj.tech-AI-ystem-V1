import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { DistributionService } from "./distribution.service.js";
import { TasksCashHmacGuard } from "./tasks-cash-hmac.guard.js";

@Controller("api/integrations/tasks-cash/distribution")
@UseGuards(TasksCashHmacGuard)
export class TasksCashDistributionController {
  constructor(@Inject(DistributionService) private readonly service: DistributionService) {}

  @Post("assignments")
  createAssignment(@Body() body: Record<string, unknown>, @Req() req: { headers: Record<string, string | undefined> }) {
    return this.service.createAssignment(body, "tasks-cash", req.headers["idempotency-key"] ?? "");
  }
  @Get("assignments/:externalAssignmentId")
  getAssignment(@Param("externalAssignmentId") id: string) { return this.service.assignmentPackage(id); }
  @Post("assignments/:externalAssignmentId/cancel")
  cancelAssignment(@Param("externalAssignmentId") id: string) { return this.service.cancelAssignment(id); }
  @Post("proofs/upload-session")
  uploadSession(@Body() body: Record<string, unknown>, @Req() req: { headers: Record<string, string | undefined> }) {
    return this.service.createProofUploadSession(body, "tasks-cash", req.headers["idempotency-key"] ?? "");
  }
  @Post("proofs/:proofSubmissionId/complete")
  complete(@Param("proofSubmissionId") id: string, @Body() body: Record<string, unknown>) { return this.service.completeProof(id, typeof body.externalUserId === "string" ? body.externalUserId : ""); }
  @Get("proofs/:proofSubmissionId/status")
  status(@Param("proofSubmissionId") id: string) { return this.service.getProof(id); }
}
