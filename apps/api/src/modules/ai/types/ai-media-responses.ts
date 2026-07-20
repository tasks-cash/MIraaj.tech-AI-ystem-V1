import type {
  AIProcessingErrorCode,
  ConfidenceBreakdown,
  DuplicateDetectionResult,
  MediaValidationResult,
  OCRResult,
  SanitizationResult,
  VisionAnalysisOutput,
} from "@miraaj/shared-types";

export interface MediaInspectResponse extends MediaValidationResult {
  sanitization?: SanitizationResult;
  duplicate?: DuplicateDetectionResult;
  processingMs: number;
}

export interface AnalyzeResponse {
  accepted: boolean;
  inspect?: MediaInspectResponse;
  ocr?: OCRResult;
  vision?: VisionAnalysisOutput;
  confidence?: ConfidenceBreakdown;
  errorCode?: AIProcessingErrorCode;
  safeMessage?: string;
  processingMs: number;
}

export interface OcrStatusResponse {
  engine: string;
  available: boolean;
  installedLanguagePacks: string[];
  defaultLanguagePacks: string[];
  maxLanguagesPerJob: number;
  preliminaryLanguages: string[];
  safeError?: string | null;
}

export interface ProvidersStatusResponse {
  vision: Record<string, unknown>;
  ocr: OcrStatusResponse;
}

export interface SignedMediaRequestBody {
  signedMediaUrl: string;
  hints?: Record<string, unknown>;
}
