
import {
  buildCanonicalRequest,
  normalizePath,
  normalizeQuery,
  sha256Hex,
  signEd25519,
} from "@maraaj/crypto";
import { randomBytes, randomUUID } from "node:crypto";
import type { ApiResponse } from "@maraaj/types";

export interface MaraajClientOptions {
  baseUrl: string;
  clientId: string;
  keyId: string;
  privateKey: string;
  projectId: string;
  fetchImpl?: typeof fetch;
}

export class MaraajApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = "MaraajApiError";
  }
}

export class MaraajClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: MaraajClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt - 30_000) return this.token;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.opts.clientId,
    });
    const res = await this.fetchImpl(`${this.opts.baseUrl}/api/v1/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as ApiResponse<{ access_token: string; expires_in: number }>;
    if (!json.success) {
      throw new MaraajApiError(json.error.code, json.error.message, res.status, json.error.details);
    }
    this.token = json.data.access_token;
    this.tokenExpiresAt = Date.now() + json.data.expires_in * 1000;
    return this.token;
  }

  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string>;
      idempotencyKey?: string;
      requireSignature?: boolean;
    } = {},
  ): Promise<T> {
    const token = await this.getToken();
    const url = new URL(path, this.opts.baseUrl);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) url.searchParams.set(k, v);
    }
    const rawBody = options.body === undefined ? "" : JSON.stringify(options.body);
    const bodySha = sha256Hex(rawBody || "");
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString("hex");
    const canonical = buildCanonicalRequest({
      method,
      path: normalizePath(url.pathname),
      query: normalizeQuery(url.searchParams),
      bodySha256: bodySha,
      timestamp,
      nonce,
      clientId: this.opts.clientId,
    });
    const signature = signEd25519(this.opts.privateKey, canonical);
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      "x-maraaj-key-id": this.opts.keyId,
      "x-maraaj-timestamp": timestamp,
      "x-maraaj-nonce": nonce,
      "x-maraaj-content-sha256": bodySha,
      "x-maraaj-signature": signature,
      "x-maraaj-project-id": this.opts.projectId,
      accept: "application/json",
    };
    if (rawBody) headers["content-type"] = "application/json";
    if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;

    const res = await this.fetchImpl(url.toString(), {
      method,
      headers,
      body: rawBody || undefined,
    });
    const json = (await res.json()) as ApiResponse<T>;
    if (!json.success) {
      throw new MaraajApiError(json.error.code, json.error.message, res.status, json.error.details);
    }
    return json.data;
  }

  posts = {
    create: (body: Record<string, unknown>, opts?: { idempotencyKey?: string }) =>
      this.request<Record<string, unknown>>("POST", "/api/v1/posts", {
        body,
        idempotencyKey: opts?.idempotencyKey ?? randomUUID(),
      }),
    get: (id: string) => this.request<Record<string, unknown>>("GET", `/api/v1/posts/${id}`),
    analyze: (id: string) =>
      this.request<Record<string, unknown>>("POST", `/api/v1/posts/${id}/analyze`, {
        idempotencyKey: randomUUID(),
      }),
  };

  assets = {
    presign: (body: Record<string, unknown>) =>
      this.request<Record<string, unknown>>("POST", "/api/v1/assets/presign", {
        body,
        idempotencyKey: randomUUID(),
      }),
    complete: (body: Record<string, unknown>) =>
      this.request<Record<string, unknown>>("POST", "/api/v1/assets/complete", {
        body,
        idempotencyKey: randomUUID(),
      }),
  };
}
