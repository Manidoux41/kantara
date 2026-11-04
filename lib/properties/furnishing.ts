import { z } from "zod";

export const furnishingLevels = ["FURNISHED", "UNFURNISHED", "PARTIALLY_FURNISHED"] as const;
export const furnishingSchema = z.enum(furnishingLevels);
export type Furnishing = z.infer<typeof furnishingSchema>;

export function publicFurnishing(details: unknown, furnished: boolean): Furnishing | null {
  const parsed = z.object({ furnishing: furnishingSchema.optional() }).nullable().parse(details);
  return parsed?.furnishing ?? (furnished ? "FURNISHED" : null);
}
