import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ApiError } from "../lib/api/errors";
import { inquiryInput, type InquiryInput } from "../lib/properties/inquiry";
import { deliverInquiry, guardInquiryRequest, inquiryConfig, inquiryRecipient, submitInquiry, verifyInquiry, type InquiryConfig } from "../services/inquiries";
import { TeamRepository } from "../services/team/repository";
import { teamView } from "../services/team/domain";
import { onboard, testAdminLogin, testAdminPassword } from "./helpers/team";

const config: InquiryConfig = { key: "fictional-test-key", secret: "fictional-turnstile-secret", siteKey: "fictional-public-site-key",
  from: "sender@example.test", fallback: "agency@example.test", origin: "http://localhost:3000", recipients: {} };
const input = (): InquiryInput => ({ requestId: randomUUID(), propertyId: "DEMO-001", locale: "fr", name: "CONTACT TEST DEMO",
  email: "visitor@example.test", phone: "+855 00 000 000", purpose: "VISIT", preferredDate: "2099-01-01",
  message: "Fictional request for a visit, not a real booking.", consent: true, website: "", turnstileToken: "fictional-token" });
const status = (value: number) => (error: unknown) => error instanceof ApiError && error.status === value;
const request = () => new Request("http://localhost:3000/api/v1/inquiries", {
  method: "POST", headers: { origin: config.origin, "X-Kantara-Demo": "local", "content-type": "application/json" },
});

test("inquiries require bounded fields, contact consent, valid recipient-independent shape and nonpast visit preferences", () => {
  const value = input();
  assert.equal(inquiryInput.parse(value).name, value.name);
  for (const invalid of [{ consent: false }, { name: "x" }, { email: "x\r\nBcc: other@example.test" }, { phone: "call me" },
    { message: "x".repeat(2001) }, { website: "spam" }, { turnstileToken: "" }, { recipient: "attacker@example.test" },
    { purpose: "INFORMATION", preferredDate: "2099-01-01" }]) assert.equal(inquiryInput.safeParse({ ...value, ...invalid }).success, false);
  assert.equal(inquiryInput.safeParse({ ...value, message: "x".repeat(2000) }).success, true);
  assert.throws(() => guardInquiryRequest(new Request(config.origin, { method: "POST", headers: { origin: "https://other.example" } }), config), status(403));
  assert.throws(() => guardInquiryRequest(new Request(config.origin, { headers: { "sec-fetch-site": "cross-site" } }), config), status(403));
});

test("Turnstile verification is mandatory, matches hostname/action/reference and fails closed on upstream errors", async () => {
  const value = input();
  const success = { success: true, hostname: "localhost", action: "property_inquiry", cdata: value.requestId };
  await verifyInquiry(value, config, async () => Response.json(success));
  for (const change of [{ success: false }, { hostname: "other.example" }, { action: "different" }, { cdata: randomUUID() }]) {
    await assert.rejects(verifyInquiry(value, config, async () => Response.json({ ...success, ...change })), status(422));
  }
  await assert.rejects(verifyInquiry(value, config, async () => new Response("not JSON")), status(502));
  await assert.rejects(verifyInquiry(value, config, async () => { throw new Error("offline"); }), status(502));
});

test("Resend gets trusted recipient, plain text, visitor Reply-To and stable idempotency; errors never become successful sends", async () => {
  const value = { ...input(), message: "<script>alert('not HTML')</script>\nDetails about a fictional visit." };
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://api.resend.com/emails");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Idempotency-Key"), `property-inquiry/${value.requestId}`);
    assert.equal(headers.get("Authorization"), `Bearer ${config.key}`);
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.to, ["agent@example.test"]);
    assert.equal(body.reply_to, value.email);
    assert.equal(body.from, config.from);
    assert.equal(body.html, undefined);
    assert.ok(body.text.includes(value.message));
    assert.ok(body.text.includes("/fr/properties/DEMO-001"));
    assert.equal(body.text.includes(config.key), false);
    return Response.json({ id: "provider-test-id" });
  };
  assert.equal(await deliverInquiry(value, "agent@example.test", config, fetcher), "provider-test-id");
  assert.equal(calls, 1);
  await assert.rejects(deliverInquiry(value, config.fallback, config, async () => Response.json({ message: "rejected" }, { status: 422 })), status(502));
  await assert.rejects(deliverInquiry(value, config.fallback, config, async () => { throw new Error("offline"); }), status(502));
});

