import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright-core";
import { crmMessages } from "../../lib/i18n/crm";
import { locales } from "../../lib/i18n/routing";

const executablePath = process.env.PDF_CHROMIUM_PATH ?? [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome",
].find(existsSync);
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
test("browser CRM: edit contact, lead pipeline, connected month calendar, rescheduling, ICS download and reload", {
  skip: process.env.TEST_DEMO_API !== "true" || !executablePath, timeout: 180000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/fr/demo/admin`);
    await page.locator(".business-kpis strong").first().waitFor();
    await page.locator(".business-tabs").getByRole("button", { name: "Clients", exact: true }).click();
    for (const [name, value] of Object.entries({ name: "CONTACT CALENDRIER DEMO", address: "Adresse fictive", identityReference: "AGENDA-IDENTITE", nationality: "KH DEMO" })) {
      await page.locator(`.business-workspace input[name="${name}"]`).fill(value);
    }
    await page.getByRole("button", { name: "Créer le client", exact: true }).click();
    const contact = page.locator(".business-list article").filter({ has: page.getByRole("heading", { name: "CONTACT CALENDRIER DEMO · Acquéreur", exact: true }) });
    await contact.locator("summary").click();
    await contact.locator('[name="company"]').fill("SOCIETE FICTIVE");
    await contact.getByRole("checkbox", { name: "Investisseur", exact: true }).check();
    await contact.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Modifications fictives enregistrées" }).waitFor();
    assert.equal(await contact.locator('[name="company"]').inputValue(), "SOCIETE FICTIVE");
    await contact.locator('[name="text"]').fill("Conversation de demonstration, aucun message envoye.");
    await contact.getByRole("button", { name: "Consigner un échange (sans envoi)", exact: true }).click();
    await contact.getByText("Conversation de demonstration, aucun message envoye.", { exact: true }).waitFor();
    await page.locator(".business-tabs").getByRole("button", { name: "Prospects", exact: true }).click();
    const leadForm = page.locator(".business-form").first();
    await leadForm.locator('[name="title"]').fill("Prospect CALENDRIER DEMO");
    await leadForm.locator('[name="clientId"]').selectOption({ label: "CONTACT CALENDRIER DEMO" });
    await leadForm.getByRole("checkbox", { name: "KANTARA DEMO — lotus", exact: true }).check();
    await leadForm.getByRole("button", { name: "Nouveau prospect lié", exact: true }).click();
    await page.getByRole("heading", { name: "Prospect CALENDRIER DEMO", exact: true }).waitFor();
    await page.locator(".business-tabs").getByRole("button", { name: "Agenda", exact: true }).click();
    const day = new Date(Date.now() + 2 * 86400000);
    while (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1);
    const date = day.toISOString().slice(0, 10);
    const agendaForm = page.locator("form.business-form").last();
    await agendaForm.locator('[name="title"]').fill("Visite CALENDRIER DEMO");
    await agendaForm.locator('[name="clientId"]').selectOption({ label: "CONTACT CALENDRIER DEMO" });
    await agendaForm.locator('[name="propertyId"]').selectOption("DEMO-001");
    await agendaForm.locator('[name="leadId"]').selectOption({ label: "Prospect CALENDRIER DEMO" });
    await agendaForm.locator('[name="startAt"]').fill(`${date}T09:00`);
    await agendaForm.locator('[name="endAt"]').fill(`${date}T10:00`);
    await agendaForm.locator('[name="location"]').fill("Siem Reap - DEMO");
    await agendaForm.getByRole("button", { name: "Planifier un rendez-vous", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Modifications fictives enregistrées" }).waitFor();
    if (date.slice(0, 7) !== new Date().toISOString().slice(0, 7)) await page.getByRole("button", { name: "Mois suivant", exact: true }).click();
    await page.getByRole("button", { name: `${date} · 1`, exact: true }).click();
    const visit = page.locator(".business-list article").filter({ has: page.getByRole("heading", { name: "Visite CALENDRIER DEMO", exact: true }) });
    await visit.getByRole("button", { name: "Replanifier", exact: true }).click();
    await agendaForm.locator('[name="startAt"]').fill(`${date}T10:00`);
    await agendaForm.locator('[name="endAt"]').fill(`${date}T11:00`);
    await agendaForm.getByRole("button", { name: "Replanifier", exact: true }).click();
    await visit.getByText(/10:00–11:00/).waitFor();
    await visit.locator('[name="feedback"]').fill("Report fictif souhaite par le client");
    await visit.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await visit.getByText("Annulé", { exact: true }).waitFor();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Télécharger l’agenda (.ics)", exact: true }).click();
    const download = await downloadPromise;
    assert.equal(await download.failure(), null);
    const stream = await download.createReadStream();
    assert.ok(stream);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const ics = Buffer.concat(chunks).toString();
    assert.ok(ics.includes("Visite CALENDRIER DEMO"));
    assert.ok(ics.includes("STATUS:CANCELLED"));
    assert.ok(ics.includes("SEQUENCE:2"));
    await download.delete();
    await page.reload();
    await page.locator(".business-kpis strong").first().waitFor();
    await page.locator(".business-tabs").getByRole("button", { name: "Prospects", exact: true }).click();
    await page.getByRole("heading", { name: "Prospect CALENDRIER DEMO", exact: true }).waitFor();
    await page.setViewportSize({ width: 375, height: 900 });
    for (const locale of locales) {
      const labels = crmMessages(locale);
      await page.goto(`${baseUrl}/${locale}/demo/admin`);
      await page.locator(".business-kpis strong").first().waitFor();
      for (const tab of ["leads", "calendar", "activity"]) {
        await page.locator(".business-tabs").getByRole("button", { name: labels[tab], exact: true }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${locale}/${tab} overflows`);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
