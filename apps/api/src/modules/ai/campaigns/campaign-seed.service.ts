import { Injectable, OnModuleInit } from "@nestjs/common";
import { createHash } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_PAYMENT_DISCLOSURES,
  CAMPAIGN_PLATFORMS,
  CAMPAIGN_PROMPT_PURPOSES,
  CAMPAIGN_TYPES,
  CONTENT_FORMATS,
  CTA_CODES,
  FUNNEL_STAGES,
} from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import { PromptVersionModel } from "../models/prompt-version.schema.js";
import {
  BrandProfileModel,
  CampaignPolicyModel,
  CompliancePolicyModel,
  PlatformPolicyModel,
  TranslationGlossaryModel,
  type BrandProfileDocument,
  type CampaignPolicyDocument,
  type CompliancePolicyDocument,
  type PlatformPolicyDocument,
  type TranslationGlossaryDocument,
} from "../models/campaign-policy.schema.js";

function checksumOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export interface CampaignSeedSummary {
  brandProfileActivated: boolean;
  campaignPolicyActivated: boolean;
  platformPolicyActivated: boolean;
  compliancePolicyActivated: boolean;
  glossaryActivated: boolean;
}

@Injectable()
export class CampaignSeedService implements OnModuleInit {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  async onModuleInit(): Promise<void> {
    await this.seedAll();
  }

  async seedAll(): Promise<CampaignSeedSummary> {
    const summary: CampaignSeedSummary = {
      brandProfileActivated: await this.seedBrandProfile(),
      campaignPolicyActivated: await this.seedCampaignPolicy(),
      platformPolicyActivated: await this.seedPlatformPolicy(),
      compliancePolicyActivated: await this.seedCompliancePolicy(),
      glossaryActivated: await this.seedTranslationGlossary(),
    };
    await this.seedPromptVersions();
    this.logger.info(
      { event: "ai.campaign.seed.reconciled", ...summary },
      "Campaign seed reconciled",
    );
    return summary;
  }

  private async seedBrandProfile(): Promise<boolean> {
    const existing = await BrandProfileModel.findOne({
      brandName: "Miraaj.tech",
      version: 1,
    }).lean();
    if (existing) {
      return false;
    }
    await BrandProfileModel.create({
      brandProfileId: "miraaj-tech",
      brandName: "Miraaj.tech",
      version: 1,
      status: "active",
      primaryDomain: "miraaj.tech",
      brandAliases: ["Miraaj", "Miraaj Tech"],
      protectedTerms: ["Miraaj.tech", "Tasks.cash"],
      prohibitedSpellings: ["Miraj.tech", "Miraajtech"],
      toneAttributes: [
        "professional",
        "clear",
        "modern",
        "reliable",
        "intelligent",
        "practical",
        "confident",
        "non-exaggerated",
        "business-focused",
        "internationally understandable",
      ],
      toneRestrictions: [
        "No fake hype",
        "No false urgency",
        "No guaranteed results",
        "No fake exclusivity",
        "No unverified number one claims",
        "No invented statistics",
        "No invented clients",
        "No invented awards",
        "No invented certifications",
        "No invented partnerships",
        "No fake testimonials",
        "No manipulation",
        "No fear-based exaggeration",
        "No insulting competitors",
        "No discriminatory content",
      ],
      approvedValuePropositions: [
        "Practical digital systems for real businesses",
        "Structured technical integration with lawful onboarding support",
      ],
      approvedCapabilities: [
        "websites",
        "business systems",
        "integrations",
        "security foundations",
      ],
      approvedProofTypes: ["service_catalog", "approved_architecture"],
      prohibitedClaims: [
        "guaranteed approval",
        "guaranteed results",
        "no KYC",
        "unhackable",
      ],
      approvedDisclosures: { payment: CAMPAIGN_PAYMENT_DISCLOSURES },
      contactPolicies: {},
      platformToneOverrides: {},
      languageToneOverrides: {},
      terminologyGlossary: [],
      visualLanguageGuidance: [],
      imageRestrictions: ["no_fake_logos", "no_fake_awards"],
      videoRestrictions: ["no_fake_testimonials", "no_celebrity_impersonation"],
      accessibilityGuidance: ["include_alt_text_when_needed"],
      complianceRules: ["payment_requires_review", "regulated_domains_require_review"],
      createdBy: "system-seed",
      approvedBy: "system-seed",
      publishedAt: new Date(),
    });
    return true;
  }

