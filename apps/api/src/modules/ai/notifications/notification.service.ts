/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { loadEnvironment } from "../../../environment.js";
import { NotificationModel, NotificationPreferenceModel } from "../models/notification.schema.js";
import { NotificationQueueService } from "../queue/notification-queue.service.js";
import { localizeNotification } from "./notification-locales.js";

const safeParameters = z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()])).default({});
const preferenceInput = z.object({
  inAppEnabled: z.boolean().optional(), emailEnabled: z.boolean().optional(),
  operationalEnabled: z.boolean().optional(), proofStateEnabled: z.boolean().optional(),
  invitationEnabled: z.boolean().optional(), recurringEnabled: z.boolean().optional(),
  preferredLanguage: z.enum(["ar", "en", "fr"]).optional(),
  quietHours: z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).nullable().optional(),
}).strict();

@Injectable()
export class NotificationService {
  private readonly environment = loadEnvironment();
  constructor(private readonly queue: NotificationQueueService) {}

  async create(input: { tenantId: string; audienceId: string; audienceType: "participant" | "operator"; notificationType: string; titleKey?: string; messageKey?: string; localizedParameters?: unknown; safeActionType?: "none" | "assignment" | "review" | "task"; safeActionTarget?: string; deduplicationKey: string; correlationId?: string; expiresAt?: Date }) {
    if (!this.environment.NOTIFICATION_IN_APP_ENABLED) return null;
    const localizedParameters = safeParameters.parse(input.localizedParameters ?? {});
    if (input.safeActionTarget && !/^[a-z0-9_-]{1,200}$/i.test(input.safeActionTarget)) throw new BadRequestException("NOTIFICATION_ACTION_TARGET_INVALID");
    const keyBase = `notifications.${input.notificationType}`;
    try {
      const notification = await NotificationModel.create({
        publicId: `ain_${randomUUID()}`, ...input, localizedParameters,
        titleKey: input.titleKey ?? keyBase,
        messageKey: input.messageKey ?? keyBase,
        safeActionType: input.safeActionType ?? "none", safeActionTarget: input.safeActionTarget ?? "",
        status: "queued", correlationId: input.correlationId ?? randomUUID(),
      });
      await this.queue.enqueue(notification.publicId);
      return notification.toObject();
    } catch (error: any) {
      if (error?.code === 11000) return NotificationModel.findOne({ tenantId: input.tenantId, audienceId: input.audienceId, deduplicationKey: input.deduplicationKey }).lean();
      throw error;
    }
  }

  async deliver(publicId: string) {
    return NotificationModel.findOneAndUpdate({ publicId, status: { $in: ["pending", "queued", "retry_scheduled"] } }, { $set: { status: "delivered", deliveredAt: new Date() }, $inc: { attemptCount: 1 } }, { new: true });
  }

  async list(tenantId: string, audienceId: string, query: Record<string, unknown>) {
    const filter: Record<string, unknown> = { tenantId, audienceId };
    if (query.unread === "true") filter.status = { $ne: "read" };
    if (query.type) filter.notificationType = String(query.type);
    if (query.before) filter.createdAt = { $lt: new Date(String(query.before)) };
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
    const items = await NotificationModel.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean();
    const language = String(query.language ?? "en");
    const rendered = items.slice(0, limit).map((item) => {
      const localized = localizeNotification(String(item.titleKey), (item.localizedParameters ?? {}) as Record<string, string | number | boolean>, language);
      return { ...item, localizedTitle: localized.title, localizedMessage: localized.message };
    });
    return { items: rendered, nextCursor: items.length > limit ? items[limit - 1]?.createdAt : null };
  }

  unreadCount(tenantId: string, audienceId: string) {
    return NotificationModel.countDocuments({ tenantId, audienceId, status: { $in: ["pending", "queued", "delivered", "retry_scheduled"] } }).then((unread) => ({ unread }));
  }

  async markRead(publicId: string, tenantId: string, audienceId: string) {
    const item = await NotificationModel.findOneAndUpdate({ publicId, tenantId, audienceId, status: { $nin: ["expired", "cancelled"] } }, { $set: { status: "read", readAt: new Date() } }, { new: true });
    if (!item) throw new NotFoundException("NOTIFICATION_NOT_FOUND");
    return item;
  }

  async markAllRead(tenantId: string, audienceId: string) {
    const result = await NotificationModel.updateMany({ tenantId, audienceId, status: { $in: ["pending", "queued", "delivered", "retry_scheduled"] } }, { $set: { status: "read", readAt: new Date() } });
    return { markedRead: result.modifiedCount };
  }

  async preferences(tenantId: string, audienceId: string, audienceType: "participant" | "operator") {
    return NotificationPreferenceModel.findOneAndUpdate({ tenantId, audienceId }, { $setOnInsert: { publicId: `anp_${randomUUID()}`, tenantId, audienceId, audienceType } }, { upsert: true, new: true }).lean();
  }

  async updatePreferences(tenantId: string, audienceId: string, audienceType: "participant" | "operator", input: unknown) {
    const values = preferenceInput.parse(input);
    if (values.emailEnabled && !this.environment.NOTIFICATION_EMAIL_ENABLED) throw new ConflictException("NOTIFICATION_EMAIL_DISABLED");
    return NotificationPreferenceModel.findOneAndUpdate({ tenantId, audienceId }, { $set: { ...values, audienceType }, $setOnInsert: { publicId: `anp_${randomUUID()}`, tenantId, audienceId } }, { upsert: true, new: true }).lean();
  }

  async expireNotifications() {
    const now = new Date();
    const result = await NotificationModel.updateMany(
      { status: { $nin: ["read", "expired", "cancelled"] }, $or: [{ expiresAt: { $lte: now } }, { createdAt: { $lte: new Date(now.getTime() - this.environment.NOTIFICATION_RETENTION_DAYS * 86_400_000) } }] },
      { $set: { status: "expired", updatedAt: now } },
    );
    return { expired: result.modifiedCount };
  }

  async cleanupRetention() {
    const cutoff = new Date(Date.now() - this.environment.NOTIFICATION_RETENTION_DAYS * 86_400_000);
    const result = await NotificationModel.deleteMany({ status: { $in: ["read", "expired", "cancelled"] }, updatedAt: { $lte: cutoff } });
    return { removed: result.deletedCount };
  }
}
