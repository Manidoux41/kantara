import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/response";
import type { BusinessState } from "@/lib/demo/business-types";
import { createBusinessState, getRevenueSummary } from "./business";
import { getCrmSummary } from "./crm";
import { recoverMemoryWorkspace, workspaceRepository } from "./repository";
import { agencyEnabled } from "@/lib/database-config";

const cookieName = "kantara-demo-workspace";
const workspaceCookie = (id: string) => `${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/api/demo; Max-Age=2592000`;
function requestedWorkspaceId(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return cookie && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(cookie) ? cookie : null;
}

export async function readDemoCatalogue(request: Request) {
  guardDemoRequest(request);
  const id = requestedWorkspaceId(request);
  if (id) {
    const state = await workspaceRepository().read(id) ?? await recoverMemoryWorkspace(id);
    if (state) return { state, cookie: workspaceCookie(id) };
  }
  // Anonymous browsing uses the explicit fictional catalogue without allocating a CRM workspace.
  return { state: createBusinessState(), cookie: undefined };
}

export function guardDemoRequest(request: Request, environment = process.env.NODE_ENV) {
  const url = new URL(request.url);
  if (agencyEnabled() || environment !== "development" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new ApiError(404, "NOT_FOUND", "This demo API is available only in local development.");
  }
  const origin = request.headers.get("origin");
  if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(403, "FORBIDDEN", "Cross-origin demo requests are not allowed.");
  }
  if (request.method !== "GET" && (origin !== url.origin || request.headers.get("x-kantara-demo") !== "local")) {
    throw new ApiError(403, "FORBIDDEN", "Same-origin local demo confirmation is required.");
  }
}

export async function getDemoSession(request: Request) {
  guardDemoRequest(request);
  const repository = workspaceRepository();
  const cookie = requestedWorkspaceId(request);
  if (cookie) {
    const existing = await repository.read(cookie);
    if (existing) return { id: cookie, session: { state: existing }, cookie: workspaceCookie(cookie), repository };
    const previous = await recoverMemoryWorkspace(cookie);
    if (previous) return { id: cookie, session: { state: await repository.create(cookie, previous) }, cookie: workspaceCookie(cookie), repository };
  }
  const id = randomUUID();
  return { id, session: { state: await repository.create(id) }, cookie: workspaceCookie(id), repository };
}
export function sessionCookie(response: Response, cookie: string | undefined) {
  if (cookie) response.headers.set("Set-Cookie", cookie);
  return response;
}
export function demoStateResponse(request: Request, operation?: (state: BusinessState) => BusinessState) {
  let cookie: string | undefined;
  return apiHandler(async () => {
    const workspace = await getDemoSession(request);
    cookie = workspace.cookie;
    if (operation) workspace.session.state = await workspace.repository.update(workspace.id, operation);
    return {
      data: { ...workspace.session.state, revenue: getRevenueSummary(workspace.session.state), crm: getCrmSummary(workspace.session.state),
        storage: process.env.DEMO_STORAGE ?? "file" },
    };
  }).then((response) => sessionCookie(response, cookie));
}