  private async seedCampaignPolicy(): Promise<boolean> {
    const existing = await CampaignPolicyModel.findOne({ version: 1 }).lean();
    if (existing) {
      return false;
    }
    const content = {
      objectives: [...CAMPAIGN_OBJECTIVES],
      funnelStages: [...FUNNEL_STAGES],
      campaignTypes: [...CAMPAIGN_TYPES],
      ctaCodes: [...CTA_CODES],
      contentFormats: [...CONTENT_FORMATS],
      maxServices: this.environment.CAMPAIGN_MAX_SERVICES,
      maxPlatforms: this.environment.CAMPAIGN_MAX_PLATFORMS,
      maxLanguages: this.environment.CAMPAIGN_MAX_LANGUAGES,
      autoApproveEnabled: this.environment.CAMPAIGN_AUTO_APPROVE_ENABLED,
      qualityThresholds: {
        high: this.environment.CAMPAIGN_QUALITY_HIGH_MIN,
        review: this.environment.CAMPAIGN_QUALITY_REVIEW_MIN,
        brand: this.environment.CAMPAIGN_BRAND_SCORE_MIN,
        compliance: this.environment.CAMPAIGN_COMPLIANCE_SCORE_MIN,
        language: this.environment.CAMPAIGN_LANGUAGE_SCORE_MIN,
        semantic: this.environment.CAMPAIGN_SEMANTIC_PRESERVATION_MIN,
        audience: this.environment.CAMPAIGN_AUDIENCE_FIT_MIN,
      },
    };
    await CampaignPolicyModel.create({
      policyId: "campaign-policy",
      version: 1,
      status: "active",
      checksum: checksumOf(content),
      changeSummary: "Initial Prompt 4 campaign policy",
      publishedAt: new Date(),
      createdBy: "system-seed",
      approvedBy: "system-seed",
      ...content,
    });
    return true;
  }

  private async seedPlatformPolicy(): Promise<boolean> {
    const existing = await PlatformPolicyModel.findOne({ version: 1 }).lean();
    if (existing) {
      return false;
    }
    const platforms = CAMPAIGN_PLATFORMS.map((platformId) => ({
      platformId,
      version: 1,
      status: "active",
      supportedCampaignObjectives: [...CAMPAIGN_OBJECTIVES],
      supportedContentFormats: [...CONTENT_FORMATS],
      supportedLanguages: ["ar", "en", "fr", "es", "de"],
      textFieldDefinitions: { headline: true, primaryText: true, cta: true },
      maximumConfiguredLengths: {
        headline: platformId === "x" ? 120 : 200,
        primaryText: platformId === "x" ? 280 : 2200,
        shortText: 500,
      },
      recommendedConfiguredLengths: {
        headline: platformId === "x" ? 80 : 140,
        primaryText: platformId === "x" ? 220 : 1200,
        shortText: 240,
      },
      hashtagSupport: !["email", "website_blog", "website_service_page", "telegram"].includes(
        platformId,
      ),
      linkSupport: true,
      titleSupport: true,
      descriptionSupport: true,
      captionSupport: true,
      threadSupport: platformId === "x",
      carouselSupport: ["facebook", "instagram", "linkedin"].includes(platformId),
      storySupport: ["instagram", "whatsapp_status"].includes(platformId),
      shortVideoSupport: ["instagram", "tiktok", "youtube_shorts"].includes(platformId),
      longVideoSupport: platformId === "youtube",
      thumbnailSupport: ["youtube", "youtube_shorts"].includes(platformId),
      ctaSupport: true,
      accessibilityRequirements: ["alt_text_when_visual"],
      complianceNotes: ["no_auto_publish"],
      versionSource: "prompt4-platform-policy-v1",
      lastReviewedAt: new Date(),
    }));
    await PlatformPolicyModel.create({
      policyId: "platform-policy",
      version: 1,
      status: "active",
      checksum: checksumOf(platforms),
      changeSummary: "Initial Prompt 4 platform policy",
      publishedAt: new Date(),
      createdBy: "system-seed",
      approvedBy: "system-seed",
      platforms,
    });
    return true;
  }

