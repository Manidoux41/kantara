import assert from "node:assert/strict";
import test from "node:test";
import { fileKey, LocalMediaError, mediaLimits, validateMediaBatch } from "../lib/demo/media";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const photo = (index: number) => new File([png], `photo-${index}.png`, { type: "image/png", lastModified: 1 });
const pdf = (index: number) => new File(["%PDF-1.7\n"], `doc-${index}.pdf`, { type: "application/pdf", lastModified: 1 });
const isError = (code: string) => (error: unknown) => error instanceof LocalMediaError && error.code === code;

test("exact photo threshold: 20 accepted, 21 rejected including accumulated selections", async () => {
  const files = Array.from({ length: 20 }, (_, index) => photo(index));
  await validateMediaBatch("photo", [], files);
  await assert.rejects(validateMediaBatch("photo", [], [...files, photo(20)]), isError("count"));
  await validateMediaBatch("photo", files.slice(0, 19).map(fileKey), [photo(19)]);
  await assert.rejects(validateMediaBatch("photo", files.map(fileKey), [photo(20)]), isError("count"));
  await assert.rejects(validateMediaBatch("photo", files.slice(0, 19).map(fileKey), [photo(20), photo(21)]), isError("count"));
  // Another property has its own independent selection, and removal frees a slot.
  await validateMediaBatch("photo", [], [photo(20)]);
  await validateMediaBatch("photo", files.slice(0, 19).map(fileKey), [photo(20)]);
});

test("exact PDF threshold: 10 accepted, 11 rejected and accumulation is bounded", async () => {
  const files = Array.from({ length: 10 }, (_, index) => pdf(index));
  await validateMediaBatch("document", [], files);
  await assert.rejects(validateMediaBatch("document", [], [...files, pdf(10)]), isError("count"));
  await assert.rejects(validateMediaBatch("document", files.map(fileKey), [pdf(10)]), isError("count"));
});

test("file-size boundaries accept exact maxima and reject one byte more and empty files", async () => {
  for (const kind of ["photo", "document"] as const) {
    const header = kind === "photo" ? png : new TextEncoder().encode("%PDF-1.7\n");
    const name = kind === "photo" ? "test.png" : "test.pdf";
    const type = kind === "photo" ? "image/png" : "application/pdf";
    const bytes = mediaLimits[kind].bytes;
    await validateMediaBatch(kind, [], [new File([header, new Uint8Array(bytes - header.length)], name, { type })]);
    await assert.rejects(validateMediaBatch(kind, [], [
      new File([header, new Uint8Array(bytes - header.length + 1)], name, { type }),
    ]), isError("size"));
    await assert.rejects(validateMediaBatch(kind, [], [new File([], name, { type })]), isError("size"));
  }
});

test("formats require matching MIME, extension and signature; SVG and disguised files are rejected", async () => {
  await validateMediaBatch("photo", [], [
    new File([new Uint8Array([255, 216, 255, 224])], "a.JPG", { type: "image/jpeg" }),
    new File(["RIFF1234WEBP"], "b.webp", { type: "image/webp" }),
  ]);
  for (const file of [
    new File(["<svg />"], "bad.svg", { type: "image/svg+xml" }),
    new File(["not an image"], "bad.png", { type: "image/png" }),
    new File([png], "bad.pdf", { type: "image/png" }),
    new File([png], "bad.png", { type: "application/octet-stream" }),
  ]) await assert.rejects(validateMediaBatch("photo", [], [file]), isError("format"));
  await assert.rejects(validateMediaBatch("document", [], [
    new File(["<script>"], "bad.pdf", { type: "application/pdf" }),
  ]), isError("format"));
  await assert.rejects(validateMediaBatch("photo", [], [photo(1), pdf(1)]), isError("format"));
});

test("duplicates are rejected both within a batch and across batches", async () => {
  await assert.rejects(validateMediaBatch("photo", [], [photo(1), photo(1)]), isError("duplicate"));
  await assert.rejects(validateMediaBatch("photo", [fileKey(photo(1))], [photo(1)]), isError("duplicate"));
});
