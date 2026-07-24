export const CAMPAIGN_TASK_TRANSITIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  draft: ["awaiting_review", "cancelled"],
  awaiting_review: ["draft", "approved", "cancelled"],
  approved: ["scheduled", "active", "cancelled", "archived"],
  scheduled: ["active", "paused", "cancelled"],
  active: ["paused", "capacity_reached", "completed", "cancelled"],
  paused: ["active", "completed", "cancelled"],
  capacity_reached: ["completed", "cancelled"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
});

export function assertCampaignTaskTransition(from: string, to: string): void {
  if (!CAMPAIGN_TASK_TRANSITIONS[from]?.includes(to)) {
    throw new Error("CAMPAIGN_TASK_TRANSITION_INVALID");
  }
}

export interface ParticipantProfile {
  publicId: string;
  tenantId: string;
  country: string;
  preferredLanguage: string;
  locale: string;
  profession?: string;
  industry?: string;
  audienceSegments?: string[];
  status: string;
}

export interface EligibleTask {
  tenantId: string;
  status: string;
  taskMode: string;
  startAt?: Date | string | null | undefined;
  endAt?: Date | string | null | undefined;
  emergencyStop?: boolean;
  totalCapacity: number;
  activeAssignmentCount: number;
  countryAllowlist?: string[];
  languageAllowlist?: string[];
  locales?: string[];
  professionAllowlist?: string[];
  industryAllowlist?: string[];
  audienceSegments?: string[];
  privateParticipantIds?: string[];
  pilotConfiguration?: { participantAllowlist?: string[]; enabled?: boolean };
}

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; code: "TASK_UNAVAILABLE" | "PARTICIPANT_INELIGIBLE" | "CAPACITY_UNAVAILABLE" };

const allows = (allowlist: string[] | undefined, value: string | undefined) =>
  !allowlist?.length || (!!value && allowlist.includes(value));

export function evaluateCampaignTaskEligibility(
  task: EligibleTask,
  participant: ParticipantProfile,
  now = new Date(),
): EligibilityResult {
  if (task.tenantId !== participant.tenantId || participant.status !== "active") {
    return { eligible: false, code: "PARTICIPANT_INELIGIBLE" };
  }
  const start = task.startAt ? new Date(task.startAt) : null;
  const end = task.endAt ? new Date(task.endAt) : null;
  if (task.status !== "active" || task.emergencyStop || (start && start > now) || (end && end <= now)) {
    return { eligible: false, code: "TASK_UNAVAILABLE" };
  }
  if (task.activeAssignmentCount >= task.totalCapacity) {
    return { eligible: false, code: "CAPACITY_UNAVAILABLE" };
  }
  if (
    !allows(task.countryAllowlist, participant.country) ||
    !allows(task.languageAllowlist, participant.preferredLanguage) ||
    !allows(task.locales, participant.locale) ||
    !allows(task.professionAllowlist, participant.profession) ||
    !allows(task.industryAllowlist, participant.industry)
  ) {
    return { eligible: false, code: "PARTICIPANT_INELIGIBLE" };
  }
  if (task.audienceSegments?.length && !task.audienceSegments.some((value) => participant.audienceSegments?.includes(value))) {
    return { eligible: false, code: "PARTICIPANT_INELIGIBLE" };
  }
  if (task.taskMode === "private" && !task.privateParticipantIds?.includes(participant.publicId)) {
    return { eligible: false, code: "PARTICIPANT_INELIGIBLE" };
  }
  if (task.taskMode === "pilot") {
    if (!task.pilotConfiguration?.enabled || !task.pilotConfiguration.participantAllowlist?.includes(participant.publicId)) {
      return { eligible: false, code: "PARTICIPANT_INELIGIBLE" };
    }
  }
  return { eligible: true };
}

export function safeCampaignTask<T extends Record<string, unknown>>(task: T): Omit<T, "privateParticipantIds"> {
  const { privateParticipantIds, ...safe } = task;
  void privateParticipantIds;
  return safe;
}