  private async seedCompliancePolicy(): Promise<boolean> {
    const existing = await CompliancePolicyModel.findOne({ version: 1 }).lean();
    if (existing) {
      return false;
    }
    const content = {
      paymentDisclosures: CAMPAIGN_PAYMENT_DISCLOSURES,
      regulatedDomains: [
        "dental_clinic",
        "clinic",
        "healthcare",
        "pharmacy",
        "legal",
        "finance",
        "education",
        "security",
      ],
      prohibitedClaimPatterns: [
        "guaranteed approval",
        "guaranteed results",
        "no KYC",
        "no KYB",
        "unhackable",
      ],
      alwaysRequireReviewFor: ["payment", "regulated"],
    };
    await CompliancePolicyModel.create({
      policyId: "compliance-policy",
      version: 1,
      status: "active",
      checksum: checksumOf(content),
      changeSummary: "Initial Prompt 4 compliance policy",
      publishedAt: new Date(),
      createdBy: "system-seed",
      approvedBy: "system-seed",
      ...content,
    });
    return true;
  }

  private async seedTranslationGlossary(): Promise<boolean> {
    const existing = await TranslationGlossaryModel.findOne({ version: 1 }).lean();
    if (existing) {
      return false;
    }
    const content = {
      protectedTerms: ["Miraaj.tech", "Tasks.cash"],
      entries: [
        {
          key: "brand.miraaj",
          sourceLanguage: "en",
          targetLanguage: "ar",
          locale: "ar",
          sourceTerm: "Miraaj.tech",
          approvedTranslation: "Miraaj.tech",
          prohibitedTranslations: [],
          preserveOriginal: true,
          caseSensitive: true,
          status: "approved",
        },
        {
          key: "brand.taskscash",
          sourceLanguage: "en",
          targetLanguage: "fr",
          locale: "fr",
          sourceTerm: "Tasks.cash",
          approvedTranslation: "Tasks.cash",
          prohibitedTranslations: [],
          preserveOriginal: true,
          caseSensitive: true,
          status: "approved",
        },
      ],
    };
    await TranslationGlossaryModel.create({
      glossaryId: "campaign-glossary",
      version: 1,
      status: "active",
      checksum: checksumOf(content),
      publishedAt: new Date(),
      createdBy: "system-seed",
      approvedBy: "system-seed",
      ...content,
    });
    return true;
  }

  private async seedPromptVersions(): Promise<void> {
    for (const purpose of CAMPAIGN_PROMPT_PURPOSES) {
      const existing = await PromptVersionModel.findOne({
        purpose,
        version: 1,
      }).lean();
      if (existing) {
        continue;
      }
      await PromptVersionModel.create({
        promptVersionId: `${purpose}-v1`,
        purpose,
        status: "active",
        version: 1,
        schemaVersion: "1.0",
        systemPrompt:
          "Draft campaign content as a suggestion only. Never invent claims, remove disclosures, approve, or publish.",
        userPromptTemplate: `Purpose: ${purpose}. Return strict JSON only.`,
        outputSchema: { schemaVersion: "1.0", purpose },
        activatedAt: new Date(),
      });
    }
  }

  async getActiveBrandProfileOrThrow(): Promise<BrandProfileDocument> {
    const profile = await BrandProfileModel.findOne({ status: "active" }).lean();
    if (!profile) {
      throw new Error("BRAND_PROFILE_NOT_FOUND");
    }
    return profile;
  }

  async getActiveCampaignPolicyOrThrow(): Promise<CampaignPolicyDocument> {
    const policy = await CampaignPolicyModel.findOne({ status: "active" }).lean();
    if (!policy) {
      throw new Error("CAMPAIGN_POLICY_NOT_FOUND");
    }
    return policy;
  }

  async getActivePlatformPolicyOrThrow(): Promise<PlatformPolicyDocument> {
    const policy = await PlatformPolicyModel.findOne({ status: "active" }).lean();
    if (!policy) {
      throw new Error("PLATFORM_POLICY_NOT_FOUND");
    }
    return policy;
  }

  async getActiveCompliancePolicyOrThrow(): Promise<CompliancePolicyDocument> {
    const policy = await CompliancePolicyModel.findOne({ status: "active" }).lean();
    if (!policy) {
      throw new Error("COMPLIANCE_POLICY_NOT_FOUND");
    }
    return policy;
  }

  async getActiveGlossaryOrThrow(): Promise<TranslationGlossaryDocument> {
    const glossary = await TranslationGlossaryModel.findOne({ status: "active" }).lean();
    if (!glossary) {
      throw new Error("GLOSSARY_NOT_FOUND");
    }
    return glossary;
  }
}
