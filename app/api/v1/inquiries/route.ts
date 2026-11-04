import { z } from "zod";
import { apiHandler } from "@/lib/api/response";
import { readJson } from "@/lib/api/read-json";
import { ApiError } from "@/lib/api/errors";
import { inquiryPropertyId } from "@/lib/properties/inquiry";
import { guardInquiryRequest, inquiryConfig, inquiryRecipient, submitInquiry } from "@/services/inquiries";

export function GET(request: Request) {
  return apiHandler(async () => {
    guardInquiryRequest(request, null);
    const search = new URL(request.url).searchParams;
    if (search.getAll("propertyId").length !== 1) throw new ApiError(400, "VALIDATION_ERROR", "Specify one property reference.");
    const query = z.strictObject({ propertyId: inquiryPropertyId }).parse(Object.fromEntries(search));
    const config = inquiryConfig();
    guardInquiryRequest(request, config);
    const recipient = await inquiryRecipient(request, query.propertyId, config);
    return { data: { enabled: Boolean(config), siteKey: config?.siteKey ?? null, agentName: recipient.name } };
  });
}
export function POST(request: Request) {
  return apiHandler(async () => {
    guardInquiryRequest(request, null);
    if (new URL(request.url).search) throw new ApiError(400, "VALIDATION_ERROR", "Query parameters are not supported.");
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415, "VALIDATION_ERROR", "A JSON request is required.");
    return { data: await submitInquiry(request, await readJson(request, 16384)) };
  });
}
