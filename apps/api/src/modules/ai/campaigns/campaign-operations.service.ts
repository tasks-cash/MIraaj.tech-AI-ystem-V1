/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CampaignPackageModel, CampaignReviewModel } from "../models/campaign.schema.js";

const allowedOperationalTransitions: Record<string, string[]> = {
  draft: ["approved", "archived"],
  approved: ["active", "paused", "archived"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: [],
};
type CampaignOperationalStatus = "draft" | "approved" | "active" | "paused" | "archived";

@Injectable()
export class CampaignOperationsService {
  list(filters: Record<string, unknown>) {
    const query: Record<string, unknown> = {};
    for (const key of ["operationalStatus", "businessProfileId", "objective"]) if (filters[key]) query[key] = filters[key];
    return CampaignPackageModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async get(id: string) {
    const campaign = await CampaignPackageModel.findOne({ campaignPackageId: id }).lean();
    if (!campaign) throw new NotFoundException("CAMPAIGN_NOT_FOUND");
    const reviews = await CampaignReviewModel.find({ campaignPackageId: id }).sort({ campaignRevision: -1 }).lean();
    return { ...campaign, revisionHistory: campaign.revisionHistory ?? [], reviews };
  }

  async importApproved(input: Record<string, unknown>, actor: string) {
    const sourceId = String(input.sourceCampaignPackageId ?? input.campaignPackageId ?? "");
    const source = await CampaignPackageModel.findOne({ campaignPackageId: sourceId, status: "approved" }).lean();
    if (!source) throw new BadRequestException("APPROVED_CAMPAIGN_PACKAGE_REQUIRED");
    const { _id, __v, campaignPackageId, campaignId, createdAt, updatedAt, ...values } = source as any;
    void _id; void __v; void campaignPackageId; void campaignId; void createdAt; void updatedAt;
    const id = `cmp_${randomUUID()}`;
    return CampaignPackageModel.create({
      ...values,
      ...input,
      campaignPackageId: id,
      campaignId: `campaign_${randomUUID()}`,
      operationalStatus: "draft",
      currentRevision: 1,
      activeRevision: 1,
      revisionHistory: [{ revision: 1, sourceCampaignPackageId: sourceId, actor, createdAt: new Date() }],
      createdBy: actor,
      correlationId: randomUUID(),
    });
  }

  async update(id: string, patch: Record<string, unknown>, actor: string) {
    const campaign = await CampaignPackageModel.findOne({ campaignPackageId: id });
    if (!campaign) throw new NotFoundException("CAMPAIGN_NOT_FOUND");
    if (!["draft", "paused"].includes(String(campaign.operationalStatus))) throw new ConflictException("CAMPAIGN_OPERATIONS_IMMUTABLE");
    const allowed = ["operations", "targetCountries", "targetLanguages", "targetLocales", "selectedPlatforms", "primaryAudience", "requiredDisclosures", "brandProfileId", "brandProfileVersion"];
    for (const key of allowed) if (key in patch) (campaign as any)[key] = patch[key];
    campaign.currentRevision += 1;
    campaign.revisionHistory.push({ revision: campaign.currentRevision, actor, changedAt: new Date(), fields: Object.keys(patch).filter((key) => allowed.includes(key)) });
    await campaign.save();
    return campaign;
  }

  async revise(id: string, patch: Record<string, unknown>, actor: string) {
    return this.update(id, patch, actor);
  }

  async transition(id: string, target: string, actor: string, reason: string) {
    if (!reason.trim()) throw new BadRequestException("CAMPAIGN_OPERATION_REASON_REQUIRED");
    const campaign = await CampaignPackageModel.findOne({ campaignPackageId: id });
    if (!campaign) throw new NotFoundException("CAMPAIGN_NOT_FOUND");
    const current = String(campaign.operationalStatus);
    if (!allowedOperationalTransitions[current]?.includes(target)) throw new ConflictException("CAMPAIGN_OPERATION_TRANSITION_INVALID");
    campaign.operationalStatus = target as CampaignOperationalStatus;
    campaign.activeRevision = campaign.currentRevision;
    campaign.revisionHistory.push({ revision: campaign.currentRevision, transition: `${current}:${target}`, actor, reason, changedAt: new Date() });
    await campaign.save();
    return campaign;
  }
}
