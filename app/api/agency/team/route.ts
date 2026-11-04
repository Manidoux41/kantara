import { z } from "zod";
import { connection } from "next/server";
import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/read-json";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, agencyCookie, agencyCookieName, guardAgency } from "@/services/agency/session";
import { changePassword, login, logout } from "@/services/team/session";
import { executeTeamCommand, publicAccount, teamView } from "@/services/team/domain";

export async function GET(request: Request) {
  await connection();
  return apiHandler(async () => {
    guardAgency(request);
    if (new URL(request.url).search) throw new ApiError(400, "VALIDATION_ERROR", "Query parameters are not supported.");
    return { data: await agencyTransaction(({ team, business }) => {
      const account = agencyAccount(team, request, true);
      if (account.mustChangePassword) return { revision: team.revision, account: publicAccount(account), properties: [], work: [], inquiries: [] };
      return teamView(team, account, business.properties);
    }) };
  });
}
export async function POST(request: Request) {
  let token: string | null | undefined;
  const response = await apiHandler(async () => {
    guardAgency(request);
    const raw = await readJson(request, 4 * 1024 * 1024);
    const { action } = z.object({ action: z.string() }).parse(raw);
    if (action === "login") {
      const result = await agencyTransaction(({ team }) => login(team, raw), true);
      if (result.error) throw result.error;
      token = result.token;
      return { data: { account: publicAccount(result.account) } };
    }
    return { data: await agencyTransaction(async (state) => {
      const { team, business } = state;
      if (action === "logout") {
        z.strictObject({ action: z.literal("logout") }).parse(raw);
        logout(team, request, agencyCookieName); token = null; return null;
      }
      const account = agencyAccount(team, request, action === "changePassword");
      if (action === "changePassword") token = await changePassword(team, account, raw);
      else {
        if (action === "sampleWork") throw new ApiError(400, "VALIDATION_ERROR", "Sample work is disabled in production.");
        await executeTeamCommand(team, account, raw, new Date(), business.properties);
        business.agents = team.accounts.filter((item) => item.role === "AGENT" && item.agentId).map((item) => {
          const previous = business.agents.find((entry) => entry.id === item.agentId);
          return { id: item.agentId!, name: item.name, active: item.active,
            workdays: previous?.workdays ?? [1, 2, 3, 4, 5], startMinute: previous?.startMinute ?? 540, endMinute: previous?.endMinute ?? 1020 };
        });
        business.revision++;
      }
      return teamView(team, account, business.properties);
    }, true) };
  });
  if (token !== undefined) response.headers.set("Set-Cookie", agencyCookie(token, request));
  return response;
}
