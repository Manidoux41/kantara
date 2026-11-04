import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { demoProperties } from "@/lib/demo/properties";
import type { BusinessState, RevenueSummary } from "@/lib/demo/business-types";
import { businessCommandSchema, type BusinessCommand } from "@/lib/validations/demo-business";
import { addSystemActivity, applyCrmCommand, createCrmState } from "./crm";

export function cents(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}
export function money(value: bigint): string {
  return `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
}
export function createBusinessState(): BusinessState {
  const ownerId = "CLIENT-DEMO-OWNER";
  return {
    ...createCrmState(),
    revision: 0,
    clients: [{
      id: ownerId, name: "Propriétaire DEMO", role: "OWNER",
      address: "Adresse fictive, Siem Reap, Cambodge", identityReference: "IDENTITE-FICTIVE",
      nationality: "KH (fictif)", email: "", phone: "",
      propertyIds: demoProperties.map((property) => property.id),
    }],
    properties: demoProperties.map(({ key, ...property }, index) => ({
      ...property, ownerId, title: `KANTARA DEMO — ${key}`, address: `Adresse fictive ${index + 1}, ${property.location}, Cambodge`,
      titleReference: `TITRE-FICTIF-${index + 1}`, availability: "AVAILABLE",
      publication: "PUBLISHED", publishedAt: `2026-10-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    })),
    contracts: [], transactions: [],
  };
}
function missing(): never { throw new ApiError(404, "NOT_FOUND", "Linked record not found."); }
function conflict(message: string): never { throw new ApiError(409, "CONFLICT", message); }
export function getRevenueSummary(state: BusinessState): RevenueSummary {
  let expected = BigInt(0), realized = BigInt(0), received = BigInt(0);
  for (const contract of state.contracts) for (const line of contract.lines) {
    // Alternative contracts for a property stop forecasting after its transaction closes.
    if (!state.transactions.some((item) => item.propertyId === line.propertyId)) expected += cents(line.expectedCommission);
  }
  for (const transaction of state.transactions) {
    realized += cents(transaction.commission);
    for (const receipt of transaction.receipts) received += cents(receipt.amount);
  }
  return { expected: money(expected), realized: money(realized), received: money(received), outstanding: money(realized - received) };
}

