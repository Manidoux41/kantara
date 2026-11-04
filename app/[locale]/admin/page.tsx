import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "@/lib/i18n/routing";
import { agencyEnabled } from "@/lib/database-config";
import { AgencyWorkspace } from "@/components/admin/agency-workspace";
import { LanguageSelector } from "@/components/public/language-selector";
import { teamMessages } from "@/lib/i18n/team";
import "@/components/admin/administration.css";
import "@/components/admin/team.css";
export const metadata: Metadata = { title: "KANTARA | Administration", robots: { index: false, follow: false } };
export default async function AdminPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!hasLocale(locales, locale) || !agencyEnabled()) notFound();
  setRequestLocale(locale);
  return <>
    <header className="site-header section-shell">
      <Link href={`/${locale}`} className="brand"><Image src="/images/kantara-logo.svg" className="company-logo" alt="KANTARA" width={360} height={96} loading="eager" /></Link>
      <LanguageSelector locale={locale} label="Language" path="/admin" />
    </header>
    <main className="team-page agency-page section-shell" id="main"><h1>{teamMessages(locale).title.replace(/DEMO/gi, "")}</h1>
      <AgencyWorkspace locale={locale} />
    </main>
  </>;
}
