import test from "node:test";
import assert from "node:assert/strict";
import { api, adminCookie, baseUrl, enabled } from "../helpers/agency-http";
test("production auth: isolated admin, invalid password, CSRF, private files and session revocation", { skip: !enabled, timeout: 60000 }, async () => {
  assert.equal((await api("admin")).status, 401);
  assert.equal((await api("media?propertyId=00000000-0000-4000-8000-000000000001")).status, 401);
  assert.equal((await api("team", { action: "login", login: process.env.ADMIN_EMAIL, password: "Incorrect-password-for-validation" })).status, 401);
  const cookie = await adminCookie();
  const response = await api("team", undefined, cookie); assert.equal(response.status, 200);
  const state = (await response.json()).data; assert.equal(state.account.role, "ADMIN");
  assert.equal(JSON.stringify(state).includes("passwordHash"), false);
  const csrf = await fetch(`${baseUrl}/api/agency/admin`, { method: "POST", headers: {
    Cookie: cookie, Origin: "https://not-the-agency.invalid", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish", revision: 0, propertyId: "test", published: true }) });
  assert.equal(csrf.status, 403);
  const exportResponse = await api("admin/export", undefined, cookie); assert.equal(exportResponse.status, 200);
  assert.ok(exportResponse.headers.get("cache-control")?.includes("no-store"));
  assert.equal((await api("team", { action: "logout" }, cookie)).status, 200);
  assert.equal((await api("admin", undefined, cookie)).status, 401);
  const catalogue = await fetch(`${baseUrl}/api/v1/catalogue`); assert.equal(catalogue.status, 200);
  assert.deepEqual((await catalogue.json()).data, []);
});
