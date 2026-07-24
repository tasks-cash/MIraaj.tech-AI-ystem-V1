export const TEMPLATE_TRANSITIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  draft: ["awaiting_review", "archived"],
  awaiting_review: ["approved", "rejected", "draft", "archived"],
  approved: ["scheduled", "active", "paused", "archived"],
  scheduled: ["active", "paused", "archived"],
  active: ["paused", "completed", "archived"],
  paused: ["active", "completed", "archived"],
  rejected: ["draft", "archived"],
  completed: ["archived"],
  archived: [],
});

export function assertTemplateTransition(from: string, to: string): void {
  if (!TEMPLATE_TRANSITIONS[from]?.includes(to)) {
    throw new Error("DISTRIBUTION_TEMPLATE_TRANSITION_INVALID");
  }
}

export function normalizeProofText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export type TimestampOutcome =
  | "timestamp_confirmed"
  | "timestamp_probable"
  | "timestamp_conflict"
  | "timestamp_unreadable"
  | "timestamp_not_visible"
  | "unsupported_timestamp_format";

export function classifyTimestamp(input: {
  extractedAt?: Date;
  submittedAt: Date;
  assignmentCreatedAt: Date;
  required: boolean;
}): TimestampOutcome {
  if (!input.extractedAt) return input.required ? "timestamp_not_visible" : "timestamp_unreadable";
  if (Number.isNaN(input.extractedAt.valueOf())) return "unsupported_timestamp_format";
  if (input.extractedAt > input.submittedAt || input.extractedAt < input.assignmentCreatedAt) {
    return "timestamp_conflict";
  }
  return input.submittedAt.valueOf() - input.extractedAt.valueOf() <= 86_400_000
    ? "timestamp_confirmed"
    : "timestamp_probable";
}

export function retentionDays(
  outcome: "accepted" | "rejected" | "duplicate" | "fraud",
  policy: { accepted: number; rejected: number; duplicate: number; fraud: number },
): number {
  return policy[outcome];
}
