
import { describe, it, expect } from "vitest";
import {
  generateEd25519KeyPair,
  buildCanonicalRequest,
  signEd25519,
  verifyEd25519,
  sha256Hex,
} from "@maraaj/crypto";

describe("request signing", () => {
  it("accepts a valid signature", () => {
    const keys = generateEd25519KeyPair();
    const body = '{"hello":"world"}';
    const canonical = buildCanonicalRequest({
      method: "POST",
      path: "/api/v1/posts",
      query: "",
      bodySha256: sha256Hex(body),
      timestamp: "1710000000",
      nonce: "abc123",
      clientId: "client_1",
    });
    const sig = signEd25519(keys.privateKeyPem, canonical);
    expect(verifyEd25519(keys.publicKeyPem, canonical, sig)).toBe(true);
  });

  it("rejects a changed body", () => {
    const keys = generateEd25519KeyPair();
    const canonical = buildCanonicalRequest({
      method: "POST",
      path: "/api/v1/posts",
      query: "",
      bodySha256: sha256Hex('{"a":1}'),
      timestamp: "1710000000",
      nonce: "abc123",
      clientId: "client_1",
    });
    const sig = signEd25519(keys.privateKeyPem, canonical);
    const tampered = buildCanonicalRequest({
      method: "POST",
      path: "/api/v1/posts",
      query: "",
      bodySha256: sha256Hex('{"a":2}'),
      timestamp: "1710000000",
      nonce: "abc123",
      clientId: "client_1",
    });
    expect(verifyEd25519(keys.publicKeyPem, tampered, sig)).toBe(false);
  });
});
