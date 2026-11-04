"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { BusinessProperty } from "@/lib/demo/business-types";
import type { WorkspaceCommand } from "./crm-workspace";
import { furnishingLevels } from "@/lib/properties/furnishing";
import { propertyEditorMessages } from "@/lib/i18n/property-editor";
import { locales } from "@/lib/i18n/routing";
import { PropertyPhotoPicker, uploadPropertyPhoto, usePhotoSelection } from "./property-photo-picker";
import { PropertyGallery } from "@/components/public/property-gallery";

type Asset = { id: string; name: string; kind: string; size: number };
export function AgencyMedia({ property, command, refresh }: { property: BusinessProperty; command: WorkspaceCommand; refresh: () => Promise<void> }) {
  const t = useTranslations("Agency");
  const locale = useLocale(), selectedLocale = locales.find((item) => item === locale) ?? "en";
  const copy = propertyEditorMessages(selectedLocale);
  const selection = usePhotoSelection();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const photos = assets.filter((asset) => asset.kind === "PHOTO");
  const orderedPhotos = [...photos].sort((a, b) => Number(property.image === `/api/v1/media/${b.id}`) - Number(property.image === `/api/v1/media/${a.id}`));
  async function load() {
    setLoaded(false);
    const response = await fetch(`/api/agency/media?propertyId=${property.id}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? t("failed"));
    setAssets(body.data);
    setLoaded(true);
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form), file = data.get("file");
    if (!(file instanceof File) || !file.size) { setError(t("fileHelp")); return; }
    if (file.size > 2.5 * 1024 * 1024) { setError(t("fileHelp")); return; }
    setBusy(true); setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(t("failed")));
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result.split(",")[1]) : reject(new Error(t("failed")));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/agency/media", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id, kind: "DOCUMENT", name: file.name, mime: file.type, base64 }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? t("failed"));
      form.reset(); await load(); await refresh(); window.dispatchEvent(new Event("kantara-agency-updated"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("failed")); }
    finally { setBusy(false); }
  }
  async function feature(id: string) {
    const response = await fetch(`/api/agency/media/${id}`, { method: "PATCH" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? t("failed"));
  }
  async function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selection.photos.length) return;
    if (photos.length + selection.photos.length > 20) { setError(copy.photoLimit); return; }
    setBusy(true); setError("");
    try {
      const selected = [...selection.photos];
      for (const [index, photo] of selected.entries()) {
        const result = await uploadPropertyPhoto(property.id, photo.file, t("failed"));
        selection.replace(selected.slice(index + 1));
        if (index === 0) await feature(result.id);
      }
    } catch (cause) { setError(`${copy.uploadFailed} ${cause instanceof Error ? cause.message : t("failed")}`); }
    finally {
      try { await load(); await refresh(); window.dispatchEvent(new Event("kantara-agency-updated")); }
      catch (cause) { setError(cause instanceof Error ? cause.message : t("failed")); }
      setBusy(false);
    }
  }
  return <details onToggle={(event) => {
    if (event.currentTarget.open) void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t("failed")));
  }}><summary>{t("propertyDetails")}</summary>
    <form className="business-form" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      const latitude = String(data.get("latitude") ?? ""), longitude = String(data.get("longitude") ?? "");
      if (Boolean(latitude) !== Boolean(longitude)) { setError(t("coordinates")); return; }
      void command({ action: "propertyDetails", propertyId: property.id, description: data.get("description"),
        ...(data.get("furnishing") ? { furnishing: data.get("furnishing") } : {}),
        coordinates: latitude && longitude ? { latitude: Number(latitude), longitude: Number(longitude) } : null });
    }}>
      <label className="business-field">{t("description")}<textarea name="description" minLength={10} maxLength={10000} required defaultValue={property.description ?? property.address} /></label>
      <label className="business-field">{copy.furnishing}<select name="furnishing" defaultValue={property.furnishing ?? ""}>
        <option value="" disabled>{copy.unspecified}</option>{furnishingLevels.map((value) => <option key={value} value={value}>{copy[value]}</option>)}
      </select></label>
      <label className="business-field">{t("latitude")}<input name="latitude" type="number" step="any" min="-90" max="90" defaultValue={property.coordinates?.latitude} /></label>
      <label className="business-field">{t("longitude")}<input name="longitude" type="number" step="any" min="-180" max="180" defaultValue={property.coordinates?.longitude} /></label>
      <button className="text-button">{t("save")}</button>
    </form>
    {error && <p role="alert" className="tools-error">{error}</p>}
    <form className="business-form agency-photo-form" onSubmit={(event) => void uploadPhotos(event)} aria-busy={busy}>
      <PropertyPhotoPicker selection={selection} existing={photos.length} disabled={busy || !loaded} onError={setError} />
      <button className="text-button" disabled={busy || !loaded || !selection.photos.length}>{copy.uploadPhotos}</button>
    </form>
    {orderedPhotos.length > 0 && <PropertyGallery key={orderedPhotos.map((photo) => photo.id).join(",")}
      images={orderedPhotos.map((photo) => `/api/agency/media/${photo.id}?preview=1`)} title={property.title} locale={selectedLocale} unoptimized />}
    <p>{t("fileHelp")}</p>
    <form className="business-form" onSubmit={(event) => void upload(event)}><fieldset disabled={busy}>
      <label className="business-field">{t("document")}<input name="file" type="file" accept="image/jpeg,image/png,application/pdf" required /></label>
      <button className="text-button">{t("upload")}</button>
    </fieldset></form>
    <ul>{assets.map((asset) => <li key={asset.id}><a href={`/api/agency/media/${asset.id}`}>{asset.name}</a> · {Math.ceil(asset.size / 1024)} KiB
      {asset.kind === "PHOTO" && (property.image === `/api/v1/media/${asset.id}` ? <strong> · {copy.featured}</strong> :
        <button type="button" className="text-button" disabled={busy} onClick={() => {
          setBusy(true); setError("");
          void feature(asset.id).then(async () => { await refresh(); window.dispatchEvent(new Event("kantara-agency-updated")); })
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t("failed"))).finally(() => setBusy(false));
        }}>{copy.setFeatured}</button>)}
      {deleteId !== asset.id ? <button className="text-button" type="button" disabled={busy} onClick={() => setDeleteId(asset.id)}>{t("remove")}</button> :
        <><button className="text-button" type="button" disabled={busy} onClick={() => {
          setBusy(true); setError("");
          void fetch(`/api/agency/media/${asset.id}`, { method: "DELETE" }).then(async (response) => {
            const body = await response.json();
            if (!response.ok) throw new Error(body.error?.message ?? t("failed"));
            setDeleteId(""); await load(); await refresh(); window.dispatchEvent(new Event("kantara-agency-updated"));
          }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t("failed"))).finally(() => setBusy(false));
        }}>{t("confirmRemove")}</button><button type="button" disabled={busy} onClick={() => setDeleteId("")}>{t("cancel")}</button></>}
    </li>)}</ul>
  </details>;
}
