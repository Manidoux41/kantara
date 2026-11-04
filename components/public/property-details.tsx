"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { demoProperties } from "@/lib/demo/properties";
import { propertyMessages } from "@/lib/i18n/property";
import type { Locale } from "@/lib/i18n/routing";
import type { CatalogueProperty } from "@/lib/properties/presentation";
import { PropertyMap } from "./property-map";
import { PropertyInquiry } from "./property-inquiry";
import { PropertyGallery } from "./property-gallery";
import { propertyEditorMessages } from "@/lib/i18n/property-editor";

export function PropertyDetails({ id, initial, initialPrice, locale, production = false }: { id: string; initial: CatalogueProperty | null; initialPrice: string; locale: Locale; production?: boolean }) {
  const t = useTranslations("Preview"), tools = useTranslations("PropertyTools"), b = useTranslations("Business");
  const copy = propertyMessages(locale);
  const editor = propertyEditorMessages(locale);
  const [property, setProperty] = useState(initial);
  const [price, setPrice] = useState(initialPrice);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(production || process.env.NODE_ENV === "development");
  useEffect(() => {
    if (!production && process.env.NODE_ENV !== "development") return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(production ? "/api/v1/catalogue" : "/api/demo/catalogue", { cache: "no-store", signal: controller.signal });
        const body: { data?: CatalogueProperty[] } = await response.json();
        if (!response.ok || !body.data) throw new Error(copy.error);
        const found = body.data.find((item) => item.id === id) ?? null;
        setProperty(found);
        setPrice(found ? new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(found.price) : "");
      } catch {
        if (!controller.signal.aborted) setError(copy.error);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [id, locale, copy.error, production]);
  const original = demoProperties.find((item) => item.id === id);
  const title = original ? t(`properties.${original.key}.title`) : property && "title" in property ? property.title : copy.notFound;

  return <main className="property-details section-shell" id="main">
    <Link className="text-link" href={`/${locale}#properties`}>{copy.back}</Link>
    {error && <p role="alert" className="tools-error">{error}</p>}
    {!property ? <h1>{loading ? "…" : copy.notFound}</h1> : <>
      <div className="property-detail-heading"><div><p className="eyebrow">{id} · {t(property.transaction)}</p><h1>{title}</h1>
        <p>{t(`locations.${property.location}`)} · {t(`types.${property.type}`)}</p></div>
        <div><p className="property-price">{price}{property.transaction === "rent" && <span>{t("perMonth")}</span>}</p>
          <p>{b(property.availability ?? "AVAILABLE")}</p><a className="button button-dark" href="#contact-agent">{copy.contact}</a></div>
      </div>
      {!production && <p className="information-notice">{copy.demo}</p>}
      <PropertyGallery key={[property.id, property.image, ...(property.images ?? [])].join(",")} images={property.images?.length ? property.images : [property.image]}
        title={title} locale={locale} unoptimized={production} />
      <div className="property-detail-layout"><article>
        <h2>{copy.overview}</h2>
        <p>{original ? t(`properties.${original.key}.description`) : "description" in property ? property.description : "address" in property ? property.address : ""}</p>
        <dl className="dialog-facts">
          <div><dt>{t("bedroomsLabel")}</dt><dd>{property.bedrooms}</dd></div>
          <div><dt>{t("bathroomsLabel")}</dt><dd>{property.bathrooms}</dd></div>
          <div><dt>{t("areaLabel")}</dt><dd>{property.area} m²</dd></div>
          <div><dt>{tools("rooms")}</dt><dd>{property.rooms}</dd></div>
          <div><dt>{editor.furnishing}</dt><dd>{property.furnishing ? editor[property.furnishing] : editor.unspecified}</dd></div>
        </dl>
        {property.publishedAt && <p>{b("publicationDate")} : <time dateTime={property.publishedAt}>{property.publishedAt.slice(0, 10)}</time></p>}
        <h2>{copy.surroundings}</h2><p>{copy.locationHelp}</p>
        <PropertyMap listings={[{ id, title, price, coordinates: "coordinates" in property ? property.coordinates : undefined }]} production={production} />
        <h2>{copy.project}</h2><p>{copy.projectHelp}</p>
        <Link href={`/${locale}/information/cambodia`}>{copy.project}</Link>
      </article>
      {!loading && !error && <PropertyInquiry propertyId={id} locale={locale} available={(property.availability ?? "AVAILABLE") === "AVAILABLE"} production={production} />}
      </div>
    </>}
  </main>;
}
