import type { Request } from "express";

export function describeDevice(userAgent: string): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome/")
      ? "Chrome"
      : ua.includes("firefox/")
        ? "Firefox"
        : ua.includes("safari/")
          ? "Safari"
          : "Browser";
  const os = ua.includes("windows")
    ? "Windows"
    : ua.includes("mac os") || ua.includes("macintosh")
      ? "macOS"
      : ua.includes("android")
        ? "Android"
        : ua.includes("iphone") || ua.includes("ipad")
          ? "iOS"
          : ua.includes("linux")
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${os}`;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === ""
  );
}

export function approximateLocation(req: Request, ip: string): string {
  const city = (req.headers["x-vercel-ip-city"] as string) || "";
  const country =
    (req.headers["cf-ipcountry"] as string) ||
    (req.headers["x-vercel-ip-country"] as string) ||
    "";
  if (city && country) return `${decodeURIComponent(city)}, ${country}`;
  if (country) return country;
  return isPrivateIp(ip) ? "Local network" : "Unknown";
}

export function extractRequestMeta(req: Request) {
  const ip = req.ip ?? "";
  const userAgent = (req.headers["user-agent"] as string) ?? "";
  return {
    ip,
    userAgent,
    device: describeDevice(userAgent),
    location: approximateLocation(req, ip),
  };
}
