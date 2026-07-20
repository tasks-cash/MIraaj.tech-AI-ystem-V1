import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import type { ReviewReasonCode, ReviewStatus, ConfidenceBreakdown } from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import {
  AnalysisResultModel,
  type AnalysisResultDocument,
} from "../models/analysis-result.schema.js";
import { AnalysisJobModel } from "../models/analysis-job.schema.js";
import { ReviewDecisionModel } from "../models/review-decision.schema.js";
import { FeedbackModel } from "../models/feedback.schema.js";

export interface ReviewResultInput {
  notes?: string;
  reasonCodes?: ReviewReasonCode[];
  correctedOutput?: Record<string, unknown>;
}

@Injectable()
export class ReviewService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  async submitReview(resultId: string, input: ReviewResultInput) {
    return this.transitionResult(resultId, "pending", {
      decisionStatus: "pending",
      reviewStatus: "in_review",
      ...(input.notes ? { notes: input.notes } : {}),
      reasonCodes: input.reasonCodes ?? [],
    });
  }

  async approveResult(resultId: string, input: ReviewResultInput) {
    return this.transitionResult(resultId, "approved", {
      decisionStatus: "approved",
      reviewStatus: "approved",
      ...(input.notes ? { notes: input.notes } : {}),
      reasonCodes: input.reasonCodes ?? [],
      ...(input.correctedOutput ? { correctedOutput: input.correctedOutput } : {}),
      approved: true,
    });
  }

  async rejectResult(resultId: string, input: ReviewResultInput) {
    return this.transitionResult(resultId, "rejected", {
      decisionStatus: "rejected",
      reviewStatus: "rejected",
      ...(input.notes ? { notes: input.notes } : {}),
      reasonCodes: input.reasonCodes ?? ["manual_review_requested"],
      ...(input.correctedOutput ? { correctedOutput: input.correctedOutput } : {}),
      rejected: true,
    });
  }

  private async transitionResult(
    resultId: string,
    decisionStatus: "pending" | "approved" | "rejected",
    input: {
      decisionStatus: "pending" | "approved" | "rejected";
      reviewStatus: ReviewStatus;
      notes?: string;
      reasonCodes: ReviewReasonCode[];
      correctedOutput?: Record<string, unknown>;
      approved?: boolean;
      rejected?: boolean;
    },
  ) {
    const result = await AnalysisResultModel.findOne({ resultId });
    if (!result) {
      throw new NotFoundException({
        code: "ANALYSIS_RESULT_NOT_FOUND",
        message: "Analysis result was not found.",
      });
    }
    if (result.reviewStatus === "approved" || result.reviewStatus === "rejected") {
      throw new BadRequestException({
        code: "ANALYSIS_RESULT_IMMUTABLE",
        message: "Analysis result review is already finalized.",
      });
    }

    result.reviewStatus = input.reviewStatus;
    if (input.approved) {
      result.approvedAt = new Date();
    }
    if (input.rejected) {
      result.rejectedAt = new Date();
    }
    if (input.correctedOutput) {
      result.mergedOutput = {
        ...(result.mergedOutput as Record<string, unknown>),
        correctedOutput: input.correctedOutput,
      };
      result.reviewStatus = "corrected";
    }
    await result.save();

    await ReviewDecisionModel.create({
      decisionId: randomUUID(),
      resultId: result.resultId,
      jobId: result.jobId,
      mediaId: result.mediaId,
      status: input.decisionStatus,
      reasonCodes: input.reasonCodes,
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.correctedOutput ? { correctedOutput: input.correctedOutput } : {}),
    });

    if (input.notes || input.correctedOutput) {
      await FeedbackModel.create({
        feedbackId: randomUUID(),
        resultId: result.resultId,
        jobId: result.jobId,
        mediaId: result.mediaId,
        category: "review",
        payload: {
          notes: input.notes ?? null,
          reasonCodes: input.reasonCodes,
          correctedOutput: input.correctedOutput ?? null,
        },
      });
    }

    await AnalysisJobModel.updateOne(
      { jobId: result.jobId },
      {
        status: input.approved ? "completed" : input.rejected ? "failed" : "awaiting_review",
      },
    );

    this.logger.info(
      {
        event: `ai.analysis.result.${decisionStatus}`,
        resultId,
        jobId: result.jobId,
      },
      "Analysis result review updated",
    );

    return this.toResultResponse(result);
  }

  toResultResponse(result: AnalysisResultDocument | Record<string, unknown>) {
    const value = result as AnalysisResultDocument;
    return {
      resultId: value.resultId,
      jobId: value.jobId,
      mediaId: value.mediaId,
      attemptId: value.attemptId,
      purpose: value.purpose,
      reviewStatus: value.reviewStatus,
      overallConfidence: value.overallConfidence,
      confidence: value.confidence as ConfidenceBreakdown,
      mergedOutput: value.mergedOutput as Record<string, unknown>,
      reviewReasonCodes: value.reviewReasonCodes,
      requiresReview: value.requiresReview,
      approvedAt: value.approvedAt?.toISOString() ?? null,
      rejectedAt: value.rejectedAt?.toISOString() ?? null,
      createdAt: value.createdAt?.toISOString?.() ?? null,
      updatedAt: value.updatedAt?.toISOString?.() ?? null,
    };
  }
}
