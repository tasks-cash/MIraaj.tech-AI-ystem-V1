import { describe, expect, it, vi } from "vitest";
import { TasksCashDistributionController } from "./tasks-cash.controller.js";

const request = (externalUserId = "user-1") => ({
  headers: {
    "x-miraaj-api-version": "v1",
    "x-tasks-cash-external-user-id": externalUserId,
    "idempotency-key": "idempotency-key-123",
  },
});

describe("Tasks.cash distribution ownership binding", () => {
  it("binds assignment reads and cancellation to the signed caller context", async () => {
    const service = {
      assignmentPackage: vi.fn().mockResolvedValue({}),
      cancelAssignment: vi.fn().mockResolvedValue({}),
    };
    const controller = new TasksCashDistributionController(service as never);
    await controller.getAssignment("assignment-1", request("user-owner"));
    await controller.cancelAssignment("assignment-1", request("user-owner"));
    expect(service.assignmentPackage).toHaveBeenCalledWith("assignment-1", "user-owner");
    expect(service.cancelAssignment).toHaveBeenCalledWith("assignment-1", "user-owner");
  });

  it("binds proof status to external user identity and rejects missing identity", async () => {
    const service = { getProofForExternalUser: vi.fn().mockResolvedValue({}) };
    const controller = new TasksCashDistributionController(service as never);
    await controller.status("proof-1", request("user-owner"));
    expect(service.getProofForExternalUser).toHaveBeenCalledWith("proof-1", "user-owner");
    expect(() => controller.status("proof-1", { headers: { "x-miraaj-api-version": "v1" } })).toThrow("TASKS_CASH_CONTRACT_INVALID");
  });

  it("rejects unknown assignment request fields before reaching the service", () => {
    const service = { createAssignment: vi.fn() };
    const controller = new TasksCashDistributionController(service as never);
    expect(() => controller.createAssignment({ apiVersion: "v1", unknown: true }, request())).toThrow("TASKS_CASH_CONTRACT_INVALID");
    expect(service.createAssignment).not.toHaveBeenCalled();
  });
});
