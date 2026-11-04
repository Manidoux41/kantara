import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright-core";

const executablePath = process.env.PDF_CHROMIUM_PATH ?? [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
].find(existsSync);
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("browser: owner, property, linked buyer, bilingual PDF download, closing, receipt and public sold filter", {
  skip: process.env.TEST_DEMO_API !== "true" || !executablePath,
  timeout: 120000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/fr/demo/admin`);
    const entry = page.getByRole("button", { name: "Gestion API locale", exact: true });
    if (await entry.isVisible()) await entry.click();
    await page.getByRole("button", { name: "Clients", exact: true }).click();
    const fill = async (values: Record<string, string>) => {
      for (const [name, value] of Object.entries(values)) await page.locator(`.business-workspace [name="${name}"]`).fill(value);
    };
    await fill({ name: "Proprietaire BROWSER DEMO", address: "Adresse fictive", identityReference: "TEST-BROWSER", nationality: "KH DEMO" });
    await page.locator('[name="role"]').selectOption("OWNER");
    await page.getByRole("button", { name: "Créer le client", exact: true }).click();
    await page.getByRole("heading", { name: "Proprietaire BROWSER DEMO · Propriétaire", exact: true }).waitFor();
    await page.getByRole("button", { name: "Biens", exact: true }).click();
    await fill({ title: "Villa BROWSER DEMO", address: "Adresse fictive", titleReference: "TITRE-BROWSER", price: "250000", area: "150", bedrooms: "3", rooms: "5", bathrooms: "2" });
    await page.locator('[name="ownerId"]').selectOption({ label: "Proprietaire BROWSER DEMO" });
    await page.locator('[name="location"]').selectOption("kampot");
    await page.locator('[name="type"]').selectOption("villa");
    await page.getByRole("button", { name: "Créer le bien en brouillon", exact: true }).click();
    const property = page.locator(".business-list article").filter({ has: page.getByRole("heading", { name: "Villa BROWSER DEMO", exact: true }) });
    await property.getByRole("button", { name: "Publier l’annonce", exact: true }).click();
    await property.getByText("Publié", { exact: true }).waitFor();

    await page.getByRole("button", { name: "Clients", exact: true }).click();
    await fill({ name: "Acquereur BROWSER DEMO", address: "Adresse fictive", identityReference: "TEST-BUYER", nationality: "DEMO" });
    await page.locator('[name="role"]').selectOption("BUYER");
    await page.getByRole("button", { name: "Créer le client", exact: true }).click();
    const buyer = page.locator(".business-list article").filter({ has: page.getByRole("heading", { name: "Acquereur BROWSER DEMO · Acquéreur", exact: true }) });
    await buyer.getByRole("checkbox", { name: "Villa BROWSER DEMO", exact: true }).check();
    await buyer.getByRole("checkbox", { name: "KANTARA DEMO — lotus", exact: true }).check();
    await buyer.getByRole("button", { name: "Enregistrer les liens", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Modifications fictives enregistrées" }).waitFor();
    assert.equal(await buyer.getByRole("checkbox", { name: "Villa BROWSER DEMO", exact: true }).isChecked(), true);
    assert.equal(await buyer.getByRole("checkbox", { name: "KANTARA DEMO — lotus", exact: true }).isChecked(), true);

    await page.getByRole("button", { name: "Mandats et baux", exact: true }).click();
    await page.getByRole("combobox", { name: "Propriétaire", exact: true }).selectOption({ label: "Proprietaire BROWSER DEMO" });
    await page.getByRole("checkbox", { name: "Villa BROWSER DEMO", exact: true }).check();
    await fill({
      agencyAddress: "Adresse fictive agence", agencyRegistration: "AGENCE-BROWSER", signedPlace: "Kampot",
      endDate: `${new Date().getUTCFullYear() + 1}-12-31`, permittedUse: "Commercialisation fictive de demonstration",
      commissionTerms: "Commission fictive due a la cloture, a valider juridiquement.",
      terms: "Conditions fictives a faire valider par un juriste cambodgien avant toute utilisation.",
    });
    await page.locator('input[name^="commission-"]').fill("1250.50");
    await page.getByRole("button", { name: "Créer le brouillon lié", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Générer le PDF bilingue", exact: true }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^kantara-draft-.*\.pdf$/);
    assert.equal(await download.failure(), null);
    const stream = await download.createReadStream();
    assert.ok(stream);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const pdf = Buffer.concat(chunks);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 20000);
    await download.delete();

    await page.getByRole("button", { name: "Revenus", exact: true }).click();
    await page.getByRole("button", { name: "Confirmer la clôture fictive", exact: true }).click();
    await page.getByRole("button", { name: "Enregistrer l’encaissement", exact: true }).waitFor();
    await fill({ amount: "500.25", reference: "BROWSER-PARTIAL" });
    await page.getByRole("button", { name: "Enregistrer l’encaissement", exact: true }).click();
    await page.getByText(/500\.25 USD · BROWSER-PARTIAL/).waitFor();
    const kpis = await page.locator(".business-kpis strong").allTextContents();
    assert.deepEqual(kpis, ["0.00 USD", "1250.50 USD", "500.25 USD", "750.25 USD"]);

    await page.getByRole("button", { name: "Biens", exact: true }).click();
    const filters = page.locator(".business-workspace .advanced-property-search");
    await filters.getByRole("combobox", { name: "Disponibilité", exact: true }).selectOption("SOLD");
    await filters.getByRole("combobox", { name: "Publication", exact: true }).selectOption("PUBLISHED");
    await filters.getByRole("combobox", { name: "Destination", exact: true }).selectOption("kampot");
    for (const [name, value] of Object.entries({ minPrice: "250000", maxPrice: "250000", minArea: "150", maxArea: "150", minBedrooms: "3", maxBedrooms: "3", minRooms: "5", maxRooms: "5" })) {
      await filters.locator(`[name="${name}"]`).fill(value);
    }
    await filters.locator("select").last().selectOption("publishedAsc");
    await filters.getByRole("button", { name: "Rechercher", exact: true }).click();
    assert.equal(await page.locator(".business-list article").count(), 1);
    await property.getByText("Vendu", { exact: true }).waitFor();
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Administration overflows at ${width}px`);
    }
    await page.goto(`${baseUrl}/fr`);
    await page.getByRole("heading", { name: "Villa BROWSER DEMO", exact: true }).waitFor();
    const publicCard = page.locator(".property-card").filter({ has: page.getByRole("heading", { name: "Villa BROWSER DEMO", exact: true }) });
    await publicCard.getByText("Vendu", { exact: true }).waitFor();
    await page.getByRole("combobox", { name: "Disponibilité", exact: true }).selectOption("SOLD");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    assert.equal(await page.locator(".property-card").count(), 1);
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Catalogue overflows at ${width}px`);
    }
    await page.setViewportSize({ width: 375, height: 900 });
    for (const locale of ["en", "fr", "km", "zh", "ja", "de", "es"]) {
      const labels: Record<string, string> = JSON.parse(await readFile(new URL(`../../messages/business/${locale}.json`, import.meta.url), "utf8"));
      await page.goto(`${baseUrl}/${locale}/demo/admin`);
      const entry = page.getByRole("button", { name: labels.entry, exact: true });
      if (await entry.isVisible()) await entry.click();
      await page.locator(".business-kpis strong").first().waitFor();
      for (const tab of ["clients", "properties", "contracts", "finance"]) {
        await page.locator(".business-tabs").getByRole("button", { name: labels[tab], exact: true }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${locale}/${tab} overflows at 375px`);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
