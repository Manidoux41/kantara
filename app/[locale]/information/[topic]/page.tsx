import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LanguageSelector } from "@/components/public/language-selector";
import { agencyResources, informationSections, informationTopics, legalMessages } from "@/lib/i18n/legal";
import { locales } from "@/lib/i18n/routing";
import { agencyEnabled } from "@/lib/database-config";

function topicFrom(value: string) {
  const topic = informationTopics.find((item) => item === value);
  if (!topic) notFound();
  return topic;
}

export function generateStaticParams() {
  return informationTopics.map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/information/[topic]">): Promise<Metadata> {
  const { locale, topic: value } = await params;
  if (!hasLocale(locales, locale)) notFound();
  const topic = topicFrom(value), t = legalMessages(locale, agencyEnabled());
  return {
    title: `KANTARA | ${t[topic]}`,
    description: t.notice,
    robots: { index: false, follow: false },
    alternates: {
      canonical: `/${locale}/information/${topic}`,
      languages: Object.fromEntries(locales.map((language) => [language, `/${language}/information/${topic}`])),
    },
  };
}

export default async function InformationPage({ params }: PageProps<"/[locale]/information/[topic]">) {
  const { locale, topic: value } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale);
  const topic = topicFrom(value), t = legalMessages(locale, agencyEnabled());
  const home = await getTranslations({ locale, namespace: "Home" });
  const preview = await getTranslations({ locale, namespace: "Preview" });
  return <>
    <a className="skip-link" href="#main">{preview("skip")}</a>
    {!agencyEnabled() && <div className="preview-banner">{preview("banner")}</div>}
    <header className="site-header section-shell">
      <Link className="brand" href={`/${locale}`} aria-label={preview("homeLabel")}>
        <Image className="company-logo" src="/images/kantara-logo.svg" alt="KANTARA" width={360} height={96} />
        <small className="company-tagline">{preview("brandSubtitle")}</small>
      </Link>
      <LanguageSelector locale={locale} label={home("language")} path={`/information/${topic}`} />
    </header>
    <main id="main" className="information-page section-shell" tabIndex={-1}>
      <Link className="text-link" href={`/${locale}#properties`}>← {t.home}</Link>
      <div className="information-heading"><p className="eyebrow">{t.navigation}</p><h1>{t[topic]}</h1></div>
      <p className="information-notice">{t.notice}</p>
      <nav className="information-nav" aria-label={t.navigation}>
        {informationTopics.map((item) => <Link key={item} href={`/${locale}/information/${item}`} prefetch={true}
          aria-current={item === topic ? "page" : undefined}>{t[item]}</Link>)}
      </nav>
      <article className="information-article">
        {informationSections[topic].map((section) => <section key={section.title}><h2>{t[section.title]}</h2><p>{t[section.text]}</p></section>)}
        {(topic === "cambodia" || topic === "fees") && <section className="information-resources">
          <h2>{t.resources}</h2><ul>{agencyResources.map((source) => <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>
          </li>)}</ul>
        </section>}
      </article>
    </main>
  </>;
}
