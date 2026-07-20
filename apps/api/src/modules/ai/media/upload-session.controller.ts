import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import {
  UploadSessionService,
} from "./upload-session.service.js";

@Controller("api/admin/ai/media/upload-sessions")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class UploadSessionController {
  constructor(
    @Inject(UploadSessionService)
    private readonly uploadSessionService: UploadSessionService,
  ) {}

  @Post()
  @RequireAiPermission(AI_PERMISSIONS.MEDIA_CREATE)
  createSession(@Body() body: Record<string, unknown>) {
    const originalFilename = body.originalFilename;
    const declaredMimeType =
      body.declaredMimeType ?? body.expectedMime ?? body.expectedContentType;
    const declaredSizeBytes =
      body.declaredSizeBytes ?? body.expectedBytes ?? body.expectedSize;
    if (
      typeof originalFilename !== "string" ||
      typeof declaredMimeType !== "string" ||
      typeof declaredSizeBytes !== "number"
    ) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "Upload session payload is invalid.",
      });
    }
    return this.uploadSessionService.createSession({
      originalFilename,
      declaredMimeType,
      declaredSizeBytes,
    });
  }

  @Post(":sessionId/complete")
  @RequireAiPermission(AI_PERMISSIONS.MEDIA_CREATE)
  completeSession(@Param("sessionId") sessionId: string) {
    return this.uploadSessionService.completeSession(sessionId);
  }

  @Get(":sessionId")
  @RequireAiPermission(AI_PERMISSIONS.MEDIA_READ)
  getSession(@Param("sessionId") sessionId: string) {
    return this.uploadSessionService.getSession(sessionId);
  }
}
