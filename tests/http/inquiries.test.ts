import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("HTTP contact: localized deep links, configuration disclosure, explicit missing delivery and rejected cross-origin/private fields", async () => {
  const page = await fetch(`${baseUrl}/fr/properties/DEMO-001`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("La villa des lotus"));
  assert.equal((await fetch(`${baseUrl}/fr/properties/DEMO-999`)).status, 404);
  const status = await fetch(`${baseUrl}/api/v1/inquiries?propertyId=DEMO-001`);
  assert.equal(status.status, 200);
  const config = await status.json();
  assert.equal(typeof config.data.enabled, "boolean");
  assert.equal(config.data.agentEmail, undefined);
  assert.equal(config.data.recipient, undefined);
  assert.match(status.headers.get("cache-control") ?? "", /no-store/);
  assert.equal((await fetch(`${baseUrl}/api/v1/inquiries?propertyId=DEMO-001&propertyId=DEMO-002`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/v1/inquiries?propertyId=DEMO-001&email=x`)).status, 400);
  const input = { requestId: randomUUID(), propertyId: "DEMO-001", locale: "fr", name: "FICTIONAL HTTP TEST",
    email: "fictional@example.test", phone: "", purpose: "INFORMATION", preferredDate: "",
    message: "A fictional HTTP-only request that must not send email.", consent: true, website: "", turnstileToken: "fake-unverified-token" };
  const post = (body: unknown, origin = new URL(baseUrl).origin) => fetch(`${baseUrl}/api/v1/inquiries`, {
    method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body),
  });
  assert.equal((await post(input, "https://foreign.example")).status, 403);
  assert.equal((await post({ ...input, recipient: "arbitrary@example.test" })).status, 400);
  assert.equal((await post({ ...input, consent: false })).status, 400);
  assert.equal((await post({ ...input, message: "x".repeat(17000) })).status, 413);
  if (!config.data.enabled) {
    const disabled = await post(input);
    assert.equal(disabled.status, 503);
    assert.equal((await disabled.json()).error.code, "CONTACT_SETUP");
  }
});

test("production also closes local inquiry routes", { skip: process.env.TEST_DEMO_API === "true" }, async () => {
  assert.equal((await fetch(`${baseUrl}/api/demo/inquiries?propertyId=DEMO-001`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/demo/inquiries`, { method: "POST", headers: { "content-type": "application/json", origin: baseUrl }, body: "{}" })).status, 404);
});
