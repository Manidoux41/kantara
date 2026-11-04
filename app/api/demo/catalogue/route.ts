import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { readDemoCatalogue, guardDemoRequest, sessionCookie } from "@/services/demo/session";

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  let cookie: string | undefined;
  const response = await apiHandler(async () => {
    guardDemoRequest(request);
    if (query) throw new ApiError(400, "VALIDATION_ERROR", "Query parameters are not supported.");
    const workspace = await readDemoCatalogue(request);
    cookie = workspace.cookie;
    return { data: workspace.state.properties.filter((item) => item.publication === "PUBLISHED").map(
      (property) => ({
        id: property.id, title: property.title, address: property.address, location: property.location,
        type: property.type, transaction: property.transaction, price: property.price, area: property.area,
        bedrooms: property.bedrooms, bathrooms: property.bathrooms, rooms: property.rooms,
        image: property.image, availability: property.availability,
        publication: property.publication, publishedAt: property.publishedAt,
      }),
    ) };
  });
  return sessionCookie(response, cookie);
}
