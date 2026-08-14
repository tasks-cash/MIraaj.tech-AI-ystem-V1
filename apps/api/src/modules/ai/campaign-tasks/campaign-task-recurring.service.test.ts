/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvironmentCache } from "../../../environment.js";
import { CampaignTaskModel, CampaignTaskOccurrenceModel } from "../models/campaign-task.schema.js";
import { CampaignTaskRecurringService } from "./campaign-task-recurring.service.js";
import type { CampaignTaskRecurringQueueService } from "../queue/campaign-task-recurring-queue.service.js";

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
  CAMPAIGN_TASK_RECURRING_ENABLED: "true", CAMPAIGN_TASK_RECURRING_SCHEDULER_ENABLED: "true",
  CAMPAIGN_TASK_RECURRING_QUEUE_NAME: "miraaj.ai.campaign-task-recurring.test",
  CAMPAIGN_TASK_RECURRING_DLQ_NAME: "miraaj.ai.campaign-task-recurring.dlq.test",
} as const;

class FakeQueue {
  jobs: Array<{ name: string; data: unknown }> = [];
  async add(name: string, data: unknown, _opts?: unknown) { this.jobs.push({ name, data }); return undefined as unknown; }
  async enqueueActivation(occurrenceId: string, _at: Date) { await this.add("activate", { occurrenceId }); }
  async enqueueCompletion(occurrenceId: string, _at: Date) { await this.add("complete", { occurrenceId }); }
  async onModuleDestroy() {}
}

describe("CampaignTaskRecurringService", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
    vi.clearAllMocks();
  });

  it("plans occurrences", async () => {
    const service = new CampaignTaskRecurringService(new FakeQueue() as unknown as CampaignTaskRecurringQueueService);
    vi.spyOn(CampaignTaskModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({
      publicId: "task-1", tenantId: "t1", status: "active", emergencyStop: false,
      recurrenceConfiguration: { enabled: true, cadence: "daily", interval: 1, weekdays: [], localTime: "09:00", timezone: "UTC" },
      assignmentDurationMinutes: 60, proofDeadlineMinutes: 120, totalCapacity: 10, currentRevision: 1,
    }) } as any);
    vi.spyOn(CampaignTaskOccurrenceModel, "countDocuments").mockResolvedValue(0);
    vi.spyOn(CampaignTaskOccurrenceModel, "create").mockImplementation((doc: any) => Promise.resolve(doc));
    const result = await service.plan("task-1", "t1");
    expect(result.planned).toBeGreaterThanOrEqual(1);
  });

  it("activates a scheduled occurrence", async () => {
    const service = new CampaignTaskRecurringService(new FakeQueue() as unknown as CampaignTaskRecurringQueueService);
    const occurrence = { publicId: "occ-1", tenantId: "t1", campaignTaskId: "task-1", status: "scheduled", assignmentWindowEnd: new Date(), save: vi.fn() };
    vi.spyOn(CampaignTaskOccurrenceModel, "findOne").mockResolvedValueOnce(occurrence as any);
    vi.spyOn(CampaignTaskModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ publicId: "task-1", tenantId: "t1", status: "active", emergencyStop: false, recurrenceConfiguration: { allowOverlap: true } }) } as any);
    const result = await service.activate("occ-1");
    expect(result.status).toBe("active");
  });

  it("recovers scheduled occurrences that are due", async () => {
    const service = new CampaignTaskRecurringService(new FakeQueue() as unknown as CampaignTaskRecurringQueueService);
    const past = new Date(Date.now() - 60_000);
    vi.spyOn(CampaignTaskOccurrenceModel, "find").mockReturnValue({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve([{ publicId: "occ-1", tenantId: "t1", campaignTaskId: "task-1", status: "scheduled", scheduledFor: past, assignmentWindowEnd: past }]) }) }) } as any);
    vi.spyOn(CampaignTaskModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ publicId: "task-1", tenantId: "t1", status: "active", emergencyStop: false }) } as any);
    const result = await service.recover("t1");
    expect(result.recovered).toBeGreaterThanOrEqual(1);
  });

  it("skips activation when parent is paused", async () => {
    const service = new CampaignTaskRecurringService(new FakeQueue() as unknown as CampaignTaskRecurringQueueService);
    const occurrence = { publicId: "occ-1", tenantId: "t1", campaignTaskId: "task-1", status: "scheduled", assignmentWindowEnd: new Date(), save: vi.fn() };
    vi.spyOn(CampaignTaskOccurrenceModel, "findOne").mockResolvedValueOnce(occurrence as any);
    vi.spyOn(CampaignTaskModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ publicId: "task-1", tenantId: "t1", status: "paused", emergencyStop: false, recurrenceConfiguration: { allowOverlap: true } }) } as any);
    const result = await service.activate("occ-1");
    expect(result.status).toBe("skipped");
  });

  it("skips activation when parent is cancelled", async () => {
    const service = new CampaignTaskRecurringService(new FakeQueue() as unknown as CampaignTaskRecurringQueueService);
    const occurrence = { publicId: "occ-1", tenantId: "t1", campaignTaskId: "task-1", status: "scheduled", assignmentWindowEnd: new Date(), save: vi.fn() };
    vi.spyOn(CampaignTaskOccurrenceModel, "findOne").mockResolvedValueOnce(occurrence as any);
    vi.spyOn(CampaignTaskModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ publicId: "task-1", tenantId: "t1", status: "cancelled", emergencyStop: false, recurrenceConfiguration: { allowOverlap: true } }) } as any);
    const result = await service.activate("occ-1");
    expect(result.status).toBe("skipped");
  });
});
