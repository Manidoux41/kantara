import { z } from "zod";
import { contactCategories, leadSources, leadStages } from "@/lib/demo/crm-types";
import { locales } from "@/lib/i18n/routing";

const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9-]+$/);
const short = z.string().trim().min(1).max(200);
const note = z.string().trim().max(4000);
const date = z.iso.date().nullable();
const money = z.string().regex(/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/);
export const contactProfileInput = z.strictObject({
  firstName: z.string().trim().max(100), lastName: z.string().trim().max(100),
  company: z.string().trim().max(200), whatsapp: z.string().trim().max(80),
  country: z.string().trim().max(100), preferredLanguage: z.enum(locales),
  categories: z.array(z.enum(contactCategories)).min(1).max(contactCategories.length)
    .refine((items) => new Set(items).size === items.length, "Duplicate contact categories."),
  source: z.enum(leadSources), assignedAgentId: id.nullable(), notes: note,
  tags: z.array(z.string().trim().min(1).max(40)).max(20), followUpDate: date,
});
export const contactDetailsInput = z.strictObject({
  name: short, address: short, identityReference: short, nationality: short,
  email: z.union([z.literal(""), z.email().max(200)]), phone: z.string().trim().max(80),
});
export const leadInput = z.strictObject({
  title: short, clientId: id, agentId: id, source: z.enum(leadSources),
  propertyIds: z.array(id).max(30).refine((items) => new Set(items).size === items.length),
  score: z.number().int().min(0).max(100), expectedCommission: money,
  expectedClosingDate: date, followUpDate: date, notes: note,
});
export const agentAvailabilityInput = z.strictObject({
  workdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine((items) => new Set(items).size === items.length),
  startMinute: z.number().int().min(0).max(1438), endMinute: z.number().int().min(1).max(1439),
}).refine((input) => input.endMinute - input.startMinute >= 15, "Availability must last at least 15 minutes.");
export const appointmentInput = z.strictObject({
  title: short, clientId: id, agentId: id, propertyId: id.nullable(), leadId: id.nullable(),
  startAt: z.iso.datetime().transform((value) => new Date(value).toISOString()),
  endAt: z.iso.datetime().transform((value) => new Date(value).toISOString()), location: short, notes: note,
}).superRefine((value, context) => {
  const duration = Date.parse(value.endAt) - Date.parse(value.startAt);
  if (duration < 15 * 60000 || duration > 8 * 3600000) {
    context.addIssue({ code: "custom", path: ["endAt"], message: "Appointments must last 15 minutes to 8 hours." });
  }
});
export const crmCommands = [
  z.strictObject({ action: z.literal("updateAgentAvailability"), revision: z.number().int().min(0), agentId: id, input: agentAvailabilityInput }),
  z.strictObject({ action: z.literal("updateContact"), revision: z.number().int().min(0), clientId: id, profile: contactProfileInput, details: contactDetailsInput.optional() }),
  z.strictObject({ action: z.literal("createLead"), revision: z.number().int().min(0), input: leadInput }),
  z.strictObject({ action: z.literal("advanceLead"), revision: z.number().int().min(0), leadId: id, stage: z.enum(leadStages), lostReason: note, followUpDate: date }),
  z.strictObject({ action: z.literal("addActivity"), revision: z.number().int().min(0), clientId: id, leadId: id.nullable(), channel: z.enum(["NOTE", "EMAIL", "WHATSAPP", "PHONE"]), text: short }),
  z.strictObject({ action: z.literal("createAppointment"), revision: z.number().int().min(0), input: appointmentInput }),
  z.strictObject({ action: z.literal("rescheduleAppointment"), revision: z.number().int().min(0), appointmentId: id, input: appointmentInput }),
  z.strictObject({ action: z.literal("finishAppointment"), revision: z.number().int().min(0), appointmentId: id, status: z.enum(["COMPLETED", "CANCELLED"]), feedback: z.string().trim().min(3).max(4000), interest: z.enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"]) }),
] as const;
export type CrmCommand = z.infer<(typeof crmCommands)[number]>;
