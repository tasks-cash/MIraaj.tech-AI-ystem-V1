/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { loadEnvironment } from "../../../environment.js";
import { CampaignTaskModel, CampaignTaskOccurrenceModel } from "../models/campaign-task.schema.js";
import { DistributionAssignmentModel, ProofSubmissionModel } from "../models/distribution.schema.js";
import { CampaignTaskRecurringQueueService } from "../queue/campaign-task-recurring-queue.service.js";
import { nextOccurrences, recurrenceKey, type RecurrenceConfiguration } from "./campaign-task-recurrence.js";

@Injectable()
export class CampaignTaskRecurringService {
  private readonly environment = loadEnvironment();
  constructor(private readonly queue: CampaignTaskRecurringQueueService) {}

  private enabled() {
    if (!this.environment.CAMPAIGN_TASK_RECURRING_ENABLED) throw new ConflictException("CAMPAIGN_TASK_RECURRING_DISABLED");
  }

  async preview(taskId: string, tenantId: string, count = 10) {
    this.enabled();
    const task = await CampaignTaskModel.findOne({ publicId: taskId, tenantId }).lean();
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    const config = task.recurrenceConfiguration as RecurrenceConfiguration & { enabled?: boolean };
    if (!config.enabled) throw new ConflictException("CAMPAIGN_TASK_RECURRENCE_NOT_CONFIGURED");
    return nextOccurrences(config, new Date(), Math.min(25, Math.max(1, count))).map((scheduledFor) => ({
      recurrenceKey: recurrenceKey(taskId, scheduledFor, config.timezone), scheduledFor: scheduledFor.toISOString(), timezone: config.timezone,
    }));
  }

  async plan(taskId: string, tenantId: string, actor = "recurring-scheduler") {
    this.enabled();
    if (!this.environment.CAMPAIGN_TASK_RECURRING_SCHEDULER_ENABLED) throw new ConflictException("CAMPAIGN_TASK_RECURRING_SCHEDULER_DISABLED");
    const task = await CampaignTaskModel.findOne({ publicId: taskId, tenantId }).lean();
    if (!task) throw new NotFoundException("CAMPAIGN_TASK_NOT_FOUND");
    if (!["approved", "scheduled", "active"].includes(task.status) || task.emergencyStop) throw new ConflictException("CAMPAIGN_TASK_RECURRENCE_PARENT_INACTIVE");
    const config = task.recurrenceConfiguration as RecurrenceConfiguration & { enabled?: boolean; maxOccurrences?: number };
    if (!config.enabled) throw new ConflictException("CAMPAIGN_TASK_RECURRENCE_NOT_CONFIGURED");
    const existingCount = await CampaignTaskOccurrenceModel.countDocuments({ tenantId, campaignTaskId: taskId });
    const remaining = Math.max(0, (config.maxOccurrences ?? 365) - existingCount);
    const candidates = nextOccurrences(config, new Date(), Math.min(25, remaining));
    const created = [];
    for (const scheduledFor of candidates) {
      const key = recurrenceKey(taskId, scheduledFor, config.timezone);
      const assignmentWindowEnd = new Date(scheduledFor.getTime() + task.assignmentDurationMinutes * 60_000);
      const proofDeadline = new Date(scheduledFor.getTime() + task.proofDeadlineMinutes * 60_000);
      try {
        const occurrence: any = await CampaignTaskOccurrenceModel.create({
          publicId: `aco_${randomUUID()}`, tenantId, campaignTaskId: taskId, taskRevision: task.currentRevision,
          recurrenceKey: key, scheduledFor, timezone: config.timezone, occurrenceNumber: existingCount + created.length + 1,
          capacitySnapshot: task.totalCapacity, assignmentWindowStart: scheduledFor, assignmentWindowEnd, proofDeadline,
          createdByScheduler: true, createdBy: actor, updatedBy: actor, correlationId: randomUUID(), status: "scheduled",
        });
        created.push(occurrence);
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
      }
    }
    return { planned: created.length, deduplicated: candidates.length - created.length, occurrences: created };
  }

