import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { loadEnvironment } from "../../../environment.js";
import { MediaStorageService } from "../media/media-storage.service.js";

/**
 * Creative media storage keys under creative/ prefixes. Wraps MediaStorageService.
 */
@Injectable()
export class CreativeStorageService {
  private readonly environment = loadEnvironment();

  constructor(
    @Inject(MediaStorageService)
    private readonly mediaStorage: MediaStorageService,
  ) {}

  get bucket(): string {
    return this.mediaStorage.bucket;
  }

  buildAssetObjectKey(
    assetId: string,
    extension: string,
    randomId = randomUUID(),
  ): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `creative/assets/${year}/${month}/${assetId}/${randomId}.${extension}`;
  }

  buildVariantObjectKey(
    assetId: string,
    variantId: string,
    extension: string,
  ): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `creative/variants/${year}/${month}/${assetId}/${variantId}.${extension}`;
  }

  buildProvenanceObjectKey(assetId: string, manifestId: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `creative/provenance/${year}/${month}/${assetId}/${manifestId}.json`;
  }

  async putBinaryObject(input: {
    objectKey: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    const maxBytes = Math.max(
      this.environment.CREATIVE_MAX_IMAGE_BYTES,
      this.environment.CREATIVE_MAX_VIDEO_BYTES,
    );
    if (input.body.byteLength > maxBytes) {
      throw new Error("CREATIVE_PROVIDER_OUTPUT_TOO_LARGE");
    }
    await this.mediaStorage.putBinaryObject(input);
  }

  async putJsonObject(objectKey: string, payload: unknown): Promise<void> {
    await this.mediaStorage.putJsonObject(objectKey, payload);
  }

  async createPresignedReadUrl(objectKey: string): Promise<string> {
    return this.mediaStorage.createPresignedReadUrl(objectKey);
  }
}
