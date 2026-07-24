import "server-only";

const apiBase = () => (process.env.MIRAAJ_API_INTERNAL_URL ?? "http://127.0.0.1:4200").replace(/\/$/, "");

export async function campaignTaskApi<T>(
  path: string,
  options: {
    method?: string;
    tenantId: string;
    participantId?: string;
    idempotencyKey?: string;
    revision?: number;
    body?: unknown;
  },
): Promise<T> {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) throw new Error("Campaign operations authentication is not configured.");
  const response = await fetch(`${apiBase()}${path}`, {
    method: options.method ?? "GET",
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": options.tenantId,
      ...(options.participantId ? { "x-participant-id": options.participantId } : {}),
      ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
      ...(options.revision ? { "if-match": String(options.revision) } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const payload = await response.json().catch(() => ({ message: "Invalid API response" })) as T & { message?: string; code?: string };
  if (!response.ok) throw new Error(payload.code ?? payload.message ?? `Campaign operations failed (${response.status}).`);
  return payload;
}

export interface CampaignTaskView {
  publicId: string;
  publicTitle: string;
  description: string;
  instructions: string;
  taskMode: string;
  status: string;
  platform: string;
  communityType: string;
  requiredDisclosure: string;
  totalCapacity: number;
  activeAssignmentCount: number;
  currentRevision: number;
  startAt?: string;
  endAt?: string;
}

export interface AssignmentPackageView {
  externalAssignmentId: string;
  status: string;
  platform: string;
  targetAudience: string;
  communityRules: string[];
  approvedPostText: string;
  headline: string;
  cta: string;
  hashtags: string[];
  requiredDisclosure: string;
  uniqueTrackedLink: string;
  proofMarker: string;
  qrDownloadUrl: string;
  headerDownloadUrl: string;
  postingInstructions: string;
  screenshotRequirements: Record<string, unknown>;
  postUrlRequirement: string;
  proofDeadline: string;
  assignmentExpiration: string;
}
