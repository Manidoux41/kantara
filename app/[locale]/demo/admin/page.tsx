import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AdminPreview } from "@/components/admin/admin-preview";
import { locales } from "@/lib/i18n/routing";
import { adminDemoRecords, getAdminDemoSummary } from "@/lib/demo/administration";
import "@/components/admin/administration.css";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/admin">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "AdminPreview" });
  return {
    title: `KANTARA | ${t("title")}`,
    description: t("notice"),
    robots: { index: false, follow: false },
    alternates: { canonical: `/${locale}/demo/admin`, languages: {} },
  };
}

export default async function AdminDemoPage({ params }: PageProps<"/[locale]/demo/admin">) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
  const summary = getAdminDemoSummary();
  const amounts = Object.fromEntries(adminDemoRecords.flatMap((record) =>
    record.amount === undefined ? [] : [[record.id, formatter.format(record.amount)]]));
  return <AdminPreview locale={locale} amounts={amounts}
    operational={process.env.NODE_ENV === "development"}
    commissionTotal={formatter.format(summary.commissions)}
    commissionPaid={formatter.format(summary.completedCommissions)} />;
}
