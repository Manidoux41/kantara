"use client";

import { useEffect, useRef, useState } from "react";
import { fileKey, LocalMediaError, validateMediaBatch, type MediaKind, type MediaError } from "@/lib/demo/media";

export type LocalMedia = { id: string; key: string; file: File; name: string; size: number; kind: MediaKind; url?: string };
export type LocalMediaIssue = { propertyId: string; code: MediaError; filename: string } | null;
type MediaStore = Record<string, LocalMedia[]>;

async function decodePhoto(url: string) {
  const image = new window.Image();
  image.src = url;
  await image.decode();
}

export function useLocalPropertyMedia() {
  const [media, setMedia] = useState<MediaStore>({});
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<LocalMediaIssue>(null);
  const store = useRef<MediaStore>({});
  const locked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const files of Object.values(store.current)) for (const item of files) {
        if (item.url) URL.revokeObjectURL(item.url);
      }
    };
  }, []);

  async function add(propertyId: string, kind: MediaKind, files: File[]) {
    if (!files.length || locked.current) return;
    locked.current = true;
    setBusy(true);
    setIssue(null);
    const created: LocalMedia[] = [];
    try {
      const current = store.current[propertyId] ?? [];
      await validateMediaBatch(kind, current.filter((item) => item.kind === kind).map((item) => item.key), files);
      for (const file of files) {
        const item: LocalMedia = {
          id: crypto.randomUUID(), key: fileKey(file), file, name: file.name,
          size: file.size, kind, url: kind === "photo" ? URL.createObjectURL(file) : undefined,
        };
        created.push(item);
        if (kind === "photo" && item.url) {
          try { await decodePhoto(item.url); }
          catch { throw new LocalMediaError("decode", file.name); }
        }
      }
      if (!mounted.current) {
        for (const item of created) if (item.url) URL.revokeObjectURL(item.url);
        return;
      }
      store.current = { ...store.current, [propertyId]: [...current, ...created] };
      setMedia(store.current);
    } catch (error) {
      for (const item of created) if (item.url) URL.revokeObjectURL(item.url);
      if (mounted.current) setIssue({
        propertyId,
        code: error instanceof LocalMediaError ? error.code : "read",
        filename: error instanceof LocalMediaError ? error.filename : "",
      });
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function remove(propertyId: string, id: string) {
    if (locked.current) return;
    const items = store.current[propertyId] ?? [];
    const removed = items.find((item) => item.id === id);
    if (removed?.url) URL.revokeObjectURL(removed.url);
    store.current = { ...store.current, [propertyId]: items.filter((item) => item.id !== id) };
    setMedia(store.current);
    setIssue(null);
  }

  return { media, busy, issue, add, remove };
}
