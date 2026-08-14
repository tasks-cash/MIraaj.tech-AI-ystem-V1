import { verifyParticipantContextToken } from "@miraaj/shared-config";
import { requireCampaignTaskOperator } from "@/lib/campaign-task-auth";

const apiBase = () => (process.env.MIRAAJ_API_INTERNAL_URL ?? "http://127.0.0.1:4200").replace(/\/$/, "");
const allowedPath = /^(assignments\/[a-z0-9_-]+(?:\/assets\/refresh)?|proofs(?:\/upload-session|\/[a-z0-9_-]+\/(?:complete|status|additional-evidence))|notifications(?:\/unread-count|\/mark-all-read|\/preferences|\/[a-z0-9_-]+\/read)?)$/i;

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  await requireCampaignTaskOperator("participant");
  const { path } = await context.params;
  const joined = path.join("/");
  if (!allowedPath.test(joined)) return Response.json({ code: "CAMPAIGN_TASK_PROXY_PATH_INVALID" }, { status: 404 });
  const secret = process.env.CAMPAIGN_TASK_PARTICIPANT_API_TOKEN;
  if (!secret) return Response.json({ code: "CAMPAIGN_TASK_PROXY_NOT_CONFIGURED" }, { status: 503 });
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ code: "CAMPAIGN_TASK_PARTICIPANT_AUTH_REQUIRED" }, { status: 401 });
  }
  const contextToken = authorization.slice("Bearer ".length).trim();
  let participantContext: { tenantId: string; participantId: string };
  try {
    participantContext = verifyParticipantContextToken(contextToken, secret);
  } catch {
    return Response.json({ code: "CAMPAIGN_TASK_PARTICIPANT_AUTH_INVALID" }, { status: 401 });
  }
  const source = new URL(request.url);
  const targetBase = joined.startsWith("notifications") ? `${apiBase()}/api/ai/notifications` : `${apiBase()}/api/ai/distribution`;
  const response = await fetch(`${targetBase}/${joined}${source.search}`, {
    method: request.method, cache: "no-store",
    headers: {
      authorization: `Bearer ${contextToken}`, "content-type": "application/json",
      "x-tenant-id": participantContext.tenantId, "x-participant-id": participantContext.participantId,
      ...(request.headers.get("idempotency-key") ? { "idempotency-key": request.headers.get("idempotency-key")! } : {}),
    },
    ...(["GET", "HEAD"].includes(request.method) ? {} : { body: await request.text() }),
  });
  return new Response(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
