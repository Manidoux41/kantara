import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "../lib/api/errors";
import { teamMessages } from "../lib/i18n/team";
import { locales } from "../lib/i18n/routing";
import { employmentExample } from "../lib/team/examples";
import { teamStateSchema } from "../lib/team/schema";
import { executeTeamCommand, teamView, validateDocument } from "../services/team/domain";
import { hashPassword, verifyPassword } from "../services/team/passwords";
import { changePassword, cookieHeader, login, logout, requireAccount } from "../services/team/session";
import { TeamRepository } from "../services/team/repository";
import { initialTeam, onboard, testAdminLogin, testAdminPassword, testAgentPassword, testIdentity } from "./helpers/team";

const isStatus = (status: number) => (error: unknown) => error instanceof ApiError && error.status === status;
const request = (token: string) => new Request("http://localhost:3000/api/demo/team", { headers: { cookie: cookieHeader(token) } });

test("hiring requires approved identity, optional address approval, current bilingual contract and explicit signed/legal confirmations", async () => {
  const state = await initialTeam(), admin = state.accounts[0];
  const run = (input: Record<string, unknown>) => executeTeamCommand(state, admin, { ...input, revision: state.revision });
  await run({ action: "candidate", input: { name: "Candidate DEMO", address: "FICTIONAL", identityReference: "ID-DEMO" } });
  const candidate = state.candidates[0];
  await assert.rejects(run({ action: "contract", candidateId: candidate.id, input: employmentExample }), isStatus(409));
  await run({ action: "upload", candidateId: candidate.id, input: testIdentity });
  await assert.rejects(run({ action: "contract", candidateId: candidate.id, input: employmentExample }), isStatus(409));
  await run({ action: "review", candidateId: candidate.id, documentId: candidate.documents[0].id, approved: true });
  await run({ action: "contract", candidateId: candidate.id, input: employmentExample });
  const oldContract = candidate.contract!.id;
  await run({ action: "upload", candidateId: candidate.id, input: { ...testIdentity, kind: "RESIDENCY" } });
  assert.equal(candidate.contract, null);
  await assert.rejects(run({ action: "contract", candidateId: candidate.id, input: employmentExample }), isStatus(409));
  await run({ action: "review", candidateId: candidate.id, documentId: candidate.documents[1].id, approved: true });
  await run({ action: "contract", candidateId: candidate.id, input: employmentExample });
  const activation = { action: "activate", candidateId: candidate.id, contractId: candidate.contract!.id, login: "agent.demo",
    temporaryPassword: testAgentPassword, signedOn: "2026-11-01", legalReviewConfirmed: true, signatureConfirmed: true };
  await assert.rejects(run({ ...activation, contractId: oldContract }), isStatus(409));
  await assert.rejects(run({ ...activation, signatureConfirmed: false }));
  await assert.rejects(run({ ...activation, signedOn: "2099-01-01" }), isStatus(409));
  await run(activation);
  assert.equal(state.accounts.length, 2);
  assert.equal(state.accounts[1].mustChangePassword, true);
  assert.equal(candidate.activation?.contractId, candidate.contract!.id);
  await assert.rejects(run({ action: "upload", candidateId: candidate.id, input: testIdentity }), isStatus(409));
  assert.doesNotThrow(() => teamStateSchema.parse(state));
});

test("agent API projections and updates never expose another agent's records, RH documents or account hashes", async () => {
  const state = await initialTeam();
  const first = await onboard(state, "agent.one"), second = await onboard(state, "agent.two");
  await first.run({ action: "assignProperty", propertyId: "DEMO-001", agentId: first.account.agentId });
  await first.run({ action: "assignProperty", propertyId: "DEMO-002", agentId: second.account.agentId });
  await first.run({ action: "sampleWork", propertyId: "DEMO-001", agentId: first.account.agentId });
  await first.run({ action: "sampleWork", propertyId: "DEMO-002", agentId: second.account.agentId });
  const view = teamView(state, first.account), json = JSON.stringify(view);
  assert.deepEqual(view.properties.map((item) => item.id), ["DEMO-001"]);
  assert.equal(view.work.length, 1);
  for (const hidden of ["base64", "identityReference", "candidates", "audit", "passwordHash", "sessions", "agent.two", "DEMO-002"]) assert.ok(!json.includes(hidden), hidden);
  const adminJson = JSON.stringify(teamView(state, state.accounts[0]));
  assert.ok(!adminJson.includes("base64") && !adminJson.includes("passwordHash"));
  await assert.rejects(executeTeamCommand(state, first.account, { action: "candidate", revision: state.revision, input: { name: "X", address: "X", identityReference: "X" } }), isStatus(403));
  await assert.rejects(executeTeamCommand(state, first.account, { action: "advanceLead", revision: state.revision, leadId: view.work[0].id, stage: "VISIT" }).then(() =>
    executeTeamCommand(state, first.account, { action: "advanceLead", revision: state.revision, leadId: state.work[1].id, stage: "VISIT" })), isStatus(404));
  await assert.rejects(first.run({ action: "assignProperty", propertyId: "DEMO-001", agentId: second.account.agentId }), isStatus(409));
  await assert.rejects(executeTeamCommand(state, state.accounts[0], { action: "candidate", revision: 0, input: { name: "X", address: "X", identityReference: "X" } }), isStatus(409));
});

