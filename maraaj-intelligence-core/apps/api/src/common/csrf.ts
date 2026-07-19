import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const CSRF_COOKIE = "mic_csrf";
const CSRF_HEADER = "x-csrf-token";

function sign(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function issueCsrfToken(res: Response, secret: string): string {
  const token = randomBytes(32).toString("base64url");
  const signed = `${token}.${sign(secret, token)}`;
  res.cookie(CSRF_COOKIE, signed, {
    httpOnly: false, // double-submit: JS must read and echo the token
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  });
  return token;
}

export function verifyCsrf(req: Request, secret: string): boolean {
  const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const header = req.headers[CSRF_HEADER];
  const provided = Array.isArray(header) ? header[0] : header;
  if (!cookie || !provided) return false;
  const [token, sig] = cookie.split(".");
  if (!token || !sig) return false;
  const expected = sign(secret, token);
  try {
    if (
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(provided))
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

/** Skip CSRF for public auth endpoints that establish the session. */
export function csrfExemptPath(path: string): boolean {
  return (
    path.endsWith("/auth/login") ||
    path.endsWith("/auth/logout") ||
    path.endsWith("/oauth/token") ||
    path.endsWith("/auth/csrf") ||
    path.includes("/.well-known/")
  );
}

export { CSRF_COOKIE, CSRF_HEADER };
