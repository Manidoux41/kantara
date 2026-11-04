import "server-only";
import { getPrisma } from "@/lib/prisma";
import type { CatalogueProperty } from "@/lib/properties/presentation";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
const city = z.enum(["siem-reap", "phnom-penh", "kampot"]);
export async function agencyCatalogue(): Promise<CatalogueProperty[]> {
  const rows = await getPrisma().property.findMany({ where: { status: "PUBLISHED", deletedAt: null },
    select: { id: true, type: true, transactionType: true, availability: true, livingArea: true, bedrooms: true, bathrooms: true, rooms: true,
      salePrice: true, rentalPrice: true, publishedAt: true, location: { select: { name: true } },
      translations: { where: { locale: "en", published: true }, select: { title: true, description: true } },
      images: { orderBy: { position: "asc" }, select: { url: true } }, agencyDetails: true },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }], take: 100 });
  return rows.map((row) => {
    const details = z.object({ address: z.string(), coordinates: z.object({ latitude: z.number(), longitude: z.number() }).optional() }).parse(row.agencyDetails);
    const type = row.type === "VILLA" ? "villa" : row.type === "HOUSE" ? "house" : "apartment";
    if (!row.translations[0]) throw new ApiError(503, "CATALOGUE_STORAGE", "Published property translation is missing.");
    return { id: row.id, title: row.translations[0].title, description: row.translations[0].description,
      address: details.address, coordinates: details.coordinates, location: city.parse(row.location.name),
      transaction: row.transactionType === "SALE" ? "sale" : "rent", type,
      price: Number(row.transactionType === "SALE" ? row.salePrice : row.rentalPrice),
      area: Number(row.livingArea), bedrooms: row.bedrooms ?? 0, bathrooms: row.bathrooms ?? 0, rooms: row.rooms ?? 0,
      image: row.images[0]?.url ?? "/images/khmer-residence.svg", images: row.images.map((item) => item.url), publication: "PUBLISHED",
      availability: row.availability === "SOLD" ? "SOLD" : row.availability === "RENTED" ? "RENTED" : "AVAILABLE",
      publishedAt: row.publishedAt?.toISOString() ?? null };
  });
}
