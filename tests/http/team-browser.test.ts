import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { chromium } from "playwright-core";
import { teamMessages } from "../../lib/i18n/team";
import { locales } from "../../lib/i18n/routing";
import { testAdminLogin, testAdminPassword, testAgentPassword, testIdentity } from "../helpers/team-fixtures";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const executablePath = process.env.PDF_CHROMIUM_PATH ?? [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome",
].find(existsSync);
test("browser: admin hires agent with mandatory ID and optional address absent, downloads EN–KM employment draft, agent signs in to assigned workspace", {
  skip: !executablePath || process.env.TEST_TEAM_API !== "true", timeout: 120000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 900 } });
    const page = await context.newPage(), agentPage = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message)); agentPage.on("pageerror", (error) => errors.push(error.message));
    const suffix = randomUUID().slice(0, 8), name = `AGENT BROWSER ${suffix} DEMO`, login = `agent.browser.${suffix}`;
    await page.goto(`${baseUrl}/fr/demo/team`);
    await page.getByLabel("Identifiant unique", { exact: true }).fill(testAdminLogin);
    await page.getByLabel("Mot de passe", { exact: true }).fill(testAdminPassword);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await page.getByRole("button", { name: "Embauche et comptes", exact: true }).click();
    await page.getByText("Nouveau candidat", { exact: true }).click();
    const candidateForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer le dossier candidat", exact: true }) });
    await candidateForm.getByLabel("Nom complet", { exact: true }).fill(name);
    await candidateForm.getByLabel("Adresse du domicile", { exact: true }).fill("DOMICILE FICTIF DEMO");
    await candidateForm.getByLabel("Référence identité / passeport", { exact: true }).fill("ID-FICTIVE-BROWSER");
    await candidateForm.getByRole("button").click();
    await page.getByRole("button", { name: `${name} · À vérifier`, exact: true }).click();
    const dossier = page.locator(".team-dossier");
    await dossier.locator('input[type=file]').setInputFiles({ name: "fictional-id.png", mimeType: "image/png", buffer: Buffer.from(testIdentity.base64, "base64") });
    await dossier.getByRole("button", { name: "Téléverser", exact: true }).click();
    await dossier.getByRole("button", { name: "Valider la pièce", exact: true }).click();
    await dossier.locator("summary").filter({ hasText: "Brouillon de CDI" }).click();
    await dossier.getByRole("button", { name: "Remplir avec un exemple fictif", exact: true }).click();
    await dossier.getByRole("button", { name: "Générer le brouillon de CDI", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await dossier.getByRole("link", { name: "Télécharger · EN–KM PDF", exact: true }).click();
    const download = await downloadPromise;
    assert.equal(await download.failure(), null);
    const stream = await download.createReadStream();
    assert.ok(stream);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).subarray(0, 5).toString(), "%PDF-");
    await download.delete();
    const activation = dossier.locator("form").filter({ has: page.getByRole("button", { name: "Activer le compte agent", exact: true }) });
    await activation.getByLabel("Identifiant unique", { exact: true }).fill(login);
    await activation.locator('[name=temporaryPassword]').fill(testAgentPassword);
    await activation.locator('[name=signedOn]').fill(new Date().toISOString().slice(0, 10));
    await activation.locator('[name=legalReviewConfirmed]').check();
    await activation.locator('[name=signatureConfirmed]').check();
    await activation.getByRole("button").click();
    await page.getByRole("button", { name: "Biens attribués", exact: true }).click();
    const property = page.locator('.team-cards article[data-agent-id=""]').first();
    const propertyId = await property.getAttribute("data-property-id");
    assert.ok(propertyId);
    const assigned = page.locator(`.team-cards article[data-property-id="${propertyId}"]`);
    await assigned.getByRole("combobox", { name: "Agent", exact: true }).selectOption({ label: name });
    await assigned.getByRole("button", { name: "Attribuer le bien", exact: true }).click();
    await assigned.getByRole("button", { name: "Ajouter prospect, visite et prévision fictifs", exact: true }).click();
    await agentPage.goto(`${baseUrl}/fr/demo/team`);
    await agentPage.getByLabel("Identifiant unique", { exact: true }).fill(login);
    await agentPage.getByLabel("Mot de passe", { exact: true }).fill(testAgentPassword);
    await agentPage.getByRole("button", { name: "Se connecter", exact: true }).click();
    await agentPage.getByText("Remplacez votre mot de passe temporaire pour accéder à votre espace personnel.", { exact: true }).waitFor();
    assert.equal(await agentPage.getByRole("button", { name: "Embauche et comptes", exact: true }).count(), 0);
    await agentPage.locator('[name=currentPassword]').fill(testAgentPassword);
    await agentPage.locator('[name=password]').fill(`Fictional-Agent-Changed-${suffix}!`);
    await agentPage.getByRole("button", { name: "Changer le mot de passe", exact: true }).click();
    await agentPage.getByText(propertyId, { exact: true }).waitFor();
    for (const locale of locales) {
      const t = teamMessages(locale);
      await agentPage.goto(`${baseUrl}/${locale}/demo/team`);
      await agentPage.getByRole("heading", { name, exact: true }).waitFor();
      for (const tab of ["properties", "prospects", "calendar", "commissions"] as const) {
        await agentPage.getByRole("button", { name: t[tab], exact: true }).click();
        assert.equal(await agentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${locale}/${tab}`);
      }
      assert.equal(await agentPage.locator(".team-hiring").count(), 0);
    }
    await agentPage.reload();
    await agentPage.getByRole("heading", { name, exact: true }).waitFor();
    await agentPage.getByRole("button", { name: teamMessages("es").signOut, exact: true }).click();
    await agentPage.getByRole("button", { name: teamMessages("es").signIn, exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
