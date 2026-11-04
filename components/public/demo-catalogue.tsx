"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  demoProperties, initialDemoFilters, filterDemoProperties,
  type DemoFilters,
} from "@/lib/demo/properties";
import { Icon } from "./icon";
import { PropertyFilters } from "./property-filters";
import { propertyPath, type CatalogueProperty } from "@/lib/properties/presentation";
import { PropertyMap } from "./property-map";
import { propertyMessages } from "@/lib/i18n/property";
import type { Locale } from "@/lib/i18n/routing";

export function DemoCatalogue({ prices }: { prices: Record<string, string> }) {
  const locale = useLocale() as Locale;
  const details = propertyMessages(locale);
  const t = useTranslations("Preview");
  const tools = useTranslations("PropertyTools");
  const b = useTranslations("Business");
  const ui = useTranslations("Interface");
  const [catalogue, setCatalogue] = useState<readonly CatalogueProperty[]>(demoProperties);
  const [apiError, setApiError] = useState("");
  const [filters, setFilters] = useState<DemoFilters>(initialDemoFilters);
  const [filterVersion, setFilterVersion] = useState(0);
  const [selected, setSelected] = useState<CatalogueProperty | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [view, setView] = useState<"grid" | "list" | "map">("grid");
  const dialog = useRef<HTMLDialogElement>(null);
  const favoritesFilter = useRef<HTMLButtonElement>(null);
  const properties = filterDemoProperties(filters, catalogue).filter((property) => !favoritesOnly || favorites.includes(property.id));
  const favoriteCount = catalogue.filter((property) => favorites.includes(property.id)).length;
  const locationName = (value: string) => t(`locations.${value}`);
  const title = (property: CatalogueProperty) => {
    const original = demoProperties.find((item) => item.id === property.id);
    return original ? t(`properties.${original.key}.title`) : "key" in property ? t(`properties.${property.key}.title`) : property.title;
  };
  const price = (property: CatalogueProperty) => prices[property.id] ?? `${property.price.toFixed(2)} USD`;

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/demo/catalogue", { cache: "no-store", signal: controller.signal });
        const body: { data?: CatalogueProperty[]; error?: { message: string } } = await response.json();
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
        setCatalogue(body.data); setApiError("");
      } catch (failure) {
        if (!controller.signal.aborted) setApiError(failure instanceof Error ? failure.message : b("requestFailed"));
      }
    };
    void load();
    window.addEventListener("focus", load);
    window.addEventListener("kantara-demo-updated", load);
    return () => { controller.abort(); window.removeEventListener("focus", load); window.removeEventListener("kantara-demo-updated", load); };
  }, [b]);

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);

  function reset() {
    setFilters(initialDemoFilters);
    setFavoritesOnly(false);
    setFilterVersion((version) => version + 1);
  }

  function favoriteButton(property: CatalogueProperty, className: string) {
    const saved = favorites.includes(property.id);
    return <button type="button" className={`favorite-button ${className}`} aria-pressed={saved}
      aria-label={`${ui(saved ? "removeFavorite" : "addFavorite")} — ${title(property)}`}
      onClick={() => setFavorites((current) => current.includes(property.id)
        ? current.filter((id) => id !== property.id) : [...current, property.id])}>
      <Icon name="heart" />
    </button>;
  }

  return (
    <section id="properties" className="catalogue section-shell" aria-labelledby="catalogue-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><span className="small-diamond" />{t("collectionEyebrow")}</p>
          <h2 id="catalogue-heading">{t("collectionTitle")}</h2>
        </div>
        <p className="section-description">{t("collectionDescription")}</p>
      </div>

      <div className="catalogue-tools">
        <span className="demo-label"><span />{t("demoLabel")}</span>
        <div className="catalogue-display" role="group" aria-label={ui("display")}>
          <button ref={favoritesFilter} type="button" className="favorites-filter" aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly(!favoritesOnly)} aria-describedby="favorites-help">
            <Icon name="heart" />{ui("favorites")}<span aria-live="polite">{favoriteCount}</span>
          </button>
          <div className="view-switch">
            {(["grid", "list"] as const).map((value) => <button type="button" key={value} aria-label={ui(value)}
              aria-pressed={view === value} onClick={() => setView(value)}><Icon name={value === "grid" ? "dashboard" : "list"} /></button>)}
            <button type="button" aria-label={details.map} aria-pressed={view === "map"} onClick={() => setView("map")}><Icon name="pin" /></button>
          </div>
        </div>
      </div>
      <p className="favorites-help" id="favorites-help">{ui("favoriteHelp")}</p>

      <PropertyFilters key={filterVersion} onApply={setFilters} onReset={reset} />
      {apiError && <p className="tools-error" role="alert">{b("error")} {apiError}</p>}

      <div className="results-bar">
        <p role="status" aria-live="polite">{t("results", { count: properties.length })}</p>
        <button className="text-button" type="button" onClick={reset}>{t("reset")}</button>
      </div>

      {view === "map" && <PropertyMap listings={properties.map((property) => ({ id: property.id, title: title(property), price: price(property) }))} />}
      {properties.length && view !== "map" ? (
        <div className={`property-grid${view === "list" ? " property-list-view" : ""}`}>
          {properties.map((property) => (
            <article key={property.id} className="property-card" data-transaction={property.transaction}>
              <div className="property-art">
                <Image src={property.image} alt={title(property)} width={1200} height={1000} sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 33vw" />
                <span className="listing-badge">{t(property.transaction)}</span>
                {favoriteButton(property, "card-favorite")}
                {property.availability && property.availability !== "AVAILABLE" && <span className="listing-availability">{b(property.availability)}</span>}
                <span className="listing-reference">{property.id}</span>
              </div>
              <div className="property-info">
                <p className="property-location"><Icon name="pin" />{locationName(property.location)}</p>
                <h3><Link href={propertyPath(locale, property.id)}>{title(property)}</Link></h3>
                {property.publishedAt && <p className="listing-published">{b("publicationDate")} : <time dateTime={property.publishedAt}>{property.publishedAt.slice(0, 10)}</time></p>}
                <ul className="property-facts" aria-label={t("features")}>
                  <li><Icon name="bed" /><span>{t("bedrooms", { count: property.bedrooms })}</span></li>
                  <li><Icon name="bath" /><span>{t("bathrooms", { count: property.bathrooms })}</span></li>
                  <li><Icon name="area" /><span>{property.area} m²</span></li>
                  <li><span>{property.rooms} {tools("rooms")}</span></li>
                </ul>
                <div className="property-card-bottom">
                  <p className="property-price">{price(property)}{property.transaction === "rent" && <span>{t("perMonth")}</span>}</p>
                  <button type="button" className="detail-button" onClick={() => setSelected(property)}
                    aria-label={`${t("viewProperty")} — ${title(property)}`}>
                    <Icon name="arrow" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : properties.length ? null : (
        <div className="empty-results">
          <Icon name="search" />
          <h3>{favoritesOnly ? ui("favoritesEmpty") : t("emptyTitle")}</h3>
          <p>{favoritesOnly ? ui("favoritesHint") : t("emptyDescription")}</p>
          <button type="button" className="button button-dark" onClick={reset}>{t("reset")}</button>
        </div>
      )}
      <p className="illustration-note">{t("illustrationNote")}</p>

      <dialog ref={dialog} className="property-dialog" aria-labelledby="property-dialog-title"
        onClose={() => {
          setSelected(null);
          if (favoritesOnly && selected && !favorites.includes(selected.id)) favoritesFilter.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.close();
          }
        }}>
        {selected && (
          <>
            <form method="dialog" className="dialog-close-form">
              <button className="dialog-close" aria-label={t("close")}><Icon name="close" /></button>
            </form>
            <Image className="dialog-art" src={selected.image} alt={title(selected)} width={1200} height={1000} />
            <div className="dialog-content">
              <p className="eyebrow">{t("demoLabel")} · {selected.id}</p>
              <h2 id="property-dialog-title">{title(selected)}</h2>
              <div className="dialog-favorite">{favoriteButton(selected, "")}<span>{ui(favorites.includes(selected.id) ? "removeFavorite" : "addFavorite")}</span></div>
              <p className="property-location"><Icon name="pin" />{locationName(selected.location)} · {t(`types.${selected.type}`)}</p>
              <p className="dialog-description">{(() => {
                const original = demoProperties.find((property) => property.id === selected.id);
                return original ? t(`properties.${original.key}.description`) : "key" in selected ? t(`properties.${selected.key}.description`) : selected.address;
              })()}</p>
              {selected.availability && <p className="business-badges"><span>{b(selected.availability)}</span></p>}
              <dl className="dialog-facts">
                <div><dt>{t("bedroomsLabel")}</dt><dd>{selected.bedrooms}</dd></div>
                <div><dt>{t("bathroomsLabel")}</dt><dd>{selected.bathrooms}</dd></div>
                <div><dt>{t("areaLabel")}</dt><dd>{selected.area} m²</dd></div>
                <div><dt>{tools("rooms")}</dt><dd>{selected.rooms}</dd></div>
              </dl>
              <p className="property-price">{price(selected)}{selected.transaction === "rent" && <span>{t("perMonth")}</span>}</p>
              <p className="dialog-notice">{details.demo}</p>
              <Link className="button button-dark" href={propertyPath(locale, selected.id)}>{details.fullDetails}</Link>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
