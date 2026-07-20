import type { Direction, Market, Region } from "@/types";

type MarketSeed = [
  countryCode: string,
  locale: string,
  countryName: string,
  languageName: string,
  nativeLanguageName: string,
  currencyCode: string,
  currencySymbol: string,
  phonePrefix: string,
  region: Region,
  timezone: string,
];

const rtlLocales = new Set(["ar"]);
const cta: Record<string, [string, string]> = {
  ar: ["ابدأ مشروعك", "تواصل معنا"],
  fr: ["Démarrer votre projet", "Nous contacter"],
  de: ["Projekt starten", "Kontakt"],
  es: ["Inicia tu proyecto", "Contacto"],
  it: ["Avvia il progetto", "Contatti"],
  pt: ["Iniciar projeto", "Contacto"],
  nl: ["Start je project", "Contact"],
  pl: ["Rozpocznij projekt", "Kontakt"],
  el: ["Ξεκινήστε το έργο σας", "Επικοινωνία"],
};

const providerMap: Record<Region, string[]> = {
  global: ["Stripe", "PayPal", "Adyen", "Checkout.com", "Apple Pay", "Google Pay"],
  "north-africa": ["PayPal", "Local providers"],
  gulf: ["Checkout.com", "PayPal", "Apple Pay", "Google Pay", "Local providers"],
  "western-europe": ["Stripe", "PayPal", "Adyen", "Mollie", "Klarna", "Apple Pay", "Google Pay"],
  "central-europe": ["Stripe", "PayPal", "Adyen", "Klarna", "Apple Pay", "Google Pay"],
  "northern-europe": ["Stripe", "PayPal", "Adyen", "Klarna", "Apple Pay", "Google Pay"],
  "southern-europe": ["Stripe", "PayPal", "Adyen", "Apple Pay", "Google Pay"],
  "eastern-europe": ["Stripe", "PayPal", "Adyen", "Apple Pay", "Google Pay", "Local providers"],
};

