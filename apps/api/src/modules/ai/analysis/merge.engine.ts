import { createHash } from "node:crypto";
import type {
  AnalysisPurpose,
  ConfidenceBreakdown,
  OCRResult,
  VisionAnalysisOutput,
} from "@miraaj/shared-types";

export function buildAnalysisFingerprint(input: {
  mediaSha256: string;
  purpose: AnalysisPurpose;
  promptVersionId: string;
  provider: string;
  ocrLanguages: string;
  schemaVersion: string;
  hints: Record<string, unknown>;
}): string {
  const canonical = JSON.stringify({
    mediaSha256: input.mediaSha256,
    purpose: input.purpose,
    promptVersionId: input.promptVersionId,
    provider: input.provider,
    ocrLanguages: input.ocrLanguages,
    schemaVersion: input.schemaVersion,
    hints: input.hints,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function mergeAnalysisOutputs(input: {
  ocr: OCRResult | null;
  vision: VisionAnalysisOutput | null;
}): Record<string, unknown> {
  return {
    ocr: input.ocr,
    vision: input.vision,
    mergedAt: new Date().toISOString(),
    mediaSummary: input.vision?.mediaSummary ?? null,
    visibleTextSummary:
      input.vision?.visibleTextSummary ?? input.ocr?.normalizedText ?? null,
    businessSignals: input.vision?.businessSignals ?? [],
    audienceSignals: input.vision?.audienceSignals ?? [],
    languageDetection: input.ocr?.languageDetection ?? null,
  };
}

export function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function topSignalConfidence<T extends { confidence: number }>(
  signals: readonly T[],
): number {
  if (signals.length === 0) {
    return 0;
  }
  return Math.max(...signals.map((signal) => signal.confidence));
}

export function computeConfidenceBreakdown(input: {
  mediaValidationConfidence: number;
  ocr: OCRResult | null;
  vision: VisionAnalysisOutput | null;
}): ConfidenceBreakdown {
  const ocrConfidence = input.ocr?.averageConfidence ?? 0;
  const scriptConfidence = input.ocr?.languageDetection.scripts.length
    ? Math.min(1, input.ocr.languageDetection.detectedLanguages[0]?.confidence ?? 0.5)
    : 0;
  const languageConfidence = input.ocr?.languageDetection.primaryLanguage
    ? Math.min(
        1,
        input.ocr.languageDetection.detectedLanguages[0]?.confidence ?? 0.5,
      )
    : 0;
  const visionSchemaConfidence = average(input.vision?.providerConfidenceSignals ?? []);
  const businessSignalConfidence = topSignalConfidence(
    input.vision?.businessSignals ?? [],
  );
  const audienceSignalConfidence = topSignalConfidence(
    input.vision?.audienceSignals ?? [],
  );
  const contentPurposeConfidence = input.vision?.contentPurpose ? 0.75 : 0;
  const overallConfidence = average([
    input.mediaValidationConfidence,
    ocrConfidence,
    scriptConfidence,
    languageConfidence,
    visionSchemaConfidence,
    businessSignalConfidence,
    audienceSignalConfidence,
    contentPurposeConfidence,
  ]);
  return {
    mediaValidationConfidence: input.mediaValidationConfidence,
    ocrConfidence,
    scriptConfidence,
    languageConfidence,
    visionSchemaConfidence,
    businessSignalConfidence,
    audienceSignalConfidence,
    contentPurposeConfidence,
    overallConfidence,
  };
}
