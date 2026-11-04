import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { demoProperties, type DemoProperty } from "@/lib/demo/properties";
import { inquiryInput, type InquiryInput, type InquiryRecord } from "@/lib/properties/inquiry";
import { propertyPath } from "@/lib/properties/presentation";
import { teamRepository } from "@/services/team/repository";
import { cambodiaDate } from "@/lib/demo/calendar";
import { readDemoCatalogue, guardDemoRequest } from "@/services/demo/session";
import { agencyEnabled } from "@/lib/database-config";
import { agencyTransaction } from "@/services/agency/repository";
import type { TeamState } from "@/lib/team/schema";

const configSchema = z.object({
  key: z.string().min(1), from: z.email(), fallback: z.email(),
  siteKey: z.string().min(1), secret: z.string().min(1), origin: z.url(),
  recipients: z.record(z.string(), z.email()),
});
export type InquiryConfig = z.infer<typeof configSchema>;
export function inquiryConfig(): InquiryConfig | null {
  if (process.env.CONTACT_ENABLED !== "true") return null;
  let recipients: unknown = {};
  try { recipients = JSON.parse(process.env.CONTACT_PROPERTY_RECIPIENTS ?? "{}"); }
  catch { throw new ApiError(503, "CONTACT_SETUP", "Contact recipient configuration is invalid."); }
  const parsed = configSchema.safeParse({
    key: process.env.RESEND_API_KEY, from: process.env.CONTACT_FROM_EMAIL, fallback: process.env.CONTACT_AGENCY_EMAIL,
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, secret: process.env.TURNSTILE_SECRET_KEY,
    origin: process.env.SITE_URL, recipients,
  });
  if (!parsed.success) throw new ApiError(503, "CONTACT_SETUP", "Configure the email sender, agency recipient, site URL and anti-spam keys.");
  const url = new URL(parsed.data.origin);
  if (url.pathname !== "/" || url.search || url.hash || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
    throw new ApiError(503, "CONTACT_SETUP", "SITE_URL must be the canonical site origin (HTTPS in production).");
  }
  return parsed.data;
}
export function guardInquiryRequest(request: Request, config: InquiryConfig | null) {
  const url = new URL(request.url);
  if (url.pathname === "/api/demo/inquiries") guardDemoRequest(request);
  const origin = config ? new URL(config.origin).origin : url.origin;
  if ((request.method === "POST" && request.headers.get("origin") !== origin)
    || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(403, "FORBIDDEN", "Same-origin contact requests are required.");
  }
}
function localTeam(request: Request) {
  return process.env.NODE_ENV === "development"
    && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
    && Boolean(process.env.DEMO_ADMIN_LOGIN && process.env.DEMO_ADMIN_PASSWORD);
}
export async function inquiryRecipient(request: Request, propertyId: string, config: InquiryConfig | null) {
  if (agencyEnabled() && new URL(request.url).pathname !== "/api/demo/inquiries") {
    return agencyTransaction(({ business, team }) => {
      const property = business.properties.find((item) => item.id === propertyId && item.publication === "PUBLISHED");
      if (!property) throw new ApiError(404, "NOT_FOUND", "Published property not found.");
      const agent = team.accounts.find((item) => item.role === "AGENT" && item.active && item.agentId === team.propertyAssignments[propertyId]);
      return { agentId: agent?.agentId ?? null, name: agent?.name ?? null, available: property.availability === "AVAILABLE",
        email: agent?.notificationEmail ?? config?.recipients[propertyId] ?? config?.fallback ?? null };
    });
  }
  let property: Pick<DemoProperty, "availability"> | undefined = demoProperties.find((item) => item.id === propertyId);
  if (new URL(request.url).pathname === "/api/demo/inquiries") {
    const workspace = await readDemoCatalogue(request);
    const listing = workspace.state.properties.find((item) => item.id === propertyId && item.publication === "PUBLISHED");
    if (!listing) throw new ApiError(404, "NOT_FOUND", "Published property not found.");
    property = listing;
  }
  if (!property) throw new ApiError(404, "NOT_FOUND", "Property not found.");
  const available = (property.availability ?? "AVAILABLE") === "AVAILABLE";
  if (localTeam(request)) return teamRepository().transact((state) => {
    const agent = state.accounts.find((item) => item.active && item.role === "AGENT" && item.agentId === state.propertyAssignments[propertyId]);
    return { agentId: agent?.agentId ?? null, name: agent?.name ?? null, available,
      email: agent?.notificationEmail ?? config?.recipients[propertyId] ?? config?.fallback ?? null };
  });
  return { agentId: null, name: null, available, email: config?.recipients[propertyId] ?? config?.fallback ?? null };
}
export async function verifyInquiry(input: InquiryInput, config: InquiryConfig, fetcher: typeof fetch = fetch) {
  let verification: Response;
  try {
    verification = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: config.secret, response: input.turnstileToken, idempotency_key: input.requestId }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { throw new ApiError(502, "ANTISPAM_UNAVAILABLE", "Anti-spam verification could not be reached. Retry."); }
  const result = await verification.json().catch(() => null);
  const token = z.object({ success: z.boolean(), hostname: z.string().optional(), action: z.string().optional(), cdata: z.string().optional() }).safeParse(result);
  if (!verification.ok || !token.success) throw new ApiError(502, "ANTISPAM_UNAVAILABLE", "Invalid anti-spam service response.");
  if (!token.data.success || token.data.hostname !== new URL(config.origin).hostname
    || token.data.action !== "property_inquiry" || token.data.cdata !== input.requestId) {
    throw new ApiError(422, "ANTISPAM_REQUIRED", "Complete a fresh anti-spam verification for this request.");
  }
}
export async function deliverInquiry(input: InquiryInput, recipient: string, config: InquiryConfig, fetcher: typeof fetch = fetch) {
  const text = [
    agencyEnabled() ? "KANTARA — PROPERTY INQUIRY / DEMANDE IMMOBILIERE" : "KANTARA — FICTIONAL PROPERTY / BIEN FICTIF",
    `Reference: ${input.propertyId}`, `Request: ${input.purpose}`, `Language: ${input.locale}`,
    `Name: ${input.name}`, `Email: ${input.email}`, `Phone: ${input.phone || "—"}`,
    `Preferred date (Cambodia, not confirmed): ${input.preferredDate || "—"}`,
    `Property: ${new URL(propertyPath(input.locale, input.propertyId), config.origin)}`,
    "", input.message, "", "Consent: contact response only; no marketing subscription.",
  ].join("\n");
  let response: Response;
  try {
    response = await fetcher("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", "Idempotency-Key": `property-inquiry/${input.requestId}` },
      body: JSON.stringify({ from: config.from, to: [recipient], reply_to: input.email,
        subject: `KANTARA · ${input.propertyId} · ${input.purpose}`, text }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { throw new ApiError(502, "EMAIL_UNAVAILABLE", "Email acceptance could not be confirmed. Retry with the same request reference."); }
  const email = z.object({ id: z.string().min(1) }).safeParse(await response.json().catch(() => null));
  if (!response.ok || !email.success) throw new ApiError(502, "EMAIL_UNAVAILABLE", "The email service did not accept the request. Retry later.");
  return email.data.id;
}
export async function submitInquiry(request: Request, raw: unknown) {
  const input = inquiryInput.parse(raw);
  if (input.preferredDate && input.preferredDate < cambodiaDate()) throw new ApiError(400, "VALIDATION_ERROR", "Choose today or a future visit date in Cambodia.");
  const config = inquiryConfig();
  guardInquiryRequest(request, config);
  if (!config) throw new ApiError(503, "CONTACT_SETUP", "Email delivery is not configured. No request was sent.");
  const recipient = await inquiryRecipient(request, input.propertyId, config);
  if (!recipient.email) throw new ApiError(503, "CONTACT_SETUP", "No contact recipient is configured.");
  if (input.purpose === "VISIT" && !recipient.available) throw new ApiError(409, "PROPERTY_UNAVAILABLE", "This property is no longer available for a visit. Ask for information instead.");
  await verifyInquiry(input, config);
  const content = { propertyId: input.propertyId, name: input.name, email: input.email, phone: input.phone,
    purpose: input.purpose, preferredDate: input.preferredDate, message: input.message, locale: input.locale };
  const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  let record: InquiryRecord = { ...content, id: input.requestId, agentId: recipient.agentId,
    recipient: recipient.email, payloadHash: hash, delivery: "PENDING", providerId: null, createdAt: new Date().toISOString() };
  const live = agencyEnabled() && new URL(request.url).pathname !== "/api/demo/inquiries";
  const persist = live || localTeam(request);
  const transact = <T>(operation: (state: TeamState) => T) => live
    ? agencyTransaction(({ team }) => operation(team), true)
    : teamRepository().transact(operation);
  if (persist) record = await transact((state) => {
    const previous = state.inquiries.find((item) => item.id === input.requestId);
    if (previous) {
      if (previous.payloadHash !== hash) throw new ApiError(409, "INQUIRY_CONFLICT", "Use a new request reference when editing a submitted inquiry.");
      if (previous.delivery !== "ACCEPTED" && Date.now() - new Date(previous.createdAt).getTime() >= 24 * 3600000) {
        throw new ApiError(409, "INQUIRY_CONFLICT", "The email idempotency window expired. Ask the agency to check this request before submitting again.");
      }
      return previous;
    }
    if (state.inquiries.length >= 200) throw new ApiError(503, "INQUIRY_CAPACITY", "The contact queue is full.");
    if (state.inquiries.filter((item) => item.email.toLowerCase() === input.email.toLowerCase()
      && Date.now() - new Date(item.createdAt).getTime() < 15 * 60000).length >= 3) {
      throw new ApiError(429, "INQUIRY_THROTTLED", "Please wait before submitting another contact request.");
    }
    state.inquiries.push(record); state.revision++;
    return record;
  });
  if (record.delivery === "ACCEPTED") return { id: input.requestId, delivery: "ACCEPTED" as const };
  // Provider idempotency covers an accepted email whose local save or HTTP response failed.
  const providerId = await deliverInquiry(input, record.recipient, config);
  if (persist) await transact((state) => {
    const current = state.inquiries.find((item) => item.id === input.requestId);
    if (!current) throw new ApiError(503, "INQUIRY_STORAGE", "Email accepted, but the local inquiry record could not be found.");
    current.delivery = "ACCEPTED"; current.providerId = providerId; state.revision++;
  });
  return { id: input.requestId, delivery: "ACCEPTED" as const };
}
