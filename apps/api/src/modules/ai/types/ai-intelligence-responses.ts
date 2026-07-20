/** Prompt 3 — response contracts for the optional FastAPI reasoning provider. */

export interface BusinessProfileReasoningRequestBody {
  evidence: {
    mediaSummary: string | null;
    visibleTextSummary: string | null;
    businessSignals: readonly Record<string, unknown>[];
    audienceSignals: readonly Record<string, unknown>[];
  };
  hints?: Record<string, unknown>;
}

export interface BusinessProfileReasoningResponse {
  accepted: boolean;
  provider: string;
  businessType?: string;
  audienceType?: string;
  confidence?: number;
  evidence?: string[];
  needs?: string[];
  safeMessage?: string;
  processingMs: number;
}

export interface NeedsSuggestionResponse {
  accepted: boolean;
  provider: string;
  needs: string[];
  processingMs: number;
}

export interface ContradictionCheckResponse {
  accepted: boolean;
  provider: string;
  contradictions: string[];
  processingMs: number;
}

export interface IntelligenceProvidersStatusResponse {
  reasoning: {
    provider: string;
    enabled: boolean;
    model?: string;
  };
}
