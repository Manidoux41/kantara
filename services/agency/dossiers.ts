import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { dossierCommand, type DossierCommand } from "@/lib/agency/dossiers";
import type { TeamAccount } from "@/lib/team/schema";
import type { AgencyState } from "./repository";
import { dossierPropertyIds, requirePropertyAccess } from "./access";
import { requireAdmin } from "@/services/team/domain";
import { cents, executeBusinessCommand, getRevenueSummary, money } from "@/services/demo/business";
import { addSystemActivity } from "@/services/demo/crm";
import type { BusinessClient } from "@/lib/demo/business-types";

function conflict(message: string): never { throw new ApiError(409, "CONFLICT", message); }
function dossierClient(client: BusinessClient, propertyIds: string[]): Omit<BusinessClient, "profile"> {
  const result = structuredClone(client);
  delete result.profile;
  return { ...result, propertyIds };
}
export function dossierSnapshot(state: AgencyState, account: TeamAccount) {
  const ids = dossierPropertyIds(state, account), business = state.business;
  const properties = business.properties.filter((item) => ids.has(item.id));
  const clients = business.clients.filter((item) => properties.some((property) => property.ownerId === item.id)
    || item.propertyIds.some((id) => ids.has(id))).map((item) => dossierClient(item, item.propertyIds.filter((id) => ids.has(id))));
  const transactions = business.transactions.filter((item) => ids.has(item.propertyId));
  return { revision: business.revision, role: account.role, properties, clients,
    documents: (business.dossierDocuments ?? []).filter((item) => ids.has(item.property.id)),
    transfers: (business.bankTransfers ?? []).filter((item) => ids.has(item.propertyId)), transactions,
    revenue: getRevenueSummary({ ...business, properties, contracts: business.contracts.map((item) =>
      ({ ...item, lines: item.lines.filter((line) => ids.has(line.propertyId)) })), transactions }) };
}
export function applyDossierCommand(state: AgencyState, account: TeamAccount, raw: DossierCommand, now = new Date()) {
  const command = dossierCommand.parse(raw), business = state.business;
  if (command.revision !== business.revision) conflict("The agency changed. Refresh and retry.");
  const today = now.toISOString().slice(0, 10);
  const documents = business.dossierDocuments ??= [], transfers = business.bankTransfers ??= [];
  let action = command.action, clientId: string | undefined;
  if (command.action === "createDocument") {
    const property = requirePropertyAccess(state, account, command.input.propertyId);
    if (documents.length >= 300) conflict("Document capacity reached.");
    const owner = business.clients.find((item) => item.id === property.ownerId);
    const counterparty = business.clients.find((item) => item.id === command.input.counterpartyId && item.propertyIds.includes(property.id));
    if (!owner || !counterparty) throw new ApiError(404, "NOT_FOUND", "Link the owner and counterparty to this property before generating documents.");
    if (counterparty.id === owner.id || counterparty.role !== (property.transaction === "sale" ? "BUYER" : "TENANT")) conflict("Select the buyer or tenant linked to this dossier.");
    if ((command.input.kind === "LEASE" && property.transaction !== "rent")
      || (["SALE_AGREEMENT", "PRELIMINARY_SALE"].includes(command.input.kind) && property.transaction !== "sale")) conflict("Document type does not match the property transaction.");
    if (property.availability !== "AVAILABLE" && ["LEASE", "SALE_AGREEMENT", "PRELIMINARY_SALE"].includes(command.input.kind)) conflict("This property transaction is already closed.");
    const snapshot = (person: BusinessClient) => dossierClient(person, [property.id]);
    documents.push({ id: randomUUID(), version: 1, createdAt: now.toISOString(), createdBy: account.id,
      input: structuredClone(command.input), owner: snapshot(owner), counterparty: snapshot(counterparty),
      property: { id: property.id, title: property.title, address: property.address, transaction: property.transaction } });
    clientId = counterparty.id;
  } else if (command.action === "closeDossier") {
    requireAdmin(account);
    const document = documents.find((item) => item.id === command.documentId);
    if (!document) throw new ApiError(404, "NOT_FOUND", "Document not found.");
    const property = requirePropertyAccess(state, account, document.property.id);
    if (!["SALE_AGREEMENT", "LEASE"].includes(document.input.kind)) conflict("Use a sale agreement or lease to close a dossier.");
    if (business.transactions.length >= 100) conflict("Transaction capacity reached.");
    if (property.availability !== "AVAILABLE" || business.transactions.some((item) => item.propertyId === property.id)) conflict("Transaction already completed.");
    if (command.closedAt > today || command.closedAt < document.input.date
      || (document.input.kind === "LEASE" && (command.closedAt < document.input.startDate || command.closedAt > document.input.endDate))) conflict("Closing date must follow signature, be within the lease term and not be in the future.");
    property.availability = property.transaction === "sale" ? "SOLD" : "RENTED";
    business.transactions.push({ id: randomUUID(), contractId: document.id, propertyId: property.id,
      closedAt: command.closedAt, commission: money(cents(command.commission)), receipts: [],
      dossierClosure: { confirmedBy: account.id, confirmedAt: now.toISOString(), signedConfirmed: command.signedConfirmed,
        legalReviewConfirmed: command.legalReviewConfirmed, formalitiesConfirmed: command.formalitiesConfirmed } });
    clientId = document.counterparty.id;
  } else if (command.action === "submitTransfer") {
    const transaction = business.transactions.find((item) => item.id === command.transactionId);
    if (!transaction) throw new ApiError(404, "NOT_FOUND", "Transaction not found.");
    requirePropertyAccess(state, account, transaction.propertyId);
    if (transfers.length >= 300) conflict("Bank transfer capacity reached.");
    if (command.paidAt > today || command.paidAt < transaction.closedAt) conflict("Payment must follow closing and not be in the future.");
    if (transfers.some((item) => item.status !== "REJECTED" && (item.reference.toLowerCase() === command.reference.toLowerCase() || item.evidenceId === command.evidenceId))
      || business.transactions.some((item) => item.receipts.some((receipt) => receipt.reference.toLowerCase() === command.reference.toLowerCase()))) conflict("This bank reference or evidence is already recorded.");
    const committed = transaction.receipts.reduce((sum, item) => sum + cents(item.amount), BigInt(0))
      + transfers.filter((item) => item.transactionId === transaction.id && item.status === "PENDING").reduce((sum, item) => sum + cents(item.amount), BigInt(0));
    if (committed + cents(command.amount) > cents(transaction.commission)) conflict("Pending and received payments cannot exceed the commission.");
    transfers.push({ id: randomUUID(), transactionId: transaction.id, propertyId: transaction.propertyId, amount: money(cents(command.amount)),
      paidAt: command.paidAt, reference: command.reference, bankName: command.bankName, payer: command.payer, evidenceId: command.evidenceId,
      submittedBy: account.id, submittedAt: now.toISOString(), status: "PENDING", reviewedBy: null, reviewedAt: null, reviewNote: "", receiptId: null });
  } else {
    requireAdmin(account);
    const transfer = transfers.find((item) => item.id === command.transferId);
    if (!transfer) throw new ApiError(404, "NOT_FOUND", "Transfer not found.");
    if (transfer.status !== "PENDING") conflict("This transfer was already reviewed.");
    if (command.approved) {
      state.business = executeBusinessCommand(business, { action: "recordReceipt", revision: business.revision,
        transactionId: transfer.transactionId, amount: transfer.amount, paidAt: transfer.paidAt, reference: transfer.reference }, now);
      const saved = state.business.bankTransfers!.find((item) => item.id === transfer.id)!;
      saved.status = "APPROVED"; saved.reviewedBy = account.id; saved.reviewedAt = now.toISOString(); saved.reviewNote = command.note;
      saved.receiptId = state.business.transactions.find((item) => item.id === transfer.transactionId)!.receipts.at(-1)!.id;
      addSystemActivity(state.business, now, "approveBankTransfer");
      return;
    }
    transfer.status = "REJECTED"; transfer.reviewedBy = account.id; transfer.reviewedAt = now.toISOString(); transfer.reviewNote = command.note;
    action = "reviewTransfer";
  }
  addSystemActivity(business, now, action, clientId ? { clientId } : {});
  business.revision++;
}
