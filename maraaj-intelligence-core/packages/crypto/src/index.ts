
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import type { EncryptedBlob } from "@maraaj/types";

export interface KeyManagementProvider {
  name: string;
  wrapDataKey(plaintextKey: Buffer): Promise<{ wrappedKey: string; keyVersion: string }>;
  unwrapDataKey(wrappedKey: string, keyVersion: string): Promise<Buffer>;
  getMasterKeyVersion(): Promise<string>;
}

export class LocalDevelopmentKeyProvider implements KeyManagementProvider {
  name = "local";
  constructor(private readonly masterKey: Buffer) {
    if (masterKey.length !== 32) throw new Error("LOCAL_MASTER_KEY must decode to 32 bytes");
  }
  async wrapDataKey(plaintextKey: Buffer) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintextKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      wrappedKey: Buffer.concat([nonce, tag, ciphertext]).toString("base64"),
      keyVersion: "local-v1",
    };
  }
  async unwrapDataKey(wrappedKey: string, _keyVersion: string) {
    const buf = Buffer.from(wrappedKey, "base64");
    const nonce = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.masterKey, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
  async getMasterKeyVersion() {
    return "local-v1";
  }
}

export class EnvironmentKeyProvider extends LocalDevelopmentKeyProvider {
  override name = "env";
  constructor(hexOrBase64: string) {
    let key: Buffer;
    if (/^[0-9a-fA-F]{64}$/.test(hexOrBase64)) key = Buffer.from(hexOrBase64, "hex");
    else key = Buffer.from(hexOrBase64, "base64");
    if (key.length !== 32) key = createHash("sha256").update(hexOrBase64).digest();
    super(key);
  }
}

export class AWSKMSProvider implements KeyManagementProvider {
  name = "aws_kms";
  constructor(private readonly keyId: string) {}
  async wrapDataKey(): Promise<{ wrappedKey: string; keyVersion: string }> {
    throw new Error("AWSKMSProvider not configured");
  }
  async unwrapDataKey(): Promise<Buffer> {
    throw new Error("AWSKMSProvider not configured");
  }
  async getMasterKeyVersion() {
    return this.keyId;
  }
}

export class GoogleCloudKMSProvider implements KeyManagementProvider {
  name = "gcp_kms";
  constructor(private readonly keyId: string) {}
  async wrapDataKey(): Promise<{ wrappedKey: string; keyVersion: string }> {
    throw new Error("GoogleCloudKMSProvider not configured");
  }
  async unwrapDataKey(): Promise<Buffer> {
    throw new Error("GoogleCloudKMSProvider not configured");
  }
  async getMasterKeyVersion() {
    return this.keyId;
  }
}

export class AzureKeyVaultProvider implements KeyManagementProvider {
  name = "azure_kv";
  constructor(private readonly keyId: string) {}
  async wrapDataKey(): Promise<{ wrappedKey: string; keyVersion: string }> {
    throw new Error("AzureKeyVaultProvider not configured");
  }
  async unwrapDataKey(): Promise<Buffer> {
    throw new Error("AzureKeyVaultProvider not configured");
  }
  async getMasterKeyVersion() {
    return this.keyId;
  }
}

export class HashiCorpVaultProvider implements KeyManagementProvider {
  name = "vault";
  constructor(private readonly keyId: string) {}
  async wrapDataKey(): Promise<{ wrappedKey: string; keyVersion: string }> {
    throw new Error("HashiCorpVaultProvider not configured");
  }
  async unwrapDataKey(): Promise<Buffer> {
    throw new Error("HashiCorpVaultProvider not configured");
  }
  async getMasterKeyVersion() {
    return this.keyId;
  }
}

export function createKeyProvider(opts: {
  provider: string;
  localMasterKey?: string;
  kmsKeyId?: string;
}): KeyManagementProvider {
  switch (opts.provider) {
    case "local": {
      const raw = opts.localMasterKey ?? randomBytes(32).toString("hex");
      const key = /^[0-9a-fA-F]{64}$/.test(raw)
        ? Buffer.from(raw, "hex")
        : createHash("sha256").update(raw).digest();
      return new LocalDevelopmentKeyProvider(key.length === 32 ? key : createHash("sha256").update(raw).digest());
    }
    case "env":
      if (!opts.localMasterKey) throw new Error("LOCAL_MASTER_KEY required for env provider");
      return new EnvironmentKeyProvider(opts.localMasterKey);
    case "aws_kms":
      return new AWSKMSProvider(opts.kmsKeyId ?? "unset");
    case "gcp_kms":
      return new GoogleCloudKMSProvider(opts.kmsKeyId ?? "unset");
    case "azure_kv":
      return new AzureKeyVaultProvider(opts.kmsKeyId ?? "unset");
    case "vault":
      return new HashiCorpVaultProvider(opts.kmsKeyId ?? "unset");
    default:
      throw new Error(`Unknown encryption provider: ${opts.provider}`);
  }
}

export class EnvelopeCrypto {
  constructor(private readonly kms: KeyManagementProvider) {}

  async encrypt(plaintext: string | Buffer): Promise<EncryptedBlob & { wrappedDataKey: string }> {
    const dataKey = randomBytes(32);
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dataKey, nonce);
    const pt = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
    const ciphertext = Buffer.concat([cipher.update(pt), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const wrapped = await this.kms.wrapDataKey(dataKey);
    return {
      algorithm: "AES-256-GCM",
      keyVersion: wrapped.keyVersion,
      nonce: nonce.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      createdAt: new Date().toISOString(),
      wrappedDataKey: wrapped.wrappedKey,
    };
  }

  async decrypt(blob: EncryptedBlob & { wrappedDataKey: string }): Promise<Buffer> {
    const dataKey = await this.kms.unwrapDataKey(blob.wrappedDataKey, blob.keyVersion);
    const decipher = createDecipheriv("aes-256-gcm", dataKey, Buffer.from(blob.nonce, "base64"));
    decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(blob.ciphertext, "base64")),
      decipher.final(),
    ]);
  }
}

export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

export function signEd25519(privateKeyPem: string, payload: string | Buffer): string {
  const key = createPrivateKey(privateKeyPem);
  const sig = cryptoSign(null, typeof payload === "string" ? Buffer.from(payload) : payload, key);
  return sig.toString("base64");
}

export function verifyEd25519(
  publicKeyPem: string,
  payload: string | Buffer,
  signatureB64: string,
): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    return cryptoVerify(
      null,
      typeof payload === "string" ? Buffer.from(payload) : payload,
      key,
      Buffer.from(signatureB64, "base64"),
    );
  } catch {
    return false;
  }
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function hmacSha256Base64(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64");
}

export function buildCanonicalRequest(parts: {
  method: string;
  path: string;
  query: string;
  bodySha256: string;
  timestamp: string;
  nonce: string;
  clientId: string;
}): string {
  return [
    parts.method.toUpperCase(),
    parts.path,
    parts.query,
    parts.bodySha256,
    parts.timestamp,
    parts.nonce,
    parts.clientId,
  ].join("\n");
}

export function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return p.replace(/\/+/g, "/");
}

export function normalizeQuery(searchParams: URLSearchParams | string): string {
  const params =
    typeof searchParams === "string"
      ? new URLSearchParams(searchParams.startsWith("?") ? searchParams.slice(1) : searchParams)
      : searchParams;
  return [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}
