import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, HttpException } from "@nestjs/common";
import { AiSystemStatusPermissionGuard } from "./guards/ai-system-status-permission.guard.js";
import { AiSystemStatusRateLimitGuard } from "./guards/ai-system-status-rate-limit.guard.js";

function createContext(input?: {
  permissions?: readonly string[];
  ip?: string;
}) {
  const request = {
    headers: {},
    adminPermissions: input?.permissions,
    ip: input?.ip ?? "127.0.0.1",
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

describe("AI system status access guards", () => {
  it("accepts the dedicated system-status permission", () => {
    const guard = new AiSystemStatusPermissionGuard();
    expect(
      guard.canActivate(
        createContext({
          permissions: ["ai.systemStatus.read"],
        }) as never,
      ),
    ).toBe(true);
  });

  it("rejects an authenticated identity with insufficient permission", () => {
    const guard = new AiSystemStatusPermissionGuard();
    expect(() =>
      guard.canActivate(
        createContext({ permissions: ["ai.other.read"] }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it("rate limits repeated status requests per client", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const guard = new AiSystemStatusRateLimitGuard();
    const context = createContext({ ip: "192.0.2.10" });

    for (let request = 0; request < 30; request += 1) {
      expect(guard.canActivate(context as never)).toBe(true);
    }
    expect(() => guard.canActivate(context as never)).toThrow(HttpException);
    vi.restoreAllMocks();
  });
});
