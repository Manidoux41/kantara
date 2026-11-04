import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { TeamWorkspace } from "@/components/admin/team-workspace";
import { LanguageSelector } from "@/components/public/language-selector";
import { teamMessages } from "@/lib/i18n/team";
import { locales } from "@/lib/i18n/routing";
import "./team.css";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/team">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  return { title: `KANTARA | ${teamMessages(locale).entry}`, robots: { index: false, follow: false }, alternates: { canonical: `/${locale}/demo/team`, languages: {} } };
}
export default async function TeamPage({ params }: PageProps<"/[locale]/demo/team">) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale);
  const t = teamMessages(locale);
  return <>
    <header className="site-header section-shell">
      <Link href={`/${locale}`} className="brand" aria-label="KANTARA"><Image src="/images/kantara-logo.svg" className="company-logo" alt="KANTARA" width={360} height={96} loading="eager" /></Link>
      <LanguageSelector locale={locale} label={t.entry} path="/demo/team" />
    </header>
    <main id="main" className="team-page section-shell">
      <p className="eyebrow">KANTARA · DEMO</p><h1>{t.title}</h1>
      <p className="information-notice">{t.notice}</p>
      {process.env.NODE_ENV === "development" ? <TeamWorkspace locale={locale} /> : <p className="information-notice">{t.unavailable}</p>}
    </main>
  </>;
}
