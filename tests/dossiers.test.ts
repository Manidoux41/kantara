import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initialTeam } from "./helpers/team";
import { createBusinessState, executeBusinessCommand } from "../services/demo/business";
import { businessStateSchema } from "../services/demo/repository";
import { dossierCommand, dossierInput, dossierKinds } from "../lib/agency/dossiers";
import { applyDossierCommand, dossierSnapshot } from "../services/agency/dossiers";
import { dossierDocumentHtml } from "../lib/agency/dossier-document";
import { dossierMessages } from "../lib/i18n/dossiers";
import { locales } from "../lib/i18n/routing";
import { contactProfileInput } from "../lib/validations/crm";
import type { AgencyState } from "../services/agency/repository";
import type { TeamAccount } from "../lib/team/schema";
import { businessCommandSchema } from "../lib/validations/demo-business";

const now = new Date("2026-11-04T12:00:00Z");
async function fixture(transaction: "sale" | "rent" = "sale") {
  const team = await initialTeam();
  const business = createBusinessState();
  business.properties = []; business.clients = []; business.agents = [];
  const state: AgencyState = { version: 1, team, business };
  const admin = team.accounts[0];
  const agent: TeamAccount = { ...admin, id: randomUUID(), role: "AGENT", agentId: randomUUID() };
  function crm(input: Record<string, unknown>) {
    state.business = executeBusinessCommand(state.business, businessCommandSchema.parse({ ...input, revision: state.business.revision }), now);
  }
  crm({ action: "createClient", input: { name: "OWNER TEST", role: "OWNER", address: "TEST", identityReference: "OWNER-ID", nationality: "TEST", email: "", phone: "", propertyIds: [] } });
  const ownerId = state.business.clients[0].id;
  crm({ action: "createProperty", input: { title: "PROPERTY TEST", address: "TEST", titleReference: "TITLE TEST", ownerId, transaction,
    location: "siem-reap", type: "villa", price: "100000", area: 120, bedrooms: 2, rooms: 3, bathrooms: 1 } });
  const propertyId = state.business.properties[0].id;
  crm({ action: "createClient", input: { name: "PARTY TEST", role: transaction === "sale" ? "BUYER" : "TENANT", address: "TEST",
    identityReference: "PARTY-ID", nationality: "TEST", email: "", phone: "", propertyIds: [propertyId] } });
  team.propertyAssignments[propertyId] = agent.agentId!;
  const input = dossierInput.parse({ propertyId, counterpartyId: state.business.clients[1].id, kind: transaction === "sale" ? "SALE_AGREEMENT" : "LEASE",
    agencyName: "TEST AGENCY", agencyAddress: "TEST ADDRESS", agencyRegistration: "TEST-REG", representative: "REP TEST",
    date: "2026-11-04", place: "TEST", price: "100000", deposit: "100", startDate: "2026-11-04", endDate: "2027-11-04", rentDueDay: 1,
    titleType: "REGISTERED_TITLE", titleReference: "TITLE TEST", termsEnglish: "Terms reviewed for test purposes.",
    termsKhmer: "លក្ខខណ្ឌសម្រាប់ការធ្វើតេស្ត" });
  const run = (command: Record<string, unknown>, account = admin) =>
    applyDossierCommand(state, account, dossierCommand.parse({ ...command, revision: state.business.revision }), now);
  return { state, admin, agent, propertyId, input, run };
}

