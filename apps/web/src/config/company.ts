import type { CompanyConfig } from "@/types";

export const company: CompanyConfig = {
  companyName: "MIRAAJ.TECH",
  legalName: "",
  slogan: "Digital Products. AI. Growth.",
  description:
    "We design and build clear, scalable digital products around real business needs.",
  primaryEmail: "",
  salesEmail: "",
  supportEmail: "",
  phone: "",
  whatsapp: "",
  socialLinks: {},
  officeLocations: [],
  businessHours: "",
  defaultMarket: "global",
  defaultLocale: "en",
};

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://miraaj.tech";
