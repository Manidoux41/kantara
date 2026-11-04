import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

test("root redirects to English without redirecting API routes", async () => {
  const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")!, baseUrl).pathname, "/en");
  assert.equal((await fetch(`${baseUrl}/api/v1/health`, { redirect: "manual" })).status, 200);
});

test("all seven public routes render their locale, translated content and alternate links", async () => {
  for (const locale of ["en", "fr", "km", "zh", "ja", "de", "es"]) {
    const response = await fetch(`${baseUrl}/${locale}`);
    assert.equal(response.status, 200, locale);
    const html = await response.text();
    assert.ok(html.includes(`<html lang="${locale}"`), locale);
    assert.ok(html.includes("KANTARA"));
    assert.ok(!html.includes("Create Next App"));
    const messages = JSON.parse(await readFile(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
    assert.ok(html.includes(messages.Home.title), locale);
    assert.ok(html.includes(messages.Preview.heroTitle), locale);
    assert.ok(html.includes(messages.Preview.banner), locale);
    assert.equal((html.match(/class="property-card"/g) ?? []).length, 6, locale);
    assert.match(html, /hreflang="fr"/i);
    assert.match(html, /aria-current="page"/);
  }
});

test("original demo illustrations are served locally", async () => {
  for (const image of ["khmer-residence", "khmer-courtyard", "river-apartment"]) {
    const response = await fetch(`${baseUrl}/images/${image}.svg`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/);
    const body = await response.text();
    assert.ok(body.startsWith("<svg"));
    assert.ok(!body.includes("<script"));
  }
});

test("unknown locales and unimplemented admin pages are not exposed", async () => {
  assert.equal((await fetch(`${baseUrl}/it`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/admin`)).status, 404);
});

test("isolated administration previews render in all seven languages and are not indexed", async () => {
  for (const locale of ["en", "fr", "km", "zh", "ja", "de", "es"]) {
    const response = await fetch(`${baseUrl}/${locale}/demo/admin`);
    assert.equal(response.status, 200, locale);
    const html = await response.text();
    const messages = JSON.parse(await readFile(new URL(`../../messages/admin/${locale}.json`, import.meta.url), "utf8"));
    assert.ok(html.includes(messages.modules.dashboard), locale);
    assert.ok(html.includes(messages.notice), locale);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.ok(html.includes(`href="/${locale}"`));
    if (process.env.TEST_DEMO_API === "true") assert.ok(html.includes('class="business-workspace"'), locale);
    else assert.equal((html.match(/class="admin-kpi"/g) ?? []).length, 4);
  }
  assert.equal((await fetch(`${baseUrl}/fr/admin`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/it/demo/admin`)).status, 404);
});

test("HTTP API validates inputs and exposes consistent error envelopes", async () => {
  for (const path of [
    "/api/v1/properties?pageSize=51",
    "/api/v1/properties?status=DRAFT",
    "/api/v1/properties?locale=en&locale=fr",
    "/api/v1/properties/bad_slug",
    "/api/v1/properties/villa?locale=xx",
    "/api/v1/properties?minRooms=4&maxRooms=3",
    "/api/v1/properties?minArea=300&maxArea=200",
    "/api/v1/properties?sort=priceAsc",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 400, path);
    const body = await response.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.equal(typeof body.requestId, "string");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("public API does not accept unauthenticated writes", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await fetch(`${baseUrl}/api/v1/properties`, { method });
    assert.equal(response.status, 405, method);
  }
});

test("unconfigured database is explicitly reported", {
  skip: process.env.TEST_DATABASE_UNCONFIGURED !== "true",
}, async () => {
  for (const path of [
    "/api/v1/properties", "/api/v1/properties/villa",
    "/api/v1/properties?location=Kampot&minArea=100&maxArea=300&minBedrooms=2&maxRooms=6&sort=roomsDesc",
    "/api/v1/properties?transactionType=RENT&sort=priceAsc",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "DATABASE_NOT_CONFIGURED");
  }
});
