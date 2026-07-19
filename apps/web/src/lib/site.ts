import type { Metadata } from "next";
import { company, siteUrl } from "@/config/company";
import { enabledMarkets, getMarket } from "@/config/markets";

export function localizedHref(country: string, locale: string, path = "") {
  const normalized = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${country}/${locale}${normalized}`;
}

export function preservePageForMarket(pathname: string, country: string, locale: string) {
  const segments = pathname.split("/").filter(Boolean);
  const suffix = segments.length > 2 ? `/${segments.slice(2).join("/")}` : "";
  return localizedHref(country, locale, suffix);
}

export function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

export function localizedMetadata(
  country: string,
  locale: string,
  pageTitle?: string,
  description?: string,
): Metadata {
  const market = getMarket(country, locale);
  const baseTitles: Record<string, string> = {
    ar: "تطوير المواقع والتطبيقات وحلول الذكاء الاصطناعي",
    de: "Webentwicklung, Apps und KI-Lösungen",
    fr: "Sites, applications et solutions IA",
    en: "Web, Apps, AI and Digital Solutions",
  };
  const title = pageTitle
    ? `${pageTitle} | ${company.companyName}`
    : `${company.companyName} | ${baseTitles[locale] ?? baseTitles.en}`;
  const canonicalPath = localizedHref(country, locale);
  const languages = Object.fromEntries(
    enabledMarkets.map((entry) => [
      `${entry.locale}-${entry.countryCode.toUpperCase()}`,
      `${siteUrl}${localizedHref(entry.countryCode, entry.locale)}`,
    ]),
  );
  return {
    metadataBase: new URL(siteUrl),
    title,
    description: description ?? company.description,
    alternates: { canonical: canonicalPath, languages },
    openGraph: {
      type: "website",
      title,
      description: description ?? company.description,
      url: canonicalPath,
      siteName: company.companyName,
      locale: market?.dateLocale.replace("-", "_"),
    },
    twitter: { card: "summary_large_image", title, description: description ?? company.description },
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.companyName,
    url: siteUrl,
    slogan: company.slogan,
    description: company.description,
  };
}
