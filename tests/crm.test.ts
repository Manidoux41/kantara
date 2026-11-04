import assert from "node:assert/strict";
import test from "node:test";
import { createBusinessState, executeBusinessCommand } from "../services/demo/business";
import { getCrmSummary } from "../services/demo/crm";
import { appointmentInput, contactProfileInput } from "../lib/validations/crm";
import { calendarIcs, appointmentUtc, localAppointmentTime } from "../lib/demo/calendar";
import { crmMessages } from "../lib/i18n/crm";
import { locales } from "../lib/i18n/routing";

const now = new Date("2026-11-04T00:00:00Z");
function contactState() {
  return executeBusinessCommand(createBusinessState(), { action: "createClient", revision: 0, input: {
    name: "CRM TEST", role: "BUYER", address: "Adresse fictive", nationality: "TEST", identityReference: "CRM-IDENTITE", email: "crm@example.invalid", phone: "", propertyIds: [],
  } }, now);
}
test("linked contact enrichment, communication timeline and lead lifecycle never duplicate contacts or realize commission", () => {
  let state = contactState();
  const clientId = state.clients.at(-1)!.id;
  const profile = contactProfileInput.parse({
    firstName: "CRM", lastName: "TEST", company: "DEMO", whatsapp: "+855 DEMO", country: "KH", preferredLanguage: "fr",
    categories: ["BUYER", "INVESTOR"], source: "DIRECT", assignedAgentId: "AGENT-DEMO-1", notes: "Fictif", tags: ["investor"], followUpDate: "2026-11-03",
  });
  state = executeBusinessCommand(state, { action: "updateContact", revision: state.revision, clientId, profile }, now);
  state = executeBusinessCommand(state, { action: "addActivity", revision: state.revision, clientId, leadId: null, channel: "WHATSAPP", text: "Discussion fictive consignée sans envoi" }, now);
  const lead = {
    clientId, agentId: "AGENT-DEMO-1", title: "Prospect TEST", source: "DIRECT" as const, propertyIds: ["DEMO-001", "DEMO-003"],
    score: 75, expectedCommission: "1000.25", expectedClosingDate: "2026-12-01", followUpDate: "2026-11-03", notes: "DEMO",
  };
  state = executeBusinessCommand(state, { action: "createLead", revision: state.revision, input: lead }, now);
  assert.throws(() => executeBusinessCommand(state, { action: "createLead", revision: state.revision, input: lead }, now), /open lead/);
  assert.equal(state.clients.length, 2);
  assert.deepEqual(state.clients.at(-1)!.propertyIds, ["DEMO-001", "DEMO-003"]);
  const leadId = state.leads[0].id;
  assert.throws(() => executeBusinessCommand(state, { action: "advanceLead", revision: state.revision, leadId, stage: "LOST", lostReason: "", followUpDate: null }, now), /reason/);
  for (const stage of ["CONTACTED", "QUALIFIED", "VISIT", "WON"] as const) {
    state = executeBusinessCommand(state, { action: "advanceLead", revision: state.revision, leadId, stage, lostReason: "", followUpDate: null }, now);
  }
  assert.equal(getCrmSummary(state, now).conversionRate, 100);
  assert.equal(state.transactions.length, 0);
  assert.equal(state.clients.length, 2);
  assert.ok(state.activities.filter((item) => item.clientId === clientId).length >= 7);
  assert.equal(state.activities.some((item) => item.channel === "WHATSAPP"), true);
  assert.throws(() => executeBusinessCommand(state, { action: "advanceLead", revision: state.revision, leadId, stage: "NEW", lostReason: "", followUpDate: null }, now));
  assert.throws(() => executeBusinessCommand(state, { action: "createClient", revision: state.revision, input: {
    name: "Duplicated TEST", role: "BUYER", address: "Adresse fictive", nationality: "TEST", identityReference: "CRM-IDENTITE", email: "CRM@example.invalid", phone: "", propertyIds: [],
  } }, now), /already uses/);
});

