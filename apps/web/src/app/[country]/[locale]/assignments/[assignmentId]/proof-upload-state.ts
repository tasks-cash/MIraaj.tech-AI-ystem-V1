export const PROOF_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const PROOF_UPLOAD_MAX_BYTES = 20_971_520;
export const PROOF_UPLOAD_MAX_FILES = 5;
export function validateProofFiles(files: Array<{ type: string; size: number }>, existingCount = 0): "ok" | "too_many" | "unsupported" | "invalid_size" {
  if (files.length + existingCount > PROOF_UPLOAD_MAX_FILES) return "too_many";
  if (files.some((file) => !PROOF_UPLOAD_TYPES.includes(file.type as typeof PROOF_UPLOAD_TYPES[number]))) return "unsupported";
  if (files.some((file) => !Number.isInteger(file.size) || file.size < 1 || file.size > PROOF_UPLOAD_MAX_BYTES)) return "invalid_size";
  return "ok";
}
export function participantProofState(status: string) {
  return ({ upload_pending: "uploading", submitted: "proof_submitted", queued: "verifying", verifying: "verifying", needs_review: "needs_review", more_evidence_required: "more_evidence_required", verified: "verified", rejected: "rejected", duplicate: "duplicate", fraudulent: "suspicious", cancelled: "cancelled" } as Record<string, string>)[status] ?? "operational_error";
}
