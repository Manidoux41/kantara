import { z } from "zod";
export const agencyMediaInput = z.strictObject({
  propertyId: z.uuid(), kind: z.enum(["PHOTO", "DOCUMENT"]),
  name: z.string().trim().min(1).max(200), mime: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  base64: z.string().min(4).max(3500000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
