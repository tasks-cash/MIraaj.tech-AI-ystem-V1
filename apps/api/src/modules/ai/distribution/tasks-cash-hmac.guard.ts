import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { loadEnvironment } from "../../../environment.js";

const seenNonces = new Map<string, number>();
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

@Injectable()
export class TasksCashHmacGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const environment = loadEnvironment();
    if (!environment.TASKS_CASH_INTEGRATION_ENABLED) throw new UnauthorizedException("TASKS_CASH_INTEGRATION_DISABLED");
    const request = context.switchToHttp().getRequest<{ method: string; originalUrl: string; body?: unknown; headers: Record<string, string | undefined> }>();
    const timestamp = Number(request.headers["x-tasks-cash-timestamp"]);
    const nonce = request.headers["x-tasks-cash-nonce"] ?? "";
    const signature = request.headers["x-tasks-cash-signature"] ?? "";
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 120_000 || !nonce || seenNonces.has(nonce)) throw new UnauthorizedException("TASKS_CASH_AUTHENTICATION_FAILED");
    const bodyHash = createHash("sha256").update(JSON.stringify(request.body ?? {})).digest("hex");
    const canonical = `${request.method.toUpperCase()}\n${request.originalUrl.split("?")[0]}\n${timestamp}\n${nonce}\n${bodyHash}`;
    const expected = createHmac("sha256", environment.TASKS_CASH_HMAC_SECRET).update(canonical).digest("hex");
    if (!safeEqual(expected, signature)) throw new UnauthorizedException("TASKS_CASH_AUTHENTICATION_FAILED");
    const cutoff = Date.now() - 120_000;
    for (const [key, value] of seenNonces) if (value < cutoff) seenNonces.delete(key);
    seenNonces.set(nonce, Date.now());
    return true;
  }
}
