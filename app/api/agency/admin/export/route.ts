import { apiHandler } from "@/lib/api/response";
import { connection } from "next/server";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
import { requireAdmin } from "@/services/team/domain";

export async function GET(request: Request) {
  await connection();
  let download: Response | undefined;
  const response = await apiHandler(async () => {
    guardAgency(request);
    const business = await agencyTransaction((state) => { requireAdmin(agencyAccount(state.team, request)); return state.business; });
    download = Response.json({ version: 1, exportedAt: new Date().toISOString(), state: business }, { headers: {
      "Content-Disposition": 'attachment; filename="kantara-agency.json"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    return { data: null };
  });
  return download ?? response;
}
