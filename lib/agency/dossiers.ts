import { z } from "zod";
import { clientInput, demoMoney } from "@/lib/validations/demo-business";

export const dossierKinds = ["LEASE", "SALE_AGREEMENT", "PRELIMINARY_SALE", "DEPOSIT_RECEIPT", "HANDOVER", "COMMISSION_STATEMENT"] as const;
const text = z.string().trim().min(1).max(200);
const positiveMoney = demoMoney.refine((value) => Number(value) > 0, "Amount must be positive.");
export const dossierInput = z.strictObject({
  propertyId: z.uuid(), counterpartyId: z.uuid(), kind: z.enum(dossierKinds),
  agencyName: text, agencyAddress: text, agencyRegistration: text, representative: text,
  date: z.iso.date(), place: text, price: positiveMoney, deposit: demoMoney,
  startDate: z.iso.date(), endDate: z.iso.date(), rentDueDay: z.number().int().min(1).max(28),
  titleType: z.enum(["REGISTERED_TITLE", "POSSESSION_DOCUMENT", "STRATA_TITLE", "OTHER"]),
  titleReference: text,
  termsEnglish: z.string().trim().min(10).max(4000),
  termsKhmer: z.string().trim().min(10).max(4000).regex(/[\u1780-\u17ff]/, "Khmer wording is required."),
}).superRefine((input, context) => {
  if (input.kind === "LEASE") {
    const anniversary = `${Number(input.startDate.slice(0, 4)) + 15}${input.startDate.slice(4)}`;
    if (input.endDate <= input.startDate || input.endDate >= anniversary) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "Use a positive lease term shorter than 15 years; longer terms require a separate legal process." });
    }
  }
  if (input.kind === "DEPOSIT_RECEIPT" && Number(input.deposit) <= 0) {
    context.addIssue({ code: "custom", path: ["deposit"], message: "A deposit receipt requires a positive deposit." });
  }
});
const person = clientInput.omit({ profile: true }).extend({ id: z.string() });
export const dossierDocumentSchema = z.strictObject({
  id: z.uuid(), version: z.literal(1), createdAt: z.iso.datetime(), createdBy: z.uuid(),
  input: dossierInput,
  owner: person, counterparty: person,
  property: z.strictObject({ id: z.uuid(), title: text, address: text, transaction: z.enum(["sale", "rent"]) }),
});
export const bankTransferSchema = z.strictObject({
  id: z.uuid(), transactionId: z.uuid(), propertyId: z.uuid(), amount: positiveMoney,
  paidAt: z.iso.date(), reference: text, bankName: text, payer: text, evidenceId: z.uuid(),
  submittedBy: z.uuid(), submittedAt: z.iso.datetime(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  reviewedBy: z.uuid().nullable(), reviewedAt: z.iso.datetime().nullable(), reviewNote: z.string().max(1000),
  receiptId: z.uuid().nullable(),
});
export const dossierClosureSchema = z.strictObject({
  confirmedBy: z.uuid(), confirmedAt: z.iso.datetime(),
  signedConfirmed: z.literal(true), legalReviewConfirmed: z.literal(true), formalitiesConfirmed: z.literal(true),
});
const revision = z.number().int().min(0);
export const dossierCommand = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("createDocument"), revision, input: dossierInput }),
  z.strictObject({ action: z.literal("closeDossier"), revision, documentId: z.uuid(), closedAt: z.iso.date(), commission: demoMoney,
    signedConfirmed: z.literal(true), legalReviewConfirmed: z.literal(true), formalitiesConfirmed: z.literal(true) }),
  z.strictObject({ action: z.literal("submitTransfer"), revision, transactionId: z.uuid(), amount: positiveMoney,
    paidAt: z.iso.date(), reference: text, bankName: text, payer: text, evidenceId: z.uuid() }),
  z.strictObject({ action: z.literal("reviewTransfer"), revision, transferId: z.uuid(), approved: z.boolean(), note: z.string().trim().min(1).max(1000) }),
]);
export type DossierDocument = z.infer<typeof dossierDocumentSchema>;
export type BankTransfer = z.infer<typeof bankTransferSchema>;
export type DossierCommand = z.infer<typeof dossierCommand>;
