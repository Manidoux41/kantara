import test from "node:test";
import assert from "node:assert/strict";
import { chromium, type Page, type Locator } from "playwright-core";
import { api, adminCookie, baseUrl, business, command, enabled } from "../helpers/agency-http";
import { testIdentity, testAgentPassword } from "../helpers/team-fixtures";
import { employmentExample } from "../../lib/team/examples";
import type { dossierSnapshot } from "../../services/agency/dossiers";

type Snapshot = ReturnType<typeof dossierSnapshot>;
async function view(cookie: string): Promise<Snapshot> {
  const response = await api("dossiers", undefined, cookie);
  assert.equal(response.status, 200);
  return (await response.json()).data;
}
async function dossier(cookie: string, input: Record<string, unknown>, status = 200): Promise<Snapshot> {
  const response = await api("dossiers", { ...input, revision: (await view(cookie)).revision }, cookie);
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body.error));
  return body.data;
}
async function submit(page: Page, form: Locator, action: string) {
  const response = page.waitForResponse((response) => response.url().endsWith("/api/agency/dossiers")
    && response.request().method() === "POST" && response.request().postDataJSON().action === action);
  await form.getByRole("button").click();
  const result = await response;
  assert.equal(result.status(), 200, await result.text());
  await page.locator('.dossier-workspace[aria-busy="false"]').waitFor();
}
test("dossiers production: assigned-agent bilingual PDF, private title files, bank proof, admin approval, CRM persistence and reassignment", { skip: !enabled, timeout: 180000 }, async () => {
  const cookie = await adminCookie(), today = new Date().toISOString().slice(0, 10);
  assert.equal((await api("dossiers")).status, 401);
  const teamCommand = async (input: Record<string, unknown>) => {
    const revision = (await (await api("team", undefined, cookie)).json()).data.revision;
    const response = await api("team", { ...input, revision }, cookie), body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body.error)); return body.data;
  };
  const onboard = async (login: string) => {
    let team = await teamCommand({ action: "candidate", input: { name: login, address: "VALIDATION ADDRESS", identityReference: `TEST-${login}` } });
    const candidateId = team.candidates.at(-1).id;
    team = await teamCommand({ action: "upload", candidateId, input: testIdentity });
    await teamCommand({ action: "review", candidateId, documentId: team.candidates.at(-1).documents[0].id, approved: true });
    team = await teamCommand({ action: "contract", candidateId, input: { ...employmentExample, startDate: today } });
    team = await teamCommand({ action: "activate", candidateId, contractId: team.candidates.at(-1).contract.id, login,
      temporaryPassword: testAgentPassword, signedOn: today, legalReviewConfirmed: true, signatureConfirmed: true });
    return team.candidates.at(-1).agentId as string;
  };
  const agentId = await onboard("dossier.validation"), replacementId = await onboard("replacement.validation");
  let state = await command(cookie, { action: "createClient", input: { name: "DOSSIER OWNER", role: "OWNER",
    address: "TEST ADDRESS", identityReference: "DOSSIER-OWNER-ID", nationality: "TEST", email: "", phone: "", propertyIds: [] } });
  const ownerId = state.clients.at(-1).id;
  const createProperty = async (transaction: "sale" | "rent") => {
    const data = await command(cookie, { action: "createProperty", input: { title: `DOSSIER ${transaction.toUpperCase()}`, address: "TEST ADDRESS", titleReference: `DOSSIER-TITLE-${transaction}`,
      ownerId, transaction, location: "siem-reap", type: "villa", price: transaction === "rent" ? "1000" : "100000", area: 120, bedrooms: 2, rooms: 3, bathrooms: 1 } });
    return data.properties.at(-1).id as string;
  };
  const propertyId = await createProperty("rent"), saleId = await createProperty("sale");
  state = await command(cookie, { action: "createClient", input: { name: "DOSSIER TENANT", role: "TENANT",
    address: "TEST ADDRESS", identityReference: "DOSSIER-TENANT-ID", nationality: "TEST", email: "", phone: "", propertyIds: [propertyId] } });
  const tenantId = state.clients.at(-1).id;
  state = await command(cookie, { action: "createClient", input: { name: "DOSSIER BUYER", role: "BUYER",
    address: "TEST ADDRESS", identityReference: "DOSSIER-BUYER-ID", nationality: "TEST", email: "", phone: "", propertyIds: [saleId] } });
  const buyerId = state.clients.at(-1).id;
  await teamCommand({ action: "assignProperty", propertyId, agentId });
  const login = await api("team", { action: "login", login: "dossier.validation", password: testAgentPassword });
  const temporary = login.headers.get("set-cookie")!.split(";")[0];
  const changed = await api("team", { action: "changePassword", currentPassword: testAgentPassword, password: `${testAgentPassword}-changed` }, temporary);
  assert.equal(changed.status, 200);
  const agentCookie = changed.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await view(agentCookie)).properties.length, 1);
  assert.equal((await api(`media?propertyId=${saleId}`, undefined, agentCookie)).status, 404);
  assert.equal((await api("media", { propertyId: saleId, kind: "DOCUMENT", name: testIdentity.name, mime: testIdentity.mime, base64: testIdentity.base64 }, agentCookie)).status, 404);
  assert.equal((await api("media", { propertyId, kind: "PHOTO", name: testIdentity.name, mime: testIdentity.mime, base64: testIdentity.base64 }, agentCookie)).status, 403);
  const input = { propertyId: saleId, counterpartyId: buyerId, kind: "SALE_AGREEMENT", agencyName: "VALIDATION AGENCY", agencyAddress: "TEST ADDRESS",
    agencyRegistration: "TEST-REG", representative: "TEST REP", date: today, place: "TEST", price: "100000", deposit: "100",
    startDate: today, endDate: "2027-11-04", rentDueDay: 1, titleType: "REGISTERED_TITLE", titleReference: "TEST TITLE",
    termsEnglish: "VALIDATION TERMS: review, taxes, title, payment and completion.",
    termsKhmer: "លក្ខខណ្ឌសម្រាប់ការធ្វើតេស្ត និងការពិនិត្យដោយអ្នកជំនាញ" };
  for (const kind of ["SALE_AGREEMENT", "PRELIMINARY_SALE", "DEPOSIT_RECEIPT", "HANDOVER", "COMMISSION_STATEMENT"]) {
    await dossier(cookie, { action: "createDocument", input: { ...input, kind } });
  }
  const saleDocument = (await view(cookie)).documents.find((item) => item.property.id === saleId)!;
  assert.equal((await api(`dossiers/documents/${saleDocument.id}/pdf`, undefined, agentCookie)).status, 404);
  const salePdf = await api(`dossiers/documents/${saleDocument.id}/pdf`, undefined, cookie);
  assert.equal(salePdf.status, 200); assert.equal(Buffer.from(await salePdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  const wrongEvidence = await api("media", { propertyId: saleId, kind: "DOCUMENT", name: testIdentity.name, mime: testIdentity.mime, base64: testIdentity.base64 }, cookie);
  const wrongEvidenceId = (await wrongEvidence.json()).data.id;
  assert.equal((await api(`media/${wrongEvidenceId}`, undefined, agentCookie)).status, 404);
  const browser = await chromium.launch({ executablePath: process.env.PDF_CHROMIUM_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  try {
    const errors: string[] = [];
    async function authenticatedPage(value: string) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
      await context.addCookies([{ name: value.split("=")[0], value: value.slice(value.indexOf("=") + 1), url: `${baseUrl}/api/agency/`, httpOnly: true, sameSite: "Strict" }]);
      const page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseUrl}/fr/admin`); await page.locator(".dossier-document-form").waitFor();
      return page;
    }
    const agentPage = await authenticatedPage(agentCookie), agentDossier = agentPage.locator(".dossier-workspace");
    const documentForm = agentDossier.locator(".dossier-document-form");
    await documentForm.locator("select").first().selectOption("LEASE");
    for (const [name, value] of Object.entries({ ...input, counterpartyId: tenantId, price: "1000", startDate: today, endDate: "2027-11-04" })) {
      const control = documentForm.locator(`[name="${name}"]`);
      if (await control.count()) {
        if (await control.evaluate((element) => element.tagName === "SELECT")) await control.selectOption(String(value));
        else await control.fill(String(value));
      }
    }
    await submit(agentPage, documentForm, "createDocument");
    const saved = await view(agentCookie), lease = saved.documents.at(-1)!;
    assert.equal(lease.input.kind, "LEASE"); assert.equal(lease.createdBy !== "", true);
    const downloading = agentPage.waitForEvent("download");
    await agentDossier.getByRole("button", { name: "Générer le PDF bilingue", exact: true }).click();
    const download = await downloading; assert.equal(await download.failure(), null);
    const stream = await download.createReadStream(); assert.ok(stream);
    const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).subarray(0, 5).toString(), "%PDF-"); await download.delete();
    const files = agentDossier.locator("details");
    await files.locator("summary").click();
    await files.locator('input[type="file"]').setInputFiles({ name: "bank-proof.png", mimeType: testIdentity.mime, buffer: Buffer.from(testIdentity.base64, "base64") });
    await files.getByRole("button", { name: "Téléverser", exact: true }).click();
    await files.getByRole("link", { name: "bank-proof.png", exact: true }).waitFor();
    const proofId = (await (await api(`media?propertyId=${propertyId}`, undefined, agentCookie)).json()).data[0].id;
    assert.equal((await api(`media/${proofId}`, undefined, agentCookie)).status, 200);
    await dossier(agentCookie, { action: "closeDossier", documentId: lease.id, closedAt: today, commission: "250.25",
      signedConfirmed: true, legalReviewConfirmed: true, formalitiesConfirmed: true }, 403);
    const adminPage = await authenticatedPage(cookie), adminDossier = adminPage.locator(".dossier-workspace");
    await adminDossier.locator(":scope > label select").selectOption(propertyId);
    const closing = adminDossier.locator(".business-list article").filter({ has: adminPage.getByRole("heading", { name: "Bail de location", exact: true }) }).locator("form");
    await closing.locator('[name="commission"]').fill("250.25");
    for (const name of ["signedConfirmed", "legalReviewConfirmed", "formalitiesConfirmed"]) await closing.locator(`[name="${name}"]`).check();
    await submit(adminPage, closing, "closeDossier");
    const transaction = (await view(agentCookie)).transactions[0];
    assert.equal(transaction.dossierClosure?.signedConfirmed, true);
    await dossier(agentCookie, { action: "submitTransfer", transactionId: transaction.id, amount: "250.25", paidAt: today,
      reference: "WRONG-PROPERTY-EVIDENCE", bankName: "TEST BANK", payer: "TEST PAYER", evidenceId: wrongEvidenceId }, 400);
    await agentDossier.getByRole("button", { name: "Actualiser", exact: true }).click();
    const transferForm = agentDossier.locator(".dossier-transfer-form"); await transferForm.waitFor();
    for (const [name, value] of Object.entries({ amount: "250.25", reference: "DOSSIER-BANK-1", bankName: "VALIDATION BANK", payer: "VALIDATION PAYER" })) {
      await transferForm.locator(`[name="${name}"]`).fill(value);
    }
    await transferForm.locator('[name="evidenceId"]').selectOption(proofId);
    await submit(agentPage, transferForm, "submitTransfer");
    let snapshot = await view(agentCookie);
    assert.equal(snapshot.revenue.received, "0.00");
    const transferId = snapshot.transfers[0].id;
    await dossier(agentCookie, { action: "reviewTransfer", transferId, approved: true, note: "UNAUTHORIZED TEST" }, 403);
    await adminDossier.getByRole("button", { name: "Actualiser", exact: true }).click();
    const review = adminDossier.locator(".dossier-review-form"); await review.waitFor();
    await review.locator('[name="note"]').fill("VALIDATION statement matched externally; reference and amount verified");
    await submit(adminPage, review, "reviewTransfer");
    snapshot = await view(agentCookie);
    assert.equal(snapshot.revenue.received, "250.25"); assert.equal(snapshot.revenue.outstanding, "0.00");
    assert.equal(snapshot.transfers[0].status, "APPROVED"); assert.equal(snapshot.transactions[0].receipts.length, 1);
    await dossier(cookie, { action: "reviewTransfer", transferId, approved: true, note: "DUPLICATE TEST" }, 409);
    const receipt = (await business(cookie)).transactions.find((item: { id: string }) => item.id === transaction.id).receipts[0];
    assert.equal(receipt.reference, "DOSSIER-BANK-1"); assert.equal(receipt.id, snapshot.transfers[0].receiptId);
    const deletion = await fetch(`${baseUrl}/api/agency/media/${proofId}`, { method: "DELETE", headers: { Cookie: cookie, Origin: baseUrl } });
    assert.equal(deletion.status, 409);
    await agentPage.setViewportSize({ width: 390, height: 844 });
    assert.ok(await agentDossier.evaluate((element) => element.getBoundingClientRect().right <= document.documentElement.clientWidth), "Dossier must fit mobile viewport");
    await teamCommand({ action: "assignProperty", propertyId, agentId: replacementId });
    assert.equal((await view(agentCookie)).documents.length, 0);
    assert.equal((await api(`dossiers/documents/${lease.id}/pdf`, undefined, agentCookie)).status, 404);
    assert.equal((await api(`media/${proofId}`, undefined, agentCookie)).status, 404);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
