import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright-core";
import { propertyMessages } from "../../lib/i18n/property";
import { locales } from "../../lib/i18n/routing";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const executablePath = process.env.PDF_CHROMIUM_PATH ?? [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome",
].find(existsSync);
const tile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");

test("browser: consent-gated free map follows search and favorites, marker opens deep-linked details, seven languages and mobile remain usable", {
  skip: !executablePath, timeout: 120000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let tiles = 0;
    await page.route("https://tile.openstreetmap.org/**", async (route) => {
      tiles++; await route.fulfill({ contentType: "image/png", body: tile });
    });
    await page.goto(`${baseUrl}/fr`);
    await page.locator(".property-card").first().waitFor();
    await page.getByRole("button", { name: "Carte", exact: true }).click();
    assert.equal(tiles, 0);
    assert.equal(await page.locator(".map-property-list a").count(), 6);
    await page.getByRole("button", { name: propertyMessages("fr").loadMap, exact: true }).click();
    await page.locator(".map-property-cluster").first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>(".leaflet-tile")].some((image) => image.complete));
    assert.ok(tiles > 0);
    assert.equal(await page.locator(".map-property-cluster").count(), 3);
    await page.locator(".map-property-cluster").first().click();
    assert.equal(await page.locator(".map-popup-link").count(), 2);
    assert.ok(await page.locator(".leaflet-control-attribution").innerText().then((text) => text.includes("OpenStreetMap")));
    await page.getByRole("combobox", { name: "Destination", exact: true }).selectOption("siem-reap");
    await page.locator(".advanced-property-search button[type=submit]").click();
    await page.waitForFunction(() => document.querySelectorAll(".map-property-link").length === 2);
    assert.equal(await page.locator(".map-property-link").first().evaluate((element) => getComputedStyle(element).color), "rgb(255, 255, 255)");
    assert.equal(await page.locator(".map-property-list a").count(), 2);
    const marker = page.locator('.map-property-link[href="/fr/properties/DEMO-001"]');
    await marker.focus(); await marker.press("Enter");
    await page.waitForURL("**/fr/properties/DEMO-001");
    await page.getByRole("heading", { name: "La villa des lotus", exact: true }).waitFor();
    await page.locator("#contact-agent").waitFor();
    assert.equal(await page.locator(".dialog-facts dd").count(), 4);
    assert.ok(await page.locator("main").innerText().then((text) => text.includes("240 m²")));
    await page.reload();
    await page.getByRole("heading", { name: "La villa des lotus", exact: true }).waitFor();
    await page.locator(".language-menu summary").click();
    await page.locator('.language-options a[lang="km"]').click();
    await page.waitForURL("**/km/properties/DEMO-001");
    for (const locale of locales) {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${baseUrl}/${locale}/properties/DEMO-001`);
      await page.locator("#contact-agent").waitFor();
      assert.equal(await page.getByRole("heading", { name: propertyMessages(locale).contact, exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, locale);
      assert.equal(await page.locator('meta[name=robots]').getAttribute("content"), "noindex, nofollow");
    }
    await page.goto(`${baseUrl}/fr`);
    await page.locator(".property-card").first().locator(".favorite-button").click();
    await page.locator(".favorites-filter").click();
    await page.getByRole("button", { name: "Carte", exact: true }).click();
    assert.equal(await page.locator(".map-property-list a").count(), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("browser: map tile failure leaves explicit error and usable property links", { skip: !executablePath, timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
    await page.goto(`${baseUrl}/fr/properties/DEMO-001`);
    await page.getByRole("button", { name: propertyMessages("fr").loadMap, exact: true }).click();
    await page.getByRole("alert").filter({ hasText: propertyMessages("fr").mapError }).waitFor();
    assert.equal(await page.locator(".map-property-list a").getAttribute("href"), "/fr/properties/DEMO-001");
  } finally { await browser.close(); }
});

test("browser: contact form preserves input on send failure and distinguishes provider acceptance from a booked visit (mocked providers)", {
  skip: !executablePath, timeout: 45000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let posts = 0, scripts = 0;
    const references: string[] = [];
    await page.route("**/api/**/inquiries?**", (route) => route.fulfill({ json: {
      data: { enabled: true, siteKey: "fictional-test-site-key", agentName: "AGENT CONTACT DEMO" },
    } }));
    await page.route("https://challenges.cloudflare.com/turnstile/**", (route) => {
      scripts++;
      return route.fulfill({ contentType: "application/javascript", body:
        "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('fictional-test-token')},10);return 'test-widget'},remove:function(){}};" });
    });
    await page.route(/\/api\/(?:demo|v1)\/inquiries$/, async (route) => {
      posts++;
      const body = route.request().postDataJSON();
      references.push(body.requestId);
      assert.equal(body.propertyId, "DEMO-001");
      assert.equal(body.consent, true);
      assert.equal(body.recipient, undefined);
      assert.equal(body.turnstileToken, "fictional-test-token");
      assert.equal(body.preferredDate, "2099-01-01");
      await route.fulfill({ status: posts === 1 ? 502 : 200,
        json: posts === 1 ? { error: { code: "EMAIL_UNAVAILABLE", message: "Fictional provider outage" } }
          : { data: { id: body.requestId, delivery: "ACCEPTED" } } });
    });
    await page.goto(`${baseUrl}/fr/properties/DEMO-001`);
    await page.getByText("Agent en charge : AGENT CONTACT DEMO", { exact: true }).waitFor();
    assert.equal(scripts, 0);
    await page.getByLabel("Nom complet", { exact: true }).fill("VISITE TEST DEMO");
    await page.getByLabel("E-mail", { exact: true }).fill("visitor@example.test");
    await page.getByLabel("Téléphone (facultatif)", { exact: true }).fill("+855 00 000 000");
    await page.getByLabel("Date de visite souhaitée (facultative)", { exact: true }).fill("2099-01-01");
    await page.getByLabel("Votre message", { exact: true }).fill("Demande entièrement fictive pour tester le parcours de visite.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: propertyMessages("fr").verification, exact: true }).click();
    await page.getByRole("button", { name: "Envoyer à l’agent", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: propertyMessages("fr").error }).waitFor();
    assert.equal(await page.getByLabel("Nom complet", { exact: true }).inputValue(), "VISITE TEST DEMO");
    await page.getByRole("button", { name: propertyMessages("fr").verification, exact: true }).click();
    await page.getByRole("button", { name: "Envoyer à l’agent", exact: true }).click();
    await page.getByRole("status").filter({ hasText: propertyMessages("fr").accepted }).waitFor();
    assert.equal(posts, 2);
    assert.equal(references[0], references[1], "retries retain the submission reference");
    assert.equal(await page.locator(".inquiry-form").count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
