import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LanguageSelector } from "@/components/public/language-selector";
import { locales } from "@/lib/i18n/routing";
import { BrandMark } from "@/components/public/brand-mark";
import { Icon } from "@/components/public/icon";
import { DemoCatalogue } from "@/components/public/demo-catalogue";
import { demoProperties } from "@/lib/demo/properties";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Home" });
  const title = `KANTARA | ${t("title")}`;
  const description = t("tagline");
  const ogLocale: Record<string, string> = { en: "en_US", fr: "fr_FR", km: "km_KH", zh: "zh_CN", ja: "ja_JP", de: "de_DE", es: "es_ES" };
  const metadataBase = new URL(process.env.SITE_URL ?? "http://localhost:3000");
  const socialImage = new URL("/api/brand/social", metadataBase).toString();
  return {
    metadataBase,
    title,
    description,
    applicationName: "KANTARA",
    category: "real estate",
    robots: { index: false, follow: false },
    openGraph: {
      type: "website", siteName: "KANTARA", title, description, url: `/${locale}`,
      locale: ogLocale[locale], alternateLocale: locales.filter((value) => value !== locale).map((value) => ogLocale[value]),
      images: [{ url: socialImage, width: 1200, height: 630, alt: "KANTARA — Cambodia — Demonstration" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
    alternates: {
      canonical: `/${locale}`,
      languages: { ...Object.fromEntries(locales.map((value) => [value, `/${value}`])), "x-default": "/en" },
    },
  };
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Home" });
  const preview = await getTranslations({ locale, namespace: "Preview" });
  // Serialize prices to avoid server/browser ICU differences, notably for Khmer.
  const priceFormatter = new Intl.NumberFormat(locale, {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
  const prices = Object.fromEntries(demoProperties.map((property) => [
    property.id, priceFormatter.format(property.price),
  ]));

  return (
    <>
      <a className="skip-link" href="#main">{preview("skip")}</a>
      <div className="preview-banner">{preview("banner")}</div>
      <header className="site-header section-shell">
        <Link className="brand" href={`/${locale}`} aria-label={preview("homeLabel")}>
          <Image className="company-logo" src="/images/kantara-logo.svg" alt="KANTARA" width={360} height={96} preload />
          <small className="company-tagline">{preview("brandSubtitle")}</small>
        </Link>
        <nav className="main-nav" aria-label={preview("navigation")}>
          <a href="#properties">{preview("navProperties")}</a>
          <a href="#approach">{preview("navApproach")}</a>
          <a href="#about">{preview("navAbout")}</a>
        </nav>
        <LanguageSelector locale={locale} label={t("language")} />
      </header>

      <main id="main" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="small-diamond" />{preview("heroEyebrow")}</p>
            <h1 id="hero-title">{preview("heroTitle")}<em>{preview("heroAccent")}</em></h1>
            <p className="hero-description">{preview("heroDescription")}</p>
            <a className="button button-dark" href="#properties">{preview("explore")}<Icon name="arrow" /></a>
            <div className="hero-footnote"><span className="ornament-line" /><p>{preview("heroFootnote")}</p></div>
          </div>
          <div className="hero-art">
            <Image src="/images/khmer-residence.svg" alt={preview("heroImageAlt")} width={1200} height={1000} preload sizes="(max-width: 760px) 100vw, 55vw" />
            <div className="hero-art-caption"><span>{preview("artCaption")}</span><span>01 — 03</span></div>
            <div className="hero-stamp" aria-hidden="true"><BrandMark /><span>SIEM REAP<br />CAMBODIA</span></div>
          </div>
        </section>

        <div className="place-strip section-shell">
          <p>{preview("placesLabel")}</p>
          <span>SIEM REAP</span><span className="strip-diamond" aria-hidden="true">◇</span>
          <span>PHNOM PENH</span><span className="strip-diamond" aria-hidden="true">◇</span><span>KAMPOT</span>
        </div>

        <DemoCatalogue prices={prices} />

        <section id="approach" className="approach" aria-labelledby="approach-title">
          <div className="section-shell">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{preview("approachEyebrow")}</p>
                <h2 id="approach-title">{preview("approachTitle")}</h2>
              </div>
              <p className="section-description">{preview("approachDescription")}</p>
            </div>
            <div className="approach-grid">
              {(["roots", "spaces", "care"] as const).map((key, index) => (
                <article key={key}>
                  <span className="approach-number">0{index + 1}</span>
                  <h3>{preview(`approach.${key}.title`)}</h3>
                  <p>{preview(`approach.${key}.description`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="about section-shell" aria-labelledby="about-title">
          <div className="about-symbol" aria-hidden="true"><BrandMark /><span>KANTARA</span></div>
          <div>
            <p className="eyebrow">{t("title")}</p>
            <h2 id="about-title">{preview("aboutTitle")}</h2>
            <p>{preview("aboutDescription")}</p>
            <a className="text-link" href="#properties">{preview("explore")}<Icon name="arrow" /></a>
          </div>
        </section>
      </main>

    </>
  );
}
