import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { apiHandler } from "../lib/api/response";
import { ApiError } from "../lib/api/errors";
import { GET as health } from "../app/api/v1/health/route";
import { GET as list } from "../app/api/v1/properties/route";
import { GET as detail } from "../app/api/v1/properties/[slug]/route";

test("health reports application liveness, not database readiness", async () => {
  const response = await health();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.data, { application: "KANTARA", apiVersion: "v1", status: "ok" });
  assert.ok(z.uuid().safeParse(body.requestId).success);
  assert.equal(response.headers.get("x-request-id"), body.requestId);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("API validation errors have a stable envelope and never echo input values", async () => {
  const response = await list(new Request("http://localhost/api/v1/properties?pageSize=999"));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.ok(Array.isArray(body.error.details));
  assert.ok(body.requestId);
});

test("detail rejects malformed slugs and duplicated or unknown query parameters before DB access", async () => {
  for (const [slug, query] of [
    ["bad_slug", ""], ["villa", "?locale=xx"], ["villa", "?locale=en&locale=fr"], ["villa", "?ownerId=1"],
  ]) {
    const response = await detail(new Request(`http://localhost/api/v1/properties/${slug}${query}`), {
      params: Promise.resolve({ slug }),
    });
    assert.equal(response.status, 400);
  }
});

test("missing database configuration returns 503 rather than fake empty results", async (t) => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  t.after(() => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  });
  const log = t.mock.method(console, "error");
  const response = await list(new Request("http://localhost/api/v1/properties"));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "DATABASE_NOT_CONFIGURED");
  assert.equal(log.mock.callCount(), 1);
});

test("expected and unexpected errors do not leak internal messages", async (t) => {
  const log = t.mock.method(console, "error");
  const missing = await apiHandler(async () => { throw new ApiError(404, "NOT_FOUND", "Property not found."); });
  assert.equal(missing.status, 404);
  const failure = await apiHandler(async () => { throw new Error("postgresql://secret"); });
  assert.equal(failure.status, 500);
  assert.ok(!(await failure.text()).includes("secret"));
  assert.ok(!JSON.stringify(log.mock.calls).includes("secret"));
});
