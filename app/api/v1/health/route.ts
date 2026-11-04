import { apiHandler } from "@/lib/api/response";

export async function GET() {
  return apiHandler(async () => ({
    data: { application: "KANTARA", apiVersion: "v1", status: "ok" },
  }));
}
