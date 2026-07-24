"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { campaignTaskApi, type CampaignTaskView } from "@/lib/campaign-task-api";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export async function createCampaignTask(form: FormData) {
  const country = text(form, "country");
  const locale = text(form, "locale");
  const tenantId = text(form, "tenantId");
  const task = await campaignTaskApi<CampaignTaskView>("/api/admin/ai/campaign-tasks", {
    method: "POST",
    tenantId,
    body: {
      internalName: text(form, "internalName"),
      publicTitle: text(form, "publicTitle"),
      description: text(form, "description"),
      instructions: text(form, "instructions"),
      campaignId: text(form, "campaignId"),
      campaignRevision: Number(text(form, "campaignRevision")),
      templateId: text(form, "templateId"),
      templateRevision: Number(text(form, "templateRevision")),
      approvedCopyVariantIds: list(text(form, "approvedCopyVariantIds")),
      targetUrl: text(form, "targetUrl"),
      taskMode: text(form, "taskMode"),
      platform: text(form, "platform"),
      publicationType: text(form, "publicationType"),
      countryAllowlist: list(text(form, "countryAllowlist")),
      languageAllowlist: list(text(form, "languageAllowlist")),
      locales: list(text(form, "locales")),
      professionAllowlist: list(text(form, "professionAllowlist")),
      industryAllowlist: list(text(form, "industryAllowlist")),
      audienceSegments: list(text(form, "audienceSegments")),
      communityType: text(form, "communityType"),
      communityRules: list(text(form, "communityRules")),
      requiredDisclosure: text(form, "requiredDisclosure"),
      assignmentDurationMinutes: Number(text(form, "assignmentDurationMinutes")),
      proofDeadlineMinutes: Number(text(form, "proofDeadlineMinutes")),
      humanReviewPolicy: text(form, "humanReviewPolicy"),
      totalCapacity: Number(text(form, "totalCapacity")),
      perParticipantLimit: Number(text(form, "perParticipantLimit")),
      dailyParticipantLimit: Number(text(form, "dailyParticipantLimit")),
      qrRequired: true,
      trackedLinkRequired: true,
      proofMarkerRequired: true,
      headerRequired: true,
      screenshotRequired: true,
      postUrlRequirement: "optional",
      timestampRequirement: "optional",
    },
  });
  redirect(`/${country}/${locale}/operations/campaign-tasks/${task.publicId}?tenant=${encodeURIComponent(tenantId)}`);
}

export async function transitionCampaignTask(form: FormData) {
  const country = text(form, "country");
  const locale = text(form, "locale");
  const tenantId = text(form, "tenantId");
  const taskId = text(form, "taskId");
  await campaignTaskApi(`/api/admin/ai/campaign-tasks/${taskId}/${text(form, "transition")}`, {
    method: "POST",
    tenantId,
    revision: Number(text(form, "revision")),
    idempotencyKey: randomUUID(),
    body: { reason: text(form, "reason") },
  });
  revalidatePath(`/${country}/${locale}/operations/campaign-tasks/${taskId}`);
}

export async function reviewCampaignProof(form: FormData) {
  const country = text(form, "country");
  const locale = text(form, "locale");
  const tenantId = text(form, "tenantId");
  const taskId = text(form, "taskId");
  const proofId = text(form, "proofId");
  await campaignTaskApi(`/api/admin/ai/campaign-tasks/${taskId}/proofs/${proofId}/review`, {
    method: "POST",
    tenantId,
    idempotencyKey: randomUUID(),
    body: { decision: text(form, "decision"), reviewerNote: text(form, "reason"), evidenceRevision: Number(text(form, "evidenceRevision")), idempotencyKey: text(form, "idempotencyKey") },
  });
  revalidatePath(`/${country}/${locale}/operations/campaign-tasks/${taskId}`);
}
