import type { AgencyState } from "./repository";
import type { TeamAccount } from "@/lib/team/schema";
import { getCrmSummary } from "@/services/demo/crm";
import { getRevenueSummary } from "@/services/demo/business";
import type { BusinessState } from "@/lib/demo/business-types";

export function agencyBusiness(state: AgencyState, account: TeamAccount) {
  if (account.role === "ADMIN") return state.business;
  const { business, team } = state;
  const propertyIds = new Set(business.properties.filter((item) => team.propertyAssignments[item.id] === account.agentId).map((item) => item.id));
  const leads = business.leads.filter((item) => item.agentId === account.agentId);
  const appointments = business.appointments.filter((item) => item.agentId === account.agentId);
  const leadIds = new Set(leads.map((item) => item.id)), appointmentIds = new Set(appointments.map((item) => item.id));
  const clientIds = new Set([...leads.map((item) => item.clientId), ...appointments.map((item) => item.clientId),
    ...business.clients.filter((item) => item.profile?.assignedAgentId === account.agentId).map((item) => item.id)]);
  const scoped: BusinessState = { revision: business.revision,
    clients: business.clients.filter((item) => clientIds.has(item.id)).map((item) => ({ ...item, identityReference: "",
      profile: item.profile?.assignedAgentId === account.agentId ? item.profile : undefined,
      propertyIds: item.propertyIds.filter((id) => propertyIds.has(id)) })),
    properties: business.properties.filter((item) => propertyIds.has(item.id)).map((item) => ({ ...item, titleReference: "" })),
    agents: business.agents.filter((item) => item.id === account.agentId), leads, appointments, contracts: [], transactions: [],
    activities: business.activities.filter((item) => (item.leadId && leadIds.has(item.leadId))
      || (item.appointmentId && appointmentIds.has(item.appointmentId))),
  };
  return scoped;
}
export function businessSnapshot(state: AgencyState, account: TeamAccount) {
  const business = agencyBusiness(state, account);
  return { ...business, revenue: getRevenueSummary(business), crm: getCrmSummary(business), storage: "postgresql" };
}
