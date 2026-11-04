import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/response";
import { readJson } from "@/lib/api/read-json";
import { ApiError } from "@/lib/api/errors";
import { getPrisma } from "@/lib/prisma";
import { agencyMediaInput } from "@/lib/properties/agency-media";
import { encryptAgency } from "@/services/agency/crypto";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
import { requireAdmin } from "@/services/team/domain";
export async function GET(request: Request) {
  await connection();
  return apiHandler(async () => {
    guardAgency(request);
    await agencyTransaction(({ team }) => requireAdmin(agencyAccount(team, request)));
    const propertyId = z.uuid().parse(new URL(request.url).searchParams.get("propertyId"));
    return { data: await getPrisma().agencyAsset.findMany({ where: { propertyId }, select: { id: true, propertyId: true, kind: true, name: true, mime: true, size: true }, orderBy: { createdAt: "asc" } }) };
  });
}
export function POST(request: Request) {
  return apiHandler(async () => {
    guardAgency(request);
    await agencyTransaction(({ team }) => requireAdmin(agencyAccount(team, request)));
    const input = agencyMediaInput.parse(await readJson(request, 3600000));
    const bytes = Buffer.from(input.base64, "base64");
    const valid = input.mime === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-"
      : input.mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!valid || !bytes.length || bytes.length > 2.5 * 1024 * 1024 || (input.kind === "PHOTO" && input.mime === "application/pdf")) {
      throw new ApiError(400, "VALIDATION_ERROR", "Use a valid JPEG, PNG or PDF up to 2.5 MiB. Photos must be JPEG or PNG.");
    }
    return { data: await agencyTransaction(async (state, tx) => {
      requireAdmin(agencyAccount(state.team, request));
      const property = state.business.properties.find((item) => item.id === input.propertyId);
      if (!property) throw new ApiError(404, "NOT_FOUND", "Property not found.");
      const count = await tx.agencyAsset.count({ where: { propertyId: input.propertyId, kind: input.kind } });
      if (count >= 20) throw new ApiError(409, "MEDIA_LIMIT", "Maximum 20 photos and 20 documents per property.");
      const id = randomUUID();
      await tx.agencyAsset.create({ data: { id, propertyId: input.propertyId, kind: input.kind,
        name: input.name, mime: input.mime, size: bytes.length, payload: encryptAgency({ base64: input.base64 }) } });
      if (input.kind === "PHOTO") {
        const maximum = await tx.propertyImage.aggregate({ where: { propertyId: input.propertyId }, _max: { position: true } });
        await tx.propertyImage.create({ data: {
          propertyId: input.propertyId, url: `/api/v1/media/${id}`, alt: input.name, position: (maximum._max.position ?? -1) + 1,
        } });
      }
      if (input.kind === "PHOTO" && count === 0) property.image = `/api/v1/media/${id}`;
      state.business.revision++;
      return { id };
    }, true) };
  });
}
