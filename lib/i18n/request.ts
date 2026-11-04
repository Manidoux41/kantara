import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { crmMessages } from "./crm";
import { interfaceMessages } from "./interface";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: {
      ...(await import(`../../messages/${locale}.json`)).default,
      AdminPreview: (await import(`../../messages/admin/${locale}.json`)).default,
      PropertyTools: (await import(`../../messages/tools/${locale}.json`)).default,
      Business: (await import(`../../messages/business/${locale}.json`)).default,
      Crm: crmMessages(locale),
      Interface: interfaceMessages(locale),
    },
  };
});
