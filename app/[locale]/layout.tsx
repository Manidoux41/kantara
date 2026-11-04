import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, routing } from "@/lib/i18n/routing";
import { SiteFooter } from "@/components/public/site-footer";
import "../globals.css";
import "@/components/public/property-details.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "KANTARA",
  description: "International Property Management & Real Estate Services",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body id="page-top"><NextIntlClientProvider>{children}<SiteFooter locale={locale} /></NextIntlClientProvider></body>
    </html>
  );
}
