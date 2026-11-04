export const demoLocations = ["siem-reap", "kampot", "phnom-penh"] as const;
export const demoTypes = ["villa", "apartment", "house"] as const;

export type DemoProperty = {
  id: string;
  key: "lotus" | "courtyard" | "riverside" | "palm" | "terrace" | "garden";
  location: (typeof demoLocations)[number];
  type: (typeof demoTypes)[number];
  transaction: "sale" | "rent";
  price: number;
  bedrooms: number;
  rooms: number;
  bathrooms: number;
  area: number;
  image: "/images/khmer-residence.svg" | "/images/khmer-courtyard.svg" | "/images/river-apartment.svg";
  availability?: "AVAILABLE" | "SOLD" | "RENTED";
  publication?: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
  furnishing?: Furnishing | null;
};

// UI-only fixtures. Never used as a fallback for the PostgreSQL-backed API.
export const demoProperties: readonly DemoProperty[] = ([
  { id: "DEMO-001", key: "lotus", location: "siem-reap", type: "villa", transaction: "sale", price: 285000, bedrooms: 3, rooms: 5, bathrooms: 3, area: 240, image: "/images/khmer-residence.svg" },
  { id: "DEMO-002", key: "courtyard", location: "siem-reap", type: "house", transaction: "rent", price: 850, bedrooms: 2, rooms: 4, bathrooms: 2, area: 145, image: "/images/khmer-courtyard.svg" },
  { id: "DEMO-003", key: "riverside", location: "phnom-penh", type: "apartment", transaction: "sale", price: 168000, bedrooms: 2, rooms: 3, bathrooms: 2, area: 112, image: "/images/river-apartment.svg" },
  { id: "DEMO-004", key: "palm", location: "kampot", type: "villa", transaction: "rent", price: 1400, bedrooms: 3, rooms: 6, bathrooms: 3, area: 210, image: "/images/khmer-residence.svg" },
  { id: "DEMO-005", key: "terrace", location: "phnom-penh", type: "apartment", transaction: "rent", price: 650, bedrooms: 1, rooms: 2, bathrooms: 1, area: 76, image: "/images/river-apartment.svg" },
  { id: "DEMO-006", key: "garden", location: "kampot", type: "house", transaction: "sale", price: 195000, bedrooms: 3, rooms: 4, bathrooms: 2, area: 185, image: "/images/khmer-courtyard.svg" },
] satisfies DemoProperty[]).map((property, index) => ({
  ...property, availability: "AVAILABLE" as const, publication: "PUBLISHED" as const,
  publishedAt: `2026-10-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
}));

export type DemoFilters = {
  transaction: "all" | DemoProperty["transaction"];
  location: string;
  type: string;
  minPrice?: string;
  maxPrice?: string;
  minArea?: string;
  maxArea?: string;
  minBedrooms?: string;
  maxBedrooms?: string;
  minRooms?: string;
  maxRooms?: string;
  sort?: DemoSort;
  availability?: string;
  publication?: string;
};

export const demoSorts = ["default", "priceAsc", "priceDesc", "areaAsc", "areaDesc", "bedroomsAsc", "bedroomsDesc", "roomsAsc", "roomsDesc", "publishedAsc", "publishedDesc"] as const;
export type DemoSort = (typeof demoSorts)[number];
export const initialDemoFilters: DemoFilters = { transaction: "all", location: "", type: "", sort: "default" };
export const numericFilterPairs = [
  ["minPrice", "maxPrice", "price"],
  ["minArea", "maxArea", "area"],
  ["minBedrooms", "maxBedrooms", "bedrooms"],
  ["minRooms", "maxRooms", "rooms"],
] as const;

export function validDemoRanges(filters: DemoFilters) {
  return numericFilterPairs.every(([min, max, field]) => {
    const low = filters[min], high = filters[max];
    const valid = (value: string | undefined) => !value || (
      /^\d{1,12}(\.\d{1,2})?$/.test(value)
      && (field !== "bedrooms" && field !== "rooms" || Number.isInteger(Number(value)))
    );
    return valid(low) && valid(high) && (!low || !high || Number(low) <= Number(high));
  });
}

export type DemoFilterable = Omit<DemoProperty, "key" | "image">;
export function filterDemoProperties<T extends DemoFilterable>(filters: DemoFilters, source: readonly T[]): T[];
export function filterDemoProperties(filters: DemoFilters): DemoProperty[];
export function filterDemoProperties(filters: DemoFilters, source: readonly DemoFilterable[] = demoProperties) {
  if (!validDemoRanges(filters)) throw new RangeError("Invalid property filter ranges");
  const result = source.filter((property) =>
    (filters.transaction === "all" || property.transaction === filters.transaction)
    && (!filters.location || property.location === filters.location)
    && (!filters.type || property.type === filters.type)
    && (!filters.availability || filters.availability === "all" || (property.availability ?? "AVAILABLE") === filters.availability)
    && (!filters.publication || filters.publication === "all" || (property.publication ?? "PUBLISHED") === filters.publication)
    && numericFilterPairs.every(([min, max, field]) =>
      (!filters[min] || property[field] >= Number(filters[min]))
      && (!filters[max] || property[field] <= Number(filters[max]))),
  );
  const sort = filters.sort ?? "default";
  if (sort === "default") return result;
  if (sort === "publishedAsc" || sort === "publishedDesc") return result.sort((a, b) => {
    if (!a.publishedAt || !b.publishedAt) return a.publishedAt ? -1 : b.publishedAt ? 1 : a.id.localeCompare(b.id);
    return a.publishedAt.localeCompare(b.publishedAt) * (sort === "publishedAsc" ? 1 : -1) || a.id.localeCompare(b.id);
  });
  const field = sort.startsWith("price") ? "price" : sort.startsWith("area") ? "area"
    : sort.startsWith("bedrooms") ? "bedrooms" : "rooms";
  const direction = sort.endsWith("Desc") ? -1 : 1;
  // Never compare a monthly rent to a sale price: group by transaction first.
  return result.sort((a, b) =>
    (field === "price" && a.transaction !== b.transaction
      ? a.transaction === "sale" ? -1 : 1
      : (a[field] - b[field]) * direction)
    || a.id.localeCompare(b.id));
}
import type { Furnishing } from "@/lib/properties/furnishing";
