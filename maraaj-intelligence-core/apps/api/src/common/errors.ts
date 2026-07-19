
import type { ErrorCode } from "@maraaj/types";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}
