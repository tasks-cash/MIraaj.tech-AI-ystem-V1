import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { enabledMarkets, getMarket } from "@/config/markets";
import { getCopy, asIntlMessages } from "@/i18n/content";
import { localizedHref, localizedMetadata, organizationSchema } from "@/lib/site";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AnnouncementBar, CookieBanner, OfflineNotice } from "@/components/layout/site-chrome";
import "../../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap" });

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ country: string; locale: string }>;
};

export function generateStaticParams() {
  return enabledMarkets.map(({ countryCode: country, locale }) => ({ country, locale }));
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { country, locale } = await params;
  return localizedMetadata(country, locale);
}

export default async function MarketLayout({ children, params }: LayoutProps) {
  const { country, locale } = await params;
  const market = getMarket(country, locale);
  if (!market) notFound();
  const copy = getCopy(locale);
  const messages = asIntlMessages(copy);
  return (
    <html lang={locale} dir={market.direction} className={`${inter.variable} ${notoArabic.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AnnouncementBar message={copy.announcement} href={localizedHref(country, locale, "quote")} linkLabel={copy.hero.primary} />
          <Navbar market={market} copy={copy} />
          <main id="main-content">{children}</main>
          <Footer market={market} />
          <CookieBanner privacyHref={localizedHref(country, locale, "privacy")} cookiesHref={localizedHref(country, locale, "cookies")} />
          <OfflineNotice />
        </NextIntlClientProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()).replace(/</g, "\\u003c") }} />
      </body>
    </html>
  );
}
