"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/routing";
import { propertyEditorMessages } from "@/lib/i18n/property-editor";

export function PropertyGallery({ images, title, locale, unoptimized = false }: {
  images: string[]; title: string; locale: Locale; unoptimized?: boolean;
}) {
  const t = propertyEditorMessages(locale);
  const [index, setIndex] = useState(0);
  const touch = useRef<number | null>(null);
  const active = Math.min(index, images.length - 1);
  function move(direction: number) { setIndex((value) => (value + direction + images.length) % images.length); }
  if (!images.length) return null;
  return <section className="property-gallery" aria-label={t.photos} aria-roledescription="carousel" onKeyDown={(event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
  }}>
    <div className="property-gallery-main" onTouchStart={(event) => { touch.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const end = event.changedTouches[0]?.clientX;
        if (touch.current !== null && end !== undefined && Math.abs(end - touch.current) > 50) move(end < touch.current ? 1 : -1);
        touch.current = null;
      }}>
      <Image className="property-detail-image" src={images[active]} unoptimized={unoptimized} alt={`${title} · ${t.photo} ${active + 1}`}
        width={1200} height={1000} sizes="(max-width: 760px) 100vw, 85vw" preload={active === 0} />
      {images.length > 1 && <div className="property-gallery-controls">
        <button type="button" aria-label={t.previous} onClick={() => move(-1)}>←</button>
        <span role="status" aria-live="polite">{active + 1} / {images.length}</span>
        <button type="button" aria-label={t.next} onClick={() => move(1)}>→</button>
      </div>}
    </div>
    {images.length > 1 && <div className="property-photo-gallery">
      {images.map((src, photoIndex) => <button key={src} type="button" aria-label={`${t.photo} ${photoIndex + 1}`}
        aria-pressed={photoIndex === active} onClick={() => setIndex(photoIndex)}>
        <Image src={src} alt="" unoptimized={unoptimized} width={180} height={120} sizes="140px" />
      </button>)}
    </div>}
  </section>;
}
