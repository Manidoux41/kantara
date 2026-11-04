import Link from "next/link";
import { locales, type Locale } from "@/lib/i18n/routing";
import { Icon } from "./icon";

const labels: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  km: "ខ្មែរ",
  zh: "简体中文",
  ja: "日本語",
  de: "Deutsch",
  es: "Español",
};

export function LanguageSelector({ locale, label, path = "" }: { locale: Locale; label: string; path?: string }) {
  return (
    <details className="language-menu">
      <summary aria-label={`${label} : ${labels[locale]}`}>
        <Icon name="globe" />
        <span>{locale.toUpperCase()}</span>
        <Icon name="chevron" />
      </summary>
      <nav aria-label={label} className="language-options">
        {locales.map((language) => (
          <Link
            key={language}
            href={`/${language}${path}`}
            hrefLang={language}
            lang={language}
            aria-current={language === locale ? "page" : undefined}
          >
            {labels[language]}
          </Link>
        ))}
      </nav>
    </details>
  );
}
