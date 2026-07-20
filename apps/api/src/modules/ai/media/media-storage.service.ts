import { Injectable } from "@nestjs/common";
import {
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { loadEnvironment } from "../../../environment.js";
import { createS3Client } from "../../../s3-client.js";

export interface PresignedUpload {
  uploadUrl: string;
  objectKey: string;
  bucket: string;
  expiresAt: string;
}

@Injectable()
export class MediaStorageService {
  private readonly environment = loadEnvironment();
  private readonly client = createS3Client({ purpose: "internal" });
  private readonly presignClient = createS3Client({ purpose: "presign" });

  get bucket(): string {
    return this.environment.S3_BUCKET;
  }

  get processedBucket(): string {
    return this.environment.S3_BUCKET;
  }

  buildOriginalObjectKey(mediaId: string, randomId = randomUUID()): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `media/original/${year}/${month}/${mediaId}/${randomId}`;
  }

  buildNormalizedObjectKey(
    mediaId: string,
    version: number,
    format: string,
  ): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `media/normalized/${year}/${month}/${mediaId}/${version}.${format}`;
  }

  buildOcrObjectKey(mediaId: string, attemptId: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `media/ocr/${year}/${month}/${mediaId}/${attemptId}.json`;
  }

  buildPreviewObjectKey(
    mediaId: string,
    page: number,
    format: string,
  ): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `media/previews/${year}/${month}/${mediaId}/${page}.${format}`;
  }

  async createPresignedUpload(input: {
    objectKey: string;
    contentType: string;
    contentLength: number;
  }): Promise<PresignedUpload> {
    const expiresIn = this.environment.MEDIA_PRESIGNED_UPLOAD_TTL_SECONDS;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    const uploadUrl = await getSignedUrl(this.presignClient, command, {
      expiresIn,
    });
    return {
      uploadUrl,
      objectKey: input.objectKey,
      bucket: this.bucket,
      expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
    };
  }

  async createPresignedReadUrl(objectKey: string): Promise<string> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: this.environment.MEDIA_PRESIGNED_READ_TTL_SECONDS,
    });
  }

  async headObject(objectKey: string): Promise<{
    exists: boolean;
    contentLength?: number;
    contentType?: string;
  }> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
      return {
        exists: true,
        ...(response.ContentLength !== undefined
          ? { contentLength: response.ContentLength }
          : {}),
        ...(response.ContentType ? { contentType: response.ContentType } : {}),
      };
    } catch {
      return { exists: false };
    }
  }

  async putJsonObject(objectKey: string, payload: unknown): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.processedBucket,
        Key: objectKey,
        Body: JSON.stringify(payload),
        ContentType: "application/json",
      }),
    );
  }

  async putBinaryObject(input: {
    objectKey: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.processedBucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }
}
