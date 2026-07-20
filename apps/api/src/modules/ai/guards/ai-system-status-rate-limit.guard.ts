import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { TemporaryAdminRequest } from "../types/admin-request.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_TRACKED_CLIENTS = 10_000;

@Injectable()
export class AiSystemStatusRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TemporaryAdminRequest>();
    const clientId =
      request.ip ?? request.socket?.remoteAddress ?? "unknown-client";
    const now = Date.now();
    if (this.attempts.size >= MAX_TRACKED_CLIENTS) {
      for (const [key, entry] of this.attempts) {
        if (entry.resetAt <= now) {
          this.attempts.delete(key);
        }
      }
      if (this.attempts.size >= MAX_TRACKED_CLIENTS) {
        const oldestClient = this.attempts.keys().next().value;
        if (oldestClient) {
          this.attempts.delete(oldestClient);
        }
      }
    }
    const current = this.attempts.get(clientId);

    if (!current || current.resetAt <= now) {
      this.attempts.set(clientId, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
      return true;
    }

    current.count += 1;
    if (current.count > MAX_REQUESTS_PER_WINDOW) {
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: "Too many AI system status requests.",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((current.resetAt - now) / 1_000),
          ),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
