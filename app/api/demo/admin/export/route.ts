import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { getDemoSession, guardDemoRequest, sessionCookie } from "@/services/demo/session";

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  let result: Response | undefined;
  const error = await apiHandler(async () => {
    guardDemoRequest(request);
    if (query) throw new ApiError(400, "VALIDATION_ERROR", "Query parameters are not supported.");
    const workspace = await getDemoSession(request);
    result = sessionCookie(Response.json({ version: 1, exportedAt: new Date().toISOString(), state: workspace.session.state }, {
      headers: { "Content-Disposition": 'attachment; filename="kantara-demo-workspace.json"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    }), workspace.cookie);
    return { data: null };
  });
  return result ?? error;
}
