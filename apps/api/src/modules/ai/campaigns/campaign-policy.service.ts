import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CampaignPolicyModel,
  CompliancePolicyModel,
  PlatformPolicyModel,
  TranslationGlossaryModel,
} from "../models/campaign-policy.schema.js";

/**
 * Admin-facing read/publish access to the versioned campaign policy,
 * platform policy, compliance policy, and translation glossary documents
 * seeded by CampaignSeedService. Publishing always deprecates the prior
 * active version — there is never more than one active version at a time.
 */
@Injectable()
export class CampaignPolicyService {
  async listCampaignPolicies() {
    return { items: await CampaignPolicyModel.find().sort({ version: -1 }).lean() };
  }

  async getActiveCampaignPolicy() {
    const policy = await CampaignPolicyModel.findOne({ status: "active" }).lean();
    if (!policy) {
      throw new NotFoundException({
        code: "CAMPAIGN_POLICIES_NOT_FOUND",
        message: "No active campaign policy is configured.",
      });
    }
    return policy;
  }

  async publishCampaignPolicy(version: number) {
    const policy = await CampaignPolicyModel.findOne({ version });
    if (!policy) {
      throw new NotFoundException({
        code: "POLICY_VERSION_NOT_FOUND",
        message: "Campaign policy version was not found.",
      });
    }
    if (policy.status !== "active") {
      await CampaignPolicyModel.updateMany(
        { status: "active" },
        { status: "deprecated", deprecatedAt: new Date() },
      );
      policy.status = "active";
      policy.publishedAt = new Date();
      await policy.save();
    }
    return policy.toObject();
  }

  async listPlatformPolicies() {
    return { items: await PlatformPolicyModel.find().sort({ version: -1 }).lean() };
  }

  async getActivePlatformPolicy() {
    const policy = await PlatformPolicyModel.findOne({ status: "active" }).lean();
    if (!policy) {
      throw new NotFoundException({
        code: "PLATFORM_POLICY_NOT_FOUND",
        message: "No active platform policy is configured.",
      });
    }
    return policy;
  }

  async publishPlatformPolicy(version: number) {
    const policy = await PlatformPolicyModel.findOne({ version });
    if (!policy) {
      throw new NotFoundException({
        code: "POLICY_VERSION_NOT_FOUND",
        message: "Platform policy version was not found.",
      });
    }
    if (policy.status !== "active") {
      await PlatformPolicyModel.updateMany(
        { status: "active" },
        { status: "deprecated", deprecatedAt: new Date() },
      );
      policy.status = "active";
      policy.publishedAt = new Date();
      await policy.save();
    }
    return policy.toObject();
  }

  async listCompliancePolicies() {
    return { items: await CompliancePolicyModel.find().sort({ version: -1 }).lean() };
  }

  async getActiveCompliancePolicy() {
    const policy = await CompliancePolicyModel.findOne({ status: "active" }).lean();
    if (!policy) {
      throw new NotFoundException({
        code: "COMPLIANCE_POLICY_NOT_FOUND",
        message: "No active compliance policy is configured.",
      });
    }
    return policy;
  }

  async publishCompliancePolicy(version: number) {
    const policy = await CompliancePolicyModel.findOne({ version });
    if (!policy) {
      throw new NotFoundException({
        code: "POLICY_VERSION_NOT_FOUND",
        message: "Compliance policy version was not found.",
      });
    }
    if (policy.status !== "active") {
      await CompliancePolicyModel.updateMany(
        { status: "active" },
        { status: "deprecated", deprecatedAt: new Date() },
      );
      policy.status = "active";
      policy.publishedAt = new Date();
      await policy.save();
    }
    return policy.toObject();
  }

  async listGlossaries() {
    return { items: await TranslationGlossaryModel.find().sort({ version: -1 }).lean() };
  }

  async getActiveGlossary() {
    const glossary = await TranslationGlossaryModel.findOne({ status: "active" }).lean();
    if (!glossary) {
      throw new NotFoundException({
        code: "GLOSSARY_NOT_FOUND",
        message: "No active translation glossary is configured.",
      });
    }
    return glossary;
  }

  async publishGlossary(version: number) {
    const glossary = await TranslationGlossaryModel.findOne({ version });
    if (!glossary) {
      throw new NotFoundException({
        code: "POLICY_VERSION_NOT_FOUND",
        message: "Translation glossary version was not found.",
      });
    }
    if (glossary.status !== "active") {
      await TranslationGlossaryModel.updateMany(
        { status: "active" },
        { status: "deprecated" },
      );
      glossary.status = "active";
      glossary.publishedAt = new Date();
      await glossary.save();
    }
    return glossary.toObject();
  }
}
