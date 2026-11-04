import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { demoProperties, type DemoProperty } from "@/lib/demo/properties";
import { teamCommand, type TeamState, type TeamAccount, type TeamPublicAccount, type TeamView } from "@/lib/team/schema";
import { hashPassword } from "./passwords";
import { LocalMediaError, validateMediaBatch } from "@/lib/demo/media";
import { publicInquiryRecord } from "@/lib/properties/inquiry";

export function publicAccount({ id, login, name, role, agentId, active, mustChangePassword }: TeamAccount): TeamPublicAccount {
  return { id, login, name, role, agentId, active, mustChangePassword };
}
function conflict(message: string): never { throw new ApiError(409, "TEAM_CONFLICT", message); }
function notFound(): never { throw new ApiError(404, "NOT_FOUND", "Record not found."); }
export function requireAdmin(account: TeamAccount) {
  if (account.role !== "ADMIN") throw new ApiError(403, "ADMIN_ONLY", "Only an administrator can manage hiring or accounts.");
}
type AssignedProperty = Pick<DemoProperty, "id" | "location" | "price" | "transaction"> & { title?: string; key?: string };
export function teamView(state: TeamState, account: TeamAccount, properties: readonly AssignedProperty[] = demoProperties): TeamView {
  const admin = account.role === "ADMIN";
  return {
    revision: state.revision, account: publicAccount(account),
    properties: properties.filter((item) => admin || state.propertyAssignments[item.id] === account.agentId)
      .map((item) => ({ id: item.id, title: item.title ?? `KANTARA DEMO — ${item.key}`, location: item.location, price: item.price,
        transaction: item.transaction, agentId: state.propertyAssignments[item.id] ?? null })),
    work: state.work.filter((item) => admin || item.agentId === account.agentId),
    inquiries: state.inquiries.filter((item) => admin || item.agentId === account.agentId).map((item) => publicInquiryRecord.parse(item)),
    ...(admin ? {
      accounts: state.accounts.map((item) => ({ ...publicAccount(item), ...(item.notificationEmail ? { notificationEmail: item.notificationEmail } : {}) })),
      candidates: state.candidates.map((candidate) => ({ ...candidate, documents: candidate.documents.map((document) => ({
        id: document.id, kind: document.kind, name: document.name, mime: document.mime, uploadedAt: document.uploadedAt,
        approvedAt: document.approvedAt, approvedBy: document.approvedBy,
      })) })),
      audit: state.audit,
    } : {}),
  };
}
export async function validateDocument(input: { mime: string; base64: string; name: string }) {
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024 || bytes.toString("base64") !== input.base64) {
    throw new ApiError(400, "INVALID_DOCUMENT", "Document must be 1 byte to 5 MiB, encoded as canonical base64.");
  }
  try {
    await validateMediaBatch(input.mime === "application/pdf" ? "document" : "photo", [], [new File([new Uint8Array(bytes)], input.name, { type: input.mime })]);
  } catch (error) {
    if (!(error instanceof LocalMediaError)) throw error;
    throw new ApiError(400, "INVALID_DOCUMENT", "File extension, content signature and MIME type must match PDF, JPEG or PNG.");
  }
  return bytes;
}
export async function executeTeamCommand(state: TeamState, account: TeamAccount, raw: unknown, now = new Date(), properties: readonly AssignedProperty[] = demoProperties) {
  const command = teamCommand.parse(raw);
  if (command.action !== "advanceLead") requireAdmin(account);
  if (command.revision !== state.revision) conflict("The team workspace changed. Refresh and retry.");
  if (state.audit.length >= 2000) conflict("Audit capacity reached.");
  const stamp = now.toISOString();
  let targetId: string = account.id;
  if ("candidateId" in command) {
    const candidate = state.candidates.find((item) => item.id === command.candidateId) ?? notFound();
    targetId = candidate.id;
    if (candidate.activation) conflict("An activated employee's hiring dossier is immutable.");
    if (command.action === "upload") {
      await validateDocument(command.input);
      const previous = candidate.documents.find((item) => item.kind === command.input.kind);
      candidate.documents = candidate.documents.filter((item) => item.id !== previous?.id);
      candidate.documents.push({ ...command.input, id: randomUUID(), uploadedAt: stamp, approvedBy: null, approvedAt: null });
      candidate.contract = null;
    } else if (command.action === "review") {
      const document = candidate.documents.find((item) => item.id === command.documentId) ?? notFound();
      document.approvedBy = command.approved ? account.id : null;
      document.approvedAt = command.approved ? stamp : null;
      candidate.contract = null;
    } else if (command.action === "contract" || command.action === "activate") {
      if (!candidate.documents.some((item) => item.kind === "IDENTITY" && item.approvedBy)
        || candidate.documents.some((item) => !item.approvedBy)) conflict("Approve the identity document and every supplied optional document first.");
      if (command.action === "contract") {
        candidate.contract = { id: randomUUID(), version: "EMPLOYMENT-DRAFT-1", createdAt: stamp, createdBy: account.id,
          input: command.input, employee: { name: candidate.name, address: candidate.address, identityReference: candidate.identityReference },
          documentIds: candidate.documents.map((item) => item.id) };
      } else {
        if (!candidate.contract || candidate.contract.id !== command.contractId) conflict("Generate and review the current employment agreement first.");
        if (command.signedOn > stamp.slice(0, 10)) conflict("A recorded signature cannot be in the future.");
        if (state.accounts.some((item) => item.login === command.login)) conflict("This unique login is already registered.");
        if (state.accounts.length >= 25) conflict("Account capacity reached.");
        const id = randomUUID();
        state.accounts.push({ id, agentId: candidate.agentId, name: candidate.name, login: command.login,
          passwordHash: await hashPassword(command.temporaryPassword), role: "AGENT", active: true, mustChangePassword: true });
        candidate.activation = { at: stamp, by: account.id, signedOn: command.signedOn,
          contractId: candidate.contract.id, legalReviewConfirmed: true };
      }
    }
  } else if (command.action === "candidate") {
    if (state.candidates.length >= 24) conflict("Candidate capacity reached.");
    targetId = randomUUID();
    state.candidates.push({ ...command.input, id: targetId, agentId: randomUUID(), documents: [],
      contract: null, activation: null, createdAt: stamp, createdBy: account.id });
  } else if (command.action === "notificationEmail") {
    const item = state.accounts.find((entry) => entry.id === command.accountId && entry.role === "AGENT") ?? notFound();
    targetId = item.id;
    if (command.email) item.notificationEmail = command.email;
    else delete item.notificationEmail;
  } else if (command.action === "disable" || command.action === "resetPassword") {
    const item = state.accounts.find((entry) => entry.id === command.accountId && entry.role === "AGENT") ?? notFound();
    targetId = item.id;
    if (command.action === "disable") item.active = false;
    else {
      if (!item.active) conflict("Disabled accounts cannot be reset.");
      item.passwordHash = await hashPassword(command.temporaryPassword); item.mustChangePassword = true;
    }
    state.sessions = state.sessions.filter((session) => session.accountId !== item.id);
  } else if (command.action === "assignProperty" || command.action === "sampleWork") {
    const agent = state.accounts.find((entry) => entry.agentId === command.agentId && entry.active) ?? notFound();
    if (!properties.some((item) => item.id === command.propertyId)) notFound();
    targetId = command.propertyId;
    if (command.action === "assignProperty") {
      if (state.work.some((item) => item.propertyId === command.propertyId && item.agentId !== agent.agentId)) conflict("This property has linked work. Do not reassign it without migrating its work records.");
      state.propertyAssignments[command.propertyId] = command.agentId;
    } else {
      if (state.propertyAssignments[command.propertyId] !== command.agentId) conflict("Assign the property to this agent first.");
      if (state.work.length >= 100) conflict("Work capacity reached.");
      const date = new Date(now.getTime() + 2 * 86400000);
      date.setUTCHours(3, 0, 0, 0);
      state.work.push({ id: randomUUID(), agentId: command.agentId, propertyId: command.propertyId,
        prospect: `Prospect DEMO ${state.work.length + 1}`, stage: "NEW",
        appointment: date.toISOString(), location: "Siem Reap · DEMO",
        expectedCommission: "250.00", realizedCommission: "0.00", receivedCommission: "0.00" });
    }
  } else if (command.action === "advanceLead") {
    const item = state.work.find((entry) => entry.id === command.leadId && (account.role === "ADMIN" || entry.agentId === account.agentId)) ?? notFound();
    item.stage = command.stage; targetId = item.id;
  }
  state.revision++;
  state.audit.push({ at: stamp, actorId: account.id, action: command.action, targetId });
}
