import { getRequestConfig } from "next-intl/server";
import { getCopy, asIntlMessages } from "./content";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? "en";
  return {
    locale,
    messages: asIntlMessages(getCopy(locale)),
    onError(error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Translation error", error);
      }
    },
    getMessageFallback({ namespace, key }) {
      const path = [namespace, key].filter(Boolean).join(".");
      return path ? getNestedFallback(path) : "";
    },
  };
});

function getNestedFallback(path: string): string {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, asIntlMessages(getCopy("en")));
  return typeof value === "string" ? value : "";
}
