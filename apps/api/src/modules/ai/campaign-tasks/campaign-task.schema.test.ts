/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it } from "vitest";
import {
  CampaignTaskInvitationModel,
  CampaignTaskModel,
  CampaignTaskReservationModel,
  DistributionParticipantModel,
} from "../models/campaign-task.schema.js";

describe("campaign task persistence schema", () => {
  it("defines operational models without financial authority", () => {
    const paths = Object.keys(CampaignTaskModel.schema.paths);
    expect(paths).toContain("campaignId");
    expect(paths).toContain("templateId");
    expect(paths).toContain("activeAssignmentCount");
    expect(paths).toContain("externalRewardRuleReference");
    expect(paths).not.toContain("rewardAmount");
    expect(paths).not.toContain("currency");
    expect(paths).not.toContain("wallet");
    expect(paths).not.toContain("withdrawal");
  });

  it("stores invitation tokens only as hashes", () => {
    expect(CampaignTaskInvitationModel.schema.path("opaqueTokenHash")).toBeDefined();
    expect(CampaignTaskInvitationModel.schema.path("opaqueToken")).toBeUndefined();
  });

  it("enforces tenant-scoped participant and idempotency indexes", () => {
    const participantIndexes = DistributionParticipantModel.schema.indexes();
    const reservationIndexes = CampaignTaskReservationModel.schema.indexes();
    expect(participantIndexes.some(([keys, options]: [Record<string, number>, { unique?: boolean }]) => keys.tenantId === 1 && keys.externalParticipantId === 1 && options.unique === true)).toBe(true);
    expect(reservationIndexes.some(([keys, options]: [Record<string, number>, { unique?: boolean }]) => keys.tenantId === 1 && keys.idempotencyKeyHash === 1 && options.unique === true)).toBe(true);
  });
});
