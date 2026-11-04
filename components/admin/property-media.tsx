"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { mediaLimits, type MediaKind } from "@/lib/demo/media";
import type { useLocalPropertyMedia } from "./use-local-property-media";

type Props = {
  propertyId: string;
  manager: ReturnType<typeof useLocalPropertyMedia>;
};

export function PropertyMedia({ propertyId, manager }: Props) {
  const t = useTranslations("PropertyTools");
  const items = manager.media[propertyId] ?? [];
  return (
    <section className="property-media" aria-label={t("mediaTitle")}>
      <h3>{t("mediaTitle")}</h3>
      <p className="local-media-notice">{t("localNotice")}</p>
      {(["photo", "document"] as const).map((kind: MediaKind) => {
        const files = items.filter((item) => item.kind === kind);
        return <div key={kind} className="media-group">
          <div className="media-group-heading"><h4>{t(kind)}</h4><span role="status">{files.length} / {mediaLimits[kind].count}</span></div>
          <label className="media-picker">
            <span>{t(kind === "photo" ? "addPhotos" : "addDocuments")}</span>
            <input type="file" multiple
              accept={kind === "photo" ? ".jpg,.jpeg,.png,.webp" : ".pdf"}
              disabled={manager.busy || files.length >= mediaLimits[kind].count}
              onChange={(event) => {
                const selectedFiles = Array.from(event.target.files ?? []);
                event.target.value = "";
                void manager.add(propertyId, kind, selectedFiles);
              }} />
          </label>
          <p className="media-help">{t(kind === "photo" ? "photoHelp" : "documentHelp")}</p>
          <ul className={kind === "photo" ? "local-photo-grid" : "local-document-list"}>
            {files.map((item) => <li key={item.id}>
              {kind === "photo" && item.url && <Image src={item.url} alt={item.name} width={160} height={120} unoptimized />}
              <span className="local-file-name">{item.name}</span>
              <span className="local-file-size">{Math.ceil(item.size / 1024)} KiB</span>
              <button type="button" disabled={manager.busy} className="text-button"
                onClick={() => manager.remove(propertyId, item.id)} aria-label={`${t("remove")} — ${item.name}`}>{t("remove")}</button>
            </li>)}
          </ul>
        </div>;
      })}
      {manager.busy && <p role="status">{t("checking")}</p>}
      {manager.issue?.propertyId === propertyId && <p className="tools-error" role="alert">
        {t(`errors.${manager.issue.code}`)} {manager.issue.filename}
      </p>}
    </section>
  );
}
