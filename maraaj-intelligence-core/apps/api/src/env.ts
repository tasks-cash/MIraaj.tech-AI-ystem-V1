import { extendEnv, parseEnv } from "@maraaj/config";
import { z } from "zod";
import { generateSigningKeys } from "@maraaj/auth";
import { randomBytes } from "node:crypto";

const schema = extendEnv({
  API_PORT: z.coerce.number().default(4000),
  COOKIE_SECRET: z.string().min(32).optional(),
});

export type ApiEnv = z.infer<typeof schema> & {
  SESSION_SECRET: string;
};

let cached: ApiEnv | null = null;

export function loadEnv(): ApiEnv {
  if (cached) return cached;
  const env = parseEnv(schema, process.env as Record<string, string | undefined>);
  cached = {
    ...env,
    SESSION_SECRET: env.SESSION_SECRET ?? env.COOKIE_SECRET ?? randomBytes(32).toString("hex"),
  };
  return cached;
}

export async function ensureTokenKeys(env: ApiEnv) {
  if (env.TOKEN_SIGNING_PRIVATE_KEY && env.TOKEN_SIGNING_PUBLIC_KEY) {
    return {
      privateKeyPem: env.TOKEN_SIGNING_PRIVATE_KEY.replace(/\\n/g, "\n"),
      publicKeyPem: env.TOKEN_SIGNING_PUBLIC_KEY.replace(/\\n/g, "\n"),
    };
  }
  console.warn("[MIC] Generating ephemeral Ed25519 token signing keys for this process");
  return generateSigningKeys();
}
