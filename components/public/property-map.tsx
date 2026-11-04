"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { propertyMessages } from "@/lib/i18n/property";
import type { Locale } from "@/lib/i18n/routing";
import { propertyPath, propertyPosition } from "@/lib/properties/presentation";
import "leaflet/dist/leaflet.css";

export type MapListing = { id: string; title: string; price: string; coordinates?: { latitude: number; longitude: number } };

export function PropertyMap({ listings, production = false }: { listings: MapListing[]; production?: boolean }) {
  const locale = useLocale() as Locale;
  const t = propertyMessages(locale);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const serialized = JSON.stringify(listings);

  useEffect(() => {
    if (!enabled || !container.current) return;
    let active = true;
    let dispose: (() => void) | undefined;
    const element = container.current;
    void import("leaflet").then((L) => {
      if (!active) return;
      const current: MapListing[] = JSON.parse(serialized);
      const map = L.map(element, { scrollWheelZoom: false });
      map.attributionControl.setPrefix(false);
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
      tiles.on("tileerror", () => { if (active) setError(true); });
      tiles.addTo(map);
      const located = current.flatMap((listing) => {
        const point = listing.coordinates ?? (!production ? propertyPosition(listing.id) : undefined);
        return point ? [{ ...listing, coordinates: [point.latitude, point.longitude] as [number, number] }] : [];
      });
      const points = located.map((listing) => listing.coordinates);
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [70, 60], maxZoom: 14 });
      else map.setView([12.5, 104.8], 7);
      const markers = L.layerGroup().addTo(map);
      function propertyLink(listing: Pick<MapListing, "id" | "title" | "price">, className: string) {
        const link = document.createElement("a");
        link.href = propertyPath(locale, listing.id);
        link.className = className;
        link.textContent = className === "map-property-link" ? listing.price : `${listing.title} · ${listing.price}`;
        link.setAttribute("aria-label", `${listing.title} — ${listing.price}`);
        link.title = `${listing.title} · ${listing.id}`;
        L.DomEvent.disableClickPropagation(link);
        return link;
      }
      function renderMarkers() {
        markers.clearLayers();
        const groups: (typeof located)[] = [];
        for (const listing of located) {
          const pixel = map.latLngToLayerPoint(listing.coordinates);
          const group = groups.find((items) => items.some((item) => {
            const other = map.latLngToLayerPoint(item.coordinates);
            return Math.abs(pixel.x - other.x) < 124 && Math.abs(pixel.y - other.y) < 48;
          }));
          if (group) group.push(listing); else groups.push([listing]);
        }
        for (const group of groups) {
          const center = L.latLngBounds(group.map((item) => item.coordinates)).getCenter();
          let element: HTMLElement;
          if (group.length === 1) element = propertyLink(group[0], "map-property-link");
          else {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "map-property-cluster";
            button.textContent = String(group.length);
            button.setAttribute("aria-label", `${group.length} · ${t.cluster}`);
            L.DomEvent.disableClickPropagation(button);
            button.addEventListener("click", () => {
              const links = document.createElement("div");
              links.className = "map-popup-links";
              for (const listing of group) links.append(propertyLink(listing, "map-popup-link"));
              map.fitBounds(L.latLngBounds(group.map((item) => item.coordinates)), { padding: [70, 60], maxZoom: 17, animate: false });
              L.popup().setLatLng(center).setContent(links).openOn(map);
            });
            element = button;
          }
          L.marker(center, { keyboard: false, icon: L.divIcon({
            className: "property-map-marker", html: element, iconSize: [112, 38], iconAnchor: [56, 38],
          }) }).addTo(markers);
        }
      }
      renderMarkers();
      map.on("zoomend", renderMarkers);
      const observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(element);
      dispose = () => { observer.disconnect(); map.remove(); };
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; dispose?.(); };
  }, [enabled, serialized, locale, t.cluster, production]);

  return <section className="property-map-section" aria-label={t.map}>
    <h3>{t.map}</h3>
    {!production && <p>{t.approximate}</p>}
    {!enabled ? <div className="map-consent"><p>{t.mapPrivacy}</p>
      <button type="button" className="button button-dark" onClick={() => { setError(false); setEnabled(true); }}>{t.loadMap}</button>
    </div> : <div className="property-map-canvas" ref={container} role="region" aria-label={`${t.map} · OpenStreetMap`} />}
    {error && <p className="tools-error" role="alert">{t.mapError}</p>}
    {listings.some((item) => !item.coordinates && (production || !propertyPosition(item.id))) && <p>{t.missing}</p>}
    <ul className="map-property-list">{listings.map((item) => <li key={item.id}>
      <Link href={propertyPath(locale, item.id)}>{item.title} · {item.price}</Link>
    </li>)}</ul>
  </section>;
}
