import { randomUUID } from "node:crypto";
import type { TeamState } from "../../lib/team/schema";
import { hashPassword } from "../../services/team/passwords";
import { executeTeamCommand } from "../../services/team/domain";
import { employmentExample } from "../../lib/team/examples";
import { testAdminLogin, testAdminPassword, testAgentPassword, testIdentity } from "./team-fixtures";

export { testAdminLogin, testAdminPassword, testAgentPassword, testIdentity } from "./team-fixtures";
export async function initialTeam(): Promise<TeamState> {
  return { version: 1, revision: 0, accounts: [{
    id: randomUUID(), name: "Admin TEST", login: testAdminLogin, role: "ADMIN", agentId: null,
    passwordHash: await hashPassword(testAdminPassword), active: true, mustChangePassword: false,
  }], candidates: [], sessions: [], attempts: [], propertyAssignments: {}, work: [], audit: [], inquiries: [] };
}
export async function onboard(state: TeamState, login = "agent.test") {
  const admin = state.accounts[0];
  const run = (input: Record<string, unknown>) => executeTeamCommand(state, admin, { ...input, revision: state.revision });
  await run({ action: "candidate", input: { name: `AGENT ${login} DEMO`, address: "FICTIONAL ADDRESS", identityReference: "FICTIONAL-ID" } });
  const candidate = state.candidates.at(-1)!;
  await run({ action: "upload", candidateId: candidate.id, input: testIdentity });
  await run({ action: "review", candidateId: candidate.id, documentId: candidate.documents[0].id, approved: true });
  await run({ action: "contract", candidateId: candidate.id, input: employmentExample });
  await run({ action: "activate", candidateId: candidate.id, contractId: candidate.contract!.id, login,
    temporaryPassword: testAgentPassword, signedOn: new Date().toISOString().slice(0, 10), legalReviewConfirmed: true, signatureConfirmed: true });
  return { candidate, account: state.accounts.at(-1)!, run };
}
