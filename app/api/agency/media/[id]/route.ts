import { z } from "zod";
import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { decryptAgency } from "@/services/agency/crypto";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
import { requireAdmin } from "@/services/team/domain";
import { requirePropertyAccess } from "@/services/agency/access";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let download: Response | undefined;
  const response = await apiHandler(async () => {
    guardAgency(request);
    const { id } = await params;
    const asset = await agencyTransaction(async (state, tx) => {
      const account = agencyAccount(state.team, request);
      const item = await tx.agencyAsset.findUnique({ where: { id: z.uuid().parse(id) } });
      if (!item) throw new ApiError(404, "NOT_FOUND", "Media not found.");
      requirePropertyAccess(state, account, item.propertyId);
      if (item.kind !== "DOCUMENT") requireAdmin(account);
      return item;
    });
    const { base64 } = z.object({ base64: z.string() }).parse(decryptAgency(asset.payload));
    download = new Response(Buffer.from(base64, "base64"), { headers: { "Content-Type": asset.mime,
      "Content-Disposition": `attachment; filename="kantara-${asset.id}.${asset.mime === "application/pdf" ? "pdf" : asset.mime === "image/png" ? "png" : "jpg"}"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" } });
    return { data: null };
  });
  return download ?? response;
}
export function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    guardAgency(request); const { id } = await params;
    return { data: await agencyTransaction(async (state, tx) => {
      requireAdmin(agencyAccount(state.team, request));
      const asset = await tx.agencyAsset.findUnique({ where: { id: z.uuid().parse(id) } });
      if (!asset) throw new ApiError(404, "NOT_FOUND", "Media not found.");
      if (state.business.bankTransfers?.some((item) => item.evidenceId === id)) {
        throw new ApiError(409, "EVIDENCE_IN_USE", "Bank reconciliation evidence must be retained for its audit trail.");
      }
      const property = state.business.properties.find((item) => item.id === asset.propertyId);
      if (!property) throw new ApiError(503, "AGENCY_STORAGE", "Media property linkage is inconsistent.");
      await tx.propertyImage.deleteMany({ where: { propertyId: asset.propertyId, url: `/api/v1/media/${id}` } });
      await tx.agencyAsset.delete({ where: { id } });
      const first = await tx.propertyImage.findFirst({ where: { propertyId: asset.propertyId }, orderBy: { position: "asc" } });
      property.image = first?.url ?? "/images/khmer-residence.svg";
      state.business.revision++;
      return { deleted: id };
    }, true) };
  });
}
