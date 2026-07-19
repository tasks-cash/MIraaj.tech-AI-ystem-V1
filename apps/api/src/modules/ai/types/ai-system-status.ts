import type {
  ServiceHealth,
  ServiceReadiness,
  ServiceVersion,
} from "@miraaj/shared-types";

export interface AiSystemStatus {
  module: "ok";
  configuredUrl: string;
  lastCheckedAt: string;
  python: {
    health: ServiceHealth | null;
    readiness: ServiceReadiness | null;
    version: ServiceVersion | null;
  };
  error: {
    code: string;
    message: string;
  } | null;
}
