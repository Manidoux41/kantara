import { z } from "zod";
import { demoLocations, demoTypes } from "@/lib/demo/properties";
import { contactProfileInput, crmCommands } from "./crm";
import { furnishingSchema } from "@/lib/properties/furnishing";

const text = z.string().trim().min(1).max(200);
const terms = z.string().trim().min(10).max(4000);
const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9-]+$/);
export const demoMoney = z.string().regex(/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/);
export const demoDate = z.iso.date();
const ids = z.array(id).max(30).refine((values) => new Set(values).size === values.length, "Duplicate property IDs.");
export const clientInput = z.strictObject({
  name: text, role: z.enum(["OWNER", "BUYER", "TENANT"]), address: text,
  identityReference: text, nationality: text,
  email: z.union([z.literal(""), z.email().max(200)]), phone: z.string().trim().max(80),
  propertyIds: ids,
  profile: contactProfileInput.optional(),
});
export const businessPropertyInput = z.strictObject({
  furnishing: furnishingSchema.optional(),
  title: text, address: text, titleReference: text, ownerId: id,
  location: z.enum(demoLocations), type: z.enum(demoTypes), transaction: z.enum(["sale", "rent"]),
  price: demoMoney.refine((value) => Number(value) > 0),
  area: z.number().positive().max(10000000), bedrooms: z.number().int().min(0).max(100),
  rooms: z.number().int().min(0).max(100), bathrooms: z.number().int().min(0).max(100),
});
export const contractInput = z.strictObject({
  kind: z.enum(["SALE_MANDATE", "RENTAL_MANDATE", "LEASE"]),
  language: z.enum(["fr-km", "en-km"]), ownerId: id, counterpartyId: id.optional(),
  agencyName: text, agencyAddress: text, agencyRegistration: text,
  signedAt: demoDate, signedPlace: text, startDate: demoDate, endDate: demoDate,
  exclusive: z.boolean(),
  lines: z.array(z.strictObject({
    propertyId: id, price: demoMoney.refine((value) => Number(value) > 0), expectedCommission: demoMoney,
  })).min(1).max(10).refine((lines) => new Set(lines.map((line) => line.propertyId)).size === lines.length, "Duplicate property lines."),
  deposit: demoMoney, rentDueDay: z.number().int().min(1).max(28),
  permittedUse: text, terms, commissionTerms: terms,
}).superRefine((value, context) => {
  const issue = (path: string, message: string) => context.addIssue({ code: "custom", path: [path], message });
  if (value.startDate > value.endDate) issue("endDate", "End date must follow start date.");
  if (value.signedAt > value.startDate) issue("signedAt", "Signing date must not follow start date.");
  if (value.kind === "LEASE") {
    if (!value.counterpartyId) issue("counterpartyId", "A tenant is required.");
    if (value.ownerId === value.counterpartyId) issue("counterpartyId", "Owner and tenant must differ.");
    if (value.startDate === value.endDate) issue("endDate", "A lease must have a positive term.");
    const anniversary = `${Number(value.startDate.slice(0, 4)) + 15}${value.startDate.slice(4)}`;
    if (value.endDate >= anniversary) issue("endDate", "Leases of 15 years or more require a separate legal workflow.");
  } else if (value.counterpartyId) issue("counterpartyId", "A mandate is between the owner and the agency.");
});
export const businessCommandSchema = z.discriminatedUnion("action", [
  ...crmCommands,
  z.strictObject({ action: z.literal("createClient"), revision: z.number().int().min(0), input: clientInput }),
  z.strictObject({ action: z.literal("createProperty"), revision: z.number().int().min(0), input: businessPropertyInput }),
  z.strictObject({ action: z.literal("linkProperties"), revision: z.number().int().min(0), clientId: id, propertyIds: ids }),
  z.strictObject({ action: z.literal("createContract"), revision: z.number().int().min(0), input: contractInput }),
  z.strictObject({ action: z.literal("publish"), revision: z.number().int().min(0), propertyId: id, published: z.boolean() }),
  z.strictObject({
    action: z.literal("closeTransaction"), revision: z.number().int().min(0),
    contractId: id, propertyId: id, closedAt: demoDate, commission: demoMoney,
  }),
  z.strictObject({
    action: z.literal("recordReceipt"), revision: z.number().int().min(0),
    transactionId: id, amount: demoMoney.refine((value) => Number(value) > 0),
    paidAt: demoDate, reference: text,
  }),
]);
export type BusinessCommand = z.infer<typeof businessCommandSchema>;
