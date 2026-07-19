import pino, { type Logger, type LoggerOptions } from "pino";

const redactPaths = [
  "authorization",
  "cookie",
  "password",
  "req.headers.authorization",
  "req.headers.cookie",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "credentials",
  "adminApiToken",
  "ADMIN_API_TOKEN",
  "aiServiceInternalSecret",
  "AI_SERVICE_INTERNAL_SECRET",
  "mongodbUri",
  "MONGODB_URI",
  "redisUrl",
  "REDIS_URL",
  "*.authorization",
  "*.cookie",
  "*.password",
  "*.accessToken",
  "*.refreshToken",
  "*.apiKey",
  "*.secret",
  "*.credentials",
  "*.adminApiToken",
  "*.ADMIN_API_TOKEN",
  "*.aiServiceInternalSecret",
  "*.AI_SERVICE_INTERNAL_SECRET",
  "*.mongodbUri",
  "*.MONGODB_URI",
  "*.redisUrl",
  "*.REDIS_URL",
] as const;

export function createLogger(input: {
  service: string;
  environment: string;
  level?: string;
  options?: LoggerOptions;
}): Logger {
  return pino({
    ...input.options,
    level: input.level ?? "info",
    base: {
      service: input.service,
      environment: input.environment,
    },
    redact: {
      paths: [...redactPaths],
      censor: "[REDACTED]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
