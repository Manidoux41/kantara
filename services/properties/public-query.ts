import type { Prisma } from "@/generated/prisma/client";
import type { PropertyQuery } from "@/lib/validations/properties";

// Explicit allowlist: never expose owner, partner, agent or internal records.
export function publicPropertySelect(locale: PropertyQuery["locale"]) {
  return {
    id: true,
    reference: true,
    slug: true,
    type: true,
    transactionType: true,
    availability: true,
    salePrice: true,
    rentalPrice: true,
    currency: true,
    livingArea: true,
    landArea: true,
    bedrooms: true,
    bathrooms: true,
    rooms: true,
    furnished: true,
    publishedAt: true,
    location: { select: { id: true, name: true } },
    features: { select: { key: true }, orderBy: { key: "asc" } },
    translations: {
      where: { locale, published: true },
      select: { locale: true, title: true, description: true },
    },
    images: {
      select: { url: true, alt: true, position: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    },
  } satisfies Prisma.PropertySelect;
}

export function publicPropertyWhere(locale: PropertyQuery["locale"]): Prisma.PropertyWhereInput {
  return {
    status: "PUBLISHED",
    deletedAt: null,
    publishedAt: { lte: new Date() },
    translations: { some: { locale, published: true } },
  };
}

export function buildPublicPropertyQuery(query: PropertyQuery) {
  const where: Prisma.PropertyWhereInput = {
    ...publicPropertyWhere(query.locale),
    currency: query.currency,
    type: query.type,
    transactionType: query.transactionType === "SALE"
      ? { in: ["SALE", "SALE_AND_RENT"] }
      : query.transactionType === "RENT"
        ? { in: ["RENT", "SALE_AND_RENT"] }
        : query.transactionType,
    availability: query.availability,
    locationId: query.locationId,
    location: query.location ? { name: { contains: query.location, mode: "insensitive" } } : undefined,
    furnished: query.furnished,
    bedrooms: query.minBedrooms === undefined && query.maxBedrooms === undefined ? undefined
      : { gte: query.minBedrooms, lte: query.maxBedrooms },
    rooms: query.minRooms === undefined && query.maxRooms === undefined ? undefined
      : { gte: query.minRooms, lte: query.maxRooms },
    livingArea: query.minArea === undefined && query.maxArea === undefined ? undefined
      : { gte: query.minArea, lte: query.maxArea },
  };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const range = { gte: query.minPrice, lte: query.maxPrice };
    const sale = { transactionType: { in: ["SALE", "SALE_AND_RENT"] }, salePrice: range } satisfies Prisma.PropertyWhereInput;
    const rent = { transactionType: { in: ["RENT", "SALE_AND_RENT"] }, rentalPrice: range } satisfies Prisma.PropertyWhereInput;
    where.OR = query.transactionType === "SALE" ? [sale]
      : query.transactionType === "RENT" ? [rent] : [sale, rent];
  }
  const direction = query.sort.endsWith("Desc") ? "desc" : "asc";
  const fields: Record<PropertyQuery["sort"], Prisma.PropertyOrderByWithRelationInput> = {
    newest: { publishedAt: "desc" },
    oldest: { publishedAt: "asc" },
    salePriceAsc: { salePrice: { sort: direction, nulls: "last" } },
    salePriceDesc: { salePrice: { sort: direction, nulls: "last" } },
    rentalPriceAsc: { rentalPrice: { sort: direction, nulls: "last" } },
    rentalPriceDesc: { rentalPrice: { sort: direction, nulls: "last" } },
    priceAsc: { [query.transactionType === "RENT" ? "rentalPrice" : "salePrice"]: { sort: direction, nulls: "last" } },
    priceDesc: { [query.transactionType === "RENT" ? "rentalPrice" : "salePrice"]: { sort: direction, nulls: "last" } },
    areaAsc: { livingArea: { sort: direction, nulls: "last" } },
    areaDesc: { livingArea: { sort: direction, nulls: "last" } },
    bedroomsAsc: { bedrooms: { sort: direction, nulls: "last" } },
    bedroomsDesc: { bedrooms: { sort: direction, nulls: "last" } },
    roomsAsc: { rooms: { sort: direction, nulls: "last" } },
    roomsDesc: { rooms: { sort: direction, nulls: "last" } },
  };
  const orderBy: Prisma.PropertyOrderByWithRelationInput[] = [fields[query.sort], { id: "asc" }];

  return {
    where,
    select: publicPropertySelect(query.locale),
    orderBy,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}