const seeds: MarketSeed[] = [
  ["global", "en", "Global", "English", "English", "USD", "$", "", "global", "UTC"],
  ["global", "ar", "العالم", "Arabic", "العربية", "USD", "$", "", "global", "UTC"],
  ["global", "fr", "Global", "French", "Français", "USD", "$", "", "global", "UTC"],
  ["dz", "ar", "الجزائر", "Arabic", "العربية", "DZD", "د.ج", "+213", "north-africa", "Africa/Algiers"],
  ["dz", "fr", "Algérie", "French", "Français", "DZD", "DA", "+213", "north-africa", "Africa/Algiers"],
  ["ae", "ar", "الإمارات", "Arabic", "العربية", "AED", "د.إ", "+971", "gulf", "Asia/Dubai"],
  ["ae", "en", "United Arab Emirates", "English", "English", "AED", "AED", "+971", "gulf", "Asia/Dubai"],
  ["kw", "ar", "الكويت", "Arabic", "العربية", "KWD", "د.ك", "+965", "gulf", "Asia/Kuwait"],
  ["kw", "en", "Kuwait", "English", "English", "KWD", "KWD", "+965", "gulf", "Asia/Kuwait"],
  ["fr", "fr", "France", "French", "Français", "EUR", "€", "+33", "western-europe", "Europe/Paris"],
  ["de", "de", "Deutschland", "German", "Deutsch", "EUR", "€", "+49", "central-europe", "Europe/Berlin"],
  ["at", "de", "Österreich", "German", "Deutsch", "EUR", "€", "+43", "central-europe", "Europe/Vienna"],
  ["ch", "de", "Schweiz", "German", "Deutsch", "CHF", "CHF", "+41", "central-europe", "Europe/Zurich"],
  ["ch", "fr", "Suisse", "French", "Français", "CHF", "CHF", "+41", "western-europe", "Europe/Zurich"],
  ["ch", "it", "Svizzera", "Italian", "Italiano", "CHF", "CHF", "+41", "southern-europe", "Europe/Zurich"],
  ["be", "fr", "Belgique", "French", "Français", "EUR", "€", "+32", "western-europe", "Europe/Brussels"],
  ["be", "nl", "België", "Dutch", "Nederlands", "EUR", "€", "+32", "western-europe", "Europe/Brussels"],
  ["gb", "en", "United Kingdom", "English", "English", "GBP", "£", "+44", "western-europe", "Europe/London"],
  ["ie", "en", "Ireland", "English", "English", "EUR", "€", "+353", "western-europe", "Europe/Dublin"],
  ["es", "es", "España", "Spanish", "Español", "EUR", "€", "+34", "southern-europe", "Europe/Madrid"],
  ["it", "it", "Italia", "Italian", "Italiano", "EUR", "€", "+39", "southern-europe", "Europe/Rome"],
  ["pt", "pt", "Portugal", "Portuguese", "Português", "EUR", "€", "+351", "southern-europe", "Europe/Lisbon"],
  ["nl", "nl", "Nederland", "Dutch", "Nederlands", "EUR", "€", "+31", "western-europe", "Europe/Amsterdam"],
  ["pl", "pl", "Polska", "Polish", "Polski", "PLN", "zł", "+48", "eastern-europe", "Europe/Warsaw"],
  ["bg", "bg", "България", "Bulgarian", "Български", "EUR", "€", "+359", "eastern-europe", "Europe/Sofia"],
  ["ro", "ro", "România", "Romanian", "Română", "RON", "lei", "+40", "eastern-europe", "Europe/Bucharest"],
  ["gr", "el", "Ελλάδα", "Greek", "Ελληνικά", "EUR", "€", "+30", "southern-europe", "Europe/Athens"],
  ["se", "sv", "Sverige", "Swedish", "Svenska", "SEK", "kr", "+46", "northern-europe", "Europe/Stockholm"],
  ["no", "nb", "Norge", "Norwegian", "Norsk", "NOK", "kr", "+47", "northern-europe", "Europe/Oslo"],
  ["dk", "da", "Danmark", "Danish", "Dansk", "DKK", "kr", "+45", "northern-europe", "Europe/Copenhagen"],
  ["fi", "fi", "Suomi", "Finnish", "Suomi", "EUR", "€", "+358", "northern-europe", "Europe/Helsinki"],
  ["cz", "cs", "Česko", "Czech", "Čeština", "CZK", "Kč", "+420", "central-europe", "Europe/Prague"],
  ["sk", "sk", "Slovensko", "Slovak", "Slovenčina", "EUR", "€", "+421", "central-europe", "Europe/Bratislava"],
  ["hu", "hu", "Magyarország", "Hungarian", "Magyar", "HUF", "Ft", "+36", "central-europe", "Europe/Budapest"],
  ["hr", "hr", "Hrvatska", "Croatian", "Hrvatski", "EUR", "€", "+385", "southern-europe", "Europe/Zagreb"],
  ["si", "sl", "Slovenija", "Slovenian", "Slovenščina", "EUR", "€", "+386", "central-europe", "Europe/Ljubljana"],
  ["lt", "lt", "Lietuva", "Lithuanian", "Lietuvių", "EUR", "€", "+370", "northern-europe", "Europe/Vilnius"],
  ["lv", "lv", "Latvija", "Latvian", "Latviešu", "EUR", "€", "+371", "northern-europe", "Europe/Riga"],
  ["ee", "et", "Eesti", "Estonian", "Eesti", "EUR", "€", "+372", "northern-europe", "Europe/Tallinn"],
  ["mt", "mt", "Malta", "Maltese", "Malti", "EUR", "€", "+356", "southern-europe", "Europe/Malta"],
  ["cy", "el", "Κύπρος", "Greek", "Ελληνικά", "EUR", "€", "+357", "southern-europe", "Asia/Nicosia"],
  ["is", "is", "Ísland", "Icelandic", "Íslenska", "ISK", "kr", "+354", "northern-europe", "Atlantic/Reykjavik"],
  ["ua", "uk", "Україна", "Ukrainian", "Українська", "UAH", "₴", "+380", "eastern-europe", "Europe/Kyiv"],
  ["rs", "sr", "Србија", "Serbian", "Српски", "RSD", "дин", "+381", "eastern-europe", "Europe/Belgrade"],
  ["al", "sq", "Shqipëria", "Albanian", "Shqip", "ALL", "L", "+355", "southern-europe", "Europe/Tirane"],
  ["ba", "bs", "Bosna i Hercegovina", "Bosnian", "Bosanski", "BAM", "KM", "+387", "southern-europe", "Europe/Sarajevo"],
  ["mk", "mk", "Северна Македонија", "Macedonian", "Македонски", "MKD", "ден", "+389", "southern-europe", "Europe/Skopje"],
  ["me", "sr", "Crna Gora", "Serbian", "Srpski", "EUR", "€", "+382", "southern-europe", "Europe/Podgorica"],
  ["lu", "fr", "Luxembourg", "French", "Français", "EUR", "€", "+352", "western-europe", "Europe/Luxembourg"],
  ["lu", "de", "Luxemburg", "German", "Deutsch", "EUR", "€", "+352", "western-europe", "Europe/Luxembourg"],
  ["li", "de", "Liechtenstein", "German", "Deutsch", "CHF", "CHF", "+423", "central-europe", "Europe/Vaduz"],
  ["mc", "fr", "Monaco", "French", "Français", "EUR", "€", "+377", "western-europe", "Europe/Monaco"],
  ["sm", "it", "San Marino", "Italian", "Italiano", "EUR", "€", "+378", "southern-europe", "Europe/San_Marino"],
  ["ad", "ca", "Andorra", "Catalan", "Català", "EUR", "€", "+376", "southern-europe", "Europe/Andorra"],
];

export const markets: Market[] = seeds.map((seed) => {
  const [countryCode, locale, countryName, languageName, nativeLanguageName, currencyCode, currencySymbol, phonePrefix, region, defaultTimezone] = seed;
  const [localizedCTA, localizedContactLabel] = cta[locale] ?? ["Start your project", "Contact us"];
  const direction: Direction = rtlLocales.has(locale) ? "rtl" : "ltr";
  return {
    id: `${countryCode}-${locale}`,
    countryCode,
    countryName,
    locale,
    languageName,
    nativeLanguageName,
    currencyCode,
    currencySymbol,
    direction,
    dateLocale: locale === "ar" ? `ar-${countryCode.toUpperCase()}` : locale,
    phonePrefix,
    region,
    defaultTimezone,
    localizedCTA,
    localizedContactLabel,
    paymentProvidersAvailable: providerMap[region],
    isEnabled: true,
    fallbackMarket: locale === "ar" ? "global-ar" : "global-en",
  };
});

export const defaultMarket = markets[0];
export const enabledMarkets = markets.filter((market) => market.isEnabled);

export function getMarket(country: string, locale: string) {
  return enabledMarkets.find((market) => market.countryCode === country && market.locale === locale);
}

export function isValidMarket(country: string, locale: string) {
  return Boolean(getMarket(country, locale));
}

export function marketsByRegion() {
  return Object.groupBy(enabledMarkets, (market) => market.region);
}
