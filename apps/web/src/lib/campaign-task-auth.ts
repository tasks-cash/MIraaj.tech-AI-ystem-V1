import "server-only";
import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

const equal = (left: string, right: string) => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

export async function requireCampaignTaskOperator(kind: "admin" | "participant"): Promise<void> {
  const enabled = kind === "admin"
    ? process.env.CAMPAIGN_TASK_ADMIN_UI_ENABLED !== "false"
    : process.env.CAMPAIGN_TASK_PARTICIPANT_PORTAL_ENABLED === "true";
  const expected = kind === "admin"
    ? process.env.CAMPAIGN_TASK_ADMIN_UI_TOKEN
    : process.env.CAMPAIGN_TASK_PARTICIPANT_PORTAL_TOKEN;
  const authorization = (await headers()).get("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!enabled || !expected || expected.length < 32 || !equal(expected, supplied)) notFound();
}
