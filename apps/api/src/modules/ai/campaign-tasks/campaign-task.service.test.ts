/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { resetEnvironmentCache } from "../../../environment.js";
import { CampaignTaskService } from "./campaign-task.service.js";
import {
  CampaignTaskModel,
  CampaignTaskOccurrenceModel,
  CampaignTaskParticipantCapacityModel,
  CampaignTaskReservationModel,
  DistributionParticipantModel,
  CampaignTaskInvitationModel,
  CampaignTaskEventModel,
} from "../models/campaign-task.schema.js";

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
  CAMPAIGN_TASK_OPERATIONS_ENABLED: "true",
} as const;

function makeTask(taskMode: string) {
  return {
    publicId: "task-1", tenantId: "t1", status: "active", emergencyStop: false, taskMode,
    activeAssignmentCount: 0, taskMode2: "", totalCapacity: 10, perParticipantLimit: 5,
    dailyParticipantLimit: 10, capacityByCountry: {}, approvedCopyVariantIds: ["copy-1"],
    templateId: "template-1", targetUrl: "https://example.com", countryAllowlist: ["DZ"],
    languageAllowlist: ["ar"], locales: ["ar-DZ"], startAt: new Date(Date.now() - 86_400_000),
    endAt: new Date(Date.now() + 86_400_000),
  };
}

describe("CampaignTaskService claim occurrence binding", () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv);
    resetEnvironmentCache();
    vi.clearAllMocks();
    vi.spyOn(CampaignTaskEventModel, "create").mockResolvedValue({} as any);
  });

  it("requires occurrenceId for recurring tasks", async () => {
    const service = new CampaignTaskService({ createAssignment: vi.fn() } as any, {} as any, {} as any);
    vi.spyOn(CampaignTaskModel, "findOne").mockReturnValue({ select: () => ({ lean: () => Promise.resolve(makeTask("recurring")) }) } as any);
    vi.spyOn(DistributionParticipantModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ publicId: "p1", tenantId: "t1", country: "DZ", preferredLanguage: "ar", status: "active", locale: "ar-DZ" }) } as any);
    await expect(service.claim("task-1", "t1", "p1", "idem-1")).rejects.toThrow(BadRequestException);
  });

  it("binds occurrenceId to the created assignment", async () => {
    const createAssignment = vi.fn().mockResolvedValue({ externalAssignmentId: "assignment-1" });
    const service = new CampaignTaskService({ createAssignment } as any, {} as any, { create: vi.fn() } as any);
    vi.spyOn(CampaignTaskModel, "findOne").mockReturnValue({ select: () => ({ lean: () => Promise.resolve(makeTask("recurring")) }) } as any);
    vi.spyOn(DistributionParticipantModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ publicId: "p1", tenantId: "t1", country: "DZ", preferredLanguage: "ar", status: "active", locale: "ar-DZ" }) } as any);
    vi.spyOn(CampaignTaskInvitationModel, "findOne").mockResolvedValue(null);
    vi.spyOn(CampaignTaskParticipantCapacityModel, "updateOne").mockResolvedValue({} as any);
    vi.spyOn(CampaignTaskParticipantCapacityModel, "findOneAndUpdate").mockResolvedValue({ publicId: "cap-1", activeCount: 1, dailyCount: 1 });
    vi.spyOn(CampaignTaskInvitationModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(null) } as any);
    vi.spyOn(CampaignTaskReservationModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(null) } as any);
    const occurrence = { publicId: "occ-1", tenantId: "t1", campaignTaskId: "task-1", status: "active", capacitySnapshot: 5, activeAssignmentCount: 1, countryCapacityUsed: {}, assignmentWindowStart: new Date(Date.now() - 86_400_000), assignmentWindowEnd: new Date(Date.now() + 86_400_000) };
    vi.spyOn(CampaignTaskOccurrenceModel, "findOneAndUpdate").mockResolvedValue(occurrence);
    vi.spyOn(CampaignTaskReservationModel, "create").mockResolvedValue({} as any);
    vi.spyOn(CampaignTaskReservationModel, "updateOne").mockResolvedValue({} as any);
    await service.claim("task-1", "t1", "p1", "idem-1", { occurrenceId: "occ-1" });
    expect(createAssignment).toHaveBeenCalledWith(expect.objectContaining({ occurrenceId: "occ-1" }), expect.any(String), expect.any(String));
  });

  it("rejects when occurrence capacity is exhausted", async () => {
    const service = new CampaignTaskService({ createAssignment: vi.fn() } as any, {} as any, { create: vi.fn() } as any);
    vi.spyOn(CampaignTaskModel, "findOne").mockReturnValue({ select: () => ({ lean: () => Promise.resolve(makeTask("recurring")) }) } as any);
    vi.spyOn(DistributionParticipantModel, "findOne").mockReturnValue({ lean: () => Promise.resolve({ publicId: "p1", tenantId: "t1", country: "DZ", preferredLanguage: "ar", status: "active", locale: "ar-DZ" }) } as any);
    vi.spyOn(CampaignTaskInvitationModel, "findOne").mockResolvedValue(null);
    vi.spyOn(CampaignTaskParticipantCapacityModel, "updateOne").mockResolvedValue({} as any);
    vi.spyOn(CampaignTaskParticipantCapacityModel, "findOneAndUpdate").mockResolvedValue({ publicId: "cap-1", activeCount: 1, dailyCount: 1 });
    vi.spyOn(CampaignTaskInvitationModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(null) } as any);
    vi.spyOn(CampaignTaskReservationModel, "findOne").mockReturnValue({ lean: () => Promise.resolve(null) } as any);
    vi.spyOn(CampaignTaskOccurrenceModel, "findOneAndUpdate").mockResolvedValue(null);
    await expect(service.claim("task-1", "t1", "p1", "idem-1", { occurrenceId: "occ-1" })).rejects.toThrow(ConflictException);
  });
});
