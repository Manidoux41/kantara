import { apiHandler } from "@/lib/api/response";
import { readJson } from "@/lib/api/read-json";
import { ApiError } from "@/lib/api/errors";
import { businessCommandSchema } from "@/lib/validations/demo-business";
import { executeBusinessCommand } from "@/services/demo/business";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
import { requireAdmin } from "@/services/team/domain";
import { businessSnapshot } from "@/services/agency/business";
import { z } from "zod";
import { connection } from "next/server";
import { agencyDetailsInput } from "@/lib/properties/agency-details";

export async function GET(request: Request) {
  await connection();
  return apiHandler(async () => {
    guardAgency(request);
    if (new URL(request.url).search) throw new ApiError(400, "VALIDATION_ERROR", "Query parameters are not supported.");
    return { data: await agencyTransaction((state) => businessSnapshot(state, agencyAccount(state.team, request))) };
  });
}
export function POST(request: Request) {
  return apiHandler(async () => {
    guardAgency(request);
    const raw = await readJson(request);
    const action = z.object({ action: z.string() }).parse(raw).action;
    const details = action === "propertyDetails" ? agencyDetailsInput.parse(raw) : null;
    const command = details ? null : businessCommandSchema.parse(raw);
    return { data: await agencyTransaction((state) => {
      const account = agencyAccount(state.team, request); requireAdmin(account);
      if (command?.action === "recordReceipt") throw new ApiError(409, "BANK_RECONCILIATION_REQUIRED", "Submit a bank transfer with proof in the property dossier, then have an administrator confirm receipt.");
      if (details) {
        if (state.business.revision !== details.revision) throw new ApiError(409, "REVISION_CONFLICT", "The agency changed. Refresh and retry.");
        const property = state.business.properties.find((item) => item.id === details.propertyId);
        if (!property) throw new ApiError(404, "NOT_FOUND", "Property not found.");
        property.description = details.description;
        property.coordinates = details.coordinates ?? undefined;
        state.business.revision++;
      } else if (command) state.business = executeBusinessCommand(state.business, command);
      return businessSnapshot(state, account);
    }, true) };
  });
}
