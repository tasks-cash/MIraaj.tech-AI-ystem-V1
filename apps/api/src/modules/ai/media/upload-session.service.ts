import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createLogger } from "@miraaj/shared-logging";
import { loadEnvironment } from "../../../environment.js";
import { UploadSessionModel } from "../models/upload-session.schema.js";
import { MediaAssetModel } from "../models/media-asset.schema.js";
import { MediaStorageService } from "./media-storage.service.js";
import { MediaQueueService } from "../queue/media-queue.service.js";
import {
  isAllowedDeclaredMime,
  sanitizeFilename,
} from "./filename-sanitize.js";

export interface CreateUploadSessionInput {
  originalFilename: string;
  declaredMimeType: string;
  declaredSizeBytes: number;
}

@Injectable()
export class UploadSessionService {
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });

  constructor(
    @Inject(MediaStorageService)
    private readonly storage: MediaStorageService,
    @Inject(MediaQueueService)
    private readonly queue: MediaQueueService,
  ) {}

  async createSession(input: CreateUploadSessionInput) {
    if (!isAllowedDeclaredMime(input.declaredMimeType)) {
      throw new BadRequestException({
        code: "MEDIA_TYPE_UNSUPPORTED",
        message: "The declared media type is not supported.",
      });
    }
    if (input.declaredSizeBytes <= 0) {
      throw new BadRequestException({
        code: "MEDIA_SIZE_EXCEEDED",
        message: "Declared media size is invalid.",
      });
    }
    const maxBytes =
      input.declaredMimeType === "application/pdf"
        ? this.environment.MEDIA_MAX_PDF_BYTES
        : this.environment.MEDIA_MAX_IMAGE_BYTES;
    if (input.declaredSizeBytes > maxBytes) {
      throw new BadRequestException({
        code: "MEDIA_SIZE_EXCEEDED",
        message: "Declared media size exceeds the configured limit.",
      });
    }

    const sessionId = randomUUID();
    const mediaId = randomUUID();
    const sanitizedFilename = sanitizeFilename(input.originalFilename);
    const objectKey = this.storage.buildOriginalObjectKey(mediaId);
    const presigned = await this.storage.createPresignedUpload({
      objectKey,
      contentType: input.declaredMimeType,
      contentLength: input.declaredSizeBytes,
    });
    const expiresAt = new Date(
      Date.now() + this.environment.MEDIA_UPLOAD_SESSION_TTL_SECONDS * 1_000,
    );

    await MediaAssetModel.create({
      mediaId,
      status: "pending_upload",
      kind: input.declaredMimeType === "application/pdf" ? "pdf" : "image",
      originalFilename: input.originalFilename,
      sanitizedFilename,
      originalObjectKey: objectKey,
      uploadSessionId: sessionId,
    });

    const session = await UploadSessionModel.create({
      sessionId,
      mediaId,
      status: "created",
      originalFilename: input.originalFilename,
      sanitizedFilename,
      declaredMimeType: input.declaredMimeType,
      declaredSizeBytes: input.declaredSizeBytes,
      objectKey,
      bucket: this.storage.bucket,
      expiresAt,
    });

    this.logger.info(
      {
        event: "ai.media.upload_session.created",
        sessionId,
        mediaId,
        declaredMimeType: input.declaredMimeType,
      },
      "Upload session created",
    );

    return {
      sessionId: session.sessionId,
      mediaId: session.mediaId,
      status: session.status,
      upload: {
        method: "PUT",
        bucket: presigned.bucket,
        objectKey: presigned.objectKey,
        uploadUrl: presigned.uploadUrl,
        expiresAt: presigned.expiresAt,
        headers: {
          "Content-Type": input.declaredMimeType,
          "Content-Length": String(input.declaredSizeBytes),
        },
      },
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async getSession(sessionId: string) {
    const session = await UploadSessionModel.findOne({ sessionId }).lean();
    if (!session) {
      throw new NotFoundException({
        code: "UPLOAD_SESSION_NOT_FOUND",
        message: "Upload session was not found.",
      });
    }
    return this.toSessionResponse(session);
  }

  async completeSession(sessionId: string) {
    const session = await UploadSessionModel.findOne({ sessionId });
    if (!session) {
      throw new NotFoundException({
        code: "UPLOAD_SESSION_NOT_FOUND",
        message: "Upload session was not found.",
      });
    }
    if (session.status === "completed") {
      return this.toSessionResponse(session.toObject());
    }
    if (session.expiresAt.getTime() < Date.now()) {
      session.status = "expired";
      await session.save();
      throw new BadRequestException({
        code: "UPLOAD_SESSION_EXPIRED",
        message: "Upload session has expired.",
      });
    }
    if (session.status !== "created" && session.status !== "uploading") {
      throw new BadRequestException({
        code: "UPLOAD_SESSION_INVALID_STATE",
        message: "Upload session cannot be completed in its current state.",
      });
    }

    const head = await this.storage.headObject(session.objectKey);
    if (!head.exists) {
      throw new BadRequestException({
        code: "UPLOAD_OBJECT_MISSING",
        message: "Uploaded object was not found in storage.",
      });
    }
    if (
      head.contentLength !== undefined &&
      head.contentLength !== session.declaredSizeBytes
    ) {
      throw new BadRequestException({
        code: "MEDIA_SIZE_EXCEEDED",
        message: "Uploaded object size does not match the declared size.",
      });
    }

    session.status = "validating";
    await session.save();
    await MediaAssetModel.updateOne(
      { mediaId: session.mediaId },
      { status: "validating" },
    );

    const bullJob = await this.queue.enqueueValidateMedia({
      sessionId: session.sessionId,
      mediaId: session.mediaId,
      objectKey: session.objectKey,
    });

    session.status = "uploaded";
    await session.save();

    this.logger.info(
      {
        event: "ai.media.upload_session.completed",
        sessionId,
        mediaId: session.mediaId,
        queueJobId: bullJob.id,
      },
      "Upload session completed",
    );

    return this.toSessionResponse(session.toObject());
  }

  private toSessionResponse(session: {
    sessionId: string;
    mediaId: string;
    status: string;
    originalFilename: string;
    sanitizedFilename: string;
    declaredMimeType: string;
    declaredSizeBytes: number;
    objectKey: string;
    bucket: string;
    expiresAt: Date;
    completedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      sessionId: session.sessionId,
      mediaId: session.mediaId,
      status: session.status,
      originalFilename: session.originalFilename,
      sanitizedFilename: session.sanitizedFilename,
      declaredMimeType: session.declaredMimeType,
      declaredSizeBytes: session.declaredSizeBytes,
      objectKey: session.objectKey,
      bucket: session.bucket,
      expiresAt: session.expiresAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      createdAt: session.createdAt?.toISOString() ?? null,
      updatedAt: session.updatedAt?.toISOString() ?? null,
    };
  }
}
