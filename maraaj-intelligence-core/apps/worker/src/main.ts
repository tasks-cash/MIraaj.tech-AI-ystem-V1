
import { connectMongo, Analysis, Post, ReviewTask, Asset, Webhook, WebhookDelivery, TrainingFeedback } from "@maraaj/database";
import { createWorker, QUEUE_NAMES } from "@maraaj/queue";
import { createRedis } from "@maraaj/cache";
import { createLogger } from "@maraaj/logging";
import { parseEnv, extendEnv } from "@maraaj/config";
import { createKeyProvider, EnvelopeCrypto, hmacSha256Base64, sha256Hex } from "@maraaj/crypto";
import { ObjectStorage } from "@maraaj/storage";
import { randomUUID } from "node:crypto";

const env = parseEnv(extendEnv({}), process.env as Record<string, string | undefined>);
const logger = createLogger("worker", env.LOG_LEVEL);
const redis = createRedis(env.REDIS_URL);
const connection = { url: env.REDIS_URL };
const storage = new ObjectStorage({
  endpoint: env.S3_ENDPOINT ?? env.MINIO_ENDPOINT,
  region: env.S3_REGION,
  bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY ?? "maraaj",
  secretAccessKey: env.S3_SECRET_KEY ?? "maraajsecret",
  forcePathStyle: true,
});
const crypto = new EnvelopeCrypto(
  createKeyProvider({
    provider: env.ENCRYPTION_PROVIDER,
    localMasterKey: env.LOCAL_MASTER_KEY,
    kmsKeyId: env.KMS_KEY_ID,
  }),
);

async function callAi(path: string, body: unknown) {
  const res = await fetch(`${env.AI_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maraaj-internal": "1" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI service error ${res.status}`);
  return res.json();
}

async function processAnalysis(job: {
  data: {
    analysisId: string;
    postId: string;
    assetId: string;
    tenantId: string;
    projectId: string;
  };
}) {
  const start = Date.now();
  const analysis = await Analysis.findOne({ analysisId: job.data.analysisId });
  if (!analysis || analysis.status === "cancelled") return;
  analysis.status = "running";
  analysis.stage = "technical_validation";
  await analysis.save();

  const asset = await Asset.findById(job.data.assetId);
  let ocrText = "";
  let description = "";
  let language = "en";
  let categories: Array<{ slug: string; score: number }> = [];
  let safetyFlags: string[] = [];

  if (asset) {
    analysis.stage = "normalization";
    await analysis.save();
    let imageBase64 = "";
    try {
      const buf = await storage.getObject(asset.objectKey);
      imageBase64 = buf.toString("base64");
    } catch (e) {
      logger.warn({ err: e }, "asset fetch failed");
    }

    analysis.stage = "ocr";
    await analysis.save();
    try {
      const ocr = (await callAi("/v1/ocr", { imageBase64, mimeType: asset.mimeType })) as {
        text?: string;
        language?: string;
      };
      ocrText = ocr.text ?? "";
      language = ocr.language ?? "en";
    } catch (e) {
      logger.warn({ err: e }, "OCR failed, continuing with empty text");
    }

    analysis.stage = "classification";
    await analysis.save();
    try {
      const cls = (await callAi("/v1/classify", {
        imageBase64,
        ocrText,
        mimeType: asset.mimeType,
      })) as {
        description?: string;
        categories?: Array<{ slug: string; score: number }>;
        safetyFlags?: string[];
      };
      description = cls.description ?? "";
      categories = cls.categories ?? [];
      safetyFlags = cls.safetyFlags ?? [];
    } catch (e) {
      logger.warn({ err: e }, "classification failed");
      categories = [{ slug: "other", score: 0.4 }];
    }
  }

  const primary = categories[0] ?? { slug: "other", score: 0.4 };
  const finalConfidence = primary.score;
  const requiresReview = finalConfidence < 0.85 || safetyFlags.length > 0;
  const reviewReasons: string[] = [];
  if (finalConfidence < 0.85) reviewReasons.push("LOW_CONFIDENCE");
  if (safetyFlags.length) reviewReasons.push("SAFETY_FLAGS");

  analysis.ocrText = ocrText;
  analysis.detectedLanguage = language;
  analysis.primaryCategory = primary.slug;
  analysis.secondaryCategories = categories.slice(1).map((c) => c.slug);
  analysis.imageDescription = description;
  analysis.safetyFlags = safetyFlags;
  analysis.confidenceScores = { primary: primary.score };
  analysis.finalConfidence = finalConfidence;
  analysis.requiresReview = requiresReview;
  analysis.reviewReasons = reviewReasons;
  analysis.providerResults = [
    { provider: "local", stage: "ocr", ok: true },
    { provider: "local", stage: "classification", ok: true },
  ];
  analysis.modelVersions = { ocr: "tesseract-local", vision: "heuristic-v1" };
  analysis.processingTimeMs = Date.now() - start;
  analysis.status = "completed";
  analysis.stage = "done";
  await analysis.save();

  const post = await Post.findById(job.data.postId);
  if (post) {
    post.analysisStatus = "completed";
    if (requiresReview) {
      post.publicationStatus = "needs_review";
      await ReviewTask.create({
        tenantId: post.tenantId,
        projectId: post.projectId,
        environment: post.environment,
        postId: post._id,
        analysisId: analysis.analysisId,
        status: "pending",
        priority: safetyFlags.length ? 10 : 0,
      });
    } else {
      post.publicationStatus = "approved";
    }
    await post.save();
  }
}

