import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { informationTopics, legalMessages } from "@/lib/i18n/legal";
import type { Locale } from "@/lib/i18n/routing";
import { BrandMark } from "./brand-mark";
import { Icon } from "./icon";
import { teamMessages } from "@/lib/i18n/team";
import { agencyEnabled } from "@/lib/database-config";

export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const p = await getTranslations({ locale, namespace: "Preview" });
  const a = await getTranslations({ locale, namespace: "AdminPreview" });
  const legal = legalMessages(locale, agencyEnabled());
  return <footer className="site-footer">
    <div className="section-shell">
      <div className="footer-main">
        <div className="footer-identity"><BrandMark /><p className="footer-wordmark">KANTARA<span>{t("tagline")}</span></p></div>
        <nav className="footer-legal-nav" aria-label={legal.navigation}>
          <h2>{legal.navigation}</h2>
          {informationTopics.map((topic) => <Link key={topic} href={`/${locale}/information/${topic}`} prefetch={true}>{legal[topic]}<Icon name="arrow" /></Link>)}
        </nav>
      </div>
      {!agencyEnabled() && <p className="footer-disclaimer">{legal.notice}</p>}
      <div className="footer-inner">
        <p>{p("footerNotice")}</p>
        {agencyEnabled() ? <Link className="text-link" href={`/${locale}/admin`}>Administration<Icon name="arrow" /></Link> : <>
        <Link className="text-link" href={`/${locale}/demo/admin`}>{a("entry")}<Icon name="arrow" /></Link>
        <Link className="text-link" href={`/${locale}/demo/team`}>{teamMessages(locale).entry}<Icon name="arrow" /></Link></>}
        <a href="#page-top">{p("backToTop")} ↑</a>
      </div>
    </div>
  </footer>;
}
