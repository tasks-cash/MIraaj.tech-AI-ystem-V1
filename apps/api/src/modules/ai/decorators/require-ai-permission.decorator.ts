import { SetMetadata } from "@nestjs/common";

export const AI_PERMISSION_METADATA_KEY = "ai:required-permission";

export const RequireAiPermission = (permission: string) =>
  SetMetadata(AI_PERMISSION_METADATA_KEY, permission);