test("real inquiry orchestration persists pending failures, retries idempotently and isolates two agents; only admin configures notification emails", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "kantara-inquiries-"));
  const settings = { NODE_ENV: "development", DEMO_TEAM_DATA_DIR: directory, DEMO_ADMIN_LOGIN: testAdminLogin,
    DEMO_ADMIN_PASSWORD: testAdminPassword, CONTACT_ENABLED: "true", RESEND_API_KEY: config.key, CONTACT_FROM_EMAIL: config.from,
    CONTACT_AGENCY_EMAIL: config.fallback, SITE_URL: config.origin, NEXT_PUBLIC_TURNSTILE_SITE_KEY: config.siteKey,
    TURNSTILE_SECRET_KEY: config.secret, CONTACT_PROPERTY_RECIPIENTS: "{}" };
  const previous = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  try {
    const repository = new TeamRepository(directory);
    const { first, second } = await repository.transact(async (state) => {
      const first = await onboard(state, "agent.inquiry.one"), second = await onboard(state, "agent.inquiry.two");
      await first.run({ action: "notificationEmail", accountId: first.account.id, email: "agent.one@example.test" });
      await first.run({ action: "assignProperty", propertyId: "DEMO-001", agentId: first.account.agentId });
      return { first: first.account, second: second.account };
    });
    const recipient = await inquiryRecipient(request(), "DEMO-001", config);
    assert.equal(recipient.email, "agent.one@example.test");
    assert.equal((await inquiryRecipient(request(), "DEMO-002", config)).email, config.fallback);
    let accepted = false, verified = true, sends = 0;
    const value = input();
    t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
      if (url.includes("siteverify")) return Response.json({ success: verified, hostname: "localhost", action: "property_inquiry", cdata: JSON.parse(String(init?.body)).idempotency_key });
      sends++;
      assert.deepEqual(JSON.parse(String(init?.body)).to, ["agent.one@example.test"]);
      return accepted ? Response.json({ id: "accepted-provider-id" }) : Response.json({ error: "test-rejection" }, { status: 503 });
    });
    await assert.rejects(submitInquiry(request(), { ...value, preferredDate: "2000-01-01" }), status(400));
    verified = false;
    await assert.rejects(submitInquiry(request(), value), status(422));
    assert.equal(await repository.transact((state) => state.inquiries.length), 0);
    verified = true;
    await assert.rejects(submitInquiry(request(), value), status(502));
    assert.equal(await repository.transact((state) => state.inquiries[0].delivery), "PENDING");
    accepted = true;
    assert.equal((await submitInquiry(request(), value)).delivery, "ACCEPTED");
    const sentCount = sends;
    assert.equal((await submitInquiry(request(), value)).delivery, "ACCEPTED");
    assert.equal(sends, sentCount, "accepted local retry does not send another email");
    await assert.rejects(submitInquiry(request(), { ...value, message: "Changed already submitted request content." }), status(409));
    await repository.transact(async (state) => {
      assert.equal(state.inquiries.length, 1);
      assert.equal(state.work.length, 0, "a preferred visit is not a booked appointment or commission");
      assert.equal(teamView(state, first).inquiries.length, 1);
      assert.equal(teamView(state, second).inquiries.length, 0);
      const json = JSON.stringify(teamView(state, first));
      for (const hidden of ["recipient", "payloadHash", "providerId", "notificationEmail", "agent.one@example.test"]) assert.equal(json.includes(hidden), false);
      const { executeTeamCommand } = await import("../services/team/domain");
      await assert.rejects(executeTeamCommand(state, first, { action: "notificationEmail", revision: state.revision, accountId: first.id, email: "other@example.test" }), status(403));
    });
    process.env.CONTACT_ENABLED = "false";
    assert.equal(inquiryConfig(), null);
    await assert.rejects(submitInquiry(request(), value), status(503));
  } finally {
    t.mock.restoreAll();
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await rm(directory, { recursive: true, force: true });
  }
});
