import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encryptAgency, decryptAgency } from "../services/agency/crypto";
import { databaseUrl } from "../lib/database-config";
import { agencyDetailsInput } from "../lib/properties/agency-details";
import { agencyMediaInput } from "../lib/properties/agency-media";
import { login, requireAccount } from "../services/team/session";
import { agencyBusiness } from "../services/agency/business";
import { initialTeam } from "./helpers/team";
import { createBusinessState } from "../services/demo/business";
import { calendarIcs } from "../lib/demo/calendar";

test("agency encryption authenticates payloads and fails closed on a different key", () => {
  const previous = process.env.AGENCY_ENCRYPTION_KEY;
  try {
    process.env.AGENCY_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    const value = { privateDocument: "CONFIDENTIAL TEST ONLY" };
    const encrypted = encryptAgency(value);
    assert.ok(!encrypted.includes(value.privateDocument)); assert.deepEqual(decryptAgency(encrypted), value);
    const parts = encrypted.split("."); parts[2] = Buffer.alloc(16).toString("base64");
    assert.throws(() => decryptAgency(parts.join(".")), /could not be decrypted/);
    process.env.AGENCY_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    assert.throws(() => decryptAgency(encrypted), /could not be decrypted/);
    delete process.env.AGENCY_ENCRYPTION_KEY;
    assert.throws(() => encryptAgency(value), /AGENCY_ENCRYPTION_KEY/);
  } finally { if (previous) process.env.AGENCY_ENCRYPTION_KEY = previous; else delete process.env.AGENCY_ENCRYPTION_KEY; }
});
test("PostgreSQL aliases distinguish pooled runtime from migration preference", () => {
  const environment = { DATABASE_URL: "postgres://db", DATABASE_URL_POOLED: "postgres://pool", POSTGRES_URL: "postgres://direct" };
  assert.equal(databaseUrl(environment), environment.DATABASE_URL_POOLED);
  assert.equal(databaseUrl(environment, true), environment.POSTGRES_URL);
  assert.equal(databaseUrl({ PRISMA_DATABASE_URL: "prisma+postgres://not-a-pg-connection" }), undefined);
});
test("production details/media validate coordinates, UUIDs, and payload shapes", () => {
  const input = { action: "propertyDetails", revision: 0, propertyId: "00000000-0000-4000-8000-000000000001", description: "Test property description", coordinates: { latitude: 13.3, longitude: 103.8 } };
  assert.equal(agencyDetailsInput.safeParse(input).success, true);
  assert.equal(agencyDetailsInput.safeParse({ ...input, coordinates: { latitude: 91, longitude: 103 } }).success, false);
  assert.equal(agencyMediaInput.safeParse({ propertyId: "DEMO-001", kind: "PHOTO", name: "test.jpg", mime: "image/jpeg", base64: "AAAA" }).success, false);
});
test("production email login and cookies are distinct from demo sessions", async () => {
  const team = await initialTeam(); team.accounts[0].login = "admin@example.invalid";
  const password = (await import("./helpers/team-fixtures")).testAdminPassword;
  const result = await login(team, { action: "login", login: "ADMIN@example.invalid", password });
  assert.ok(result.token);
  const request = new Request("https://agency.example/api/agency/admin", { headers: { Cookie: `kantara-agency-session=${result.token}` } });
  assert.throws(() => requireAccount(team, request), /Sign in/);
  assert.equal(requireAccount(team, request, false, Date.now(), "kantara-agency-session").role, "ADMIN");
});
test("agent business projection excludes unassigned CRM, contracts and private identity references", async () => {
  const team = await initialTeam(), business = createBusinessState();
  const agentId = "00000000-0000-4000-8000-000000000099";
  team.propertyAssignments[business.properties[0].id] = agentId;
  const account = { ...team.accounts[0], role: "AGENT" as const, agentId };
  const scoped = agencyBusiness({ version: 1, business, team }, account);
  assert.equal(scoped.properties.length, 1); assert.equal(scoped.properties[0].titleReference, "");
  assert.equal(scoped.contracts.length, 0); assert.equal(scoped.clients.length, 0); assert.equal(scoped.transactions.length, 0);
  assert.ok(!calendarIcs(scoped, true).includes("DEMO"));
});
