import type { CacheService } from "@maraaj/cache";
import { progressiveLoginDelayMs } from "@maraaj/auth";

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS_PER_WINDOW = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * IP-based login rate limit (Redis) + progressive per-account delay.
 * Returns false when the IP is over the limit.
 */
export async function consumeLoginRateLimit(
  cache: CacheService,
  ip: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = cache.rateLimitKey(`login:${ip || "unknown"}`, String(window));
  const current = (await cache.getJson<number>(key)) ?? 0;
  if (current >= MAX_ATTEMPTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
  }
  await cache.setJson(key, current + 1, WINDOW_SECONDS);
  return { allowed: true };
}

export async function applyProgressiveDelay(failedAttempts: number): Promise<void> {
  const ms = progressiveLoginDelayMs(failedAttempts);
  if (ms > 0) await sleep(ms);
}
