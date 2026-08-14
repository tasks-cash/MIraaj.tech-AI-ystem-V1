/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../../environment.js";
import { NotificationModel, NotificationPreferenceModel } from "../models/notification.schema.js";
import { NotificationService } from "./notification.service.js";

const baseEnv = {
  NODE_ENV: "test", APP_ENV: "test", LOG_LEVEL: "error",
  MONGODB_URI: "mongodb://localhost:27020/miraaj_test", REDIS_URL: "redis://localhost:6383",
  S3_ENDPOINT: "http://localhost:9200", S3_REGION: "us-east-1", S3_BUCKET: "miraaj-test",
  S3_ACCESS_KEY_ID: "test-key", S3_SECRET_ACCESS_KEY: "test-secret-value-with-enough-chars", S3_FORCE_PATH_STYLE: "true",
  ENCRYPTION_KEY_ID: "test-v1", ENCRYPTION_MASTER_KEY: "test-only-encryption-key-with-32-characters",
  API_HOST: "127.0.0.1", API_PORT: "4200", AI_SERVICE_URL: "http://127.0.0.1:8200",
  AI_SERVICE_HOST: "127.0.0.1", AI_SERVICE_PORT: "8200", AI_SERVICE_ID: "miraaj-api",
  AI_SERVICE_INTERNAL_SECRET: "test-only-internal-secret-with-32-characters",
  AI_SERVICE_REQUEST_TIMEOUT_MS: "5000", AI_SERVICE_REPLAY_WINDOW_SECONDS: "120", AI_SERVICE_VERSION: "0.1.0",
  TEMPORARY_ADMIN_TOKEN_ENABLED: "true", ALLOW_TEMPORARY_ADMIN_TOKEN_IN_PRODUCTION: "false",
  ADMIN_API_TOKEN: "test-only-admin-token-with-32-characters!!",
  CAMPAIGN_TASK_PARTICIPANT_API_TOKEN: "test-only-participant-token-with-32-chars",
  NOTIFICATION_IN_APP_ENABLED: "true", NOTIFICATION_EMAIL_ENABLED: "false", NOTIFICATION_EXTERNAL_WEBHOOK_ENABLED: "false",
  NOTIFICATION_RETENTION_DAYS: "90",
} as const;

class FakeQueue {
  enqueued: string[] = [];
  async enqueue(publicId: string) { this.enqueued.push(publicId); }
  async deadLetterItem(_publicId: string, _safeError: string) { /* no-op */ }
}

describe("NotificationService", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
    vi.clearAllMocks();
  });

  it("creates and enqueues a notification", async () => {
    const service = new NotificationService(new FakeQueue() as any);
    vi.spyOn(NotificationModel, "create").mockResolvedValue({ publicId: "ain_1", toObject: () => ({ publicId: "ain_1" }) } as any);
    const result = await service.create({ tenantId: "t1", audienceId: "p1", audienceType: "participant", notificationType: "assignment_ready", deduplicationKey: "dedup-1" });
    expect(result).toEqual({ publicId: "ain_1" });
  });

  it("returns existing notification on deduplication conflict", async () => {
    const service = new NotificationService(new FakeQueue() as any);
    const duplicate = new Error("duplicate");
    (duplicate as any).code = 11000;
    vi.spyOn(NotificationModel, "create").mockRejectedValue(duplicate);
    vi.spyOn(NotificationModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ publicId: "ain_1" }) } as any);
    const result = await service.create({ tenantId: "t1", audienceId: "p1", audienceType: "participant", notificationType: "assignment_ready", deduplicationKey: "dedup-1" });
    expect(result).toEqual({ publicId: "ain_1" });
  });

  it("lists and localizes notifications", async () => {
    const service = new NotificationService(new FakeQueue() as any);
    vi.spyOn(NotificationModel, "find").mockReturnValue({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve([{ titleKey: "notifications.assignment_ready", localizedParameters: { assignmentId: "a1" }, status: "pending", createdAt: new Date() }]) }) }) } as any);
    const result = await service.list("t1", "p1", { language: "en", limit: "10" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.localizedTitle).toBe("Assignment ready");
  });

  it("counts unread notifications", async () => {
    const service = new NotificationService(new FakeQueue() as any);
    vi.spyOn(NotificationModel, "countDocuments").mockResolvedValue(5);
    const result = await service.unreadCount("t1", "p1");
    expect(result.unread).toBe(5);
  });

  it("marks a notification as read", async () => {
    const service = new NotificationService(new FakeQueue() as any);
    vi.spyOn(NotificationModel, "findOneAndUpdate").mockResolvedValue({ publicId: "ain_1", status: "read" } as any);
    const result = await service.markRead("ain_1", "t1", "p1");
    expect(result.status).toBe("read");
  });

  it("marks all notifications as read", async () => {
    const service = new NotificationService(new FakeQueue() as any);
    vi.spyOn(NotificationModel, "updateMany").mockResolvedValue({ modifiedCount: 3 } as any);
    const result = await service.markAllRead("t1", "p1");
    expect(result.markedRead).toBe(3);
  });

  it("returns and upserts preferences", async () => {
    const service = new NotificationService(new FakeQueue() as any);
    vi.spyOn(NotificationPreferenceModel, "findOneAndUpdate").mockReturnValue({ lean: () => Promise.resolve({ publicId: "anp_1", inAppEnabled: true }) } as any);
    const result = await service.preferences("t1", "p1", "participant");
    expect(result.inAppEnabled).toBe(true);
  });

  it("expires notifications beyond retention", async () => {
    const service = new NotificationService(new FakeQueue() as any);
    vi.spyOn(NotificationModel, "updateMany").mockResolvedValue({ modifiedCount: 2 } as any);
    const result = await service.expireNotifications();
    expect(result.expired).toBe(2);
  });
});