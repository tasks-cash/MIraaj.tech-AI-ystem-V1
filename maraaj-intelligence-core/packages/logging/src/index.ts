
import pino, { type Logger } from "pino";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "password",
  "privateKey",
  "private_key",
  "apiSecret",
  "apiKey",
  "token",
  "accessToken",
  "refreshToken",
  "webhookSecret",
  "providerToken",
  "LOCAL_MASTER_KEY",
  "SMTP_PASSWORD",
  "S3_SECRET_KEY",
];

export function createLogger(service: string, level = "info"): Logger {
  return pino({
    level,
    base: { service },
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export function redactObject<T extends Record<string, unknown>>(obj: T): T {
  const clone = structuredClone(obj);
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        if (/password|secret|token|private|authorization|cookie|credential/i.test(k)) {
          o[k] = "[REDACTED]";
        } else {
          o[k] = walk(o[k]);
        }
      }
      return o;
    }
    return v;
  };
  return walk(clone) as T;
}

export type { Logger };
