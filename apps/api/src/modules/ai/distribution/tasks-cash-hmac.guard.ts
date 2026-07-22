import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { loadEnvironment } from "../../../environment.js";
import { signTasksCashRequest, TASKS_CASH_CLOCK_SKEW_MS } from "./distribution.contracts.js";
import { TasksCashReplayService } from "./tasks-cash-replay.service.js";

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

@Injectable()
export class TasksCashHmacGuard implements CanActivate {
  constructor(@Inject(TasksCashReplayService) private readonly replay: TasksCashReplayService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const environment = loadEnvironment();
    if (!environment.TASKS_CASH_INTEGRATION_ENABLED) throw new UnauthorizedException("TASKS_CASH_INTEGRATION_DISABLED");
    const request = context.switchToHttp().getRequest<{ method: string; originalUrl: string; body?: unknown; headers: Record<string, string | undefined> }>();
    const timestamp = Number(request.headers["x-tasks-cash-timestamp"]);
    const nonce = request.headers["x-tasks-cash-nonce"] ?? "";
    const signature = request.headers["x-tasks-cash-signature"] ?? "";
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > TASKS_CASH_CLOCK_SKEW_MS || !nonce) throw new UnauthorizedException("TASKS_CASH_AUTHENTICATION_FAILED");
    const expected = signTasksCashRequest(environment.TASKS_CASH_HMAC_SECRET, {
      method: request.method,
      path: request.originalUrl.split("?")[0] ?? request.originalUrl,
      timestamp,
      nonce,
      body: request.body ?? {},
    });
    if (!safeEqual(expected, signature)) throw new UnauthorizedException("TASKS_CASH_AUTHENTICATION_FAILED");
    if (!(await this.replay.reserve(nonce, timestamp))) throw new UnauthorizedException("TASKS_CASH_AUTHENTICATION_FAILED");
    return true;
  }
}
