import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import type { BusinessState } from "@/lib/demo/business-types";
import type { CrmState, CrmSummary, Activity, DemoAgent } from "@/lib/demo/crm-types";
import type { CrmCommand } from "@/lib/validations/crm";
import { cents, money } from "./business";

export function createCrmState(): CrmState {
  return {
    agents: [
      { id: "AGENT-DEMO-1", name: "Dara DEMO", active: true, workdays: [1, 2, 3, 4, 5, 6], startMinute: 480, endMinute: 1080 },
      { id: "AGENT-DEMO-2", name: "Sophea DEMO", active: true, workdays: [1, 2, 3, 4, 5, 6], startMinute: 480, endMinute: 1080 },
    ],
    leads: [], appointments: [], activities: [],
  };
}
function conflict(message: string): never { throw new ApiError(409, "CONFLICT", message); }
function missing(): never { throw new ApiError(404, "NOT_FOUND", "Linked CRM record not found."); }
function available(agent: Pick<DemoAgent, "workdays" | "startMinute" | "endMinute">, startAt: string, endAt: string) {
  const start = new Date(Date.parse(startAt) + 7 * 3600000), end = new Date(Date.parse(endAt) + 7 * 3600000);
  return start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10)
    && agent.workdays.includes(start.getUTCDay())
    && start.getUTCHours() * 60 + start.getUTCMinutes() >= agent.startMinute
    && end.getUTCHours() * 60 + end.getUTCMinutes() <= agent.endMinute;
}
export function addSystemActivity(state: BusinessState, now: Date, action: string, linked: Partial<Pick<Activity, "clientId" | "leadId" | "appointmentId">> = {}) {
  if (state.activities.length >= 2000) conflict("Demo activity capacity reached; export the workspace before continuing.");
  state.activities.push({
    id: randomUUID(), at: now.toISOString(), action, clientId: null, leadId: null,
    appointmentId: null, channel: "SYSTEM", text: "", ...linked,
  });
}
export function applyCrmCommand(state: BusinessState, command: CrmCommand, now: Date) {
  const client = (id: string) => state.clients.find((item) => item.id === id) ?? missing();
  const lead = (id: string) => state.leads.find((item) => item.id === id) ?? missing();
  const agent = (id: string) => state.agents.find((item) => item.id === id && item.active) ?? missing();
  if (command.action === "updateAgentAvailability") {
    const assigned = agent(command.agentId);
    if (state.appointments.some((item) => item.agentId === assigned.id && item.status === "SCHEDULED"
      && item.endAt >= now.toISOString() && !available(command.input, item.startAt, item.endAt))) {
      conflict("Reschedule existing appointments before reducing availability.");
    }
    Object.assign(assigned, command.input);
    addSystemActivity(state, now, command.action);
  } else if (command.action === "updateContact") {
    if (command.profile.assignedAgentId) agent(command.profile.assignedAgentId);
    const item = client(command.clientId);
    if (!command.profile.categories.includes(item.role)) conflict("Keep the contact's primary contractual category.");
    if (command.details) {
      if (command.details.email && state.clients.some((entry) => entry.id !== item.id && entry.email.toLowerCase() === command.details!.email.toLowerCase())) conflict("Another contact already uses this email. Reuse its record.");
      Object.assign(item, command.details);
    }
    item.profile = command.profile;
    addSystemActivity(state, now, command.action, { clientId: item.id });
  } else if (command.action === "createLead") {
    if (state.leads.length >= 200) conflict("Demo lead capacity reached.");
    const person = client(command.input.clientId);
    agent(command.input.agentId);
    for (const id of command.input.propertyIds) if (!state.properties.some((item) => item.id === id)) missing();
    if (state.leads.some((item) => item.clientId === person.id && !["WON", "LOST"].includes(item.stage))) conflict("This contact already has an open lead.");
    const item = { ...command.input, id: randomUUID(), stage: "NEW" as const, lostReason: "", createdAt: now.toISOString(), updatedAt: now.toISOString() };
    state.leads.push(item);
    person.propertyIds = [...new Set([...person.propertyIds, ...item.propertyIds])];
    addSystemActivity(state, now, command.action, { clientId: person.id, leadId: item.id });
  } else if (command.action === "advanceLead") {
    const item = lead(command.leadId);
    if (["WON", "LOST"].includes(item.stage)) conflict("A closed lead cannot be changed.");
    if (command.stage === "LOST" && command.lostReason.length < 3) conflict("A lost reason is required.");
    item.stage = command.stage; item.lostReason = command.stage === "LOST" ? command.lostReason : "";
    item.followUpDate = command.followUpDate; item.updatedAt = now.toISOString();
    addSystemActivity(state, now, `lead:${command.stage}`, { clientId: item.clientId, leadId: item.id });
  } else if (command.action === "addActivity") {
    client(command.clientId);
    if (command.leadId && lead(command.leadId).clientId !== command.clientId) conflict("Lead and contact do not match.");
    addSystemActivity(state, now, command.action, { clientId: command.clientId, leadId: command.leadId });
    const item = state.activities.at(-1)!; item.channel = command.channel; item.text = command.text;
  } else if (command.action === "finishAppointment") {
    const item = state.appointments.find((entry) => entry.id === command.appointmentId) ?? missing();
    if (item.status !== "SCHEDULED") conflict("This appointment is already closed.");
    if (command.status === "COMPLETED" && item.endAt > now.toISOString()) conflict("A future appointment cannot be completed.");
    item.status = command.status; item.feedback = command.feedback; item.interest = command.interest;
    item.updatedAt = now.toISOString(); item.sequence++;
    addSystemActivity(state, now, `appointment:${command.status}`, { clientId: item.clientId, leadId: item.leadId, appointmentId: item.id });
  } else {
    const input = command.input;
    const person = client(input.clientId);
    const assigned = agent(input.agentId);
    if (input.propertyId && !state.properties.some((item) => item.id === input.propertyId)) missing();
    if (input.leadId && lead(input.leadId).clientId !== person.id) conflict("Lead and appointment contact do not match.");
    if (input.startAt < now.toISOString()) conflict("Schedule appointments in the future.");
    if (!available(assigned, input.startAt, input.endAt)) conflict("Outside the selected agent's configured availability (Asia/Phnom_Penh).");
    const existing = command.action === "rescheduleAppointment"
      ? state.appointments.find((item) => item.id === command.appointmentId) ?? missing() : undefined;
    if (existing && existing.status !== "SCHEDULED") conflict("A closed appointment cannot be rescheduled.");
    if (state.appointments.some((item) => item.id !== existing?.id && item.status === "SCHEDULED"
      && (item.agentId === input.agentId || item.clientId === input.clientId)
      && item.startAt < input.endAt && item.endAt > input.startAt)) conflict("Agent or client already has an overlapping appointment.");
    if (!existing && state.appointments.length >= 500) conflict("Demo appointment capacity reached.");
    const item = {
      ...input, id: existing?.id ?? randomUUID(), status: "SCHEDULED" as const, feedback: "", interest: "UNKNOWN" as const,
      createdAt: existing?.createdAt ?? now.toISOString(), updatedAt: now.toISOString(), sequence: (existing?.sequence ?? -1) + 1,
    };
    if (existing) Object.assign(existing, item); else state.appointments.push(item);
    if (input.propertyId && !person.propertyIds.includes(input.propertyId)) person.propertyIds.push(input.propertyId);
    addSystemActivity(state, now, command.action, { clientId: person.id, leadId: input.leadId, appointmentId: item.id });
  }
}
export function getCrmSummary(state: BusinessState, now = new Date()): CrmSummary {
  const today = now.toISOString().slice(0, 10);
  const until = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1)).toISOString().slice(0, 7);
    const transactions = state.transactions.filter((item) => item.closedAt.startsWith(month));
    const realized = transactions.reduce((sum, item) => sum + cents(item.commission), BigInt(0));
    const received = state.transactions.flatMap((item) => item.receipts).filter((item) => item.paidAt.startsWith(month)).reduce((sum, item) => sum + cents(item.amount), BigInt(0));
    return { month, realized: money(realized), received: money(received), transactions: transactions.length };
  });
  const wonLeads = state.leads.filter((item) => item.stage === "WON").length;
  return {
    contacts: state.clients.length, activeAgents: state.agents.filter((item) => item.active).length,
    openLeads: state.leads.filter((item) => !["WON", "LOST"].includes(item.stage)).length, wonLeads,
    conversionRate: state.leads.length ? Math.round(wonLeads / state.leads.length * 100) : 0,
    upcoming: state.appointments.filter((item) => item.status === "SCHEDULED" && item.endAt >= now.toISOString()).length,
    overdueFollowUps: state.leads.filter((item) => !["WON", "LOST"].includes(item.stage) && item.followUpDate && item.followUpDate < today).length
      + state.clients.filter((item) => item.profile?.followUpDate && item.profile.followUpDate < today).length,
    expiringContracts: state.contracts.filter((item) => item.endDate >= today && item.endDate <= until).length,
    published: state.properties.filter((item) => item.publication === "PUBLISHED").length,
    available: state.properties.filter((item) => item.availability === "AVAILABLE").length,
    sold: state.properties.filter((item) => item.availability === "SOLD").length,
    rented: state.properties.filter((item) => item.availability === "RENTED").length,
    sales: state.properties.filter((item) => item.transaction === "sale").length,
    rentals: state.properties.filter((item) => item.transaction === "rent").length, monthly,
  };
}
