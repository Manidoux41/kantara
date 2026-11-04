import { z } from "zod";
import { inquiryRecord, publicInquiryRecord, type PublicInquiry } from "@/lib/properties/inquiry";

const text = z.string().trim().min(1).max(200);
export const loginId = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{3,49}$/);
export const passwordInput = z.string().min(12).max(128);
export const candidateInput = z.strictObject({
  name: text, address: text, identityReference: text,
});
export const employmentInput = z.strictObject({
  employerName: text, employerRegistration: text, employerAddress: text, representative: text,
  position: text, dutiesEnglish: z.string().trim().min(10).max(2000),
  dutiesKhmer: z.string().trim().min(10).max(2000).regex(/[\u1780-\u17ff]/),
  workplace: text, startDate: z.iso.date(),
  monthlySalary: z.string().regex(/^[1-9]\d{0,6}(\.\d{1,2})?$/),
  payDay: z.number().int().min(1).max(28), weeklyHours: z.number().int().min(1).max(48),
  workScheduleEnglish: text, workScheduleKhmer: text.regex(/[\u1780-\u17ff]/),
  leaveEnglish: text, leaveKhmer: text.regex(/[\u1780-\u17ff]/),
  terminationEnglish: text, terminationKhmer: text.regex(/[\u1780-\u17ff]/),
});
export const documentInput = z.strictObject({
  kind: z.enum(["IDENTITY", "RESIDENCY"]), name: text,
  mime: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  base64: z.string().min(4).max(4 * Math.ceil(5 * 1024 * 1024 / 3)).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
const revision = z.number().int().min(0);
const id = z.uuid();
export const teamCommand = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("candidate"), revision, input: candidateInput }),
  z.strictObject({ action: z.literal("upload"), revision, candidateId: id, input: documentInput }),
  z.strictObject({ action: z.literal("review"), revision, candidateId: id, documentId: id, approved: z.boolean() }),
  z.strictObject({ action: z.literal("contract"), revision, candidateId: id, input: employmentInput }),
  z.strictObject({ action: z.literal("activate"), revision, candidateId: id, contractId: id,
    login: loginId, temporaryPassword: passwordInput, signedOn: z.iso.date(),
    legalReviewConfirmed: z.literal(true), signatureConfirmed: z.literal(true) }),
  z.strictObject({ action: z.literal("disable"), revision, accountId: id }),
  z.strictObject({ action: z.literal("resetPassword"), revision, accountId: id, temporaryPassword: passwordInput }),
  z.strictObject({ action: z.literal("assignProperty"), revision, propertyId: text, agentId: id }),
  z.strictObject({ action: z.literal("sampleWork"), revision, agentId: id, propertyId: text }),
  z.strictObject({ action: z.literal("advanceLead"), revision, leadId: id, stage: z.enum(["CONTACTED", "QUALIFIED", "SEARCH", "VISIT", "OFFER", "NEGOTIATION"]) }),
  z.strictObject({ action: z.literal("notificationEmail"), revision, accountId: id, email: z.union([z.email().max(254), z.literal("")]) }),
]);
export const accountSchema = z.strictObject({
  id, login: loginId, name: text, role: z.enum(["ADMIN", "AGENT"]), agentId: id.nullable(),
  passwordHash: z.string().regex(/^[a-f0-9]{32}:[a-f0-9]{128}$/),
  active: z.boolean(), mustChangePassword: z.boolean(),
  notificationEmail: z.email().max(254).optional(),
});
export const candidateSchema = candidateInput.extend({
  id, agentId: id, createdAt: z.iso.datetime(), createdBy: id,
  documents: z.array(documentInput.extend({
    id, uploadedAt: z.iso.datetime(), approvedBy: id.nullable(), approvedAt: z.iso.datetime().nullable(),
  })).max(2),
  contract: z.strictObject({
    id, version: z.literal("EMPLOYMENT-DRAFT-1"), createdAt: z.iso.datetime(), createdBy: id,
    input: employmentInput, employee: candidateInput,
    documentIds: z.array(id).min(1).max(2),
  }).nullable(),
  activation: z.strictObject({ at: z.iso.datetime(), by: id, signedOn: z.iso.date(), contractId: id, legalReviewConfirmed: z.literal(true) }).nullable(),
});
export const teamStateSchema = z.strictObject({
  version: z.literal(1), revision,
  accounts: z.array(accountSchema).min(1).max(25),
  candidates: z.array(candidateSchema).max(24),
  sessions: z.array(z.strictObject({ digest: z.string().regex(/^[a-f0-9]{64}$/), accountId: id, expiresAt: z.number() })).max(100),
  attempts: z.array(z.strictObject({ key: z.string(), count: z.number().int(), until: z.number() })).max(200),
  propertyAssignments: z.record(z.string(), id),
  inquiries: z.array(inquiryRecord).max(200).default([]),
  work: z.array(z.strictObject({
    id, agentId: id, propertyId: text, prospect: text, stage: text,
    appointment: z.iso.datetime(), location: text,
    expectedCommission: z.string(), realizedCommission: z.string(), receivedCommission: z.string(),
  })).max(100),
  audit: z.array(z.strictObject({ at: z.iso.datetime(), actorId: id, action: text, targetId: text })).max(2000),
});
export type TeamState = z.infer<typeof teamStateSchema>;
export type TeamAccount = z.infer<typeof accountSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type EmploymentInput = z.infer<typeof employmentInput>;
export type TeamCommand = z.infer<typeof teamCommand>;
export type TeamPublicAccount = Pick<TeamAccount, "id" | "login" | "name" | "role" | "agentId" | "active" | "mustChangePassword">;
export type TeamView = {
  revision: number; account: TeamPublicAccount; accounts?: (TeamPublicAccount & { notificationEmail?: string })[];
  candidates?: (Omit<Candidate, "documents"> & { documents: Omit<Candidate["documents"][number], "base64">[] })[];
  properties: { id: string; title: string; location: string; price: number; transaction: string; agentId: string | null }[];
  work: TeamState["work"];
  audit?: TeamState["audit"];
  inquiries: PublicInquiry[];
};
export const teamViewSchema = z.strictObject({
  revision: z.number(), account: accountSchema.omit({ passwordHash: true }),
  accounts: z.array(accountSchema.omit({ passwordHash: true })).optional(),
  candidates: z.array(candidateSchema.extend({ documents: z.array(candidateSchema.shape.documents.element.omit({ base64: true })) })).optional(),
  properties: z.array(z.strictObject({ id: z.string(), title: z.string(), location: z.string(), price: z.number(), transaction: z.string(), agentId: z.string().nullable() })),
  work: teamStateSchema.shape.work, audit: teamStateSchema.shape.audit.optional(),
  inquiries: z.array(publicInquiryRecord).default([]),
});
