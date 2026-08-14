import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DisabledEmailAdapter, FakeEmailAdapter, signNotificationWebhook } from "./notification-adapters.js";

describe("notification adapters", () => {
  it("keeps email disabled by default", async () => {
    await expect(new DisabledEmailAdapter().send({ to: "user@example.test", subject: "test", text: "test" })).rejects.toThrow("NOTIFICATION_EMAIL_DISABLED");
  });
  it("uses an in-memory fake and rejects header injection", async () => {
    const adapter = new FakeEmailAdapter();
    await expect(adapter.send({ to: "user@example.test", subject: "test", text: "test" })).resolves.toEqual({ deliveryId: "fake_email_1" });
    await expect(adapter.send({ to: "bad@example.test\r\nBcc:x@example.test", subject: "test", text: "test" })).rejects.toThrow("NOTIFICATION_EMAIL_RECIPIENT_INVALID");
  });
  it("signs webhook envelopes deterministically", () => {
    const expected = createHmac("sha256", "secret").update("123.event.body").digest("hex");
    expect(signNotificationWebhook("secret", "123", "event", "body")).toBe(expected);
  });
});
