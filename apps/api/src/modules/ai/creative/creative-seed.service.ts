import { Injectable, OnModuleInit } from "@nestjs/common";
import { createLogger } from "@miraaj/shared-logging";
import type {
  CreativeImageProvider,
  CreativeVideoProvider,
} from "@miraaj/shared-types";
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
  CREATIVE_MODEL_POLICY_SEEDS,
  CREATIVE_PROMPT_VERSION_SEEDS,
  CREATIVE_PROVIDER_CAPABILITY_SEEDS,
  CREATIVE_RENDER_SPEC_SEEDS,
} from "./creative-seed-data.js";

export interface CreativeSeedSummary {
  renderSpecsSeeded: number;
  providerCapabilitiesSeeded: number;
  modelPoliciesSeeded: number;
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
      modelPoliciesSeeded: await this.seedModelPolicies(),
      promptVersionsSeeded: await this.seedPromptVersions(),
    };
    this.logger.info(
      { event: "ai.creative.seed.reconciled", ...summary },
      "Creative seed reconciled",
    );
    return summary;
  }

  /** Default (disabled) active policy for shared limits. */
  async getActiveModelPolicyOrThrow(): Promise<CreativeModelPolicyDocument> {
    const policy =
      (await CreativeModelPolicyModel.findOne({
        status: "active",
        policyId: CREATIVE_MODEL_POLICY_SEED.policyId,
      }).lean()) ??
      (await CreativeModelPolicyModel.findOne({
        status: "active",
        imageProvider: "disabled",
        videoProvider: "disabled",
      }).lean());
    if (!policy) {
      throw new Error("Active creative model policy was not found.");
    }
    return policy;
  }

  /**
   * Resolves the active policy for a selected provider pair.
   * Live providers (openai/runway) require their dedicated active policy.
   */
  async getActiveModelPolicyForProviders(input: {
    imageProvider: CreativeImageProvider;
    videoProvider: CreativeVideoProvider;
  }): Promise<CreativeModelPolicyDocument> {
    if (input.imageProvider === "openai") {
      const openaiPolicy = await CreativeModelPolicyModel.findOne({
        status: "active",
        imageProvider: "openai",
      }).lean();
      if (!openaiPolicy) {
        throw new Error("Active OpenAI creative model policy was not found.");
      }
      if (input.videoProvider === "runway") {
        const runwayPolicy = await CreativeModelPolicyModel.findOne({
          status: "active",
          videoProvider: "runway",
        }).lean();
        if (!runwayPolicy) {
          throw new Error("Active Runway creative model policy was not found.");
        }
      }
      return openaiPolicy;
    }
    if (input.videoProvider === "runway") {
      const runwayPolicy = await CreativeModelPolicyModel.findOne({
        status: "active",
        videoProvider: "runway",
      }).lean();
      if (!runwayPolicy) {
        throw new Error("Active Runway creative model policy was not found.");
      }
      return runwayPolicy;
    }
    return this.getActiveModelPolicyOrThrow();
  }

  async getCapabilityOrNull(capabilityId: string) {
    return CreativeProviderCapabilityModel.findOne({ capabilityId }).lean();
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

  private async seedModelPolicies(): Promise<number> {
    let seeded = 0;
    for (const policy of CREATIVE_MODEL_POLICY_SEEDS) {
      const existing = await CreativeModelPolicyModel.findOne({
        policyId: policy.policyId,
        version: policy.version,
      }).lean();
      if (existing) {
        continue;
      }
      await CreativeModelPolicyModel.create(policy);
      seeded += 1;
    }
    return seeded;
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
