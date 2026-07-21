import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";

interface MockCampaignPackage {
  campaignPackageId: string;
  campaignId: string;
  campaignBriefId: string;
  status: string;
  currentRevision: number;
  brandProfileId: string;
  brandProfileVersion: number;
  platformPolicyVersion: number;
  compliancePolicyVersion: number;
  selectedPlatforms: string[];
  targetLanguages: string[];
  targetLocales: string[];
  requiredDisclosures: Record<string, unknown>;
  reviewReasonCodes: string[];
  selectedServices: string[];
  correlationId: string;
  createdBy: string;
  requiresReview?: boolean;
  imageCreativeBriefs?: unknown[];
  videoCreativeBriefs?: unknown[];
  carouselBriefs?: unknown[];
  storySequences?: unknown[];
}

function approvedPackage(
  partial: Partial<MockCampaignPackage> = {},
): MockCampaignPackage {
  return {
    campaignPackageId: "pkg-1",
    campaignId: "campaign-1",
    campaignBriefId: "brief-1",
    status: "approved",
    currentRevision: 1,
    brandProfileId: "miraaj-tech",
    brandProfileVersion: 1,
    platformPolicyVersion: 1,
    compliancePolicyVersion: 1,
    selectedPlatforms: ["facebook"],
    targetLanguages: ["en"],
    targetLocales: ["en-US"],
    requiredDisclosures: {},
    reviewReasonCodes: [],
    selectedServices: ["dental_clinic_management"],
    correlationId: "corr-1",
    createdBy: "admin-1",
    requiresReview: false,
    imageCreativeBriefs: [
      { briefId: "img-1", textOverlay: "Grow with Miraaj.tech" },
    ],
    videoCreativeBriefs: [],
    carouselBriefs: [],
    storySequences: [],
    ...partial,
  };
}

async function loadService(pkg: MockCampaignPackage | null) {
  vi.resetModules();
  vi.doMock("../../models/campaign.schema.js", () => ({
    CampaignPackageModel: {
      findOne: () => ({ lean: () => Promise.resolve(pkg) }),
    },
  }));
  const { CreativeSourceEligibilityService } = await import(
    "../creative-source-eligibility.service.js"
  );
  return new CreativeSourceEligibilityService();
}

describe("Prompt 5 — CreativeSourceEligibilityService", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("accepts an approved campaign package", async () => {
    const service = await loadService(approvedPackage());
    const result = await service.loadAndValidate({
      campaignPackageId: "pkg-1",
    });
    expect(result.campaignPackage.status).toBe("approved");
    expect(result.briefs).toHaveLength(1);
    expect(result.briefs[0]?.briefId).toBe("img-1");
  });

  it("rejects unapproved packages", async () => {
    const service = await loadService(
      approvedPackage({ status: "awaiting_review" }),
    );
    await expect(
      service.loadAndValidate({ campaignPackageId: "pkg-1" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invalid revision without override", async () => {
    const service = await loadService(
      approvedPackage({ currentRevision: 2 }),
    );
    await expect(
      service.loadAndValidate({
        campaignPackageId: "pkg-1",
        campaignPackageRevision: 1,
      }),
    ).rejects.toMatchObject({
      response: { code: "CREATIVE_SOURCE_REVISION_INVALID" },
    });
  });

  it("accepts corrected packages", async () => {
    const service = await loadService(approvedPackage({ status: "corrected" }));
    const result = await service.loadAndValidate({
      campaignPackageId: "pkg-1",
    });
    expect(result.campaignPackage.status).toBe("corrected");
  });
});
