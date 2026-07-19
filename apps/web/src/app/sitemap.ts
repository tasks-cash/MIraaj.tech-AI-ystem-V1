import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/company";
import { enabledMarkets } from "@/config/markets";
import { articles, services } from "@/data/site";
import { localizedHref } from "@/lib/site";

const pages = ["", "about", "services", "solutions", "industries", "work", "process", "ai", "payments", "video", "pricing", "quote", "contact", "faq", "insights", "careers", "privacy", "terms", "cookies", "accessibility"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return enabledMarkets.flatMap((market) => {
    const paths = [
      ...pages,
      ...services.map((service) => `services/${service.slug}`),
      ...articles.map((article) => `insights/${article.slug}`),
    ];
    return paths.map((path) => ({
      url: `${siteUrl}${localizedHref(market.countryCode, market.locale, path)}`,
      lastModified: now,
      changeFrequency: path === "" ? "weekly" as const : "monthly" as const,
      priority: path === "" ? 1 : path === "quote" ? 0.9 : 0.7,
    }));
  });
}
