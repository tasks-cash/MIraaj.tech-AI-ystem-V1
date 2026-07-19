
import { Controller, Get, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getServices } from "../services/app-services";
import { mongoose } from "@maraaj/database";
import { success } from "../common/response";

@Controller()
export class HealthController {
  @Get("/health/live")
  live() {
    return success({ status: "live" });
  }

  @Get("/health/ready")
  async ready(@Res() res: Response) {
    const mongoOk = mongoose.connection.readyState === 1;
    const svc = getServices();
    let redisOk = false;
    try {
      redisOk = (await svc.redis.ping()) === "PONG";
    } catch {
      redisOk = false;
    }
    const ok = mongoOk && redisOk;
    res.status(ok ? 200 : 503).json(success({ status: ok ? "ready" : "not_ready", mongoOk, redisOk }));
  }

  @Get("/health/dependencies")
  async deps(@Req() req: Request, @Res() res: Response) {
    // Protect detailed dependency health — require admin session cookie or internal header
    const internal = req.headers["x-maraaj-internal"] === process.env.REVALIDATION_SECRET;
    if (!internal) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Forbidden", details: [] } });
    }
    const svc = getServices();
    const mongoOk = mongoose.connection.readyState === 1;
    let redisOk = false;
    try {
      redisOk = (await svc.redis.ping()) === "PONG";
    } catch {
      redisOk = false;
    }
    let aiOk = false;
    try {
      const r = await fetch(`${svc.env.AI_SERVICE_URL}/health`);
      aiOk = r.ok;
    } catch {
      aiOk = false;
    }
    return res.json(success({ mongo: mongoOk, redis: redisOk, ai: aiOk, storage: true }));
  }
}
