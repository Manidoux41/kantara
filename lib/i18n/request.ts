import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { crmMessages } from "./crm";
import { interfaceMessages } from "./interface";
import { agencyMessages, productionOverrides } from "./production";
import { agencyEnabled } from "@/lib/database-config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const base = (await import(`../../messages/${locale}.json`)).default;
  const production = agencyEnabled() ? productionOverrides(locale) : null;
  return {
    locale,
    messages: {
      ...base,
      Preview: { ...base.Preview, ...production?.Preview },
      AdminPreview: (await import(`../../messages/admin/${locale}.json`)).default,
      PropertyTools: (await import(`../../messages/tools/${locale}.json`)).default,
      Business: { ...(await import(`../../messages/business/${locale}.json`)).default, ...production?.Business },
      Crm: { ...crmMessages(locale), ...production?.Crm },
      Agency: agencyMessages(locale),
      Interface: interfaceMessages(locale),
    },
  };
});
