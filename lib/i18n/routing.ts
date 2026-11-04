import { defineRouting } from "next-intl/routing";

export const locales = ["en", "fr", "km", "zh", "ja", "de", "es"] as const;
export type Locale = (typeof locales)[number];
export const informationTopics = ["legal", "privacy", "terms", "fees", "cambodia"] as const;

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: false,
});
