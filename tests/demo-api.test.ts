import assert from "node:assert/strict";
import test from "node:test";
import { guardDemoRequest } from "../services/demo/session";
import { GET, POST } from "../app/api/demo/admin/route";
import { GET as PDF } from "../app/api/demo/admin/contracts/[id]/pdf/route";
import { GET as catalogue } from "../app/api/demo/catalogue/route";
import { GET as calendar } from "../app/api/demo/admin/calendar/route";
import { GET as backup } from "../app/api/demo/admin/export/route";

test("demo API requires development, loopback host and same-origin confirmation for writes", () => {
  const url = "http://localhost:3000/api/demo/admin";
  assert.doesNotThrow(() => guardDemoRequest(new Request(url), "development"));
  for (const env of ["test", "production"] as const) assert.throws(() => guardDemoRequest(new Request(url), env));
  assert.throws(() => guardDemoRequest(new Request("http://public.example/api/demo/admin"), "development"));
  const invalidHeaders: Record<string, string>[] = [{}, { origin: "http://evil.example", "x-kantara-demo": "local" }, { origin: "http://localhost:3000" }];
  for (const headers of invalidHeaders) {
    assert.throws(() => guardDemoRequest(new Request(url, { method: "POST", headers }), "development"));
  }
  assert.doesNotThrow(() => guardDemoRequest(new Request(url, { method: "POST", headers: {
    origin: "http://localhost:3000", "x-kantara-demo": "local",
  } }), "development"));
  assert.throws(() => guardDemoRequest(new Request(url, { headers: { "sec-fetch-site": "cross-site" } }), "development"));
});

test("all demo routes are closed outside development including PDF generation", async () => {
  const request = new Request("http://localhost:3000/api/demo/admin");
  for (const response of [
    await GET(request), await POST(new Request(request, { method: "POST" })), await catalogue(request),
    await PDF(request, { params: Promise.resolve({ id: "missing" }) }),
    await calendar(request), await backup(request),
  ]) {
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "NOT_FOUND");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.has("set-cookie"), false);
  }
});
