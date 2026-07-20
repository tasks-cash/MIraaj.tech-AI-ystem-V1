import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ALL_TEMPORARY_ADMIN_PERMISSIONS } from "@miraaj/shared-config";
import { loadEnvironment } from "../../../environment.js";
import { secureTokenEquals } from "../../../internal-auth.js";
import type { TemporaryAdminRequest } from "../types/admin-request.js";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const environment = loadEnvironment();
    const request = context
      .switchToHttp()
      .getRequest<TemporaryAdminRequest>();
    if (!environment.TEMPORARY_ADMIN_TOKEN_ENABLED) {
      throw new UnauthorizedException({
        code: "TEMPORARY_ADMIN_AUTH_DISABLED",
        message: "Temporary administrator authentication is disabled.",
      });
    }
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Admin authentication is required.",
      });
    }
    const token = authorization.slice("Bearer ".length).trim();
    if (!secureTokenEquals(environment.ADMIN_API_TOKEN, token)) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Admin authentication is required.",
      });
    }
    request.adminPermissions = ALL_TEMPORARY_ADMIN_PERMISSIONS;
    return true;
  }
}
