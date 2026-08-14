import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { verifyParticipantContextToken } from "@miraaj/shared-config";
import { loadEnvironment } from "../../../environment.js";
import type { CampaignTaskParticipantRequest } from "../types/campaign-task-participant-request.js";

@Injectable()
export class CampaignTaskParticipantAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const environment = loadEnvironment();
    const request = context
      .switchToHttp()
      .getRequest<CampaignTaskParticipantRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        code: "CAMPAIGN_TASK_PARTICIPANT_AUTH_REQUIRED",
        message: "Participant authentication is required.",
      });
    }
    const token = authorization.slice("Bearer ".length).trim();
    const secret = environment.CAMPAIGN_TASK_PARTICIPANT_API_TOKEN;

    let tenantId: string | undefined;
    let participantId: string | undefined;

    try {
      const ctx = verifyParticipantContextToken(token, secret);
      tenantId = ctx.tenantId;
      participantId = ctx.participantId;
    } catch {
      // Reject admin or any other non-participant token on this boundary.
      throw new UnauthorizedException({
        code: "CAMPAIGN_TASK_PARTICIPANT_AUTH_INVALID",
        message: "Participant authentication is invalid.",
      });
    }

    if (!tenantId || !participantId) {
      throw new UnauthorizedException({
        code: "CAMPAIGN_TASK_PARTICIPANT_CONTEXT_REQUIRED",
        message: "Participant tenant and identity are required.",
      });
    }
    request.participantContext = { tenantId, participantId };
    return true;
  }
}
