import { z } from "zod";
import { locales } from "@/lib/i18n/routing";
import { ApiError } from "@/lib/api/errors";

const price = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);
const area = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/);
const count = z.union([z.number(), z.string().regex(/^\d+$/)])
  .transform(Number).pipe(z.number().int().min(0).max(100));
export const propertySorts = [
  "newest", "oldest", "salePriceAsc", "salePriceDesc", "rentalPriceAsc", "rentalPriceDesc",
  "priceAsc", "priceDesc", "areaAsc", "areaDesc", "bedroomsAsc", "bedroomsDesc", "roomsAsc", "roomsDesc",
] as const;

export const propertyQuerySchema = z.strictObject({
  locale: z.enum(locales).default("en"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum([
    "VILLA", "APARTMENT", "HOUSE", "CONDOMINIUM", "LAND", "OFFICE",
    "COMMERCIAL", "GUESTHOUSE", "HOTEL", "RESORT", "DEVELOPMENT",
  ]).optional(),
  transactionType: z.enum(["SALE", "RENT", "SALE_AND_RENT"]).optional(),
  availability: z.enum(["AVAILABLE", "RESERVED", "SOLD", "RENTED"]).optional(),
  locationId: z.uuid().optional(),
  location: z.string().trim().min(1).max(100).optional(),
  minBedrooms: count.optional(),
  maxBedrooms: count.optional(),
  minRooms: count.optional(),
  maxRooms: count.optional(),
  minArea: area.optional(),
  maxArea: area.optional(),
  furnished: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  minPrice: price.optional(),
  maxPrice: price.optional(),
  sort: z.enum(propertySorts).default("newest"),
}).refine(
  ({ minPrice, maxPrice }) =>
    !minPrice || !maxPrice || toCents(minPrice) <= toCents(maxPrice),
  { message: "minPrice must not exceed maxPrice.", path: ["maxPrice"] },
).refine(
  ({ minArea, maxArea }) => !minArea || !maxArea || toCents(minArea) <= toCents(maxArea),
  { message: "minArea must not exceed maxArea.", path: ["maxArea"] },
).refine(
  ({ minBedrooms, maxBedrooms }) => minBedrooms === undefined || maxBedrooms === undefined || minBedrooms <= maxBedrooms,
  { message: "minBedrooms must not exceed maxBedrooms.", path: ["maxBedrooms"] },
).refine(
  ({ minRooms, maxRooms }) => minRooms === undefined || maxRooms === undefined || minRooms <= maxRooms,
  { message: "minRooms must not exceed maxRooms.", path: ["maxRooms"] },
).refine(
  ({ sort, transactionType }) => !sort.startsWith("price") || transactionType === "SALE" || transactionType === "RENT",
  { message: "Price sorting requires transactionType SALE or RENT.", path: ["transactionType"] },
);

function toCents(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export type PropertyQuery = z.infer<typeof propertyQuerySchema>;

export function parsePropertyQuery(params: URLSearchParams): PropertyQuery {
  const values: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in values) {
      throw new ApiError(400, "VALIDATION_ERROR", `Duplicate query parameter: ${key}`);
    }
    values[key] = value;
  }
  return propertyQuerySchema.parse(values);
}

export const propertySlugSchema = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const propertyDetailQuerySchema = z.strictObject({
  locale: z.enum(locales).default("en"),
});
