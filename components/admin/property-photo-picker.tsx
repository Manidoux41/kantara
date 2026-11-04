"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { locales } from "@/lib/i18n/routing";
import { propertyEditorMessages } from "@/lib/i18n/property-editor";
import { z } from "zod";

export type SelectedPhoto = { file: File; url: string };
export function usePhotoSelection() {
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const current = useRef(photos);
  useEffect(() => () => { current.current.forEach((photo) => URL.revokeObjectURL(photo.url)); }, []);
  function replace(next: SelectedPhoto[]) {
    current.current.filter((photo) => !next.includes(photo)).forEach((photo) => URL.revokeObjectURL(photo.url));
    current.current = next; setPhotos(next);
  }
  return { photos, replace };
}
export async function uploadPropertyPhoto(propertyId: string, file: File, failed: string) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(failed));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result.split(",")[1]) : reject(new Error(failed));
    reader.readAsDataURL(file);
  });
  const response = await fetch("/api/agency/media", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId, kind: "PHOTO", name: file.name, mime: file.type, base64 }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? failed);
  return z.object({ id: z.uuid() }).parse(body.data);
}
export function PropertyPhotoPicker({ selection, existing = 0, disabled = false, onError }: {
  selection: ReturnType<typeof usePhotoSelection>; existing?: number; disabled?: boolean; onError: (message: string) => void;
}) {
  const locale = useLocale(), t = propertyEditorMessages(locales.find((item) => item === locale) ?? "en");
  return <section className="property-photo-picker" aria-label={t.photos}>
    <h3>{t.photos} <small>{existing + selection.photos.length} / 20</small></h3><p>{t.photoHelp}</p>
    <label className="business-field"><span>{t.addPhotos}</span>
      <input type="file" name="photos" accept="image/jpeg,image/png" multiple disabled={disabled || existing + selection.photos.length >= 20} onChange={(event) => {
        const files = Array.from(event.target.files ?? []); event.target.value = "";
        if (disabled) return;
        if (existing + selection.photos.length + files.length > 20) { onError(t.photoLimit); return; }
        if (files.some((file) => !["image/jpeg", "image/png"].includes(file.type) || !file.size || file.size > 2.5 * 1024 * 1024)) {
          onError(t.invalidPhoto); return;
        }
        selection.replace([...selection.photos, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]); onError("");
      }} />
    </label>
    <ul className="property-editor-photos">{selection.photos.map((photo, index) => <li key={photo.url}>
      <Image src={photo.url} alt={photo.file.name} width={240} height={180} unoptimized />
      <span>{photo.file.name}</span>
      {index === 0 ? <strong>{t.featured}</strong> : <button type="button" className="text-button" disabled={disabled}
        onClick={() => selection.replace([photo, ...selection.photos.filter((item) => item !== photo)])}>{t.setFeatured}</button>}
      <button type="button" className="text-button" disabled={disabled} onClick={() => selection.replace(selection.photos.filter((item) => item !== photo))}>{t.remove}</button>
    </li>)}</ul>
  </section>;
}
