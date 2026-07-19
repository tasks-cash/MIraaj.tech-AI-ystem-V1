import { describe, expect, it } from "vitest";
import { canonicalizeInternalRequest, sha256Hex } from "./index.js";

describe("internal request canonicalization", () => {
  it("is deterministic and includes correlation and body digest", () => {
    const bodySha256 = sha256Hex('{"job":"example"}');
    const canonical = canonicalizeInternalRequest({
      method: "post",
      path: "/v1/analysis/jobs",
      serviceId: "miraaj-api",
      timestamp: 1_721_000_000,
      requestId: "23a9022a-6d80-4a1e-b6a8-ea13bea7371e",
      correlationId: "corr-23a9022a",
      idempotencyKey: "analysis-example",
      bodySha256,
    });

    expect(canonical).toContain("POST\n/v1/analysis/jobs\nmiraaj-api");
    expect(canonical).toContain("corr-23a9022a");
    expect(canonical.endsWith(bodySha256)).toBe(true);
  });
});
