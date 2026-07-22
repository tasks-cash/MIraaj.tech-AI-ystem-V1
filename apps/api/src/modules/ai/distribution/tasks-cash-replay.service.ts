import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { InfrastructureService } from "../../../infrastructure.service.js";
import { TASKS_CASH_CLOCK_SKEW_MS } from "./distribution.contracts.js";
import { TasksCashReplayNonceModel } from "../models/distribution.schema.js";

@Injectable()
export class TasksCashReplayService {
  constructor(@Inject(InfrastructureService) private readonly infrastructure: InfrastructureService) {}

  async reserve(nonce: string, requestTimestamp: number): Promise<boolean> {
    const nonceHash = createHash("sha256").update(nonce).digest("hex");
    const key = `miraaj:tasks-cash:nonce:${nonceHash}`;
    const redis = this.infrastructure.getRedis();
    const reserved = await redis.set(key, "1", "PX", TASKS_CASH_CLOCK_SKEW_MS, "NX");
    if (reserved !== "OK") return false;
    try {
      await TasksCashReplayNonceModel.create({
        nonceHash,
        requestTimestamp,
        expiresAt: new Date(Date.now() + TASKS_CASH_CLOCK_SKEW_MS),
      });
      return true;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code: number }).code === 11000) {
        return false;
      }
      throw error;
    }
  }
}
