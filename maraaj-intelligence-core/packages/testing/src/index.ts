
import { generateEd25519KeyPair, buildCanonicalRequest, signEd25519, sha256Hex, normalizePath, normalizeQuery } from "@maraaj/crypto";

export function createTestSigningClient(clientId = "test-client") {
  const keys = generateEd25519KeyPair();
  return {
    clientId,
    keyId: "key_test_1",
    ...keys,
    sign(method: string, path: string, body = "", query = "") {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = `n_${Date.now()}_${Math.random()}`;
      const bodySha256 = sha256Hex(body);
      const canonical = buildCanonicalRequest({
        method,
        path: normalizePath(path),
        query: normalizeQuery(query),
        bodySha256,
        timestamp,
        nonce,
        clientId,
      });
      return {
        timestamp,
        nonce,
        bodySha256,
        signature: signEd25519(keys.privateKeyPem, canonical),
        canonical,
      };
    },
  };
}
