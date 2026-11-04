import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { calendarIcs } from "@/lib/demo/calendar";
import { getDemoSession, guardDemoRequest, sessionCookie } from "@/services/demo/session";

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  let result: Response | undefined;
  const error = await apiHandler(async () => {
    guardDemoRequest(request);
    if (query) throw new ApiError(400, "VALIDATION_ERROR", "Query parameters are not supported.");
    const workspace = await getDemoSession(request);
    result = sessionCookie(new Response(calendarIcs(workspace.session.state), { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kantara-demo.ics"',
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } }), workspace.cookie);
    return { data: null };
  });
  return result ?? error;
}
