import { beforeEach, describe, expect, it, vi } from "vitest";
import { TasksCashReplayNonceModel } from "../models/distribution.schema.js";
import { TasksCashReplayService } from "./tasks-cash-replay.service.js";

describe("Tasks.cash distributed replay reservation", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses Redis NX so a second API replica cannot reserve the same nonce", async () => {
    const keys = new Set<string>();
    const redis = { set: vi.fn((key: string) => Promise.resolve(keys.has(key) ? null : (keys.add(key), "OK"))) };
    const create = vi.spyOn(TasksCashReplayNonceModel, "create").mockResolvedValue({} as never);
    const infrastructure = { getRedis: () => redis };
    const replicaA = new TasksCashReplayService(infrastructure as never);
    const replicaB = new TasksCashReplayService(infrastructure as never);
    await expect(replicaA.reserve("same-nonce", Date.now())).resolves.toBe(true);
    await expect(replicaB.reserve("same-nonce", Date.now())).resolves.toBe(false);
    expect(create).toHaveBeenCalledOnce();
  });

  it("fails closed when durable Mongo uniqueness reports a replay", async () => {
    const redis = { set: vi.fn().mockResolvedValue("OK") };
    vi.spyOn(TasksCashReplayNonceModel, "create").mockRejectedValue({ code: 11000 });
    await expect(new TasksCashReplayService({ getRedis: () => redis } as never).reserve("durable-replay", Date.now())).resolves.toBe(false);
  });
});