test("scrypt credentials, login throttling, forced replacement, session rotation, logout, expiry, reset and disabling", async () => {
  const state = await initialTeam(), { account, run } = await onboard(state);
  const otherHash = await hashPassword(testAgentPassword);
  assert.notEqual(otherHash, account.passwordHash);
  assert.equal(await verifyPassword(testAgentPassword, otherHash), true);
  for (let i = 0; i < 5; i++) assert.equal((await login(state, { action: "login", login: "missing.user", password: "wrong" }, 1000)).error?.status, 401);
  assert.equal((await login(state, { action: "login", login: "missing.user", password: "wrong" }, 1001)).error?.status, 429);
  const result = await login(state, { action: "login", login: account.login, password: testAgentPassword });
  assert.ok(result.token);
  const initialRequest = request(result.token);
  assert.throws(() => requireAccount(state, initialRequest), isStatus(403));
  assert.equal(requireAccount(state, initialRequest, true).id, account.id);
  const newPassword = "Fictional-Replacement-Password-2026!";
  const rotated = await changePassword(state, account, { action: "changePassword", currentPassword: testAgentPassword, password: newPassword });
  assert.throws(() => requireAccount(state, initialRequest), isStatus(401));
  assert.equal(requireAccount(state, request(rotated)).id, account.id);
  assert.throws(() => requireAccount(state, request(rotated), false, Date.now() + 9 * 3600000), isStatus(401));
  logout(state, request(rotated));
  assert.throws(() => requireAccount(state, request(rotated)), isStatus(401));
  const next = await login(state, { action: "login", login: account.login, password: newPassword });
  assert.ok(next.token);
  await run({ action: "resetPassword", accountId: account.id, temporaryPassword: testAgentPassword });
  assert.throws(() => requireAccount(state, request(next.token)), isStatus(401));
  assert.equal(account.mustChangePassword, true);
  await run({ action: "disable", accountId: account.id });
  assert.equal((await login(state, { action: "login", login: account.login, password: testAgentPassword })).error?.status, 401);
  assert.match(cookieHeader(rotated), /HttpOnly; SameSite=Strict; Path=\/api\/demo\/team; Max-Age=28800/);
  assert.ok(!JSON.stringify(state).includes(newPassword));
});

test("private uploads enforce exact 5 MiB limit, formats, canonical encoding and reject active markup", async () => {
  await validateDocument(testIdentity);
  const bytes = Buffer.alloc(5 * 1024 * 1024); bytes.write("%PDF-1.7\n");
  await validateDocument({ name: "sample.pdf", mime: "application/pdf", base64: bytes.toString("base64") });
  await assert.rejects(validateDocument({ name: "sample.pdf", mime: "application/pdf", base64: Buffer.concat([bytes, Buffer.from("x")]).toString("base64") }), isStatus(400));
  for (const input of [
    { ...testIdentity, name: "malicious.svg", base64: Buffer.from("<svg onload='alert(1)'/>").toString("base64") },
    { ...testIdentity, mime: "application/pdf" }, { ...testIdentity, base64: "" }, { ...testIdentity, base64: testIdentity.base64 + "\n" },
  ]) await assert.rejects(validateDocument(input), isStatus(400));
});

test("team file persistence retains hashed credentials, throttling and sessions, rejects corruption without resetting", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kantara-team-test-"));
  const previous = { login: process.env.DEMO_ADMIN_LOGIN, password: process.env.DEMO_ADMIN_PASSWORD };
  process.env.DEMO_ADMIN_LOGIN = testAdminLogin; process.env.DEMO_ADMIN_PASSWORD = testAdminPassword;
  try {
    const repository = new TeamRepository(directory);
    await repository.transact(async (state) => { await onboard(state); });
    const loggedIn = await repository.transact((state) => login(state, { action: "login", login: testAdminLogin, password: testAdminPassword }));
    assert.ok(loggedIn.token);
    await new TeamRepository(directory).transact((state) => assert.equal(requireAccount(state, request(loggedIn.token)).role, "ADMIN"));
    const saved = await readFile(join(directory, "agency.json"), "utf8");
    assert.ok(!saved.includes(testAdminPassword) && !saved.includes(testAgentPassword));
    await writeFile(join(directory, "agency.lock"), "");
    await assert.rejects(repository.transact(() => null), isStatus(409));
    await rm(join(directory, "agency.lock"));
    await writeFile(join(directory, "agency.json"), "{corrupt");
    await assert.rejects(repository.transact(() => null), isStatus(503));
    assert.equal(await readFile(join(directory, "agency.json"), "utf8"), "{corrupt");
  } finally {
    if (previous.login === undefined) delete process.env.DEMO_ADMIN_LOGIN; else process.env.DEMO_ADMIN_LOGIN = previous.login;
    if (previous.password === undefined) delete process.env.DEMO_ADMIN_PASSWORD; else process.env.DEMO_ADMIN_PASSWORD = previous.password;
    await rm(directory, { recursive: true, force: true });
  }
});

test("all seven team interfaces have matching nonempty translations", () => {
  const keys = Object.keys(teamMessages("en")).sort();
  for (const locale of locales) {
    const messages = teamMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), keys);
    for (const text of Object.values(messages)) assert.ok(text.trim().length > 0);
  }
});
