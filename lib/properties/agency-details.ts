import { z } from "zod";
export const agencyDetailsInput = z.strictObject({
  action: z.literal("propertyDetails"), revision: z.number().int().min(0), propertyId: z.uuid(),
  description: z.string().trim().min(10).max(10000),
  coordinates: z.strictObject({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).nullable(),
});
