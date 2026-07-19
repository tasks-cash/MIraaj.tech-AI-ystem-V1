
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

function readCsrfFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )mic_csrf=([^;]+)/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]!);
  return raw.split(".")[0] ?? null;
}

export async function ensureCsrf(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  const fromCookie = readCsrfFromCookie();
  if (fromCookie) {
    csrfToken = fromCookie;
    return csrfToken;
  }
  try {
    const data = await api<{ csrfToken: string }>("/api/v1/auth/csrf", { method: "GET" });
    csrfToken = data.csrfToken;
    return csrfToken;
  } catch {
    return null;
  }
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  role?: string;
  permissions: string[];
  mustChangePassword?: boolean;
  mustEnrollTwoFactor?: boolean;
  totpEnabled?: boolean;
};

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  if (method !== "GET" && method !== "HEAD" && !path.endsWith("/auth/login") && !path.endsWith("/auth/csrf")) {
    const token = csrfToken ?? readCsrfFromCookie() ?? (await ensureCsrf());
    if (token) headers["x-csrf-token"] = token;
  }

  const res = await fetch(`${API}${path}`, {
    ...init,
    method,
    credentials: "include",
    headers,
    cache: "no-store",
  });
  const json = await res.json();
  if (!json.success) {
    throw new ApiError(json.error?.message ?? "Request failed", json.error?.code);
  }
  if (json.data?.csrfToken) csrfToken = json.data.csrfToken as string;
  return json.data as T;
}

export function pendingSecurityRoute(user: AuthUser | null | undefined): string | null {
  if (!user) return null;
  if (user.mustChangePassword) return "/security/change-password";
  if (user.mustEnrollTwoFactor) return "/security/setup-2fa";
  return null;
}
