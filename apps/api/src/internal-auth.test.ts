import { describe, expect, it } from "vitest";
import {
  INTERNAL_HEADER_NAMES,
  internalRequestHeaders,
  secureTokenEquals,
  signInternalRequest,
} from "./internal-auth.js";

describe("internal service signing", () => {
  it("produces deterministic metadata for a fixed request", () => {
    const metadata = signInternalRequest({
      method: "POST",
      path: "/v1/analysis/jobs",
      body: '{"sourceType":"image"}',
      idempotencyKey: "analysis-123",
      requestId: "23a9022a-6d80-4a1e-b6a8-ea13bea7371e",
      correlationId: "corr-23a9022a",
      timestamp: 1_721_000_000,
      environment: {
        AI_SERVICE_ID: "miraaj-api",
        AI_SERVICE_INTERNAL_SECRET:
          "test-only-internal-secret-with-32-characters",
      },
    });
    const headers = internalRequestHeaders(metadata);

    expect(metadata.bodySha256).toBe(
      "46fbddc8f45dd5956c649cedcf6c1226a4f6063a97a0a4d8314a9d2281b0d699",
    );
    expect(metadata.signature).toBe(
      "284a49f524deefad36e871f8c71f6eb5820bac81c607edd3fdcd41c0647426ab",
    );
    expect(headers[INTERNAL_HEADER_NAMES.serviceId]).toBe("miraaj-api");
    expect(headers[INTERNAL_HEADER_NAMES.correlationId]).toBe("corr-23a9022a");
    expect(headers[INTERNAL_HEADER_NAMES.bodySha256]).toHaveLength(64);
  });

  it("compares tokens in constant time", () => {
    expect(
      secureTokenEquals(
        "test-only-admin-token-with-32-characters!!",
        "test-only-admin-token-with-32-characters!!",
      ),
    ).toBe(true);
    expect(
      secureTokenEquals(
        "test-only-admin-token-with-32-characters!!",
        "different-admin-token-with-32-characters!",
      ),
    ).toBe(false);
  });

  it("includes the raw query string in the signed canonical route", () => {
    const input = {
      method: "GET",
      body: "",
      idempotencyKey: "query-signature-test",
      requestId: "23a9022a-6d80-4a1e-b6a8-ea13bea7371e",
      correlationId: "corr-23a9022a",
      timestamp: 1_721_000_000,
      environment: {
        AI_SERVICE_ID: "miraaj-api",
        AI_SERVICE_INTERNAL_SECRET:
          "test-only-internal-secret-with-32-characters",
      },
    } as const;
    const safe = signInternalRequest({
      ...input,
      path: "/v1/status?mode=safe",
    });
    const modified = signInternalRequest({
      ...input,
      path: "/v1/status?mode=modified",
    });
    expect(safe.signature).not.toBe(modified.signature);
  });
});
