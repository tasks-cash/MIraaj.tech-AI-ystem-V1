import { createHash, createHmac } from "node:crypto";
import { z } from "zod";

export const TASKS_CASH_DISTRIBUTION_API_VERSION = "v1" as const;
export const PROOF_VERIFICATION_EVENT_TYPE = "proof.verification.completed" as const;
export const PROOF_VERIFICATION_EVENT_VERSION = 1 as const;
export const TASKS_CASH_CLOCK_SKEW_MS = 120_000;
export const TASKS_CASH_DISTRIBUTION_ENDPOINTS = Object.freeze({
  createAssignment: { method: "POST", path: "/api/integrations/tasks-cash/distribution/assignments" },
  getAssignment: { method: "GET", path: "/api/integrations/tasks-cash/distribution/assignments/:externalAssignmentId" },
  cancelAssignment: { method: "POST", path: "/api/integrations/tasks-cash/distribution/assignments/:externalAssignmentId/cancel" },
  createProofUploadSession: { method: "POST", path: "/api/integrations/tasks-cash/distribution/proofs/upload-session" },
  completeProof: { method: "POST", path: "/api/integrations/tasks-cash/distribution/proofs/:proofSubmissionId/complete" },
  getProofStatus: { method: "GET", path: "/api/integrations/tasks-cash/distribution/proofs/:proofSubmissionId/status" },
});

const externalId = z.string().trim().min(1).max(200);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const apiVersion = z.literal(TASKS_CASH_DISTRIBUTION_API_VERSION);

export const createDistributionAssignmentRequestSchema = z.object({
  apiVersion,
  templateId: externalId,
  copyVariantId: externalId,
  externalTaskId: externalId,
  externalUserId: externalId,
  externalAssignmentId: externalId,
  targetUrl: z.url().max(2_048),
  country: z.string().trim().min(2).max(3).optional(),
  correlationId: externalId.optional(),
  headerWidth: z.number().int().min(320).max(4_096).optional(),
  headerHeight: z.number().int().min(320).max(4_096).optional(),
}).strict();

export const assignmentIdentitySchema = z.object({
  apiVersion,
  externalUserId: externalId,
}).strict();

export const createProofUploadSessionRequestSchema = z.object({
  apiVersion,
  externalAssignmentId: externalId,
  externalUserId: externalId,
  screenshotCount: z.number().int().min(1).max(5).optional(),
  contentLength: z.number().int().positive().max(20_971_520).optional(),
  postUrl: z.url().max(2_048).optional(),
  claimedPublicationAt: z.iso.datetime().optional(),
  claimedGroupName: z.string().trim().min(1).max(500).optional(),
  userNote: z.string().max(2_000).optional(),
  correlationId: externalId.optional(),
}).strict();

export const completeProofRequestSchema = z.object({
  apiVersion,
  externalUserId: externalId,
}).strict();

export const rewardRecommendationSchema = z.enum([
  "eligible", "not_eligible", "pending_review", "expired", "duplicate", "fraud_suspected",
]);
export const verificationDecisionSchema = z.enum(["verified", "rejected", "needs_review"]);

const dateTimeResponse = z.union([z.iso.datetime(), z.date()]);
export const assignmentPackageResponseSchema = z.object({
  apiVersion,
  externalAssignmentId: externalId,
  status: z.string().min(1),
  platform: z.string().min(1),
  targetAudience: z.string().min(1),
  communityRules: z.array(z.string()),
  approvedPostText: z.string(),
  headline: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  requiredDisclosure: z.string(),
  uniqueTrackedLink: z.url(),
  proofMarker: z.string().min(1),
  qrDownloadUrl: z.url(),
  headerDownloadUrl: z.url(),
  postingInstructions: z.string(),
  screenshotRequirements: z.record(z.string(), z.unknown()),
  postUrlRequirement: z.enum(["optional", "required", "forbidden"]),
  proofDeadline: dateTimeResponse,
  assignmentExpiration: dateTimeResponse,
  rewardEligibilityRecommendation: rewardRecommendationSchema,
}).strict();

export const cancelAssignmentResponseSchema = z.object({
  apiVersion,
  externalAssignmentId: externalId,
  status: z.literal("cancelled"),
  rewardEligibilityRecommendation: rewardRecommendationSchema,
}).strict();

export const proofUploadSessionResponseSchema = z.object({
  apiVersion,
  proofSubmissionId: externalId,
  evidence: z.array(z.object({
    evidenceId: externalId,
    kind: z.literal("screenshot"),
    contentType: z.literal("image/png"),
    uploadUrl: z.url(),
    uploadExpiresAt: dateTimeResponse,
  }).strict()),
  expiresAt: dateTimeResponse.optional(),
}).strict();

export const proofCompletionResponseSchema = z.object({
  apiVersion,
  proofSubmissionId: externalId,
  externalAssignmentId: externalId,
  status: z.enum(["submitted", "queued"]),
  submittedAt: dateTimeResponse.optional(),
}).strict();

export const proofStatusResponseSchema = z.object({
  apiVersion,
  proofSubmissionId: externalId,
  externalAssignmentId: externalId,
  status: z.enum(["upload_pending", "submitted", "queued", "verifying", "needs_review", "verified", "rejected", "cancelled"]),
  submittedAt: dateTimeResponse.optional(),
  createdAt: dateTimeResponse.optional(),
  updatedAt: dateTimeResponse.optional(),
}).strict();

export const proofVerificationCompletedEventSchema = z.object({
  eventId: externalId,
  eventVersion: z.literal(PROOF_VERIFICATION_EVENT_VERSION),
  eventType: z.literal(PROOF_VERIFICATION_EVENT_TYPE),
  occurredAt: z.iso.datetime(),
  externalTaskId: externalId,
  externalUserId: externalId,
  externalAssignmentId: externalId,
  proofSubmissionId: externalId,
  verificationDecision: verificationDecisionSchema,
  verificationConfidence: z.number().min(0).max(1),
  rewardEligibilityRecommendation: rewardRecommendationSchema,
  reasonCodes: z.array(z.string().min(1).max(200)).max(100),
  resultChecksum: sha256,
  correlationId: externalId,
}).strict();

export type ProofVerificationCompletedEvent = z.infer<typeof proofVerificationCompletedEventSchema>;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function proofResultChecksum(input: {
  decision: string;
  scores: Record<string, number>;
  reasons: string[];
}): string {
  return createHash("sha256")
    .update(canonicalJson({ ...input, reasons: [...new Set(input.reasons)].sort() }))
    .digest("hex");
}

export function tasksCashRequestCanonical(input: {
  method: string;
  path: string;
  timestamp: number;
  nonce: string;
  body: unknown;
}): string {
  const bodyHash = createHash("sha256").update(JSON.stringify(input.body ?? {})).digest("hex");
  return [input.method.toUpperCase(), input.path, String(input.timestamp), input.nonce, bodyHash].join("\n");
}

export function signTasksCashRequest(secret: string, input: Parameters<typeof tasksCashRequestCanonical>[0]): string {
  return createHmac("sha256", secret).update(tasksCashRequestCanonical(input)).digest("hex");
}

export function callbackCanonical(timestamp: number, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function signProofCallback(secret: string, timestamp: number, rawBody: string): string {
  return createHmac("sha256", secret).update(callbackCanonical(timestamp, rawBody)).digest("hex");
}