test("dossiers: legacy encrypted states parse; current assignment scopes clients, immutable documents and financials", async () => {
  const { state, admin, agent, input, run, propertyId } = await fixture();
  assert.equal(businessStateSchema.safeParse(state.business).success, true);
  state.business.clients[1].profile = contactProfileInput.parse({ firstName: "TEST", lastName: "", company: "", whatsapp: "", country: "", preferredLanguage: "en",
    categories: ["BUYER"], source: "DIRECT", assignedAgentId: null, notes: "PRIVATE OTHER DOSSIER", tags: [], followUpDate: null });
  state.business.clients[1].propertyIds.push("OUTSIDE-TEST");
  run({ action: "createDocument", input }, agent);
  const view = dossierSnapshot(state, agent);
  assert.equal(view.properties.length, 1);
  assert.equal(JSON.stringify(view).includes("PRIVATE OTHER DOSSIER"), false);
  assert.equal(JSON.stringify(view).includes("OUTSIDE-TEST"), false);
  state.business.clients[1].name = "CHANGED TEST";
  assert.equal(state.business.dossierDocuments![0].counterparty.name, "PARTY TEST");
  delete state.team.propertyAssignments[propertyId];
  assert.equal(dossierSnapshot(state, agent).documents.length, 0);
  assert.throws(() => run({ action: "createDocument", input }, agent), /not found/);
  assert.equal(dossierSnapshot(state, admin).documents.length, 1);
  assert.equal(businessStateSchema.safeParse(state.business).success, true);
});
test("dossiers: six bilingual document types escape input and preserve legal distinctions and signature blanks", async () => {
  const { state, input, run } = await fixture();
  for (const kind of dossierKinds) {
    if (kind === "LEASE") state.business.properties[0].transaction = "rent";
    else state.business.properties[0].transaction = "sale";
    state.business.clients[1].role = kind === "LEASE" ? "TENANT" : "BUYER";
    run({ action: "createDocument", input: { ...input, kind, termsEnglish: "<script>alert('test')</script> test clauses" } });
    const html = dossierDocumentHtml(state.business.dossierDocuments!.at(-1)!, "TESTFONT");
    assert.ok(html.includes('lang="km"')); assert.match(html, /Constitution Article 44/);
    assert.match(html, /____________________________/); assert.doesNotMatch(html, /<script>|DRAFT|DO NOT SIGN/);
    assert.match(html, /&lt;script&gt;/);
    if (kind === "SALE_AGREEMENT") assert.match(html, /does not itself register or transfer/);
    if (kind === "COMMISSION_STATEMENT") assert.match(html, /not proof of receipt or a tax invoice/);
  }
});
test("dossiers: required bilingual wording, lease limits, counterparties and revision are enforced", async () => {
  const { state, input, agent, run } = await fixture("rent");
  assert.equal(dossierInput.safeParse({ ...input, termsKhmer: "English only text" }).success, false);
  assert.equal(dossierInput.safeParse({ ...input, endDate: "2041-11-04" }).success, false);
  assert.equal(dossierInput.safeParse({ ...input, endDate: input.startDate }).success, false);
  assert.equal(dossierInput.safeParse({ ...input, kind: "DEPOSIT_RECEIPT", deposit: "0" }).success, false);
  assert.throws(() => run({ action: "createDocument", input: { ...input, kind: "SALE_AGREEMENT" } }, agent), /does not match/);
  assert.throws(() => applyDossierCommand(state, agent, dossierCommand.parse({ action: "createDocument", input, revision: state.business.revision - 1 }), now), /Refresh/);
  state.business.clients[1].propertyIds = [];
  assert.throws(() => run({ action: "createDocument", input }, agent), /Link the owner/);
});
test("dossiers: admin closure persists confirmations and realizes revenue exactly once", async () => {
  const { state, input, agent, admin, run } = await fixture();
  run({ action: "createDocument", input }, agent);
  const close = { action: "closeDossier", documentId: state.business.dossierDocuments![0].id,
    closedAt: "2026-11-04", commission: "1000.20", signedConfirmed: true, legalReviewConfirmed: true, formalitiesConfirmed: true };
  assert.throws(() => run(close, agent), /administrator/i);
  assert.throws(() => run({ ...close, signedConfirmed: false }), /true/);
  assert.throws(() => run({ ...close, closedAt: "2026-11-05" }), /future/);
  run(close);
  assert.equal(state.business.properties[0].availability, "SOLD");
  assert.equal(state.business.transactions[0].dossierClosure?.confirmedBy, admin.id);
  assert.equal(dossierSnapshot(state, admin).revenue.realized, "1000.20");
  assert.throws(() => run(close), /already completed/);
  assert.equal(businessStateSchema.safeParse(state.business).success, true);
});
test("dossiers: bank submission, rejection, resubmission and admin-only approval update CRM once", async () => {
  const { state, input, agent, run, admin } = await fixture("rent");
  run({ action: "createDocument", input }, agent);
  run({ action: "closeDossier", documentId: state.business.dossierDocuments![0].id, closedAt: "2026-11-04",
    commission: "1000.20", signedConfirmed: true, legalReviewConfirmed: true, formalitiesConfirmed: true });
  const submit = { action: "submitTransfer", transactionId: state.business.transactions[0].id, amount: "400.10",
    paidAt: "2026-11-04", bankName: "TEST BANK", payer: "TEST PAYER", reference: "BANK-TEST-1", evidenceId: randomUUID() };
  run(submit, agent);
  assert.equal(dossierSnapshot(state, agent).revenue.received, "0.00");
  const review = { action: "reviewTransfer", transferId: state.business.bankTransfers![0].id, approved: true, note: "TEST bank statement checked" };
  assert.throws(() => run(review, agent), /administrator/i);
  assert.throws(() => run(submit), /already recorded/);
  assert.throws(() => run({ ...submit, reference: "BANK-TEST-2", evidenceId: randomUUID(), amount: "600.11" }), /exceed/);
  assert.throws(() => run({ ...submit, paidAt: "2026-11-05" }), /future/);
  run({ ...review, approved: false });
  run(submit, agent);
  const transfer = state.business.bankTransfers!.at(-1)!;
  run({ ...review, transferId: transfer.id });
  assert.equal(state.business.bankTransfers!.at(-1)!.status, "APPROVED");
  assert.equal(state.business.bankTransfers!.at(-1)!.reviewedBy, admin.id);
  assert.equal(dossierSnapshot(state, agent).revenue.received, "400.10");
  assert.equal(dossierSnapshot(state, agent).revenue.outstanding, "600.10");
  assert.throws(() => run({ ...review, transferId: transfer.id }), /already reviewed/);
  assert.equal(state.business.transactions[0].receipts.length, 1);
  assert.equal(state.business.bankTransfers!.at(-1)!.receiptId, state.business.transactions[0].receipts[0].id);
  assert.equal(businessStateSchema.safeParse(state.business).success, true);
  assert.ok(state.business.activities.some((item) => item.action === "approveBankTransfer"));
});
test("dossiers: every locale has matching, non-empty workflow labels", () => {
  for (const locale of locales) {
    const labels = dossierMessages(locale);
    assert.deepEqual(Object.keys(labels), Object.keys(dossierMessages("en")));
    assert.ok(Object.values(labels).every((value) => value.length > 0));
  }
});
