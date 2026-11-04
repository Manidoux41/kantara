import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { agencyEnabled } from "@/lib/database-config";
import { agencyCatalogue } from "@/services/agency/catalogue";
import { connection } from "next/server";
export async function GET() {
  await connection();
  return apiHandler(async () => {
    if (!agencyEnabled()) throw new ApiError(404, "NOT_FOUND", "Production catalogue is not enabled.");
    return { data: await agencyCatalogue() };
  });
}