test("calendar enforces related records, duration, agent/client availability, overlap, rescheduling and feedback", () => {
  let state = contactState();
  const clientId = state.clients.at(-1)!.id;
  const input = {
    clientId, agentId: "AGENT-DEMO-1", propertyId: "DEMO-001", leadId: null, title: "Visite TEST", location: "Siem Reap DEMO",
    startAt: "2026-11-05T02:00:00.000Z", endAt: "2026-11-05T03:00:00.000Z", notes: "Fictif",
  };
  state = executeBusinessCommand(state, { action: "createAppointment", revision: state.revision, input }, now);
  const appointmentId = state.appointments[0].id;
  assert.equal(state.appointments[0].sequence, 0);
  assert.throws(() => executeBusinessCommand(state, { action: "updateAgentAvailability", revision: state.revision, agentId: "AGENT-DEMO-1", input: {
    workdays: [1, 2, 3, 4, 5], startMinute: 600, endMinute: 1080,
  } }, now), /Reschedule existing/);
  for (const changes of [
    { agentId: "missing" }, { propertyId: "missing" }, { clientId: "missing" }, { startAt: "2026-11-05T02:30:00Z", endAt: "2026-11-05T03:30:00Z" },
    { startAt: "2026-11-05T00:00:00Z", endAt: "2026-11-05T01:00:00Z" },
    { startAt: "2026-11-08T02:00:00Z", endAt: "2026-11-08T03:00:00Z" },
  ]) assert.throws(() => executeBusinessCommand(state, { action: "createAppointment", revision: state.revision, input: { ...input, ...changes } }, now));
  assert.equal(appointmentInput.safeParse({ ...input, endAt: input.startAt }).success, false);
  assert.throws(() => executeBusinessCommand(state, { action: "finishAppointment", revision: state.revision, appointmentId, status: "COMPLETED", feedback: "Visited", interest: "HIGH" }, now), /future/);
  state = executeBusinessCommand(state, { action: "rescheduleAppointment", revision: state.revision, appointmentId, input: { ...input, startAt: "2026-11-05T03:00:00Z", endAt: "2026-11-05T04:00:00Z" } }, now);
  assert.equal(state.appointments.length, 1);
  assert.equal(state.appointments[0].sequence, 1);
  assert.equal(state.appointments[0].startAt, "2026-11-05T03:00:00.000Z");
  state = executeBusinessCommand(state, { action: "finishAppointment", revision: state.revision, appointmentId, status: "COMPLETED", feedback: "Très intéressé", interest: "HIGH" }, new Date("2026-11-05T05:00:00Z"));
  assert.equal(state.appointments[0].feedback, "Très intéressé");
  assert.equal(state.appointments[0].status, "COMPLETED");
  assert.ok(state.clients.at(-1)?.propertyIds.includes("DEMO-001"));
});

test("ICS preserves stable event IDs and sequences, UTC instants, cancellations and safe UTF-8 folded text", () => {
  let state = contactState();
  const input = {
    clientId: state.clients.at(-1)!.id, agentId: "AGENT-DEMO-1", propertyId: null, leadId: null,
    title: "TEST\nBEGIN:VEVENT,;\\", location: "Lieu fictif", notes: "ខ្មែរ".repeat(100),
    startAt: appointmentUtc("2026-11-05T09:00"), endAt: appointmentUtc("2026-11-05T10:00"),
  };
  state = executeBusinessCommand(state, { action: "createAppointment", revision: state.revision, input }, now);
  const before = calendarIcs(state);
  assert.ok(before.includes("DTSTART:20261105T020000Z"));
  assert.equal(localAppointmentTime(input.startAt), "2026-11-05T09:00");
  state = executeBusinessCommand(state, { action: "finishAppointment", revision: state.revision, appointmentId: state.appointments[0].id, status: "CANCELLED", feedback: "Report fictif", interest: "UNKNOWN" }, now);
  const after = calendarIcs(state);
  assert.equal(after.match(/BEGIN:VEVENT/g)?.length, 2, "one actual event plus escaped title token");
  assert.equal(after.split("\r\n").filter((line) => line === "BEGIN:VEVENT").length, 1);
  assert.equal(before.match(/UID:[^\r]+/)?.[0], after.match(/UID:[^\r]+/)?.[0]);
  assert.ok(after.includes("STATUS:CANCELLED"));
  assert.ok(after.includes("SEQUENCE:1"));
  assert.ok(after.includes("\\nBEGIN:VEVENT\\,\\;\\\\"));
  for (const line of after.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
});

test("all seven CRM message sets have matching keys and nonempty translations", () => {
  const keys = Object.keys(crmMessages("en")).sort();
  for (const locale of locales) {
    const messages = crmMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), keys);
    for (const value of Object.values(messages)) assert.ok(typeof value === "string" && value.trim().length > 0, locale);
  }
});
