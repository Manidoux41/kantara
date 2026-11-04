import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright-core";
import { interfaceMessages } from "../../lib/i18n/interface";
import { locales } from "../../lib/i18n/routing";

const executablePath = process.env.PDF_CHROMIUM_PATH ?? [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
].find(existsSync);
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("browser: localized favorites, grid/list, dialog state, combined search and keyboard actions", {
  skip: !executablePath, timeout: 90000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const locale of locales) {
      const ui = interfaceMessages(locale);
      await page.goto(`${baseUrl}/${locale}`);
      const cards = page.locator(".property-card");
      await cards.first().waitFor();
      assert.equal(await cards.count(), 6);
      const favorite = cards.first().locator(".favorite-button");
      await favorite.focus();
      await favorite.press("Space");
      assert.equal(await favorite.getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: ui.list, exact: true }).click();
      assert.equal(await page.locator(".property-list-view").count(), 1);
      await page.locator(".favorites-filter").click();
      assert.equal(await cards.count(), 1);
      await cards.first().locator(".detail-button").click();
      const dialog = page.locator("dialog[open]");
      await dialog.waitFor();
      assert.equal(await dialog.locator(".favorite-button").getAttribute("aria-pressed"), "true");
      await dialog.locator(".favorite-button").click();
      await dialog.press("Escape");
      await page.locator(".empty-results").waitFor();
      assert.equal(await cards.count(), 0);
      assert.equal(await page.locator(".favorites-filter").evaluate((node) => node === document.activeElement), true);
      assert.equal(await page.getByRole("heading", { name: ui.favoritesEmpty, exact: true }).count(), 1);
      await page.locator(".empty-results button").click();
      assert.equal(await cards.count(), 6);
      assert.equal(await page.locator(".favorites-filter").getAttribute("aria-pressed"), "false");
      await page.getByRole("button", { name: ui.grid, exact: true }).click();
      assert.equal(await page.locator(".property-list-view").count(), 0);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.getByRole("button", { name: ui.list, exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, locale);
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await page.goto(`${baseUrl}/fr`);
    await page.locator(".property-card").first().locator(".favorite-button").click();
    await page.getByRole("combobox", { name: "Destination", exact: true }).selectOption("kampot");
    await page.locator(".advanced-property-search button[type=submit]").click();
    await page.locator(".favorites-filter").click();
    await page.locator(".empty-results").waitFor();
    await page.locator(".advanced-property-search button[type=button]").click();
    assert.equal(await page.locator(".property-card").count(), 6);
    assert.equal(await page.locator(".favorites-filter").getAttribute("aria-pressed"), "false");
    assert.equal(await page.locator(".property-card .favorite-button[aria-pressed=true]").count(), 1);
    await page.reload();
    await page.locator(".property-card").first().waitFor();
    assert.equal(await page.locator(".favorite-button[aria-pressed=true]").count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("browser: administrative quick access and production preview do not expose dead CRM actions", {
  skip: !executablePath, timeout: 30000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/fr/demo/admin`);
    if (process.env.TEST_DEMO_API === "true") {
      const quick = page.getByRole("navigation", { name: "Accès rapide", exact: true });
      await quick.waitFor();
      await quick.getByRole("button", { name: "Accès rapide — Clients", exact: true }).click();
      await page.locator('input[name="identityReference"]').waitFor();
      await page.locator(".business-tabs").getByRole("button", { name: "Synthèse", exact: true }).click();
      await quick.waitFor();
      await quick.getByRole("button", { name: "Accès rapide — Agenda", exact: true }).click();
      await page.locator(".crm-calendar").waitFor();
      assert.equal(await page.locator('.crm-calendar button[aria-current="date"]').count(), 1);
      await page.locator(".business-tabs button").first().click();
      await page.locator(".business-kpis > button").first().click();
      await page.getByRole("heading", { name: "Clôturer une transaction", exact: true }).waitFor();
    } else {
      await page.locator(".admin-deployment-notice").waitFor();
      assert.equal(await page.getByRole("button", { name: "Gestion API locale", exact: true }).count(), 0);
      await page.locator(".admin-kpi").first().click();
      await page.locator(".admin-table").waitFor();
      assert.equal(await page.locator('.admin-sidebar button[aria-current="page"]').innerText(), "Biens immobiliers");
    }
  } finally { await browser.close(); }
});

test("browser: colorful controls preserve rendered contrast, focus visibility and reduced motion", {
  skip: !executablePath, timeout: 30000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    await page.goto(`${baseUrl}/fr`);
    const favorite = page.locator(".favorite-button").first();
    await favorite.focus();
    const outline = await favorite.evaluate((node) => getComputedStyle(node).outlineStyle);
    assert.notEqual(outline, "none");
    await favorite.click();
    await page.locator(".favorites-filter").click();
    const ratios = await page.locator(".favorite-button, .listing-badge, .catalogue-display button[aria-pressed=true]").evaluateAll((nodes) => {
      return nodes.map((node) => {
        const style = getComputedStyle(node);
        const values = [style.color, style.backgroundColor].map((color) => {
          const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
            const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
          });
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        }).sort((a, b) => b - a);
        return (values[0] + .05) / (values[1] + .05);
      });
    });
    assert.ok(ratios.length >= 3);
    for (const ratio of ratios) assert.ok(ratio >= 4.5, `Rendered contrast ${ratio}`);
    const image = page.locator(".property-art img").first();
    await image.hover();
    assert.equal(await image.evaluate((node) => getComputedStyle(node).transform), "none");
    await page.locator(".detail-button").first().click();
    const dialog = page.locator("dialog[open]");
    await dialog.waitFor();
    assert.equal(await dialog.evaluate((node) => getComputedStyle(node).animationName), "none");
    await dialog.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
  } finally { await browser.close(); }
});
