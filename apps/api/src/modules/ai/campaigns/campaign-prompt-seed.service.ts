import { Injectable, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CAMPAIGN_PROMPT_PURPOSES, type CampaignPromptPurpose } from "@miraaj/shared-types";
import { PromptVersionModel } from "../models/prompt-version.schema.js";

const SHARED_GUARDRAILS =
  "You are drafting within a scope already fixed by a deterministic NestJS system: objective, funnel stage, audience, and selected services are all final. Never invent statistics, guarantees, awards, or urgency. Preserve every protected term and required disclosure verbatim. Your output is a draft suggestion only — NestJS validation and quality scoring are authoritative and may reject or discard it.";

const PROMPT_SEED_COPY: Record<
  CampaignPromptPurpose,
  { systemPrompt: string; userPromptTemplate: string; outputSchema: Record<string, unknown> }
> = {
  "campaign.strategy": {
    systemPrompt: `${SHARED_GUARDRAILS} Propose a campaign strategy angle (primary message pillar, tone notes) for the given objective, funnel stage, audience, and services.`,
    userPromptTemplate:
      "Objective: {{objective}}. Funnel stage: {{funnelStage}}. Audience: {{audience}}. Selected services: {{selectedServices}}. Platforms: {{platforms}}. Languages: {{languages}}. Suggest a strategy angle as structured JSON.",
    outputSchema: { type: "object", required: ["strategyAngle"] },
  },
  "campaign.master-message": {
    systemPrompt: `${SHARED_GUARDRAILS} Draft a master message framework (target problem, value proposition, primary CTA) strictly from the approved services and brief.`,
    userPromptTemplate:
      "Brief: {{brief}}. Approved services: {{selectedServices}}. Brand tone attributes: {{toneAttributes}}. Draft a master message framework as structured JSON.",
    outputSchema: { type: "object", required: ["primaryValueProposition"] },
  },
  "campaign.platform-copy": {
    systemPrompt: `${SHARED_GUARDRAILS} Draft platform-specific copy (headline, primary text, hashtags) respecting the platform's structural limits.`,
    userPromptTemplate:
      "Platform: {{platform}}. Language: {{language}}. Master message: {{masterMessage}}. Structural limits: {{platformLimits}}. Draft platform copy as structured JSON.",
    outputSchema: { type: "object", required: ["headline", "primaryText"] },
  },
  "campaign.image-brief": {
    systemPrompt: `${SHARED_GUARDRAILS} Draft an image creative brief (concept, visual narrative, prohibited elements) — never generate or render actual images.`,
    userPromptTemplate:
      "Platform: {{platform}}. Objective: {{objective}}. Services: {{selectedServices}}. Draft an image creative brief as structured JSON.",
    outputSchema: { type: "object", required: ["conceptTitle", "visualNarrative"] },
  },
  "campaign.video-brief": {
    systemPrompt: `${SHARED_GUARDRAILS} Draft a video script/storyboard brief — never generate or render actual video.`,
    userPromptTemplate:
      "Platform: {{platform}}. Objective: {{objective}}. Services: {{selectedServices}}. Draft a video creative brief as structured JSON.",
    outputSchema: { type: "object", required: ["hook", "voiceoverScript"] },
  },
  "campaign.carousel": {
    systemPrompt: `${SHARED_GUARDRAILS} Draft a carousel slide sequence outline for the given services and platform.`,
    userPromptTemplate:
      "Platform: {{platform}}. Services: {{selectedServices}}. Draft a carousel outline as structured JSON.",
    outputSchema: { type: "object", required: ["slides"] },
  },
  "campaign.story": {
    systemPrompt: `${SHARED_GUARDRAILS} Draft a short story-sequence outline (2-5 frames) for the given platform and objective.`,
    userPromptTemplate:
      "Platform: {{platform}}. Objective: {{objective}}. Draft a story sequence outline as structured JSON.",
    outputSchema: { type: "object", required: ["frames"] },
  },
  "campaign.transcreation": {
    systemPrompt: `${SHARED_GUARDRAILS} Transcreate the given source text into the target language and locale, preserving every protected term from the glossary verbatim and preserving all compliance disclosures. Do not translate protected terms.`,
    userPromptTemplate:
      "Source language: {{sourceLanguage}}. Target language: {{targetLanguage}}. Target locale: {{targetLocale}}. Protected terms: {{protectedTerms}}. Source text: {{sourceText}}. Return the transcreated text as structured JSON.",
    outputSchema: { type: "object", required: ["transcreatedText"] },
  },
  "campaign.quality-check": {
    systemPrompt: `${SHARED_GUARDRAILS} Provide advisory quality observations only — NestJS's CampaignQualityService computes the authoritative score.`,
    userPromptTemplate:
      "Platform variants: {{platformVariants}}. Language variants: {{languageVariants}}. Provide advisory quality observations as structured JSON.",
    outputSchema: { type: "object", required: ["observations"] },
  },
  "campaign.compliance-check": {
    systemPrompt: `${SHARED_GUARDRAILS} Provide advisory compliance observations only — NestJS's CampaignValidationService computes the authoritative result.`,
    userPromptTemplate:
      "Content: {{content}}. Involves payment: {{involvesPayment}}. Regulated domain: {{regulatedDomain}}. Provide advisory compliance observations as structured JSON.",
    outputSchema: { type: "object", required: ["observations"] },
  },
};

/**
 * Idempotently seeds a v1 prompt version for every CAMPAIGN_PROMPT_PURPOSES
 * entry. Reuses the shared PromptVersion schema from Prompt 3.
 */
@Injectable()
export class CampaignPromptSeedService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.seedAllPrompts();
  }

  async seedAllPrompts(): Promise<void> {
    for (const purpose of CAMPAIGN_PROMPT_PURPOSES) {
      await this.seedPrompt(purpose);
    }
  }

  private async seedPrompt(purpose: CampaignPromptPurpose): Promise<void> {
    const existing = await PromptVersionModel.findOne({
      purpose,
      status: "active",
    }).lean();
    if (existing) {
      return;
    }
    const copy = PROMPT_SEED_COPY[purpose];
    await PromptVersionModel.create({
      promptVersionId: randomUUID(),
      purpose,
      status: "active",
      version: 1,
      schemaVersion: "1.0",
      systemPrompt: copy.systemPrompt,
      userPromptTemplate: copy.userPromptTemplate,
      outputSchema: copy.outputSchema,
      activatedAt: new Date(),
    });
  }

  async getActivePrompt(purpose: CampaignPromptPurpose) {
    const prompt = await PromptVersionModel.findOne({
      purpose,
      status: "active",
    }).lean();
    if (!prompt) {
      throw new Error(`Active prompt version not found for purpose ${purpose}.`);
    }
    return prompt;
  }
}
