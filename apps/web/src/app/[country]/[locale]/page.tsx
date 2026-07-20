import { notFound } from "next/navigation";
import { getMarket } from "@/config/markets";
import { getHomeCopy } from "@/i18n/home-copy";
import {
  AiSystemOverview,
  AnalysisCapabilities,
  AutomationSection,
  BusinessIntelligenceSection,
  CoreAiSolutions,
  ExplorerSection,
  FinalCtaSection,
  HomeHero,
  ImplementationSection,
  IndustrySolutions,
  MarketLineBanner,
  MultilingualSection,
  SecuritySection,
  ServiceRecommendationSection,
  TrustStrip,
  WhyMiraajSection,
} from "@/components/sections/home/home-page-sections";

export default async function HomePage({
  params,
}: {
  params: Promise<{ country: string; locale: string }>;
}) {
  const { country, locale } = await params;
  const market = getMarket(country, locale);
  if (!market) notFound();
  const copy = getHomeCopy(locale);

  return (
    <>
      <HomeHero market={market} copy={copy} />
      <TrustStrip copy={copy} />
      <MarketLineBanner market={market} copy={copy} />
      <AiSystemOverview copy={copy} />
      <CoreAiSolutions market={market} copy={copy} />
      <AnalysisCapabilities copy={copy} />
      <BusinessIntelligenceSection copy={copy} />
      <ServiceRecommendationSection copy={copy} />
      <AutomationSection copy={copy} />
      <IndustrySolutions copy={copy} />
      <MultilingualSection copy={copy} />
      <SecuritySection copy={copy} />
      <ExplorerSection market={market} copy={copy} />
      <WhyMiraajSection copy={copy} />
      <ImplementationSection copy={copy} />
      <FinalCtaSection market={market} copy={copy} />
    </>
  );
}
