export interface TemporaryAdminRequest {
  headers: {
    authorization?: string;
    "idempotency-key"?: string;
  };
  adminPermissions?: readonly string[];
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}
