import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { initServices } from "./services/app-services";
import { connectMongo } from "@maraaj/database";
import { AppError } from "./common/errors";
import { failure } from "./common/response";
import { randomUUID } from "node:crypto";
import { requestContext } from "./common/request-context";
import { csrfExemptPath, verifyCsrf } from "./common/csrf";

@Catch()
class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    if (exception instanceof AppError) {
      return res
        .status(exception.status)
        .json(failure(exception.code, exception.message, exception.details));
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return res.status(status).json(failure("VALIDATION_ERROR", exception.message));
    }
    console.error(exception);
    return res.status(500).json(failure("INTERNAL_ERROR", "An unexpected error occurred"));
  }
}

async function bootstrap() {
  const services = await initServices();
  await connectMongo(services.env.MONGODB_URI);

  const app = await NestFactory.create(AppModule, { rawBody: true });
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: services.env.NODE_ENV === "production" ? undefined : false,
    }),
  );
  expressApp.use(cookieParser(services.env.SESSION_SECRET));
  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = String(req.headers["x-request-id"] ?? randomUUID());
    const correlationId = String(req.headers["x-correlation-id"] ?? requestId);
    res.setHeader("x-request-id", requestId);
    requestContext.run({ requestId, correlationId }, () => next());
  });

  // Double-submit CSRF for cookie-authenticated state-changing requests.
  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
    if (csrfExemptPath(req.path)) return next();
    // Machine (Bearer) clients use request signing instead of CSRF cookies.
    if (req.headers.authorization?.startsWith("Bearer ")) return next();
    if (!req.cookies?.mic_session) return next();
    const secret = services.env.SESSION_SECRET ?? "dev";
    if (!verifyCsrf(req, secret)) {
      return res.status(403).json(failure("CSRF_INVALID", "Invalid or missing CSRF token"));
    }
    return next();
  });

  app.enableCors({
    origin: [services.env.ADMIN_URL, services.env.PUBLIC_WEB_URL],
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const swagger = new DocumentBuilder()
    .setTitle("Maraaj Intelligence Core API")
    .setDescription("Private AI platform API for Maraaj.tech")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("/docs", app, SwaggerModule.createDocument(app, swagger));

  const port = services.env.API_PORT;
  await app.listen(port);
  services.logger.info({ port }, "MIC API listening");
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
