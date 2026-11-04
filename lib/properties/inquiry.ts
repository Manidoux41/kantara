import { z } from "zod";
import { locales } from "@/lib/i18n/routing";

export const inquiryPropertyId = z.string().regex(/^(?:DEMO-00[1-6]|[a-f0-9]{8}-[a-f0-9-]{27})$/);
export const inquiryInput = z.strictObject({
  requestId: z.uuid(), propertyId: inquiryPropertyId, locale: z.enum(locales),
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().max(254),
  phone: z.string().trim().max(40).regex(/^[+\d\s().-]*$/),
  purpose: z.enum(["VISIT", "INFORMATION"]),
  preferredDate: z.union([z.iso.date(), z.literal("")]),
  message: z.string().trim().min(10).max(2000),
  consent: z.literal(true), website: z.literal(""),
  turnstileToken: z.string().min(1).max(2048),
}).refine((value) => value.purpose === "VISIT" || !value.preferredDate, { message: "A preferred date applies only to visits.", path: ["preferredDate"] });
export type InquiryInput = z.infer<typeof inquiryInput>;
export const inquiryRecord = z.strictObject({
  id: z.uuid(), propertyId: inquiryPropertyId, agentId: z.uuid().nullable(),
  name: z.string(), email: z.string(), phone: z.string(), purpose: z.enum(["VISIT", "INFORMATION"]),
  preferredDate: z.string(), message: z.string(), locale: z.enum(locales),
  createdAt: z.iso.datetime(), payloadHash: z.string(), recipient: z.email(),
  delivery: z.enum(["PENDING", "ACCEPTED"]), providerId: z.string().nullable(),
});
export type InquiryRecord = z.infer<typeof inquiryRecord>;
export const publicInquiryRecord = inquiryRecord.omit({ payloadHash: true, recipient: true, providerId: true }).strip();
export type PublicInquiry = z.infer<typeof publicInquiryRecord>;
