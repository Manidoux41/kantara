import { ApiError } from "@/lib/api/errors";
import type { AgencyState } from "./repository";
import type { TeamAccount } from "@/lib/team/schema";

export function requirePropertyAccess(state: AgencyState, account: TeamAccount, propertyId: string) {
  const property = state.business.properties.find((item) => item.id === propertyId);
  if (!property || (account.role !== "ADMIN" && (!account.agentId || state.team.propertyAssignments[propertyId] !== account.agentId))) {
    throw new ApiError(404, "NOT_FOUND", "Property dossier not found.");
  }
  return property;
}
export function dossierPropertyIds(state: AgencyState, account: TeamAccount) {
  return new Set(state.business.properties.filter((item) => account.role === "ADMIN"
    || (account.agentId && state.team.propertyAssignments[item.id] === account.agentId)).map((item) => item.id));
}
