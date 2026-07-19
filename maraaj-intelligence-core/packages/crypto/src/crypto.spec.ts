
import { describe, it, expect } from "vitest";
import {
  createKeyProvider,
  EnvelopeCrypto,
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
} from "./index";

describe("envelope encryption", () => {
  it("round-trips secrets", async () => {
    const kms = createKeyProvider({
      provider: "local",
      localMasterKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    });
    const crypto = new EnvelopeCrypto(kms);
    const enc = await crypto.encrypt("super-secret");
    const dec = await crypto.decrypt(enc);
    expect(dec.toString("utf8")).toBe("super-secret");
  });
});

describe("ed25519", () => {
  it("signs and verifies", () => {
    const keys = generateEd25519KeyPair();
    const sig = signEd25519(keys.privateKeyPem, "hello");
    expect(verifyEd25519(keys.publicKeyPem, "hello", sig)).toBe(true);
    expect(verifyEd25519(keys.publicKeyPem, "bye", sig)).toBe(false);
  });
});