export function executeBusinessCommand(state: BusinessState, raw: BusinessCommand, now = new Date()): BusinessState {
  const command = businessCommandSchema.parse(raw);
  if (command.revision !== state.revision) conflict("The workspace changed. Refresh before retrying.");
  const next = structuredClone(state);
  const property = (id: string) => next.properties.find((item) => item.id === id) ?? missing();
  const client = (id: string) => next.clients.find((item) => item.id === id) ?? missing();
  const today = now.toISOString().slice(0, 10);
  const noFuture = (date: string) => { if (date > today) conflict("A recorded event cannot be in the future."); };
  if (command.action === "updateAgentAvailability" || command.action === "updateContact" || command.action === "createLead" || command.action === "advanceLead"
    || command.action === "addActivity" || command.action === "createAppointment" || command.action === "rescheduleAppointment"
    || command.action === "finishAppointment") {
    applyCrmCommand(next, command, now);
  } else if (command.action === "createClient") {
    if (next.clients.length >= 100) conflict("Demo client capacity reached.");
    if (command.input.email && next.clients.some((item) => item.email.toLowerCase() === command.input.email.toLowerCase())) conflict("A contact already uses this email. Reuse its record instead of duplicating it.");
    if (command.input.profile?.assignedAgentId && !next.agents.some((item) => item.id === command.input.profile!.assignedAgentId && item.active)) missing();
    if (command.input.profile && !command.input.profile.categories.includes(command.input.role)) conflict("Keep the contact's primary contractual category.");
    for (const id of command.input.propertyIds) property(id);
    if (command.input.role === "OWNER" && command.input.propertyIds.length) conflict("Create an owner's property separately; existing ownership cannot be reassigned.");
    next.clients.push({ id: randomUUID(), ...command.input });
  } else if (command.action === "createProperty") {
    if (next.properties.length >= 100) conflict("Demo property capacity reached.");
    const owner = client(command.input.ownerId);
    if (owner.role !== "OWNER") conflict("Property owner must have the OWNER role.");
    const id = randomUUID();
    next.properties.push({
      ...command.input, price: Number(command.input.price), id,
      image: command.input.type === "apartment" ? "/images/river-apartment.svg" : "/images/khmer-residence.svg",
      availability: "AVAILABLE", publication: "DRAFT", publishedAt: null,
    });
    owner.propertyIds.push(id);
  } else if (command.action === "linkProperties") {
    const linkedClient = client(command.clientId);
    if (linkedClient.role === "OWNER") conflict("Ownership links are managed by property creation.");
    for (const id of command.propertyIds) property(id);
    linkedClient.propertyIds = command.propertyIds;
  } else if (command.action === "createContract") {
    if (next.contracts.length >= 100) conflict("Demo contract capacity reached.");
    const owner = client(command.input.ownerId);
    if (owner.role !== "OWNER") conflict("A contract requires a property owner.");
    const counterparty = command.input.counterpartyId ? client(command.input.counterpartyId) : undefined;
    if (counterparty && counterparty.role !== "TENANT") conflict("A lease requires a tenant.");
    const properties = command.input.lines.map((line) => property(line.propertyId));
    for (const item of properties) {
      if (item.ownerId !== owner.id) conflict("All contract properties must belong to the selected owner.");
      if (item.availability !== "AVAILABLE") conflict("A completed property cannot receive a new contract.");
      const newLine = command.input.lines.find((line) => line.propertyId === item.id)!;
      if (cents(newLine.expectedCommission) > BigInt(0) && next.contracts.some((contract) =>
        contract.lines.some((line) => line.propertyId === item.id && cents(line.expectedCommission) > BigInt(0)))) {
        conflict("An existing contract already forecasts this property's commission; use zero to avoid double counting.");
      }
      if ((command.input.kind === "SALE_MANDATE" ? "sale" : "rent") !== item.transaction) conflict("Property transaction type does not match the contract.");
      if (command.input.kind !== "LEASE" && next.contracts.some((contract) =>
        contract.kind !== "LEASE" && contract.lines.some((line) => line.propertyId === item.id))) {
        conflict("This demo allows one agency mandate per property to avoid duplicate forecasts.");
      }
      if (command.input.kind === "LEASE" && next.contracts.some((contract) =>
        contract.kind === "LEASE" && contract.lines.some((line) => line.propertyId === item.id))) {
        conflict("This demo allows one lease per property.");
      }
      if (command.input.kind === "LEASE" && next.contracts.some((contract) =>
        contract.kind === "RENTAL_MANDATE" && contract.lines.some((line) => line.propertyId === item.id))
        && cents(command.input.lines.find((line) => line.propertyId === item.id)!.expectedCommission) > BigInt(0)) {
        conflict("A rental mandate already forecasts this commission; set the lease commission to zero.");
      }
    }
    if (counterparty) counterparty.propertyIds = [...new Set([...counterparty.propertyIds, ...properties.map((item) => item.id)])];
    next.contracts.push({
      ...command.input, id: randomUUID(), createdAt: now.toISOString(),
      ownerSnapshot: structuredClone(owner),
      counterpartySnapshot: counterparty ? structuredClone(counterparty) : undefined,
      propertySnapshots: structuredClone(properties),
    });
  } else if (command.action === "publish") {
    const item = property(command.propertyId);
    if (command.published && item.publication !== "PUBLISHED") item.publishedAt = now.toISOString();
    item.publication = command.published ? "PUBLISHED" : "DRAFT";
    // Preserve last publication date when unpublishing, so history remains visible.
  } else if (command.action === "closeTransaction") {
    const contract = next.contracts.find((item) => item.id === command.contractId) ?? missing();
    const item = property(command.propertyId);
    if (!contract.lines.some((line) => line.propertyId === item.id)) conflict("Property is not linked to this contract.");
    if (item.availability !== "AVAILABLE" || next.transactions.some((entry) => entry.propertyId === item.id)) conflict("Transaction already completed for this property.");
    noFuture(command.closedAt);
    if (command.closedAt < contract.signedAt || command.closedAt < contract.startDate || command.closedAt > contract.endDate) conflict("Closing date must be within the contract term and follow signing.");
    if (contract.kind === "LEASE" && next.contracts.some((entry) =>
      entry.kind === "RENTAL_MANDATE" && entry.lines.some((line) => line.propertyId === item.id))) {
      conflict("Close the rental mandate instead of the lease so its agency commission is not lost or duplicated.");
    }
    item.availability = item.transaction === "sale" ? "SOLD" : "RENTED";
    next.transactions.push({
      id: randomUUID(), contractId: contract.id, propertyId: item.id,
      closedAt: command.closedAt, commission: money(cents(command.commission)), receipts: [],
    });
  } else {
    const transaction = next.transactions.find((item) => item.id === command.transactionId) ?? missing();
    noFuture(command.paidAt);
    if (command.paidAt < transaction.closedAt) conflict("Receipt cannot precede the transaction.");
    if (transaction.receipts.length >= 100) conflict("Demo receipt capacity reached.");
    if (transaction.receipts.some((receipt) => receipt.reference === command.reference)) conflict("This receipt reference was already recorded.");
    const received = transaction.receipts.reduce((sum, item) => sum + cents(item.amount), BigInt(0));
    if (received + cents(command.amount) > cents(transaction.commission)) conflict("Receipts cannot exceed the realized commission.");
    transaction.receipts.push({ id: randomUUID(), amount: money(cents(command.amount)), paidAt: command.paidAt, reference: command.reference });
  }
  if (command.action === "createClient") addSystemActivity(next, now, command.action, { clientId: next.clients.at(-1)!.id });
  else if (["createProperty", "createContract", "publish", "closeTransaction", "recordReceipt", "linkProperties"].includes(command.action)) {
    addSystemActivity(next, now, command.action, command.action === "linkProperties" ? { clientId: command.clientId } : {});
  }
  next.revision++;
  return next;
}
