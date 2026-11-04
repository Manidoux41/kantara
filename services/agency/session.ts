import "server-only";
import { ApiError } from "@/lib/api/errors";
import { agencyEnabled } from "@/lib/database-config";
import { requireAccount } from "@/services/team/session";
import type { TeamState } from "@/lib/team/schema";

export const agencyCookieName = "kantara-agency-session";
export function guardAgency(request: Request) {
  if (!agencyEnabled()) throw new ApiError(404, "NOT_FOUND", "Production agency is not enabled.");
  const url = new URL(request.url);
  const origin = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ? url.origin : process.env.SITE_URL;
  if (!origin || new URL(origin).origin !== origin.replace(/\/$/, "")) throw new ApiError(503, "AGENCY_SETUP", "Configure SITE_URL with the canonical origin.");
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")
    && !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new ApiError(503, "AGENCY_SETUP", "Production requires an HTTPS SITE_URL.");
  if (request.headers.get("sec-fetch-site") === "cross-site"
    || (request.headers.get("origin") && request.headers.get("origin") !== origin.replace(/\/$/, ""))
    || (request.method !== "GET" && request.headers.get("origin") !== origin.replace(/\/$/, ""))) {
    throw new ApiError(403, "FORBIDDEN", "Same-origin agency requests are required.");
  }
}
export function agencyAccount(team: TeamState, request: Request, passwordChange = false) {
  return requireAccount(team, request, passwordChange, Date.now(), agencyCookieName);
}
export function agencyCookie(token: string | null, request: Request) {
  const secure = new URL(request.url).protocol === "https:" || process.env.SITE_URL?.startsWith("https://");
  return `${agencyCookieName}=${token ?? ""}; HttpOnly; SameSite=Strict; Path=/api/agency; Max-Age=${token ? 28800 : 0}${secure ? "; Secure" : ""}`;
}
