import assert from "node:assert/strict";
import test from "node:test";
import type { BusinessState, RevenueSummary } from "../../lib/demo/business-types";
import { sampleContract } from "../helpers/business";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const enabled = process.env.TEST_DEMO_API === "true";
type Snapshot = BusinessState & { revenue: RevenueSummary };

async function workspace() {
  const first = await fetch(`${baseUrl}/api/demo/admin`);
  assert.equal(first.status, 200);
  const cookie = first.headers.get("set-cookie")!.split(";")[0];
  let state: Snapshot = (await first.json()).data;
  const headers = { cookie, origin: new URL(baseUrl).origin, "X-Kantara-Demo": "local", "Content-Type": "application/json" };
  return {
    cookie, get state() { return state; },
    async read() {
      const response = await fetch(`${baseUrl}/api/demo/admin`, { headers: { cookie } });
      assert.equal(response.status, 200);
      state = (await response.json()).data;
      return state;
    },
    async command(command: Record<string, unknown>, status = 200) {
      const response = await fetch(`${baseUrl}/api/demo/admin`, {
        method: "POST", headers, body: JSON.stringify({ ...command, revision: state.revision }),
      });
      const body = await response.json();
      assert.equal(response.status, status, JSON.stringify(body));
      if (response.ok) state = body.data;
      return body;
    },
    async catalogue() {
      const response = await fetch(`${baseUrl}/api/demo/catalogue`, { headers: { cookie } });
      assert.equal(response.status, 200);
      return (await response.json()).data;
    },
    async pdf(id: string) {
      const response = await fetch(`${baseUrl}/api/demo/admin/contracts/${id}/pdf`, { headers: { cookie } });
      assert.equal(response.status, 200, await (async () => response.ok ? "" : response.text())());
      assert.equal(response.headers.get("content-type"), "application/pdf");
      assert.match(response.headers.get("content-disposition")!, /attachment/);
      const pdf = new Uint8Array(await response.arrayBuffer());
      assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
      assert.ok(pdf.length > 20000);
      return pdf;
    },
  };
}

test("local API: new client → multiple properties → linked mandate → publication → sale → receipts → public projection", { skip: !enabled }, async () => {
  const api = await workspace();
  await api.command({ action: "createClient", input: {
    name: "HTTP OWNER TEST", role: "OWNER", address: "Adresse fictive HTTP", nationality: "KH TEST",
    identityReference: "HTTP-TEST-ID", email: "", phone: "", propertyIds: [],
  } });
  const ownerId = api.state.clients.at(-1)!.id;
  for (const title of ["HTTP MAISON A", "HTTP MAISON B"]) await api.command({ action: "createProperty", input: {
    title, address: "Adresse fictive HTTP", titleReference: "HTTP-TITRE", ownerId,
    type: "house", location: "kampot", transaction: "sale", price: "100000.10", area: 120, bedrooms: 2, bathrooms: 1, rooms: 4,
  } });
  const properties = api.state.properties.slice(-2);
  assert.ok(!(await api.catalogue()).some((item: { id: string }) => item.id === properties[0].id));
  await api.command({ action: "createClient", input: {
    name: "HTTP BUYER TEST", role: "BUYER", address: "Adresse fictive", nationality: "TEST",
    identityReference: "HTTP-BUYER-ID", email: "", phone: "", propertyIds: properties.map((item) => item.id),
  } });
  assert.equal(api.state.clients.at(-1)?.propertyIds.length, 2);
  await api.command({ action: "createContract", input: {
    ...sampleContract(), ownerId, lines: properties.map((property, index) => ({
      propertyId: property.id, price: "100000.10", expectedCommission: index ? "200.25" : "100.25",
    })),
  } });
  assert.equal(api.state.revenue.expected, "300.50");
  const contractId = api.state.contracts[0].id;
  await api.pdf(contractId);
  await api.command({ action: "publish", propertyId: properties[0].id, published: true });
  const publicationDate = api.state.properties.at(-2)!.publishedAt;
  await api.command({ action: "closeTransaction", contractId, propertyId: properties[0].id, closedAt: "2026-11-03", commission: "75.30" });
  const transactionId = api.state.transactions[0].id;
  await api.command({ action: "recordReceipt", transactionId, amount: "0.10", paidAt: "2026-11-04", reference: "PAY-1" });
  await api.command({ action: "recordReceipt", transactionId, amount: "75.20", paidAt: "2026-11-04", reference: "PAY-2" });
  await api.command({ action: "recordReceipt", transactionId, amount: "0.01", paidAt: "2026-11-04", reference: "OVER" }, 409);
  const after = await api.read();
  assert.deepEqual(after.revenue, { expected: "200.25", realized: "75.30", received: "75.30", outstanding: "0.00" });
  assert.equal(after.properties.at(-2)?.availability, "SOLD");
  assert.equal(after.properties.at(-2)?.publishedAt, publicationDate);
  const catalogue = await api.catalogue();
  const sold = catalogue.find((item: { id: string }) => item.id === properties[0].id);
  assert.equal(sold.availability, "SOLD");
  assert.equal("ownerId" in sold, false);
  assert.equal("titleReference" in sold, false);
  assert.equal(JSON.stringify(catalogue).includes("HTTP-TEST-ID"), false);
  await api.command({ action: "publish", propertyId: properties[0].id, published: false });
  assert.ok(!(await api.catalogue()).some((item: { id: string }) => item.id === properties[0].id));
});

