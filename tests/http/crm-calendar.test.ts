import assert from "node:assert/strict";
import test from "node:test";
import type { BusinessState } from "../../lib/demo/business-types";
import { appointmentUtc } from "../../lib/demo/calendar";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
test("HTTP CRM and calendar: relational writes, revisions, ICS changes, isolated exports and persistent read-back", {
  skip: process.env.TEST_DEMO_API !== "true",
}, async () => {
  const first = await fetch(`${baseUrl}/api/demo/admin`);
  assert.equal(first.status, 200);
  const cookie = first.headers.get("set-cookie")!.split(";")[0];
  assert.match(first.headers.get("set-cookie")!, /Max-Age=2592000/);
  const initial = await first.json();
  assert.equal(initial.data.storage, "file");
  let state: BusinessState = initial.data;
  const headers = { cookie, origin: new URL(baseUrl).origin, "X-Kantara-Demo": "local", "Content-Type": "application/json" };
  const command = async (input: Record<string, unknown>, expected = 200) => {
    const response = await fetch(`${baseUrl}/api/demo/admin`, { method: "POST", headers, body: JSON.stringify({ ...input, revision: state.revision }) });
    const body = await response.json();
    assert.equal(response.status, expected, JSON.stringify(body));
    if (response.ok) state = body.data;
    return body;
  };
  await command({ action: "createClient", input: {
    name: "CONTACT AGENDA TEST", role: "BUYER", address: "Adresse fictive", nationality: "TEST", identityReference: "CAL-TEST", email: "", phone: "", propertyIds: [],
  } });
  const clientId = state.clients.at(-1)!.id;
  await command({ action: "createLead", input: {
    title: "Prospect agenda TEST", clientId, agentId: "AGENT-DEMO-1", source: "DIRECT", propertyIds: ["DEMO-001"], score: 75,
    expectedCommission: "1250.25", expectedClosingDate: null, followUpDate: null, notes: "Données fictives",
  } });
  const leadId = state.leads[0].id;
  const day = new Date(Date.now() + 2 * 86400000);
  while (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1);
  const date = day.toISOString().slice(0, 10);
  const input = {
    title: "Visite API TEST", clientId, agentId: "AGENT-DEMO-1", propertyId: "DEMO-001", leadId, location: "Siem Reap DEMO", notes: "Fictif",
    startAt: appointmentUtc(`${date}T09:00`), endAt: appointmentUtc(`${date}T10:00`),
  };
  await command({ action: "createAppointment", input });
  const appointmentId = state.appointments[0].id;
  await command({ action: "createAppointment", input }, 409);
  const download = async () => {
    const response = await fetch(`${baseUrl}/api/demo/admin/calendar`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type")!, /text\/calendar/);
    return response.text();
  };
  const original = await download();
  assert.ok(original.includes(`UID:${appointmentId}@kantara.demo`));
  assert.ok(original.includes("SEQUENCE:0"));
  await command({ action: "rescheduleAppointment", appointmentId, input: { ...input, startAt: appointmentUtc(`${date}T10:00`), endAt: appointmentUtc(`${date}T11:00`) } });
  assert.ok((await download()).includes("SEQUENCE:1"));
  await command({ action: "finishAppointment", appointmentId, status: "CANCELLED", feedback: "Report fictif du client", interest: "UNKNOWN" });
  assert.ok((await download()).includes("STATUS:CANCELLED"));
  await command({ action: "advanceLead", leadId, stage: "QUALIFIED", lostReason: "", followUpDate: date });
  const readBack = await fetch(`${baseUrl}/api/demo/admin`, { headers: { cookie } });
  const snapshot = (await readBack.json()).data;
  assert.equal(snapshot.appointments[0].status, "CANCELLED");
  assert.equal(snapshot.leads[0].clientId, clientId);
  assert.equal(snapshot.crm.openLeads, 1);
  const exported = await fetch(`${baseUrl}/api/demo/admin/export`, { headers: { cookie } });
  const backup = await exported.json();
  assert.equal(backup.version, 1);
  for (const key of ["revision", "clients", "properties", "contracts", "transactions", "agents", "leads", "appointments", "activities"] as const) {
    assert.deepEqual(backup.state[key], state[key], key);
  }
  assert.equal("crm" in backup.state, false, "Derived totals should be recomputed after migration");
  const foreign = await fetch(`${baseUrl}/api/demo/admin/calendar`);
  assert.equal((await foreign.text()).includes(appointmentId), false);
  const crossOrigin = await fetch(`${baseUrl}/api/demo/admin/export`, { headers: { cookie, origin: "http://untrusted.invalid" } });
  assert.equal(crossOrigin.status, 403);
});
