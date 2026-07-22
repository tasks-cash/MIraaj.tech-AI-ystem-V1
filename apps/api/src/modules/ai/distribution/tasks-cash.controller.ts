import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { DistributionService } from "./distribution.service.js";
import { TasksCashHmacGuard } from "./tasks-cash-hmac.guard.js";
import {
  assignmentIdentitySchema,
  completeProofRequestSchema,
  createDistributionAssignmentRequestSchema,
  createProofUploadSessionRequestSchema,
} from "./distribution.contracts.js";

const parse = <T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException("TASKS_CASH_CONTRACT_INVALID");
  return result.data;
};

type IntegrationRequest = { headers: Record<string, string | undefined> };
const identity = (request: IntegrationRequest) => parse(assignmentIdentitySchema, {
  apiVersion: request.headers["x-miraaj-api-version"],
  externalUserId: request.headers["x-tasks-cash-external-user-id"],
});

@Controller("api/integrations/tasks-cash/distribution")
@UseGuards(TasksCashHmacGuard)
export class TasksCashDistributionController {
  constructor(@Inject(DistributionService) private readonly service: DistributionService) {}

  @Post("assignments")
  createAssignment(@Body() body: unknown, @Req() req: IntegrationRequest) {
    return this.service.createAssignment(parse(createDistributionAssignmentRequestSchema, body), "tasks-cash", req.headers["idempotency-key"] ?? "");
  }
  @Get("assignments/:externalAssignmentId")
  getAssignment(@Param("externalAssignmentId") id: string, @Req() req: IntegrationRequest) {
    return this.service.assignmentPackage(id, identity(req).externalUserId);
  }
  @Post("assignments/:externalAssignmentId/cancel")
  cancelAssignment(@Param("externalAssignmentId") id: string, @Req() req: IntegrationRequest) {
    return this.service.cancelAssignment(id, identity(req).externalUserId);
  }
  @Post("proofs/upload-session")
  uploadSession(@Body() body: unknown, @Req() req: IntegrationRequest) {
    return this.service.createProofUploadSession(parse(createProofUploadSessionRequestSchema, body), "tasks-cash", req.headers["idempotency-key"] ?? "");
  }
  @Post("proofs/:proofSubmissionId/complete")
  complete(@Param("proofSubmissionId") id: string, @Body() body: unknown) {
    const parsed = parse(completeProofRequestSchema, body);
    return this.service.completeProof(id, parsed.externalUserId);
  }
  @Get("proofs/:proofSubmissionId/status")
  status(@Param("proofSubmissionId") id: string, @Req() req: IntegrationRequest) {
    return this.service.getProofForExternalUser(id, identity(req).externalUserId);
  }
}
