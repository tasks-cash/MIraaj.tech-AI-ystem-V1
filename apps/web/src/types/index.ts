export type Direction = "ltr" | "rtl";
export type Region =
  | "global"
  | "north-africa"
  | "gulf"
  | "western-europe"
  | "central-europe"
  | "northern-europe"
  | "southern-europe"
  | "eastern-europe";

export interface Market {
  id: string;
  countryCode: string;
  countryName: string;
  locale: string;
  languageName: string;
  nativeLanguageName: string;
  currencyCode: string;
  currencySymbol: string;
  direction: Direction;
  dateLocale: string;
  phonePrefix: string;
  region: Region;
  defaultTimezone: string;
  localizedCTA: string;
  localizedContactLabel: string;
  paymentProvidersAvailable: string[];
  isEnabled: boolean;
  fallbackMarket: string;
}

export interface Service {
  slug: string;
  group: "build" | "automate" | "grow";
  icon: string;
  title: string;
  description: string;
  capabilities: string[];
}

export interface Project {
  slug: string;
  name: string;
  category: string;
  summary: string;
  services: string[];
  concept: true;
  accent: string;
}

export interface Industry {
  slug: string;
  title: string;
  description: string;
  solutions: string[];
}

export interface FAQItem {
  category: string;
  question: string;
  answer: string;
}

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  demo: true;
  readingTime: number;
}

export interface PaymentProvider {
  name: string;
  kind: "global" | "wallet" | "local";
}

export interface NavigationItem {
  label: string;
  href: string;
}

export interface CompanyConfig {
  companyName: string;
  legalName: string;
  slogan: string;
  description: string;
  primaryEmail: string;
  salesEmail: string;
  supportEmail: string;
  phone: string;
  whatsapp: string;
  socialLinks: Record<string, string>;
  officeLocations: string[];
  businessHours: string;
  defaultMarket: string;
  defaultLocale: string;
}