  async planAll() {
    if (!this.environment.CAMPAIGN_TASK_RECURRING_ENABLED || !this.environment.CAMPAIGN_TASK_RECURRING_SCHEDULER_ENABLED) return { tasks: 0, planned: 0 };
    const tasks = await CampaignTaskModel.find({ status: { $in: ["approved", "scheduled", "active"] }, emergencyStop: false, "recurrenceConfiguration.enabled": true }).select("publicId tenantId").lean();
    let planned = 0;
    for (const task of tasks) {
      const result = await this.plan(String(task.publicId), String(task.tenantId));
      planned += result.planned;
    }
    return { tasks: tasks.length, planned };
  }

  history(taskId: string, tenantId: string) {
    this.enabled();
    return CampaignTaskOccurrenceModel.find({ tenantId, campaignTaskId: taskId }).sort({ scheduledFor: -1 }).limit(100).lean();
  }

  async cancel(taskId: string, occurrenceId: string, tenantId: string, actor: string) {
    const occurrence = await CampaignTaskOccurrenceModel.findOneAndUpdate(
      { publicId: occurrenceId, campaignTaskId: taskId, tenantId, status: "scheduled" },
      { $set: { status: "cancelled", cancelledAt: new Date(), updatedBy: actor } }, { new: true },
    );
    if (!occurrence) throw new ConflictException("CAMPAIGN_TASK_OCCURRENCE_CANCEL_INVALID");
    return occurrence;
  }

  async activate(occurrenceId: string) {
    const occurrence = await CampaignTaskOccurrenceModel.findOne({ publicId: occurrenceId });
    if (!occurrence || !["scheduled", "activating"].includes(occurrence.status)) return occurrence;
    occurrence.status = "activating"; occurrence.updatedBy = "recurring-scheduler";
    await occurrence.save();
    const parent = await CampaignTaskModel.findOne({ publicId: occurrence.campaignTaskId, tenantId: occurrence.tenantId }).lean();
    if (!parent || !["approved", "scheduled", "active"].includes(parent.status) || parent.emergencyStop) {
      occurrence.status = "skipped"; occurrence.lastSafeErrorCode = "PARENT_INACTIVE"; await occurrence.save(); return occurrence;
    }
    if (occurrence.taskRevision !== parent.currentRevision) {
      occurrence.status = "failed"; occurrence.lastSafeErrorCode = "STALE_REVISION"; await occurrence.save(); return occurrence;
    }
    const configuration = parent.recurrenceConfiguration as { allowOverlap?: boolean };
    if (!configuration.allowOverlap) {
      const overlapping = await CampaignTaskOccurrenceModel.exists({ tenantId: occurrence.tenantId, campaignTaskId: occurrence.campaignTaskId, publicId: { $ne: occurrence.publicId }, status: "active" });
      if (overlapping) { occurrence.status = "skipped"; occurrence.lastSafeErrorCode = "OVERLAP_FORBIDDEN"; await occurrence.save(); return occurrence; }
    }
    occurrence.status = "active"; occurrence.activatedAt = new Date(); occurrence.updatedBy = "recurring-scheduler";
    await occurrence.save();
    await this.queue.enqueueCompletion(occurrence.publicId, occurrence.assignmentWindowEnd);
    return occurrence;
  }

  async complete(occurrenceId: string) {
    const occurrence = await CampaignTaskOccurrenceModel.findOne({ publicId: occurrenceId, status: { $in: ["active", "closing"] } });
    if (!occurrence) return null;
    const parent = await CampaignTaskModel.findOne({ publicId: occurrence.campaignTaskId, tenantId: occurrence.tenantId }).lean();
    if (parent?.emergencyStop) {
      occurrence.lastSafeErrorCode = "PARENT_STOPPED";
    }
    const now = new Date();
    const proofDeadline = new Date(occurrence.proofDeadline);
    const activeStatuses = ["active", "awaiting_proof", "verification_pending", "needs_review", "more_evidence_required", "queued", "submitted"];
    const [activeAssignments, pendingProofs] = await Promise.all([
      DistributionAssignmentModel.countDocuments({ occurrenceId: occurrence.publicId, status: { $in: activeStatuses } }),
      ProofSubmissionModel.countDocuments({ occurrenceId: occurrence.publicId, status: { $in: ["upload_pending", "queued", "verifying", "needs_review", "more_evidence_required"] } }),
    ]);
    const hasActiveWork = activeAssignments > 0 || pendingProofs > 0;
    if (hasActiveWork && now < proofDeadline) {
      occurrence.status = "closing";
      occurrence.updatedBy = "recurring-scheduler";
      await occurrence.save();
      await this.queue.enqueueCompletion(occurrence.publicId, proofDeadline);
      return occurrence;
    }
    occurrence.status = "completed"; occurrence.completedAt = new Date(); occurrence.updatedBy = "recurring-scheduler";
    await occurrence.save();
    return occurrence;
  }

