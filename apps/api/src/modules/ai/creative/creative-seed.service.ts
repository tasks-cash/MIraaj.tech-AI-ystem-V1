import { Injectable, OnModuleInit } from "@nestjs/common";
import { createLogger } from "@miraaj/shared-logging";
import { loadEnvironment } from "../../../environment.js";
import {
  CreativeModelPolicyModel,
  CreativePromptVersionModel,
  CreativeProviderCapabilityModel,
  CreativeRenderSpecificationModel,
  type CreativeModelPolicyDocument,
} from "../models/creative.schema.js";
import {
  CREATIVE_MODEL_POLICY_SEED,
  CREATIVE_PROMPT_VERSION_SEEDS,
  CREATIVE_PROVIDER_CAPABILITY_SEEDS,
  CREATIVE_RENDER_SPEC_SEEDS,
} from "./creative-seed-data.js";

export interface CreativeSeedSummary {
  renderSpecsSeeded: number;
  providerCapabilitiesSeeded: number;
  modelPolicyActivated: boolean;
  promptVersionsSeeded: number;
}

@Injectable()
export class CreativeSeedService implements OnModuleInit {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  async onModuleInit(): Promise<void> {
    await this.seedAll();
  }

  async seedAll(): Promise<CreativeSeedSummary> {
    const summary: CreativeSeedSummary = {
      renderSpecsSeeded: await this.seedRenderSpecs(),
      providerCapabilitiesSeeded: await this.seedProviderCapabilities(),
      modelPolicyActivated: await this.seedModelPolicy(),
      promptVersionsSeeded: await this.seedPromptVersions(),
    };
    this.logger.info(
      { event: "ai.creative.seed.reconciled", ...summary },
      "Creative seed reconciled",
    );
    return summary;
  }

  async getActiveModelPolicyOrThrow(): Promise<CreativeModelPolicyDocument> {
    const policy = await CreativeModelPolicyModel.findOne({
      status: "active",
    }).lean();
    if (!policy) {
      throw new Error("Active creative model policy was not found.");
    }
    return policy;
  }

  private async seedRenderSpecs(): Promise<number> {
    let seeded = 0;
    for (const spec of CREATIVE_RENDER_SPEC_SEEDS) {
      const existing = await CreativeRenderSpecificationModel.findOne({
        renderSpecId: spec.renderSpecId,
        version: spec.version,
      }).lean();
      if (existing) {
        continue;
      }
      await CreativeRenderSpecificationModel.create(spec);
      seeded += 1;
    }
    return seeded;
  }

  private async seedProviderCapabilities(): Promise<number> {
    let seeded = 0;
    for (const capability of CREATIVE_PROVIDER_CAPABILITY_SEEDS) {
      const existing = await CreativeProviderCapabilityModel.findOne({
        capabilityId: capability.capabilityId,
      }).lean();
      if (existing) {
        continue;
      }
      await CreativeProviderCapabilityModel.create(capability);
      seeded += 1;
    }
    return seeded;
  }

  private async seedModelPolicy(): Promise<boolean> {
    const existing = await CreativeModelPolicyModel.findOne({
      policyId: CREATIVE_MODEL_POLICY_SEED.policyId,
      version: CREATIVE_MODEL_POLICY_SEED.version,
    }).lean();
    if (existing) {
      return false;
    }
    await CreativeModelPolicyModel.create(CREATIVE_MODEL_POLICY_SEED);
    return true;
  }

  private async seedPromptVersions(): Promise<number> {
    let seeded = 0;
    for (const prompt of CREATIVE_PROMPT_VERSION_SEEDS) {
      const existing = await CreativePromptVersionModel.findOne({
        purpose: prompt.purpose,
        version: prompt.version,
      }).lean();
      if (existing) {
        continue;
      }
      await CreativePromptVersionModel.create(prompt);
      seeded += 1;
    }
    return seeded;
  }
}
