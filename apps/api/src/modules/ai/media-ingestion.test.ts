import { afterEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AI_PERMISSIONS } from "@miraaj/shared-config";
import { AiPermissionGuard } from "./guards/ai-permission.guard.js";
import { AI_PERMISSION_METADATA_KEY } from "./decorators/require-ai-permission.decorator.js";
import { buildAnalysisFingerprint } from "./analysis/merge.engine.js";
import { evaluateConfidence } from "./analysis/confidence.engine.js";
import { transitionJobStatus } from "./analysis/atomic-transition.js";

function createPermissionContext(permissions?: readonly string[]) {
  const request = { adminPermissions: permissions, headers: {} };
  return {
    request,
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
  };
}

describe("media ingestion helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires ai.media.create for upload session permission metadata", () => {
    vi.spyOn(Reflector.prototype, "getAllAndOverride").mockReturnValue(
      AI_PERMISSIONS.MEDIA_CREATE,
    );
    const guard = new AiPermissionGuard();
    expect(() =>
      guard.canActivate(
        createPermissionContext([AI_PERMISSIONS.MEDIA_READ]) as never,
      ),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        createPermissionContext([AI_PERMISSIONS.MEDIA_CREATE]) as never,
      ),
    ).toBe(true);
    expect(AI_PERMISSION_METADATA_KEY).toBe("ai:required-permission");
  });

  it("builds stable analysis fingerprints for idempotent reuse", () => {
    const first = buildAnalysisFingerprint({
      mediaSha256: "abc123",
      purpose: "business_context",
      promptVersionId: "prompt-1",
      provider: "gemini",
      ocrLanguages: "ara+eng+fra",
      schemaVersion: "1.0",
      hints: { country: "DZ" },
    });
    const second = buildAnalysisFingerprint({
      mediaSha256: "abc123",
      purpose: "business_context",
      promptVersionId: "prompt-1",
      provider: "gemini",
      ocrLanguages: "ara+eng+fra",
      schemaVersion: "1.0",
      hints: { country: "DZ" },
    });
    const different = buildAnalysisFingerprint({
      mediaSha256: "abc123",
      purpose: "business_context",
      promptVersionId: "prompt-1",
      provider: "gemini",
      ocrLanguages: "ara+eng+fra",
      schemaVersion: "1.0",
      hints: { country: "FR" },
    });
    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it("routes low confidence results to review", () => {
    const decision = evaluateConfidence({
      confidence: {
        mediaValidationConfidence: 0.9,
        ocrConfidence: 0.4,
        scriptConfidence: 0.4,
        languageConfidence: 0.4,
        visionSchemaConfidence: 0.3,
        businessSignalConfidence: 0.2,
        audienceSignalConfidence: 0.2,
        contentPurposeConfidence: 0.2,
        overallConfidence: 0.42,
      },
      autoCompleteMin: 0.82,
      reviewMin: 0.5,
      lowBelow: 0.5,
      ocrRequiresReview: true,
    });
    expect(decision.requiresReview).toBe(true);
    expect(decision.autoComplete).toBe(false);
    expect(decision.reviewReasonCodes).toContain("low_overall_confidence");
  });

  it("auto-completes high confidence results without review", () => {
    const decision = evaluateConfidence({
      confidence: {
        mediaValidationConfidence: 0.95,
        ocrConfidence: 0.9,
        scriptConfidence: 0.9,
        languageConfidence: 0.9,
        visionSchemaConfidence: 0.88,
        businessSignalConfidence: 0.86,
        audienceSignalConfidence: 0.84,
        contentPurposeConfidence: 0.85,
        overallConfidence: 0.9,
      },
      autoCompleteMin: 0.82,
      reviewMin: 0.5,
      lowBelow: 0.5,
    });
    expect(decision.requiresReview).toBe(false);
    expect(decision.autoComplete).toBe(true);
  });

  it("transitions queued jobs to active atomically", async () => {
    const jobs = new Map<string, { jobId: string; status: string }>([
      ["job-1", { jobId: "job-1", status: "queued" }],
    ]);
    const model = {
      findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const job = jobs.get(String(filter.jobId));
        if (!job || job.status !== filter.status) {
          return Promise.resolve(null);
        }
        Object.assign(job, update);
        return Promise.resolve({ ...job });
      },
    };
    const activated = await transitionJobStatus(
      model as never,
      "job-1",
      "queued",
      { status: "active" },
    );
    expect(activated?.status).toBe("active");
    const rejected = await transitionJobStatus(
      model as never,
      "job-1",
      "queued",
      { status: "active" },
    );
    expect(rejected).toBeNull();
  });
});
