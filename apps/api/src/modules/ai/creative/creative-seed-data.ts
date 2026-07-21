import { createHash } from "node:crypto";
import {
  CAMPAIGN_PLATFORMS,
  CREATIVE_ASSET_TYPES,
  CREATIVE_PROMPT_PURPOSES,
} from "@miraaj/shared-types";

function checksumOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export const CREATIVE_RENDER_SPEC_SEEDS = (
  ["facebook", "instagram", "linkedin"] as const
).flatMap((platform) => {
  const specs = [
    { aspectRatio: "1:1" as const, width: 1080, height: 1080, label: "square" },
    { aspectRatio: "4:5" as const, width: 1080, height: 1350, label: "portrait" },
    { aspectRatio: "16:9" as const, width: 1920, height: 1080, label: "landscape" },
    { aspectRatio: "9:16" as const, width: 1080, height: 1920, label: "story" },
  ];
  return specs.map((spec) => {
    const payload = {
      platform,
      aspectRatio: spec.aspectRatio,
      width: spec.width,
      height: spec.height,
      maxDurationSeconds: spec.aspectRatio === "9:16" ? 60 : 120,
      safeZoneInsets: { top: 64, right: 64, bottom: 64, left: 64 },
      textOverlayRules: {
        maxChars: 80,
        fontFamily: "Inter",
        contrastMin: 4.5,
      },
      subtitleRules: {
        maxLines: 2,
        fontSize: 36,
        position: "bottom",
      },
    };
    return {
      renderSpecId: `${platform}-${spec.label}-v1`,
      version: 1,
      status: "active" as const,
      platform,
      aspectRatio: spec.aspectRatio,
      width: spec.width,
      height: spec.height,
      maxDurationSeconds: payload.maxDurationSeconds,
      safeZoneInsets: payload.safeZoneInsets,
      textOverlayRules: payload.textOverlayRules,
      subtitleRules: payload.subtitleRules,
      checksum: checksumOf(payload),
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  });
});

export const CREATIVE_PROVIDER_CAPABILITY_SEEDS = [
  {
    capabilityId: "image-mock",
    providerType: "image" as const,
    providerName: "mock",
    status: "mock" as const,
    supportedAssetTypes: CREATIVE_ASSET_TYPES.filter(
      (type) =>
        type.includes("image") ||
        type.includes("thumbnail") ||
        type.includes("banner") ||
        type.includes("carousel") ||
        type.includes("story_frame") ||
        type.includes("mockup") ||
        type.includes("infographic") ||
        type.includes("poster"),
    ),
    supportedPlatforms: [...CAMPAIGN_PLATFORMS],
    maxWidth: 4096,
    maxHeight: 4096,
    maxBytes: 52_428_800,
    notes: "Local mock image provider for Prompt 5.",
  },
  {
    capabilityId: "image-disabled",
    providerType: "image" as const,
    providerName: "disabled",
    status: "disabled" as const,
    supportedAssetTypes: [],
    supportedPlatforms: [],
    notes: "Image generation disabled.",
  },
  {
    capabilityId: "image-openai",
    providerType: "image" as const,
    providerName: "openai",
    status: "active" as const,
    supportedAssetTypes: CREATIVE_ASSET_TYPES.filter(
      (type) =>
        type.includes("image") ||
        type.includes("thumbnail") ||
        type.includes("banner") ||
        type.includes("carousel") ||
        type.includes("story_frame") ||
        type.includes("mockup") ||
        type.includes("infographic") ||
        type.includes("poster"),
    ),
    supportedPlatforms: [...CAMPAIGN_PLATFORMS],
    maxWidth: 4096,
    maxHeight: 4096,
    maxBytes: 52_428_800,
    notes: "OpenAI image provider — commercial-use review required.",
  },
  {
    capabilityId: "video-mock",
    providerType: "video" as const,
    providerName: "mock",
    status: "mock" as const,
    supportedAssetTypes: CREATIVE_ASSET_TYPES.filter(
      (type) =>
        type.includes("video") ||
        type.includes("reel") ||
        type === "short" ||
        type.includes("graphic"),
    ),
    supportedPlatforms: [...CAMPAIGN_PLATFORMS],
    maxWidth: 1920,
    maxHeight: 1920,
    maxDurationSeconds: 600,
    maxBytes: 1_073_741_824,
    notes: "Local mock video provider for Prompt 5.",
  },
  {
    capabilityId: "video-disabled",
    providerType: "video" as const,
    providerName: "disabled",
    status: "disabled" as const,
    supportedAssetTypes: [],
    supportedPlatforms: [],
    notes: "Video generation disabled.",
  },
  {
    capabilityId: "video-runway",
    providerType: "video" as const,
    providerName: "runway",
    status: "active" as const,
    supportedAssetTypes: CREATIVE_ASSET_TYPES.filter(
      (type) =>
        type.includes("video") ||
        type.includes("reel") ||
        type === "short" ||
        type.includes("graphic"),
    ),
    supportedPlatforms: [...CAMPAIGN_PLATFORMS],
    maxWidth: 1920,
    maxHeight: 1920,
    maxDurationSeconds: 10,
    maxBytes: 1_073_741_824,
    notes: "Runway video provider — async generation; commercial-use review required.",
  },
  {
    capabilityId: "render-local",
    providerType: "render" as const,
    providerName: "local",
    status: "local" as const,
    supportedAssetTypes: [...CREATIVE_ASSET_TYPES],
    supportedPlatforms: [...CAMPAIGN_PLATFORMS],
    notes: "Local synthetic render / overlay provider.",
  },
];

/** Default active policy keeps live providers off for safety. */
export const CREATIVE_MODEL_POLICY_SEED = {
  policyId: "creative-model-policy",
  version: 1,
  status: "active" as const,
  imageProvider: "disabled" as const,
  videoProvider: "disabled" as const,
  renderProvider: "local" as const,
  autoApproveEnabled: false,
  requiredHumanReview: true,
  commercialUseStatus: "review_required" as const,
  maxBriefsPerJob: 20,
  maxVariantsPerBrief: 4,
  maxTotalAssetsPerJob: 40,
  qualityHighMin: 0.88,
  qualityReviewMin: 0.65,
  brandScoreMin: 0.85,
  complianceScoreMin: 0.95,
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
};

/** Active provider-specific policies — used when env/job selects openai/runway. */
export const CREATIVE_MODEL_POLICY_SEEDS = [
  CREATIVE_MODEL_POLICY_SEED,
  {
    policyId: "creative-model-policy-openai-v1",
    version: 1,
    status: "active" as const,
    imageProvider: "openai" as const,
    videoProvider: "disabled" as const,
    renderProvider: "local" as const,
    autoApproveEnabled: false,
    requiredHumanReview: true,
    commercialUseStatus: "review_required" as const,
    maxBriefsPerJob: 20,
    maxVariantsPerBrief: 4,
    maxTotalAssetsPerJob: 40,
    qualityHighMin: 0.88,
    qualityReviewMin: 0.65,
    brandScoreMin: 0.85,
    complianceScoreMin: 0.95,
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    policyId: "creative-model-policy-runway-v1",
    version: 1,
    status: "active" as const,
    imageProvider: "disabled" as const,
    videoProvider: "runway" as const,
    renderProvider: "local" as const,
    autoApproveEnabled: false,
    requiredHumanReview: true,
    commercialUseStatus: "review_required" as const,
    maxBriefsPerJob: 20,
    maxVariantsPerBrief: 4,
    maxTotalAssetsPerJob: 40,
    qualityHighMin: 0.88,
    qualityReviewMin: 0.65,
    brandScoreMin: 0.85,
    complianceScoreMin: 0.95,
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

export const CREATIVE_PROMPT_VERSION_SEEDS = CREATIVE_PROMPT_PURPOSES.map(
  (purpose, index) => {
    const template = `Prompt 5 seed template for ${purpose}. Brand=Miraaj.tech. Never invent testimonials, medical outcomes, or payment guarantees.`;
    return {
      promptVersionId: `creative-prompt-${index + 1}`,
      purpose,
      version: 1,
      status: "active" as const,
      template,
      checksum: checksumOf({ purpose, template }),
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  },
);
