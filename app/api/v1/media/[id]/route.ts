import { z } from "zod";
import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { getPrisma } from "@/lib/prisma";
import { agencyEnabled } from "@/lib/database-config";
import { decryptAgency } from "@/services/agency/crypto";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let image: Response | undefined;
  const response = await apiHandler(async () => {
    if (!agencyEnabled()) throw new ApiError(404, "NOT_FOUND", "Media not found.");
    const { id } = await params;
    const asset = await getPrisma().agencyAsset.findFirst({ where: { id: z.uuid().parse(id), kind: "PHOTO",
      property: { status: "PUBLISHED", deletedAt: null } } });
    if (!asset) throw new ApiError(404, "NOT_FOUND", "Published image not found.");
    const { base64 } = z.object({ base64: z.string() }).parse(decryptAgency(asset.payload));
    image = new Response(Buffer.from(base64, "base64"), { headers: { "Content-Type": asset.mime,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
    return { data: null };
  });
  return image ?? response;
}
