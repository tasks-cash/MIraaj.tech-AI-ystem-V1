
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "../common/errors";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) {
    return true;
  }
  // IPv6 ULA / link-local rough checks
  if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd") || ip.toLowerCase().startsWith("fe80")) {
    return true;
  }
  return false;
}

export async function validateDestinationUrl(
  rawUrl: string,
  opts: { allowHttpInDev?: boolean; maxRedirects?: number } = {},
) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError("DESTINATION_UNSAFE", "Destination URL is invalid.", 400);
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new AppError("DESTINATION_UNSAFE", "Unsupported URL scheme.", 400);
  }
  if (url.protocol === "http:" && !opts.allowHttpInDev) {
    throw new AppError("DESTINATION_UNSAFE", "HTTPS is required.", 400);
  }
  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new AppError("DESTINATION_UNSAFE", "Destination host is blocked.", 400);
  }

  const host = url.hostname;
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new AppError("DESTINATION_UNSAFE", "Private network destinations are blocked.", 400);
    }
  } else {
    const records = await lookup(host, { all: true });
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        throw new AppError("DESTINATION_UNSAFE", "Private network destinations are blocked.", 400);
      }
    }
  }

  const redirectChain: string[] = [url.toString()];
  let current = url.toString();
  let finalStatus = 0;
  let finalUrl = current;
  const maxRedirects = opts.maxRedirects ?? 3;

  for (let i = 0; i <= maxRedirects; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "MaraajLinkSafety/1.0" },
      });
      finalStatus = res.status;
      // Drain limited body
      const reader = res.body?.getReader();
      if (reader) {
        let read = 0;
        while (read < 64_000) {
          const { done, value } = await reader.read();
          if (done) break;
          read += value?.byteLength ?? 0;
        }
        reader.cancel().catch(() => undefined);
      }
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, current);
        await validateDestinationUrl(next.toString(), {
          allowHttpInDev: opts.allowHttpInDev,
          maxRedirects: 0,
        });
        redirectChain.push(next.toString());
        current = next.toString();
        finalUrl = current;
        continue;
      }
      finalUrl = current;
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    safe: true,
    finalUrl,
    finalDomain: new URL(finalUrl).hostname,
    redirectChain,
    httpStatus: finalStatus,
    tlsValid: finalUrl.startsWith("https:"),
    reasons: [] as string[],
  };
}
