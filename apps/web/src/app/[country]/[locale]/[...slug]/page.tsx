import { notFound } from "next/navigation";
import { getMarket } from "@/config/markets";
import { services, articles } from "@/data/site";
import { localizedMetadata } from "@/lib/site";
import { renderMarketingPage } from "@/components/sections/marketing-pages";

const topLevelPages = new Set([
  "about", "services", "solutions", "industries", "work", "process", "ai",
  "payments", "video", "pricing", "quote", "contact", "faq", "insights",
  "careers", "privacy", "terms", "cookies", "accessibility",
]);

type PageProps = { params: Promise<{ country: string; locale: string; slug: string[] }> };

export async function generateMetadata({ params }: PageProps) {
  const { country, locale, slug } = await params;
  const label = slug.at(-1)?.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return localizedMetadata(country, locale, label);
}

export default async function MarketingPage({ params }: PageProps) {
  const { country, locale, slug } = await params;
  const market = getMarket(country, locale);
  if (!market || !slug[0] || !topLevelPages.has(slug[0]) || slug.length > 2) notFound();
  if (slug[0] === "services" && slug[1] && !services.some((service) => service.slug === slug[1])) notFound();
  if (slug[0] === "insights" && slug[1] && !articles.some((article) => article.slug === slug[1])) notFound();
  if (slug.length === 2 && !["services", "insights"].includes(slug[0])) notFound();
  return renderMarketingPage({ market, segments: slug });
}
