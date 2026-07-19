import { Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import mongoose from "mongoose";
import { createLogger } from "@miraaj/shared-logging";
import { loadEnvironment } from "./environment.js";

export interface DependencyStatus {
  mongo: "ready" | "unavailable";
  redis: "ready" | "unavailable";
}

@Injectable()
export class InfrastructureService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly environment = loadEnvironment();
  private readonly logger = createLogger({
    service: "miraaj-api",
    environment: this.environment.APP_ENV,
    level: this.environment.LOG_LEVEL,
  });
  private readonly redis = new Redis(this.environment.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
  });

  async onModuleInit(): Promise<void> {
    await Promise.all([
      mongoose.connect(this.environment.MONGODB_URI, {
        serverSelectionTimeoutMS: 8_000,
      }),
      this.redis.connect(),
    ]);
    this.logger.info("MongoDB and Redis connections are ready");
  }

  async dependencyStatus(): Promise<DependencyStatus> {
    const mongo =
      mongoose.connection.readyState === mongoose.ConnectionStates.connected
        ? "ready"
        : "unavailable";
    let redis: DependencyStatus["redis"] = "unavailable";
    try {
      redis = (await this.redis.ping()) === "PONG" ? "ready" : "unavailable";
    } catch {
      redis = "unavailable";
    }
    return { mongo, redis };
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([mongoose.disconnect(), this.redis.quit()]);
  }
}
