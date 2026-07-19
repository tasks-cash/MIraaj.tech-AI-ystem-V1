
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes, createHash } from "node:crypto";

export interface StorageConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export class ObjectStorage {
  private client: S3Client;
  constructor(private readonly config: StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
    }
  }

  buildObjectKey(parts: {
    tenantId: string;
    projectId: string;
    kind: string;
    filename: string;
  }): string {
    const safe = parts.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const id = randomBytes(8).toString("hex");
    return `${parts.tenantId}/${parts.projectId}/${parts.kind}/${id}-${safe}`;
  }

  async presignUpload(opts: {
    key: string;
    contentType: string;
    maxSizeBytes: number;
    expiresIn?: number;
  }): Promise<{ url: string; key: string; expiresIn: number }> {
    const expiresIn = opts.expiresIn ?? 300;
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: opts.key,
      ContentType: opts.contentType,
      Metadata: { "max-size": String(opts.maxSizeBytes) },
    });
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { url, key: opts.key, expiresIn };
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty object");
    return Buffer.from(bytes);
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }

  publicUrl(mediaBaseUrl: string, key: string): string {
    return `${mediaBaseUrl.replace(/\/$/, "")}/${key}`;
  }
}

export function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  // AVIF / ISO BMFF
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif";
  }
  return null;
}

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Simple average hash for duplicate detection (8x8). */
export function simplePerceptualHash(grayPixels: number[][], size = 8): string {
  let sum = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) sum += grayPixels[y]?.[x] ?? 0;
  }
  const avg = sum / (size * size);
  let bits = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) bits += (grayPixels[y]?.[x] ?? 0) >= avg ? "1" : "0";
  }
  const hex = BigInt(`0b${bits}`).toString(16).padStart(16, "0");
  return hex;
}
