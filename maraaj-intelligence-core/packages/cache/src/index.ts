
import Redis from "ioredis";

export function createRedis(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

export class CacheService {
  constructor(private readonly redis: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds) await this.redis.set(key, payload, "EX", ttlSeconds);
    else await this.redis.set(key, payload);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.redis.del(...keys);
  }

  async setNxEx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.redis.set(key, value, "EX", ttlSeconds, "NX");
    return res === "OK";
  }

  pageKey(projectId: string, publicCode: string, locale: string) {
    return `page:${projectId}:${publicCode}:${locale}`;
  }
  nonceKey(clientId: string, nonce: string) {
    return `nonce:${clientId}:${nonce}`;
  }
  idempotencyKey(clientId: string, key: string) {
    return `idempotency:${clientId}:${key}`;
  }
  rateLimitKey(clientId: string, window: string) {
    return `ratelimit:${clientId}:${window}`;
  }
  revokedJtiKey(jti: string) {
    return `revoked-jti:${jti}`;
  }
}

export type { Redis };
