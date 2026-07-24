import { describe, expect, it } from "vitest";
import {
  assertCampaignTaskTransition,
  CAMPAIGN_TASK_TRANSITIONS,
  evaluateCampaignTaskEligibility,
  safeCampaignTask,
} from "./campaign-task.operations.js";

const participant = {
  publicId: "adp_dentist_1",
  tenantId: "tenant_dz",
  country: "DZ",
  preferredLanguage: "ar",
  locale: "ar-DZ",
  profession: "dentist",
  industry: "healthcare",
  audienceSegments: ["clinic-owner"],
  status: "active",
};
const task = {
  tenantId: "tenant_dz",
  status: "active",
  taskMode: "targeted",
  totalCapacity: 10,
  activeAssignmentCount: 0,
  countryAllowlist: ["DZ"],
  languageAllowlist: ["ar"],
  locales: ["ar-DZ"],
  professionAllowlist: ["dentist"],
  industryAllowlist: ["healthcare"],
  audienceSegments: ["clinic-owner"],
};

describe("standalone campaign task operations", () => {
  it("enforces bounded transitions and terminal archive behavior", () => {
    expect(CAMPAIGN_TASK_TRANSITIONS.draft).toEqual(["awaiting_review", "cancelled"]);
    expect(() => assertCampaignTaskTransition("awaiting_review", "approved")).not.toThrow();
    expect(() => assertCampaignTaskTransition("active", "capacity_reached")).not.toThrow();
    expect(() => assertCampaignTaskTransition("archived", "active")).toThrow("CAMPAIGN_TASK_TRANSITION_INVALID");
    expect(() => assertCampaignTaskTransition("completed", "active")).toThrow("CAMPAIGN_TASK_TRANSITION_INVALID");
  });

  it("evaluates targeting from trusted participant data", () => {
    expect(evaluateCampaignTaskEligibility(task, participant)).toEqual({ eligible: true });
    expect(evaluateCampaignTaskEligibility(task, { ...participant, profession: "lawyer" })).toEqual({
      eligible: false,
      code: "PARTICIPANT_INELIGIBLE",
    });
    expect(evaluateCampaignTaskEligibility(task, { ...participant, tenantId: "other" })).toEqual({
      eligible: false,
      code: "PARTICIPANT_INELIGIBLE",
    });
  });

  it("fails closed for paused, expired, stopped and full tasks", () => {
    expect(evaluateCampaignTaskEligibility({ ...task, status: "paused" }, participant)).toEqual({ eligible: false, code: "TASK_UNAVAILABLE" });
    expect(evaluateCampaignTaskEligibility({ ...task, emergencyStop: true }, participant)).toEqual({ eligible: false, code: "TASK_UNAVAILABLE" });
    expect(evaluateCampaignTaskEligibility({ ...task, activeAssignmentCount: 10 }, participant)).toEqual({ eligible: false, code: "CAPACITY_UNAVAILABLE" });
    expect(evaluateCampaignTaskEligibility({ ...task, endAt: "2026-01-01T00:00:00.000Z" }, participant, new Date("2026-01-02T00:00:00.000Z"))).toEqual({ eligible: false, code: "TASK_UNAVAILABLE" });
  });

  it("hides private participant allowlists", () => {
    expect(safeCampaignTask({ publicId: "act_1", privateParticipantIds: ["adp_1"] })).toEqual({ publicId: "act_1" });
  });

  it("requires explicit private and pilot membership", () => {
    expect(evaluateCampaignTaskEligibility({ ...task, taskMode: "private", privateParticipantIds: ["other"] }, participant)).toEqual({ eligible: false, code: "PARTICIPANT_INELIGIBLE" });
    expect(evaluateCampaignTaskEligibility({ ...task, taskMode: "pilot", pilotConfiguration: { enabled: true, participantAllowlist: [participant.publicId] } }, participant)).toEqual({ eligible: true });
    expect(evaluateCampaignTaskEligibility({ ...task, taskMode: "pilot", pilotConfiguration: { enabled: false, participantAllowlist: [participant.publicId] } }, participant)).toEqual({ eligible: false, code: "PARTICIPANT_INELIGIBLE" });
  });
});
