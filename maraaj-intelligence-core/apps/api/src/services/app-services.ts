
import { CacheService, createRedis } from "@maraaj/cache";
import { createKeyProvider, EnvelopeCrypto } from "@maraaj/crypto";
import { ObjectStorage } from "@maraaj/storage";
import { createQueue, QUEUE_NAMES } from "@maraaj/queue";
import type { Queue } from "bullmq";
import { loadEnv, ensureTokenKeys, type ApiEnv } from "../env";
import { createLogger } from "@maraaj/logging";

export interface AppServices {
  env: ApiEnv;
  redis: ReturnType<typeof createRedis>;
  cache: CacheService;
  crypto: EnvelopeCrypto;
  storage: ObjectStorage;
  queues: Record<string, Queue>;
  tokenKeys: { privateKeyPem: string; publicKeyPem: string };
  logger: ReturnType<typeof createLogger>;
}

let services: AppServices | null = null;

export async function initServices(): Promise<AppServices> {
  if (services) return services;
  const env = loadEnv();
  const redis = createRedis(env.REDIS_URL);
  const cache = new CacheService(redis);
  const kms = createKeyProvider({
    provider: env.ENCRYPTION_PROVIDER,
    localMasterKey: env.LOCAL_MASTER_KEY,
    kmsKeyId: env.KMS_KEY_ID,
  });
  const crypto = new EnvelopeCrypto(kms);
  const storage = new ObjectStorage({
    endpoint: env.S3_ENDPOINT ?? env.MINIO_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY ?? "maraaj",
    secretAccessKey: env.S3_SECRET_KEY ?? "maraajsecret",
    forcePathStyle: true,
  });
  try {
    await storage.ensureBucket();
  } catch (e) {
    console.warn("[MIC] Storage bucket ensure failed (will retry later)", e);
  }
  const connection = { url: env.REDIS_URL };
  const queues: Record<string, Queue> = {};
  for (const name of QUEUE_NAMES) {
    queues[name] = createQueue(name, connection);
  }
  const tokenKeys = await ensureTokenKeys(env);
  services = {
    env,
    redis,
    cache,
    crypto,
    storage,
    queues,
    tokenKeys,
    logger: createLogger("api", env.LOG_LEVEL),
  };
  return services;
}

export function getServices(): AppServices {
  if (!services) throw new Error("Services not initialized");
  return services;
}
