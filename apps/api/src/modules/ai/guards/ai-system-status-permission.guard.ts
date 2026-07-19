import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AI_PERMISSIONS } from "@miraaj/shared-config";

export interface TemporaryAdminRequest {
  headers: {
    authorization?: string;
  };
  adminPermissions?: readonly string[];
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

@Injectable()
export class AiSystemStatusPermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TemporaryAdminRequest>();
    if (
      !request.adminPermissions?.includes(
        AI_PERMISSIONS.SYSTEM_STATUS_READ,
      )
    ) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_PERMISSION",
        message: "The ai.systemStatus.read permission is required.",
      });
    }
    return true;
  }
}
