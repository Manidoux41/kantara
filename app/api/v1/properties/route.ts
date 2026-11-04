import { apiHandler } from "@/lib/api/response";
import { parsePropertyQuery } from "@/lib/validations/properties";
import { listPublicProperties } from "@/services/properties/public-service";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return apiHandler(() =>
    listPublicProperties(parsePropertyQuery(params)),
  );
}
