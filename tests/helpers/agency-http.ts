import assert from "node:assert/strict";
export const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
export const enabled = process.env.TEST_AGENCY_API === "true";
export async function api(path: string, input?: unknown, cookie?: string) {
  return fetch(`${baseUrl}/api/agency/${path}`, { method: input ? "POST" : "GET",
    headers: { Origin: baseUrl, ...(input ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: input ? JSON.stringify(input) : undefined });
}
export async function adminCookie() {
  assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, "Use only isolated test admin credentials.");
  const response = await api("team", { action: "login", login: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")!.split(";")[0];
}
export async function business(cookie: string) {
  const response = await api("admin", undefined, cookie); assert.equal(response.status, 200);
  return (await response.json()).data;
}
export async function command(cookie: string, input: Record<string, unknown>) {
  const state = await business(cookie);
  const response = await api("admin", { ...input, revision: state.revision }, cookie);
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result.error));
  return result.data;
}