  async retry(occurrenceId: string, tenantId: string) {
    const occurrence = await CampaignTaskOccurrenceModel.findOneAndUpdate({ publicId: occurrenceId, tenantId, status: "failed" }, { $set: { status: "scheduled", updatedBy: "recurring-recovery" }, $unset: { lastSafeErrorCode: 1 } }, { new: true });
    if (!occurrence) throw new ConflictException("CAMPAIGN_TASK_OCCURRENCE_RETRY_INVALID");
    await this.queue.enqueueActivation(occurrence.publicId, new Date());
    return occurrence;
  }

  async recover(tenantId?: string, limit = 25) {
    this.enabled();
    const now = new Date();
    const filter: Record<string, unknown> = { status: { $in: ["scheduled", "activating", "active", "failed", "closing"] } };
    if (tenantId) filter.tenantId = tenantId;
    const occurrences = await CampaignTaskOccurrenceModel.find(filter).sort({ scheduledFor: 1 }).limit(limit).lean();
    const recovered: Array<{ publicId: string; action: string }> = [];
    for (const occurrence of occurrences) {
      const parent = await CampaignTaskModel.findOne({ publicId: occurrence.campaignTaskId, tenantId: occurrence.tenantId }).lean();
      if (!parent) continue;
      if (["paused", "cancelled"].includes(parent.status) || parent.emergencyStop) continue;
      if (occurrence.status === "scheduled" && new Date(occurrence.scheduledFor) <= now) {
        await this.queue.enqueueActivation(occurrence.publicId, new Date());
        recovered.push({ publicId: occurrence.publicId, action: "enqueue_activate" });
      } else if (occurrence.status === "activating" && new Date(occurrence.updatedAt).getTime() < now.getTime() - 60_000) {
        await this.queue.enqueueActivation(occurrence.publicId, new Date());
        recovered.push({ publicId: occurrence.publicId, action: "enqueue_activate" });
      } else if ((occurrence.status === "active" || occurrence.status === "closing") && new Date(occurrence.assignmentWindowEnd) <= now) {
        await this.queue.enqueueCompletion(occurrence.publicId, new Date());
        recovered.push({ publicId: occurrence.publicId, action: "enqueue_complete" });
      } else if (occurrence.status === "failed") {
        await this.queue.enqueueActivation(occurrence.publicId, new Date());
        recovered.push({ publicId: occurrence.publicId, action: "enqueue_retry" });
      }
    }
    return { recovered: recovered.length, items: recovered };
  }

  async recoverDeadLetter(limit = 25) {
    this.enabled();
    const jobs = await this.queue.deadLetter.getJobs(["failed"], 0, limit - 1);
    const recovered: Array<{ jobId: string; action: string }> = [];
    for (const job of jobs) {
      const data = job.data as { occurrenceId?: string };
      if (!data.occurrenceId) continue;
      const occurrence = await CampaignTaskOccurrenceModel.findOne({ publicId: data.occurrenceId }).lean();
      if (!occurrence) continue;
      if (occurrence.status === "completed" || occurrence.status === "skipped" || occurrence.status === "cancelled") {
        recovered.push({ jobId: String(job.id), action: "skip_terminal" });
        continue;
      }
      if (occurrence.status === "failed" || occurrence.status === "scheduled" || occurrence.status === "activating") {
        await this.queue.enqueueActivation(occurrence.publicId, new Date());
        recovered.push({ jobId: String(job.id), action: "enqueue_activate" });
      } else {
        await this.queue.enqueueCompletion(occurrence.publicId, new Date());
        recovered.push({ jobId: String(job.id), action: "enqueue_complete" });
      }
    }
    return { recovered: recovered.length, items: recovered };
  }
}
