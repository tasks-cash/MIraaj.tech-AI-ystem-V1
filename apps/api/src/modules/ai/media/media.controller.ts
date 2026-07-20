import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import { AdminAuthGuard } from "../guards/admin-auth.guard.js";
import { AiPermissionGuard } from "../guards/ai-permission.guard.js";
import { RequireAiPermission } from "../decorators/require-ai-permission.decorator.js";
import { MediaService } from "./media.service.js";

@Controller("api/admin/ai/media")
@UseGuards(AdminAuthGuard, AiPermissionGuard)
export class MediaController {
  constructor(
    @Inject(MediaService)
    private readonly mediaService: MediaService,
  ) {}

  @Get(":mediaId")
  @RequireAiPermission(AI_PERMISSIONS.MEDIA_READ)
  getMedia(@Param("mediaId") mediaId: string) {
    return this.mediaService.getMedia(mediaId);
  }
}
