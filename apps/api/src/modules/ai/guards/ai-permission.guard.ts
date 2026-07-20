import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AI_PERMISSION_METADATA_KEY } from "../decorators/require-ai-permission.decorator.js";
import type { TemporaryAdminRequest } from "../types/admin-request.js";

@Injectable()
export class AiPermissionGuard implements CanActivate {
  private readonly reflector = new Reflector();

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<
      string | undefined
    >(AI_PERMISSION_METADATA_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredPermission) {
      return true;
    }
    const request = context.switchToHttp().getRequest<TemporaryAdminRequest>();
    if (!request.adminPermissions?.includes(requiredPermission)) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_PERMISSION",
        message: `The ${requiredPermission} permission is required.`,
      });
    }
    return true;
  }
}