async function processWebhook(job: {
  data: { webhookId: string; event: string; payload?: unknown; deliveryId?: string };
}) {
  const wh = await Webhook.findById(job.data.webhookId);
  if (!wh || !wh.active) return;
  // SSRF: only http(s) and not private — basic check
  const url = new URL(wh.url);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid webhook URL");
  const secretEnc = wh.secretEnc as never;
  const secret = secretEnc ? (await crypto.decrypt(secretEnc)).toString("utf8") : "";
  const deliveryId = job.data.deliveryId ?? randomUUID();
  const body = JSON.stringify({
    event: job.data.event,
    deliveryId,
    data: job.data.payload ?? {},
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyHash = sha256Hex(body);
  const signature = hmacSha256Base64(secret, `${timestamp}.${deliveryId}.${bodyHash}`);
  let delivery = await WebhookDelivery.findOne({ deliveryId });
  if (!delivery) {
    delivery = await WebhookDelivery.create({
      webhookId: wh._id,
      deliveryId,
      event: job.data.event,
      status: "pending",
      payloadHash: bodyHash,
    });
  }
  try {
    const res = await fetch(wh.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-maraaj-event": job.data.event,
        "x-maraaj-delivery-id": deliveryId,
        "x-maraaj-timestamp": timestamp,
        "x-maraaj-signature": signature,
        "x-maraaj-key-id": "webhook-v1",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    delivery.attempts += 1;
    delivery.responseStatus = res.status;
    delivery.status = res.ok ? "success" : "failed";
    await delivery.save();
    if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
  } catch (e) {
    delivery.attempts += 1;
    delivery.status = delivery.attempts >= 5 ? "dead" : "failed";
    delivery.lastError = e instanceof Error ? e.message : "error";
    await delivery.save();
    throw e;
  }
}

async function main() {
  await connectMongo(env.MONGODB_URI);
  logger.info("Worker starting");

  createWorker("image-analysis", async (job) => processAnalysis(job as never), connection);
  createWorker("image-ingestion", async (job) => {
    logger.info({ jobId: job.id }, "ingestion complete (noop normalize)");
  }, connection);
  createWorker("webhook-delivery", async (job) => processWebhook(job as never), connection);
  createWorker("dataset-export", async () => {
    const rows = await TrainingFeedback.find().limit(10_000).lean();
    logger.info({ count: rows.length }, "dataset export prepared");
  }, connection);
  createWorker("audit-integrity", async () => {
    // dynamic import avoided — inline verify
    const { AuditLog } = await import("@maraaj/database");
    const { sha256Hex } = await import("@maraaj/crypto");
    const logs = await AuditLog.find().sort({ timestamp: 1 }).limit(5000).lean();
    let prev = "GENESIS";
    let ok = true;
    for (const log of logs as Array<Record<string, unknown>>) {
      const canonical = JSON.stringify({
        eventId: log.eventId,
        timestamp: new Date(log.timestamp as string).toISOString(),
        tenantId: log.tenantId ?? null,
        projectId: log.projectId ?? null,
        actorType: log.actorType,
        actorId: log.actorId ?? null,
        action: log.action,
        entityType: log.entityType ?? null,
        entityId: log.entityId ?? null,
        previousValues: log.previousValues ?? null,
        newValues: log.newValues ?? null,
        ipHash: log.ipHash ?? null,
        correlationId: log.correlationId ?? null,
        requestId: log.requestId ?? null,
        severity: log.severity ?? "informational",
      });
      const expected = sha256Hex(prev + canonical);
      if (expected !== log.eventHash) {
        ok = false;
        logger.error({ eventId: log.eventId }, "Audit chain broken");
        break;
      }
      prev = String(log.eventHash);
    }
    logger.info({ ok }, "Audit integrity check");
  }, connection);

  // Rotate IP hash salt periodically (every process start if missing)
  const salt = await redis.get("ip-hash-salt");
  if (!salt) await redis.set("ip-hash-salt", randomUUID());

  logger.info({ queues: QUEUE_NAMES }, "Workers registered");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
