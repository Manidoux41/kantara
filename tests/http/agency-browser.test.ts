import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { baseUrl, enabled } from "../helpers/agency-http";
import { testIdentity } from "../helpers/team-fixtures";
import { employmentExample } from "../../lib/team/examples";
import { locales } from "../../lib/i18n/routing";
test("browser production: real login, dashboard, persisted client, empty real catalogue, logout and no demo login", { skip: !enabled, timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.PDF_CHROMIUM_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/fr/admin`);
    const login = page.locator(".team-login");
    await login.waitFor();
    assert.deepEqual(await login.evaluate((element) => {
      const style = getComputedStyle(element);
      return { display: style.display, border: style.borderTopWidth, maxWidth: style.maxWidth };
    }), { display: "grid", border: "1px", maxWidth: "680px" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await login.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= document.documentElement.clientWidth;
    }), "The styled login form must fit a mobile viewport");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('input[name="login"]').fill(process.env.ADMIN_EMAIL!);
    await page.locator('input[name="password"]').fill("Intentionally-wrong-validation-password");
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await page.locator(".team-error").waitFor();
    await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await page.locator(".business-tabs").waitFor();
    assert.doesNotMatch(await page.locator("body").innerText(), /\bficti\w*|\bdemo\b|démonstration|brouillon/iu);
    assert.equal(await page.locator(".business-tabs").evaluate((element) => getComputedStyle(element).display), "flex");
    await page.locator(".business-kpis").first().waitFor();
    const kpiDisplays = await page.locator(".business-kpis").evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).display));
    assert.ok(kpiDisplays.length > 0 && kpiDisplays.every((display) => display === "grid"));
    await page.locator(".business-tabs").getByRole("button", { name: "Clients", exact: true }).click();
    const form = page.locator(".business-form").filter({ has: page.getByRole("heading", { name: "Nouveau client", exact: true }) });
    await form.locator('[name="name"]').fill("BROWSER VALIDATION CLIENT");
    await form.locator('[name="address"]').fill("TEST ADDRESS");
    await form.locator('[name="identityReference"]').fill("BROWSER-TEST-ID");
    await form.locator('[name="nationality"]').fill("TEST");
    await form.getByRole("button", { name: "Créer le client", exact: true }).click();
    await page.getByRole("heading", { name: /BROWSER VALIDATION CLIENT/ }).waitFor();
    await page.getByRole("button", { name: "Embauche et comptes", exact: true }).click();
    await page.getByText("Nouveau candidat", { exact: true }).click();
    const candidateForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer le dossier candidat", exact: true }) });
    await candidateForm.locator('[name="name"]').fill("BROWSER HIRING VALIDATION");
    await candidateForm.locator('[name="address"]').fill("TEST ADDRESS");
    await candidateForm.locator('[name="identityReference"]').fill("TEST-ID");
    await candidateForm.getByRole("button").click();
    await page.getByRole("button", { name: "BROWSER HIRING VALIDATION · À vérifier", exact: true }).click();
    const dossier = page.locator(".team-dossier");
    await dossier.locator('input[type="file"]').setInputFiles({
      name: testIdentity.name, mimeType: testIdentity.mime, buffer: Buffer.from(testIdentity.base64, "base64"),
    });
    await dossier.getByRole("button", { name: "Téléverser", exact: true }).click();
    const preview = dossier.locator(".team-document-preview");
    await preview.waitFor();
    await page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>(".team-document-preview");
      return image?.complete && image.naturalWidth > 0;
    });
    await dossier.getByRole("button", { name: "Valider la pièce", exact: true }).click();
    await dossier.locator("summary").filter({ hasText: "Contrat de travail" }).click();
    for (const [key, value] of Object.entries(employmentExample)) {
      await dossier.locator(`.team-contract-form [name="${key}"]`).fill(String(value));
    }
    await dossier.getByRole("button", { name: "Générer le contrat de travail", exact: true }).click();
    const pdfLink = dossier.getByRole("link", { name: "Télécharger · EN–KM PDF", exact: true });
    const downloaded = page.waitForEvent("download");
    await pdfLink.click();
    const download = await downloaded;
    assert.equal(await download.failure(), null);
    const stream = await download.createReadStream();
    assert.ok(stream);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).subarray(0, 5).toString(), "%PDF-");
    await download.delete();
    await page.route("**/api/agency/team/employment/*", (route) => route.fulfill({
      status: 503, contentType: "application/json",
      body: JSON.stringify({ error: { code: "PDF_BUSY", message: "PDF generation is busy. Please retry." } }),
    }));
    await pdfLink.click();
    await page.locator(".team-error").filter({ hasText: "PDF_BUSY" }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/fr/admin");
    await page.unroute("**/api/agency/team/employment/*");
    await page.reload(); await page.locator(".business-tabs").waitFor();
    await page.locator(".business-tabs").getByRole("button", { name: "Clients", exact: true }).click();
    await page.getByRole("heading", { name: /BROWSER VALIDATION CLIENT/ }).waitFor();
    await page.getByRole("button", { name: "Se déconnecter", exact: true }).click();
    await page.getByRole("button", { name: "Se connecter", exact: true }).waitFor();
    assert.equal(await page.locator(".business-tabs").count(), 0);
    for (const locale of locales) {
      await page.goto(`${baseUrl}/${locale}`);
      await page.locator("#catalogue-heading").waitFor();
      assert.equal(await page.locator(".property-card").count(), 0);
      assert.equal(await page.locator(".preview-banner").count(), 0);
      assert.equal(await page.locator(`a[href="/${locale}/admin"]`).count(), 1);
      assert.doesNotMatch(await page.locator("body").innerText(), /\bficti\w*|\bdemo\b|démonstration|prototype|brouillon|虚构|演示|架空|デモ/iu);
    }
    for (const topic of ["legal", "privacy", "terms", "fees", "cambodia"]) {
      await page.goto(`${baseUrl}/fr/information/${topic}`);
      assert.doesNotMatch(await page.locator("body").innerText(), /\bficti\w*|\bdemo\b|démonstration|prototype|brouillon/iu);
    }
    for (const path of ["/fr/demo/admin", "/fr/demo/team", "/fr/properties/DEMO-001"]) {
      assert.equal((await page.request.get(`${baseUrl}${path}`)).status(), 404);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
