import { apiHandler } from "@/lib/api/response";
import { connection } from "next/server";
import { calendarIcs } from "@/lib/demo/calendar";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
import { agencyBusiness } from "@/services/agency/business";

export async function GET(request: Request) {
  await connection();
  let download: Response | undefined;
  const response = await apiHandler(async () => {
    guardAgency(request);
    const business = await agencyTransaction((state) => agencyBusiness(state, agencyAccount(state.team, request)));
    download = new Response(calendarIcs(business, true), { headers: { "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kantara.ics"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    return { data: null };
  });
  return download ?? response;
}
