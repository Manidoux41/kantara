import test from "node:test";
import assert from "node:assert/strict";
import { api, adminCookie, baseUrl, business, command, enabled } from "../helpers/agency-http";
import { testIdentity, testAgentPassword } from "../helpers/team-fixtures";
import { employmentExample } from "../../lib/team/examples";
import { chromium } from "playwright-core";

test("production business: PostgreSQL CRUD, documents, 20-photo limit, publication, hiring, own-agent isolation, calendar and PDF", { skip: !enabled, timeout: 180000 }, async () => {
  const cookie = await adminCookie();
  let state = await command(cookie, { action: "createClient", input: { name: "VALIDATION OWNER", role: "OWNER",
    address: "VALIDATION ADDRESS", identityReference: "TEST-PRIVATE-IDENTITY", nationality: "TEST", email: "", phone: "", propertyIds: [] } });
  const ownerId = state.clients.at(-1).id;
  state = await command(cookie, { action: "createProperty", input: { title: "VALIDATION PROPERTY", address: "VALIDATION ADDRESS", titleReference: "TEST-PRIVATE-TITLE",
    ownerId, location: "siem-reap", type: "villa", transaction: "sale", price: "100000.00", area: 120, bedrooms: 2, rooms: 3, bathrooms: 1 } });
  const propertyId = state.properties.at(-1).id;
  assert.equal((await business(cookie)).properties.at(-1).id, propertyId);
  let catalogue = await (await fetch(`${baseUrl}/api/v1/catalogue`)).json(); assert.equal(catalogue.data.length, 0);
  state = await command(cookie, { action: "propertyDetails", propertyId, description: "Isolated validation description, not a real listing.", coordinates: { latitude: 13.36, longitude: 103.85 } });
  let photoId = "";
  for (let index = 0; index < 21; index++) {
    const response = await api("media", { propertyId, kind: "PHOTO", name: `validation-${index}.png`, mime: testIdentity.mime, base64: testIdentity.base64 }, cookie);
    assert.equal(response.status, index < 20 ? 200 : 409);
    if (!index) photoId = (await response.json()).data.id;
  }
  assert.equal((await fetch(`${baseUrl}/api/v1/media/${photoId}`)).status, 404);
  const pdfFile = Buffer.from("%PDF-1.4\n%VALIDATION PRIVATE DOCUMENT\n").toString("base64");
  const privateResponse = await api("media", { propertyId, kind: "DOCUMENT", name: "validation.pdf", mime: "application/pdf", base64: pdfFile }, cookie);
  assert.equal(privateResponse.status, 200); const privateId = (await privateResponse.json()).data.id;
  assert.equal((await api(`media/${privateId}`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/v1/media/${privateId}`)).status, 404);
  state = await command(cookie, { action: "publish", propertyId, published: true });
  catalogue = await (await fetch(`${baseUrl}/api/v1/catalogue`)).json();
  assert.equal(catalogue.data.length, 1); assert.equal(catalogue.data[0].coordinates.latitude, 13.36);
  assert.equal(JSON.stringify(catalogue).includes("TEST-PRIVATE"), false);
  assert.equal((await fetch(`${baseUrl}/api/v1/media/${photoId}`)).status, 200);
  const browser = await chromium.launch({ executablePath: process.env.PDF_CHROMIUM_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/fr/properties/${propertyId}`);
    await page.getByRole("heading", { name: "VALIDATION PROPERTY", exact: true }).waitFor();
    await page.locator("#contact-agent").waitFor();
    assert.equal(await page.locator(".property-photo-gallery img").count(), 19);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  const revision = state.revision;
  const stale = await api("admin", { action: "publish", propertyId, published: false, revision: revision - 1 }, cookie);
  assert.equal(stale.status, 409);
  const today = new Date().toISOString().slice(0, 10);
  state = await command(cookie, { action: "createContract", input: { kind: "SALE_MANDATE", language: "en-km", ownerId,
    agencyName: "VALIDATION AGENCY", agencyAddress: "VALIDATION ADDRESS", agencyRegistration: "TEST-REG", signedAt: today, signedPlace: "TEST",
    startDate: today, endDate: "2027-11-01", exclusive: false, lines: [{ propertyId, price: "100000", expectedCommission: "1000" }],
    deposit: "0", rentDueDay: 1, permittedUse: "TEST MANDATE", terms: "VALIDATION TERMS ONLY", commissionTerms: "VALIDATION COMMISSION ONLY" } });
  const contractId = state.contracts.at(-1).id;
  const pdf = await api(`admin/contracts/${contractId}/pdf`, undefined, cookie); assert.equal(pdf.status, 200);
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  state = await command(cookie, { action: "closeTransaction", propertyId, contractId, closedAt: today, commission: "1000" });
  assert.equal(state.properties.at(-1).availability, "SOLD");
  const transactionId = state.transactions.at(-1).id;
  state = await command(cookie, { action: "recordReceipt", transactionId, amount: "400", paidAt: today, reference: "TEST-RECEIPT-001" });
  assert.equal(state.revenue.received, "400.00");
  const run = async (input: Record<string, unknown>) => {
    const view = await (await api("team", undefined, cookie)).json();
    const response = await api("team", { ...input, revision: view.data.revision }, cookie);
    const body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body.error)); return body.data;
  };
  let team = await run({ action: "candidate", input: { name: "VALIDATION AGENT", address: "VALIDATION", identityReference: "TEST-AGENT-ID" } });
  const candidate = team.candidates.at(-1);
  team = await run({ action: "upload", candidateId: candidate.id, input: testIdentity });
  const documentId = team.candidates.at(-1).documents[0].id;
  assert.equal((await api(`team/documents/${documentId}?preview=1`)).status, 401);
  const preview = await api(`team/documents/${documentId}?preview=1`, undefined, cookie);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("content-type"), "image/png");
  assert.ok(preview.headers.get("content-disposition")?.startsWith("inline;"));
  assert.equal(preview.headers.get("cache-control"), "no-store");
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), Buffer.from(testIdentity.base64, "base64"));
  const attachment = await api(`team/documents/${documentId}`, undefined, cookie);
  assert.ok(attachment.headers.get("content-disposition")?.startsWith("attachment;"));
  await run({ action: "review", candidateId: candidate.id, documentId: team.candidates.at(-1).documents[0].id, approved: true });
  team = await run({ action: "contract", candidateId: candidate.id, input: { ...employmentExample, startDate: today } });
  const employmentId = team.candidates.at(-1).contract.id;
  assert.equal((await api(`team/employment/${candidate.id}`)).status, 401);
  const employmentPdf = await api(`team/employment/${candidate.id}`, undefined, cookie);
  assert.equal(employmentPdf.status, 200);
  assert.equal(employmentPdf.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await employmentPdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  await run({ action: "activate", candidateId: candidate.id, contractId: employmentId, login: "validation.agent", temporaryPassword: testAgentPassword,
    signedOn: today, legalReviewConfirmed: true, signatureConfirmed: true });
  team = await run({ action: "assignProperty", propertyId, agentId: candidate.agentId });
  state = await command(cookie, { action: "createLead", input: { title: "VALIDATION CRM LEAD", clientId: ownerId, agentId: candidate.agentId,
    source: "DIRECT", propertyIds: [], score: 50, expectedCommission: "0", expectedClosingDate: null, followUpDate: null, notes: "TEST ONLY" } });
  const leadId = state.leads.at(-1).id;
  const day = new Date(Date.now() + 2 * 86400000);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  const appointmentDate = day.toISOString().slice(0, 10);
  state = await command(cookie, { action: "createAppointment", input: { title: "VALIDATION CONNECTED AGENDA", clientId: ownerId, agentId: candidate.agentId,
    propertyId: null, leadId, startAt: `${appointmentDate}T02:00:00.000Z`, endAt: `${appointmentDate}T03:00:00.000Z`, location: "TEST OFFICE", notes: "TEST ONLY" } });
  const agentLogin = await api("team", { action: "login", login: "validation.agent", password: testAgentPassword });
  const agentCookie = agentLogin.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await api("admin", undefined, agentCookie)).status, 403);
  const changed = await api("team", { action: "changePassword", currentPassword: testAgentPassword, password: `${testAgentPassword}-changed` }, agentCookie);
  assert.equal(changed.status, 200); const changedCookie = changed.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await api(`team/documents/${documentId}?preview=1`, undefined, changedCookie)).status, 403);
  assert.equal((await api(`team/employment/${candidate.id}`, undefined, changedCookie)).status, 403);
  assert.equal((await api("admin", { action: "publish", revision: 0, propertyId, published: false }, changedCookie)).status, 403);
  const agentBusiness = await business(changedCookie); assert.equal(agentBusiness.properties.length, 1);
  assert.equal(agentBusiness.clients.length, 1); assert.equal(agentBusiness.clients[0].identityReference, "");
  assert.equal(agentBusiness.contracts.length, 0); assert.equal(agentBusiness.leads.length, 1); assert.equal(agentBusiness.appointments.length, 1);
  assert.equal((await api("admin/export", undefined, changedCookie)).status, 403);
  const calendar = await api("admin/calendar", undefined, changedCookie); assert.equal(calendar.status, 200);
  assert.ok((await calendar.text()).includes("VALIDATION CONNECTED AGENDA"));
  await run({ action: "disable", accountId: team.accounts.find((entry: { login: string }) => entry.login === "validation.agent").id });
  assert.equal((await api("admin", undefined, changedCookie)).status, 401);
  state = await command(cookie, { action: "publish", propertyId, published: false });
  assert.equal((await (await fetch(`${baseUrl}/api/v1/catalogue`)).json()).data.length, 0);
  assert.equal((await fetch(`${baseUrl}/api/v1/media/${photoId}`)).status, 404);
  const removed = await fetch(`${baseUrl}/api/agency/media/${privateId}`, { method: "DELETE", headers: { Cookie: cookie, Origin: baseUrl } });
  assert.equal(removed.status, 200); assert.equal((await api(`media/${privateId}`, undefined, cookie)).status, 404);
  assert.ok(!(await (await api("admin/calendar", undefined, cookie)).text()).includes("DEMO"));
});
