import { notFound } from "next/navigation";
import { getMarket } from "@/config/markets";
import { getCopy } from "@/i18n/content";
import { interpolate } from "@/lib/site";
import {
  AiShowcase,
  FinalCtaAndFaq,
  HomeHero,
  PaymentShowcase,
  ProcessSection,
  ServicesGrid,
  ServiceStrip,
  SolutionsWorkAndWhy,
} from "@/components/sections/home-sections";
import { Container } from "@/components/ui/core";

export default async function HomePage({ params }: { params: Promise<{ country: string; locale: string }> }) {
  const { country, locale } = await params;
  const market = getMarket(country, locale);
  if (!market) notFound();
  const copy = getCopy(locale);
  return (
    <>
      <HomeHero market={market} copy={copy} />
      <ServiceStrip market={market} />
      <div className="border-b border-blue-100 bg-blue-50/70 py-3 text-center text-sm font-semibold text-blue-950">
        <Container>{interpolate(copy.marketLine, { country: market.countryName })} · {market.currencyCode}</Container>
      </div>
      <ServicesGrid market={market} copy={copy} />
      <ProcessSection copy={copy} />
      <AiShowcase market={market} copy={copy} />
      <PaymentShowcase market={market} copy={copy} />
      <SolutionsWorkAndWhy market={market} copy={copy} />
      <FinalCtaAndFaq market={market} copy={copy} />
    </>
  );
}
