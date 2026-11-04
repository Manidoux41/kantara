import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createBusinessState, executeBusinessCommand, getRevenueSummary } from "../services/demo/business";
import { contractInput, businessCommandSchema } from "../lib/validations/demo-business";
import { filterDemoProperties, initialDemoFilters } from "../lib/demo/properties";
import { locales } from "../lib/i18n/routing";
import { sampleContract } from "./helpers/business";

const now = new Date("2026-11-04T03:00:00Z");
test("owner to property to bilingual mandate to closing to partial receipts, exact cents and immutable snapshots", () => {
  const initial = createBusinessState();
  let state = executeBusinessCommand(initial, { action: "createClient", revision: 0, input: {
    name: "Propriétaire TEST", role: "OWNER", address: "Adresse fictive", nationality: "KH TEST",
    identityReference: "TEST-IDENTITY", email: "", phone: "", propertyIds: [],
  } }, now);
  const owner = state.clients.at(-1)!;
  state = executeBusinessCommand(state, { action: "createProperty", revision: state.revision, input: {
    title: "Maison TEST", address: "Adresse TEST", titleReference: "TITRE-TEST", ownerId: owner.id,
    type: "house", transaction: "sale", location: "kampot", price: "12345.67",
    area: 120, bedrooms: 2, rooms: 4, bathrooms: 1,
  } }, now);
  const property = state.properties.at(-1)!;
  assert.ok(state.clients.at(-1)?.propertyIds.includes(property.id));
  assert.equal(property.publication, "DRAFT");
  assert.equal(property.publishedAt, null);
  state = executeBusinessCommand(state, { action: "publish", revision: state.revision, propertyId: property.id, published: true }, now);
  const publishedAt = state.properties.at(-1)!.publishedAt;
  state = executeBusinessCommand(state, { action: "createContract", revision: state.revision, input: {
    ...sampleContract(), ownerId: owner.id, lines: [{ propertyId: property.id, price: "12345.67", expectedCommission: "1000.25" }],
  } }, now);
  const contract = state.contracts[0];
  assert.equal(contract.ownerSnapshot.name, owner.name);
  assert.equal(contract.propertySnapshots[0].publication, "PUBLISHED");
  assert.deepEqual(getRevenueSummary(state), { expected: "1000.25", realized: "0.00", received: "0.00", outstanding: "0.00" });
  state = executeBusinessCommand(state, { action: "closeTransaction", revision: state.revision,
    contractId: contract.id, propertyId: property.id, closedAt: "2026-11-03", commission: "900.30" }, now);
  assert.equal(state.properties.at(-1)?.availability, "SOLD");
  assert.equal(state.properties.at(-1)?.publishedAt, publishedAt);
  assert.equal(state.contracts[0].propertySnapshots[0].availability, "AVAILABLE");
  const transactionId = state.transactions[0].id;
  for (const [amount, reference] of [["0.10", "R-1"], ["0.20", "R-2"], ["900.00", "R-3"]]) {
    state = executeBusinessCommand(state, { action: "recordReceipt", revision: state.revision,
      transactionId, amount, reference, paidAt: "2026-11-04" }, now);
  }
  assert.deepEqual(getRevenueSummary(state), { expected: "0.00", realized: "900.30", received: "900.30", outstanding: "0.00" });
  assert.equal(initial.clients.length, 1);
  assert.equal(initial.contracts.length, 0);
  assert.throws(() => executeBusinessCommand(state, { action: "recordReceipt", revision: state.revision, transactionId, amount: "0.01", paidAt: "2026-11-04", reference: "OVER" }, now));
  assert.throws(() => executeBusinessCommand(state, { action: "closeTransaction", revision: state.revision, contractId: contract.id, propertyId: property.id, closedAt: "2026-11-03", commission: "900" }, now));
});

test("multiple property mandates forecast independently and close only the selected property", () => {
  let state = createBusinessState();
  state = executeBusinessCommand(state, { action: "createContract", revision: 0, input: {
    ...sampleContract(), lines: [
      { propertyId: "DEMO-001", price: "285000", expectedCommission: "1000" },
      { propertyId: "DEMO-003", price: "168000", expectedCommission: "2000" },
    ],
  } }, now);
  assert.equal(getRevenueSummary(state).expected, "3000.00");
  state = executeBusinessCommand(state, { action: "closeTransaction", revision: 1,
    contractId: state.contracts[0].id, propertyId: "DEMO-001", closedAt: "2026-11-03", commission: "950" }, now);
  assert.equal(state.properties[0].availability, "SOLD");
  assert.equal(state.properties[2].availability, "AVAILABLE");
  assert.equal(getRevenueSummary(state).expected, "2000.00");
});

test("tenant links and rental mandate plus lease do not duplicate revenue, rented status follows closing", () => {
  let state = createBusinessState();
  state = executeBusinessCommand(state, { action: "createClient", revision: 0, input: {
    name: "Tenant TEST", role: "TENANT", address: "Adresse TEST", nationality: "TEST",
    identityReference: "ID-TEST", email: "", phone: "", propertyIds: ["DEMO-002", "DEMO-004"],
  } }, now);
  const tenant = state.clients.at(-1)!;
  state = executeBusinessCommand(state, { action: "createContract", revision: state.revision, input: sampleContract("RENTAL_MANDATE") }, now);
  assert.throws(() => executeBusinessCommand(state, { action: "createContract", revision: state.revision, input: {
    ...sampleContract("LEASE"), counterpartyId: tenant.id,
  } }, now));
  state = executeBusinessCommand(state, { action: "createContract", revision: state.revision, input: {
    ...sampleContract("LEASE"), counterpartyId: tenant.id,
    lines: [{ propertyId: "DEMO-002", price: "850", expectedCommission: "0" }],
  } }, now);
  assert.equal(getRevenueSummary(state).expected, "1000.25");
  assert.throws(() => executeBusinessCommand(state, { action: "closeTransaction", revision: state.revision,
    contractId: state.contracts[1].id, propertyId: "DEMO-002", closedAt: "2026-11-03", commission: "0" }, now), /rental mandate/);
  assert.equal(getRevenueSummary(state).expected, "1000.25");
  state = executeBusinessCommand(state, { action: "closeTransaction", revision: state.revision,
    contractId: state.contracts[0].id, propertyId: "DEMO-002", closedAt: "2026-11-03", commission: "850" }, now);
  assert.equal(state.properties[1].availability, "RENTED");
  assert.deepEqual(getRevenueSummary(state), { expected: "0.00", realized: "850.00", received: "0.00", outstanding: "850.00" });
});

