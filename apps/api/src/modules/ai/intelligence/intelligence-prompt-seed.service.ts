import { Injectable, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PromptVersionModel } from "../models/prompt-version.schema.js";

export const BUSINESS_PROFILE_REASONING_PROMPT_PURPOSE =
  "business.profile.reasoning";

/**
 * Seeds the prompt used when AI_REASONING_PROVIDER is enabled. NestJS never
 * lets this provider pick services — it only supplies corroborating
 * evidence that the deterministic BusinessProfileService may attach.
 */
@Injectable()
export class IntelligencePromptSeedService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.seedActivePrompt();
  }

  async seedActivePrompt(): Promise<void> {
    const existing = await PromptVersionModel.findOne({
      purpose: BUSINESS_PROFILE_REASONING_PROMPT_PURPOSE,
      status: "active",
    }).lean();
    if (existing) {
      return;
    }

    await PromptVersionModel.updateMany(
      { purpose: BUSINESS_PROFILE_REASONING_PROMPT_PURPOSE, status: "active" },
      { status: "deprecated", deprecatedAt: new Date() },
    );

    await PromptVersionModel.create({
      promptVersionId: randomUUID(),
      purpose: BUSINESS_PROFILE_REASONING_PROMPT_PURPOSE,
      status: "active",
      version: 1,
      schemaVersion: "1.0",
      systemPrompt:
        "You suggest business-profile evidence (business type, audience, needs) for a deterministic matching system. Your suggestions are advisory only — a rules engine makes the final decision.",
      userPromptTemplate:
        "Given the following approved business analysis evidence, suggest a business type, audience type, and notable needs. Return structured JSON only.",
      outputSchema: {
        type: "object",
        required: ["businessType", "audienceType"],
      },
      activatedAt: new Date(),
    });
  }

  async getActivePrompt() {
    const prompt = await PromptVersionModel.findOne({
      purpose: BUSINESS_PROFILE_REASONING_PROMPT_PURPOSE,
      status: "active",
    }).lean();
    if (!prompt) {
      throw new Error(
        `Active prompt version not found for purpose ${BUSINESS_PROFILE_REASONING_PROMPT_PURPOSE}.`,
      );
    }
    return prompt;
  }
}
