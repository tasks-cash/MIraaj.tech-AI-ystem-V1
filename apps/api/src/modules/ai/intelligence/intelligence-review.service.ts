import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import type { IntelligenceReviewReasonCode } from "@miraaj/shared-types";
import { loadEnvironment } from "../../../environment.js";
import {
  BusinessProfileModel,
  type BusinessProfileDocument,
} from "../models/business-profile.schema.js";
import {
  ServiceRecommendationSetModel,
  type ServiceRecommendationSetDocument,
} from "../models/service-recommendation-set.schema.js";
import { BusinessIntelligenceJobModel } from "../models/business-intelligence-job.schema.js";
import { RecommendationReviewModel } from "../models/recommendation-review.schema.js";
import { IntelligenceFeedbackModel } from "../models/intelligence-feedback.schema.js";

export interface ReviewTargetInput {
  notes?: string;
  reasonCodes?: IntelligenceReviewReasonCode[];
  correctedPayload?: Record<string, unknown>;
}

type DecisionStatus = "pending" | "approved" | "corrected" | "rejected";

@Injectable()
export class IntelligenceReviewService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  async reviewProfile(profileId: string, input: ReviewTargetInput) {
    return this.transitionProfile(profileId, "pending", input);
  }

  async approveProfile(profileId: string, input: ReviewTargetInput) {
    return this.transitionProfile(profileId, "approved", input);
  }

  async rejectProfile(profileId: string, input: ReviewTargetInput) {
    return this.transitionProfile(profileId, "rejected", input);
  }

  async reviewRecommendationSet(setId: string, input: ReviewTargetInput) {
    return this.transitionRecommendationSet(setId, "pending", input);
  }

  async approveRecommendationSet(setId: string, input: ReviewTargetInput) {
    return this.transitionRecommendationSet(setId, "approved", input);
  }

  async rejectRecommendationSet(setId: string, input: ReviewTargetInput) {
    return this.transitionRecommendationSet(setId, "rejected", input);
  }

  private async transitionProfile(
    profileId: string,
    decisionStatus: DecisionStatus,
    input: ReviewTargetInput,
  ): Promise<BusinessProfileDocument> {
    const profile = await BusinessProfileModel.findOne({ profileId });
    if (!profile) {
      throw new NotFoundException({
        code: "BUSINESS_PROFILE_NOT_FOUND",
        message: "Business profile was not found.",
      });
    }
    if (profile.status === "approved" || profile.status === "rejected") {
      throw new BadRequestException({
        code: "BUSINESS_PROFILE_REVIEW_REQUIRED",
        message: "Business profile review is already finalized.",
      });
    }

    if (decisionStatus === "approved") {
      profile.status = "approved";
      profile.approvedAt = new Date();
    } else if (decisionStatus === "rejected") {
      profile.status = "rejected";
      profile.rejectedAt = new Date();
    } else {
      profile.status = "awaiting_review";
    }
    if (input.correctedPayload) {
      profile.correctedFields = input.correctedPayload;
      profile.status = "corrected";
    }
    await profile.save();

    await RecommendationReviewModel.create({
      decisionId: randomUUID(),
      targetType: "business_profile",
      targetId: profileId,
      jobId: profile.jobId ?? "",
      status: decisionStatus,
      reasonCodes: input.reasonCodes ?? [],
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.correctedPayload ? { correctedPayload: input.correctedPayload } : {}),
    });

    if (input.notes || input.correctedPayload) {
      const feedback: Record<string, unknown> = {
        feedbackId: randomUUID(),
        profileId,
        category: "business_profile_review",
        payload: {
          notes: input.notes ?? null,
          reasonCodes: input.reasonCodes ?? [],
          correctedPayload: input.correctedPayload ?? null,
        },
      };
      if (profile.jobId) {
        feedback.jobId = profile.jobId;
      }
      await IntelligenceFeedbackModel.create(feedback);
    }

    this.logger.info(
      { event: `ai.intelligence.profile.${decisionStatus}`, profileId },
      "Business profile review updated",
    );

    return profile.toObject();
  }

  private async transitionRecommendationSet(
    setId: string,
    decisionStatus: DecisionStatus,
    input: ReviewTargetInput,
  ): Promise<ServiceRecommendationSetDocument> {
    const set = await ServiceRecommendationSetModel.findOne({ setId });
    if (!set) {
      throw new NotFoundException({
        code: "RECOMMENDATION_NOT_FOUND",
        message: "Recommendation set was not found.",
      });
    }
    if (set.status === "approved" || set.status === "rejected") {
      throw new BadRequestException({
        code: "RECOMMENDATION_REVIEW_REQUIRED",
        message: "Recommendation set review is already finalized.",
      });
    }

    if (decisionStatus === "approved") {
      set.status = "approved";
      set.approvedAt = new Date();
    } else if (decisionStatus === "rejected") {
      set.status = "rejected";
      set.rejectedAt = new Date();
    } else {
      set.status = "awaiting_review";
    }
    if (input.correctedPayload) {
      set.correctedItems = input.correctedPayload;
      set.status = "corrected";
    }
    await set.save();

    await RecommendationReviewModel.create({
      decisionId: randomUUID(),
      targetType: "recommendation_set",
      targetId: setId,
      jobId: set.jobId,
      status: decisionStatus,
      reasonCodes: input.reasonCodes ?? [],
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.correctedPayload ? { correctedPayload: input.correctedPayload } : {}),
    });

    if (input.notes || input.correctedPayload) {
      await IntelligenceFeedbackModel.create({
        feedbackId: randomUUID(),
        setId,
        jobId: set.jobId,
        category: "recommendation_review",
        payload: {
          notes: input.notes ?? null,
          reasonCodes: input.reasonCodes ?? [],
          correctedPayload: input.correctedPayload ?? null,
        },
      });
    }

    await BusinessIntelligenceJobModel.updateOne(
      { jobId: set.jobId },
      {
        status:
          decisionStatus === "approved"
            ? "completed"
            : decisionStatus === "rejected"
              ? "failed"
              : "awaiting_review",
      },
    );

    this.logger.info(
      { event: `ai.intelligence.recommendations.${decisionStatus}`, setId },
      "Recommendation set review updated",
    );

    return set.toObject();
  }
}
