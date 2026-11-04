import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { employmentExample } from "../../lib/team/examples";
import { teamViewSchema, type TeamView } from "../../lib/team/schema";
import { testAdminLogin, testAdminPassword, testAgentPassword, testIdentity } from "../helpers/team-fixtures";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const enabled = process.env.TEST_TEAM_API === "true";
const api = `${baseUrl}/api/demo/team`;
const origin = new URL(baseUrl).origin;
function client() {
  let cookie = "", view: TeamView;
  return {
    get cookie() { return cookie; }, get view() { return view; },
    async get(status = 200) {
      const response = await fetch(api, { headers: { cookie } });
      assert.equal(response.status, status);
      const body = await response.json();
      if (status === 200) view = teamViewSchema.parse(body.data);
      return body;
    },
    async post(input: Record<string, unknown>, status = 200) {
      const response = await fetch(api, { method: "POST",
        headers: { cookie, origin, "Content-Type": "application/json", "X-Kantara-Demo": "local" },
        body: JSON.stringify(input) });
      const body = await response.json();
      assert.equal(response.status, status, JSON.stringify(body));
      const next = response.headers.get("set-cookie");
      if (next) cookie = next.split(";")[0];
      return body;
    },
    async command(input: Record<string, unknown>, status = 200) {
      await this.get();
      return this.post({ ...input, revision: view.revision }, status);
    },
  };
}
test("authenticated local hiring API: prerequisites, private files/PDF, two isolated agents, password replacement, logout and revocation", {
  skip: !enabled, timeout: 90000,
}, async () => {
  const admin = client(), first = client(), second = client();
  await admin.get(401);
  await admin.post({ action: "login", login: testAdminLogin, password: "incorrect" }, 401);
  await admin.post({ action: "login", login: testAdminLogin, password: testAdminPassword });
  const suffix = randomUUID().slice(0, 8);
  for (const [index, agent] of [first, second].entries()) {
    await admin.command({ action: "candidate", input: { name: `AGENT HTTP ${suffix}-${index} DEMO`, address: "FICTIONAL ADDRESS", identityReference: "FICTIONAL-ID" } });
    await admin.get();
    const candidate = admin.view.candidates!.at(-1)!;
    await admin.command({ action: "contract", candidateId: candidate.id, input: employmentExample }, 409);
    await admin.command({ action: "upload", candidateId: candidate.id, input: testIdentity });
    await admin.get();
    const document = admin.view.candidates!.at(-1)!.documents[0];
    await admin.command({ action: "review", candidateId: candidate.id, documentId: document.id, approved: true });
    await admin.command({ action: "contract", candidateId: candidate.id, input: employmentExample });
    const pdf = await fetch(`${api}/employment/${candidate.id}`, { headers: { cookie: admin.cookie } });
    assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    const privateFile = await fetch(`${api}/documents/${document.id}`, { headers: { cookie: admin.cookie } });
    assert.equal(privateFile.headers.get("content-disposition")?.startsWith("attachment;"), true);
    assert.equal(Buffer.from(await privateFile.arrayBuffer()).toString("base64"), testIdentity.base64);
    await admin.get();
    const contractId = admin.view.candidates!.at(-1)!.contract!.id;
    const login = `agent.${suffix}.${index}`;
    await admin.command({ action: "activate", candidateId: candidate.id, contractId, login, temporaryPassword: testAgentPassword,
      signedOn: new Date().toISOString().slice(0, 10), legalReviewConfirmed: true, signatureConfirmed: true });
    await agent.post({ action: "login", login, password: testAgentPassword });
    const passwordView = await agent.get();
    assert.equal(passwordView.data.account.mustChangePassword, true);
    assert.equal(passwordView.data.candidates, undefined);
    assert.deepEqual(passwordView.data.properties, []);
    await agent.post({ action: "advanceLead", revision: admin.view.revision, leadId: randomUUID(), stage: "VISIT" }, 403);
    const oldCookie = agent.cookie;
    await agent.post({ action: "changePassword", currentPassword: testAgentPassword, password: `Changed-Fictional-${suffix}-${index}!` });
    assert.notEqual(agent.cookie, oldCookie);
    assert.equal((await fetch(api, { headers: { cookie: oldCookie } })).status, 401);
    await agent.command({ action: "candidate", input: { name: "DENIED", address: "DENIED", identityReference: "DENIED" } }, 403);
    for (const resource of [`documents/${document.id}`, `employment/${candidate.id}`]) {
      assert.equal((await fetch(`${api}/${resource}`, { headers: { cookie: agent.cookie } })).status, 403);
      assert.equal((await fetch(`${api}/${resource}`)).status, 401);
    }
    await admin.get();
    const property = admin.view.properties.find((item) => item.agentId === null)!;
    assert.ok(property, "A fresh isolated team store must have available fixtures");
    await admin.command({ action: "assignProperty", propertyId: property.id, agentId: candidate.agentId });
    await admin.command({ action: "sampleWork", propertyId: property.id, agentId: candidate.agentId });
    await agent.get();
    assert.deepEqual(agent.view.properties.map((item) => item.id), [property.id]);
    assert.equal(agent.view.work.length, 1);
    assert.equal(agent.view.candidates, undefined);
    assert.equal(agent.view.accounts, undefined);
    assert.equal(agent.view.audit, undefined);
    assert.ok(!JSON.stringify(agent.view).includes("base64"));
    await agent.command({ action: "advanceLead", leadId: agent.view.work[0].id, stage: "QUALIFIED" });
    await agent.get();
    assert.equal(agent.view.work[0].stage, "QUALIFIED");
  }
  await second.get();
  await first.command({ action: "advanceLead", leadId: second.view.work[0].id, stage: "VISIT" }, 404);
  const csrf = await fetch(api, { method: "POST", headers: { cookie: admin.cookie, origin: "https://invalid.example", "Content-Type": "application/json", "X-Kantara-Demo": "local" }, body: JSON.stringify({ action: "logout" }) });
  assert.equal(csrf.status, 403);
  const missingConfirmation = await fetch(api, { method: "POST", headers: { cookie: admin.cookie, origin, "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
  assert.equal(missingConfirmation.status, 403);
  await admin.command({ action: "disable", accountId: second.view.account.id });
  await second.get(401);
  const oldCookie = first.cookie;
  await first.post({ action: "logout" });
  assert.equal((await fetch(api, { headers: { cookie: oldCookie } })).status, 401);
  await admin.post({ action: "logout" });
});

test("production closes individual accounts, private documents and employment PDFs instead of using demo credentials", {
  skip: process.env.TEST_DEMO_API === "true" || enabled,
}, async () => {
  for (const path of ["", `/documents/${randomUUID()}`, `/employment/${randomUUID()}`]) {
    const response = await fetch(`${api}${path}`);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("set-cookie"), null);
  }
  const login = await fetch(api, { method: "POST", headers: { origin, "Content-Type": "application/json", "X-Kantara-Demo": "local" },
    body: JSON.stringify({ action: "login", login: testAdminLogin, password: testAdminPassword }) });
  assert.equal(login.status, 404);
  const response = await fetch(`${baseUrl}/fr/demo/team`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.ok(html.includes("L’accès hébergé nécessite"));
  assert.ok(!html.includes('name="password"'));
});
