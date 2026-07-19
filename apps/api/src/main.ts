import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { createLogger } from "@miraaj/shared-logging";
import { AppModule } from "./app.module.js";
import { loadEnvironment } from "./environment.js";

async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  const logger = createLogger({
    service: "miraaj-api",
    environment: environment.APP_ENV,
    level: environment.LOG_LEVEL,
  });
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.enableShutdownHooks();
  await app.listen(environment.API_PORT, environment.API_HOST);
  logger.info(
    {
      host: environment.API_HOST,
      port: environment.API_PORT,
    },
    "Miraaj API started",
  );
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  process.stderr.write(
    `${JSON.stringify({
      level: "fatal",
      service: "miraaj-api",
      event: "startup_failed",
      message,
    })}\n`,
  );
  process.exitCode = 1;
});
