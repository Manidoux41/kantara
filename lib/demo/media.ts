export const mediaLimits = {
  photo: { count: 20, bytes: 10 * 1024 * 1024 },
  document: { count: 10, bytes: 20 * 1024 * 1024 },
} as const;
export type MediaKind = keyof typeof mediaLimits;
export type MediaError = "count" | "size" | "format" | "duplicate" | "read" | "decode";

export class LocalMediaError extends Error {
  constructor(public readonly code: MediaError, public readonly filename = "") {
    super(code);
  }
}

export function fileKey(file: Pick<File, "name" | "size" | "lastModified">) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export async function validateMediaBatch(kind: MediaKind, existingKeys: readonly string[], files: readonly File[]) {
  if (existingKeys.length + files.length > mediaLimits[kind].count) throw new LocalMediaError("count");
  const keys = new Set(existingKeys);
  for (const file of files) {
    if (keys.has(fileKey(file))) throw new LocalMediaError("duplicate", file.name);
    keys.add(fileKey(file));
    if (file.size === 0 || file.size > mediaLimits[kind].bytes) throw new LocalMediaError("size", file.name);
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const text = (start: number, end: number) => String.fromCharCode(...header.slice(start, end));
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    const valid = kind === "document"
      ? file.type === "application/pdf" && extension === "pdf" && text(0, 5) === "%PDF-"
      : (file.type === "image/jpeg" && (extension === "jpg" || extension === "jpeg") && header[0] === 255 && header[1] === 216 && header[2] === 255)
        || (file.type === "image/png" && extension === "png" && text(1, 4) === "PNG" && header[0] === 137 && header[4] === 13 && header[5] === 10 && header[6] === 26 && header[7] === 10)
        || (file.type === "image/webp" && extension === "webp" && text(0, 4) === "RIFF" && text(8, 12) === "WEBP");
    if (!valid) throw new LocalMediaError("format", file.name);
  }
}
