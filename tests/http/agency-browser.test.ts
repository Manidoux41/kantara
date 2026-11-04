import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { baseUrl, enabled } from "../helpers/agency-http";
test("browser production: real login, dashboard, persisted client, empty real catalogue, logout and no demo login", { skip: !enabled, timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.PDF_CHROMIUM_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/fr/admin`);
    await page.locator('input[name="login"]').fill(process.env.ADMIN_EMAIL!);
    await page.locator('input[name="password"]').fill("Intentionally-wrong-validation-password");
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await page.locator(".team-error").waitFor();
    await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await page.locator(".business-tabs").waitFor();
    await page.locator(".business-tabs").getByRole("button", { name: "Clients", exact: true }).click();
    const form = page.locator(".business-form").filter({ has: page.getByRole("heading", { name: "Nouveau client", exact: true }) });
    await form.locator('[name="name"]').fill("BROWSER VALIDATION CLIENT");
    await form.locator('[name="address"]').fill("TEST ADDRESS");
    await form.locator('[name="identityReference"]').fill("BROWSER-TEST-ID");
    await form.locator('[name="nationality"]').fill("TEST");
    await form.getByRole("button", { name: "Créer le client", exact: true }).click();
    await page.getByRole("heading", { name: /BROWSER VALIDATION CLIENT/ }).waitFor();
    await page.reload(); await page.locator(".business-tabs").waitFor();
    await page.locator(".business-tabs").getByRole("button", { name: "Clients", exact: true }).click();
    await page.getByRole("heading", { name: /BROWSER VALIDATION CLIENT/ }).waitFor();
    await page.getByRole("button", { name: "Se déconnecter", exact: true }).click();
    await page.getByRole("button", { name: "Se connecter", exact: true }).waitFor();
    assert.equal(await page.locator(".business-tabs").count(), 0);
    await page.goto(`${baseUrl}/fr`);
    await page.locator("#catalogue-heading").waitFor();
    assert.equal(await page.locator(".property-card").count(), 0);
    assert.equal(await page.locator(".preview-banner").count(), 0);
    assert.equal(await page.locator('a[href="/fr/admin"]').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