test("local API: tenant linked to multiple properties, rental mandate and English–Khmer lease PDFs, rental closing", { skip: !enabled, timeout: 90000 }, async () => {
  const api = await workspace();
  await api.command({ action: "createClient", input: {
    name: "HTTP TENANT TEST", role: "TENANT", address: "Adresse fictive HTTP", nationality: "TEST",
    identityReference: "HTTP-TENANT-ID", email: "", phone: "", propertyIds: ["DEMO-002", "DEMO-004"],
  } });
  const tenantId = api.state.clients.at(-1)!.id;
  await api.command({ action: "createContract", input: { ...sampleContract("RENTAL_MANDATE"), language: "en-km" } });
  const mandateId = api.state.contracts[0].id;
  await api.command({ action: "createContract", input: {
    ...sampleContract("LEASE"), language: "en-km", counterpartyId: tenantId,
    lines: [{ propertyId: "DEMO-002", price: "850", expectedCommission: "0" }],
  } });
  assert.equal(api.state.revenue.expected, "1000.25");
  await api.pdf(mandateId);
  await api.pdf(api.state.contracts[1].id);
  await api.command({ action: "closeTransaction", contractId: mandateId, propertyId: "DEMO-002", closedAt: "2026-11-03", commission: "850" });
  await api.command({ action: "closeTransaction", contractId: mandateId, propertyId: "DEMO-002", closedAt: "2026-11-03", commission: "850" }, 409);
  assert.equal((await api.read()).properties.find((item) => item.id === "DEMO-002")?.availability, "RENTED");
  assert.equal((await api.catalogue()).find((item: { id: string }) => item.id === "DEMO-002").availability, "RENTED");
});

test("local API: independent workspace cookies, CSRF/host guards, size and validation errors preserve state", { skip: !enabled }, async () => {
  const api = await workspace(), second = await workspace();
  assert.notEqual(api.cookie, second.cookie);
  const headers = { cookie: api.cookie, origin: new URL(baseUrl).origin, "X-Kantara-Demo": "local", "Content-Type": "application/json" };
  for (const [body, status] of [["{", 400], [" ".repeat(65537), 413], ['{"action":"bogus"}', 400]] as const) {
    const response = await fetch(`${baseUrl}/api/demo/admin`, { method: "POST", headers, body });
    assert.equal(response.status, status);
  }
  const forbidden = await fetch(`${baseUrl}/api/demo/admin`, { method: "POST", headers: { ...headers, origin: "http://untrusted.example" }, body: "{}" });
  assert.equal(forbidden.status, 403);
  assert.equal((await api.read()).revision, 0);
  await api.command({ action: "createContract", input: sampleContract() });
  const inaccessible = await fetch(`${baseUrl}/api/demo/admin/contracts/${api.state.contracts[0].id}/pdf`, { headers: { cookie: second.cookie } });
  assert.equal(inaccessible.status, 404);
  assert.equal((await second.read()).contracts.length, 0);
});

test("production never exposes demo business records or PDF endpoints", { skip: enabled }, async () => {
  for (const path of ["/api/demo/admin", "/api/demo/admin?invalid=true", "/api/demo/catalogue", "/api/demo/catalogue?invalid=true", "/api/demo/admin/contracts/missing/pdf", "/api/demo/admin/calendar", "/api/demo/admin/export"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404, path);
    assert.equal((await response.json()).error.code, "NOT_FOUND");
    assert.equal(response.headers.has("set-cookie"), false);
  }
});
