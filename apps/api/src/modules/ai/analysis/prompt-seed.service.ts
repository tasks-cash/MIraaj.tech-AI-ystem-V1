import { Injectable, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PromptVersionModel } from "../models/prompt-version.schema.js";

export const DEFAULT_PROMPT_PURPOSE = "media.business-context-analysis";

@Injectable()
export class PromptSeedService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.seedActivePrompt();
  }

  async seedActivePrompt(): Promise<void> {
    const existing = await PromptVersionModel.findOne({
      purpose: DEFAULT_PROMPT_PURPOSE,
      status: "active",
    }).lean();
    if (existing) {
      return;
    }

    await PromptVersionModel.updateMany(
      { purpose: DEFAULT_PROMPT_PURPOSE, status: "active" },
      { status: "deprecated", deprecatedAt: new Date() },
    );

    await PromptVersionModel.create({
      promptVersionId: randomUUID(),
      purpose: DEFAULT_PROMPT_PURPOSE,
      status: "active",
      version: 1,
      schemaVersion: "1.0",
      systemPrompt:
        "You analyze uploaded business media and return structured evidence about business context, audience, and content purpose.",
      userPromptTemplate:
        "Analyze the provided media for business context. Return structured JSON only.",
      outputSchema: {
        type: "object",
        required: ["mediaSummary", "businessSignals", "audienceSignals"],
      },
      activatedAt: new Date(),
    });
  }

  async getActivePrompt(purpose = DEFAULT_PROMPT_PURPOSE) {
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
