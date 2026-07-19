import { describe, it, expect } from "vitest";
import { validateDestinationUrl } from "./link-safety";

describe("link safety", () => {
  it("blocks localhost", async () => {
    await expect(validateDestinationUrl("http://localhost/admin")).rejects.toMatchObject({
      code: "DESTINATION_UNSAFE",
    });
  });

  it("blocks private IP literals", async () => {
    await expect(validateDestinationUrl("https://127.0.0.1/")).rejects.toMatchObject({
      code: "DESTINATION_UNSAFE",
    });
  });

  it("blocks metadata host", async () => {
    await expect(
      validateDestinationUrl("http://metadata.google.internal/"),
    ).rejects.toMatchObject({ code: "DESTINATION_UNSAFE" });
  });
});
