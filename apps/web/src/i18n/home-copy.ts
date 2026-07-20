export type { HomeCopy } from "./home-copy.en";
import type { HomeCopy } from "./home-copy.en";
import { en } from "./home-copy.en";
import { ar } from "./home-copy.ar";
import { fr } from "./home-copy.fr";

export const homeCopyLocales = ["en", "ar", "fr"] as const;

const copyByLocale: Record<string, HomeCopy> = { en, ar, fr };

export function getHomeCopy(locale: string): HomeCopy {
  return copyByLocale[locale] ?? en;
}
