import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { propertyDetailQuerySchema, propertySlugSchema } from "@/lib/validations/properties";
import { getPublicProperty } from "@/services/properties/public-service";

export async function GET(
  request: Request,
  context: RouteContext<"/api/v1/properties/[slug]">,
) {
  const { slug } = await context.params;
  const params = new URL(request.url).searchParams;
  return apiHandler(async () => {
    if (params.getAll("locale").length > 1) {
      throw new ApiError(400, "VALIDATION_ERROR", "Duplicate query parameter: locale");
    }
    const { locale } = propertyDetailQuerySchema.parse(Object.fromEntries(params));
    return getPublicProperty(propertySlugSchema.parse(slug), locale);
  });
}