test("a lease without a rental mandate can close and realize its own commission", () => {
  let state = executeBusinessCommand(createBusinessState(), { action: "createClient", revision: 0, input: {
    name: "Lease-only TEST", role: "TENANT", address: "Adresse TEST", nationality: "TEST",
    identityReference: "ID-TEST", email: "", phone: "", propertyIds: [],
  } }, now);
  state = executeBusinessCommand(state, { action: "createContract", revision: state.revision, input: {
    ...sampleContract("LEASE"), counterpartyId: state.clients.at(-1)!.id,
  } }, now);
  state = executeBusinessCommand(state, { action: "closeTransaction", revision: state.revision,
    contractId: state.contracts[0].id, propertyId: "DEMO-002", closedAt: "2026-11-03", commission: "850" }, now);
  assert.equal(state.properties[1].availability, "RENTED");
  assert.equal(getRevenueSummary(state).realized, "850.00");
  assert.equal(getRevenueSummary(state).expected, "0.00");
});

test("relationships, stale revisions, duplicate forecasts and invalid contract terms are explicitly rejected", () => {
  const state = createBusinessState();
  for (const input of [
    { ...sampleContract(), ownerId: "missing" },
    { ...sampleContract(), lines: [{ propertyId: "missing", price: "10", expectedCommission: "1" }] },
    { ...sampleContract(), kind: "RENTAL_MANDATE" as const },
  ]) assert.throws(() => executeBusinessCommand(state, { action: "createContract", revision: 0, input }, now));
  assert.throws(() => executeBusinessCommand(state, { action: "publish", revision: 3, propertyId: "DEMO-001", published: true }, now));
  const created = executeBusinessCommand(state, { action: "createContract", revision: 0, input: sampleContract() }, now);
  assert.throws(() => executeBusinessCommand(created, { action: "createContract", revision: 1, input: sampleContract() }, now));
  for (const changes of [
    { startDate: "2027-01-01", endDate: "2026-01-01" }, { signedAt: "2026-11-02" },
    { lines: [] }, { terms: "short" }, { language: "km" }, { unknown: "private" },
    { lines: [...sampleContract().lines, ...sampleContract().lines] },
  ]) assert.equal(contractInput.safeParse({ ...sampleContract(), ...changes }).success, false);
  for (const changes of [
    { counterpartyId: undefined }, { counterpartyId: state.clients[0].id },
    { endDate: "2041-11-01" }, { endDate: "2026-11-01" }, { startDate: "2026-02-30" },
  ]) assert.equal(contractInput.safeParse({ ...sampleContract("LEASE"), ...changes }).success, false);
  assert.equal(businessCommandSchema.safeParse({ action: "recordReceipt", revision: 0, transactionId: "t", amount: "1e2", paidAt: "2026-11-04", reference: "ref" }).success, false);
});

test("publication idempotency, date preservation, sold/rented and publication filters, oldest/newest ordering", () => {
  let state = createBusinessState();
  const originalDate = state.properties[0].publishedAt;
  state = executeBusinessCommand(state, { action: "publish", revision: 0, propertyId: "DEMO-001", published: true }, now);
  assert.equal(state.properties[0].publishedAt, originalDate);
  state = executeBusinessCommand(state, { action: "publish", revision: 1, propertyId: "DEMO-001", published: false }, now);
  assert.equal(state.properties[0].publishedAt, originalDate);
  assert.equal(filterDemoProperties({ ...initialDemoFilters, publication: "DRAFT" }, state.properties).length, 1);
  assert.equal(filterDemoProperties({ ...initialDemoFilters, publication: "PUBLISHED" }, state.properties).length, 5);
  state.properties[1].availability = "RENTED";
  state.properties[2].availability = "SOLD";
  assert.equal(filterDemoProperties({ ...initialDemoFilters, availability: "RENTED" }, state.properties)[0].id, "DEMO-002");
  assert.equal(filterDemoProperties({ ...initialDemoFilters, availability: "SOLD" }, state.properties)[0].id, "DEMO-003");
  assert.equal(filterDemoProperties({ ...initialDemoFilters, sort: "publishedAsc" }, state.properties)[0].id, "DEMO-001");
  assert.equal(filterDemoProperties({ ...initialDemoFilters, sort: "publishedDesc" }, state.properties)[0].id, "DEMO-006");
});

test("seven business dictionaries have identical complete keys", async () => {
  let expected: string[] | undefined;
  for (const locale of locales) {
    const messages = JSON.parse(await readFile(new URL(`../messages/business/${locale}.json`, import.meta.url), "utf8"));
    const keys = Object.keys(messages).sort();
    expected ??= keys;
    assert.deepEqual(keys, expected, locale);
    for (const value of Object.values(messages)) assert.ok(typeof value === "string" && value.trim());
  }
});
