import { z } from "zod";
import { apiHandler } from "@/lib/api/response";
import { readJson } from "@/lib/api/read-json";
import { teamRepository } from "@/services/team/repository";
import { executeTeamCommand, publicAccount, teamView } from "@/services/team/domain";
import { changePassword, cookieHeader, guardTeamRequest, login, logout, requireAccount } from "@/services/team/session";

export function GET(request: Request) {
  return apiHandler(async () => {
    guardTeamRequest(request);
    return { data: await teamRepository().transact((state) => {
      const account = requireAccount(state, request, true);
      return account.mustChangePassword ? { revision: state.revision, account: publicAccount(account), properties: [], work: [] } : teamView(state, account);
    }) };
  });
}
export async function POST(request: Request) {
  let cookie: string | undefined;
  const response = await apiHandler(async () => {
    guardTeamRequest(request);
    const raw = await readJson(request, 7 * 1024 * 1024);
    const { action } = z.object({ action: z.string() }).parse(raw);
    if (action === "login") {
      const result = await teamRepository().transact((state) => login(state, raw));
      if (result.error) throw result.error;
      cookie = cookieHeader(result.token);
      return { data: { account: publicAccount(result.account) } };
    }
    return { data: await teamRepository().transact(async (state) => {
      if (action === "logout") {
        z.strictObject({ action: z.literal("logout") }).parse(raw);
        logout(state, request); cookie = cookieHeader(null);
        return null;
      }
      const account = requireAccount(state, request, action === "changePassword");
      if (action === "changePassword") {
        cookie = cookieHeader(await changePassword(state, account, raw));
      } else await executeTeamCommand(state, account, raw);
      return teamView(state, account);
    }) };
  });
  if (cookie) response.headers.set("Set-Cookie", cookie);
  return response;
}
