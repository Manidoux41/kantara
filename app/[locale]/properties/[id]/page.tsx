import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "@/lib/i18n/routing";
import { demoProperties } from "@/lib/demo/properties";
import { PropertyDetails } from "@/components/public/property-details";
import { LanguageSelector } from "@/components/public/language-selector";
import { propertyPath } from "@/lib/properties/presentation";
import { propertyMessages } from "@/lib/i18n/property";

export function generateStaticParams() {
  return locales.flatMap((locale) => demoProperties.map((property) => ({ locale, id: property.id })));
}
export async function generateMetadata({ params }: PageProps<"/[locale]/properties/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  if (!hasLocale(locales, locale)) notFound();
  const property = demoProperties.find((item) => item.id === id);
  const t = await getTranslations({ locale, namespace: "Preview" });
  return { title: `KANTARA | ${property ? t(`properties.${property.key}.title`) : propertyMessages(locale).fullDetails}`,
    description: property ? t(`properties.${property.key}.description`) : undefined,
    robots: { index: false, follow: false },
    alternates: { canonical: propertyPath(locale, id), languages: Object.fromEntries(locales.map((value) => [value, propertyPath(value, id)])) } };
}
export default async function PropertyPage({ params }: PageProps<"/[locale]/properties/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(locales, locale)) notFound();
  const property = demoProperties.find((item) => item.id === id) ?? null;
  if (!property && (process.env.NODE_ENV !== "development" || !/^[a-f0-9]{8}-[a-f0-9-]{27}$/.test(id))) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Home" });
  return <>
    <header className="site-header section-shell">
      <Link href={`/${locale}`} className="brand"><Image src="/images/kantara-logo.svg" alt="KANTARA" width={240} height={64} preload /></Link>
      <LanguageSelector locale={locale} label={t("language")} path={`/properties/${encodeURIComponent(id)}`} />
    </header>
    <PropertyDetails id={id} initial={property} locale={locale}
      initialPrice={property ? new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(property.price) : ""} />
  </>;
}
