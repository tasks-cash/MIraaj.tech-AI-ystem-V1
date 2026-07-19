
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  correlationId: string;
  tenantId?: string;
  projectId?: string;
  clientId?: string;
  userId?: string;
  scopes?: string[];
  permissions?: string[];
  environment?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getCtx(): RequestContext | undefined {
  return requestContext.getStore();
}
