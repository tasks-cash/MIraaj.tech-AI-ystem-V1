
import { SecurityEvent } from "@maraaj/database";

export async function recordSecurityEvent(input: {
  type: string;
  severity: "informational" | "low" | "medium" | "high" | "critical";
  message: string;
  tenantId?: string;
  projectId?: string;
  clientId?: string;
  userId?: string;
  ipHash?: string;
  metadata?: unknown;
}) {
  return SecurityEvent.create(input);
}
