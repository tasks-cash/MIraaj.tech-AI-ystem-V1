import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { loadEnvironment } from "./environment.js";

export function createS3Client(options?: {
  /** Host-facing uploads use the public endpoint when configured. */
  purpose?: "internal" | "presign";
}): S3Client {
  const environment = loadEnvironment();
  const endpoint =
    options?.purpose === "presign" && environment.S3_PUBLIC_ENDPOINT
      ? environment.S3_PUBLIC_ENDPOINT
      : environment.S3_ENDPOINT;
  const config: S3ClientConfig = {
    region: environment.S3_REGION,
    forcePathStyle: environment.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: environment.S3_ACCESS_KEY_ID,
      secretAccessKey: environment.S3_SECRET_ACCESS_KEY,
    },
  };
  if (endpoint) {
    config.endpoint = endpoint;
  }
  return new S3Client(config);
}
