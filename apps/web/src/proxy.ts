import { NextRequest, NextResponse } from "next/server";
import { enabledMarkets, getMarket } from "@/config/markets";

function marketFromCookie(request: NextRequest) {
  const id = request.cookies.get("miraaj_market")?.value;
  return enabledMarkets.find((market) => market.id === id);
}

function preferredLocales(request: NextRequest) {
  return (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase().split("-")[0])
    .filter((locale): locale is string => Boolean(locale));
}

function detectMarket(request: NextRequest) {
  const saved = marketFromCookie(request);
  if (saved) return saved;
  const locales = preferredLocales(request);
  const geoCountry = request.headers.get("x-vercel-ip-country")?.toLowerCase();
  if (geoCountry) {
    const localMatch = enabledMarkets.find(
      (market) => market.countryCode === geoCountry && locales.includes(market.locale),
    );
    if (localMatch) return localMatch;
  }
  const languageMatch = enabledMarkets.find(
    (market) => market.countryCode === "global" && locales.includes(market.locale),
  ) ?? enabledMarkets.find((market) => locales.includes(market.locale));
  return languageMatch ?? enabledMarkets[0];
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && getMarket(segments[0] ?? "", segments[1] ?? "")) {
    return NextResponse.next();
  }
  const market = detectMarket(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${market.countryCode}/${market.locale}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|brand|icons|mockups|illustrations|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"],
};
