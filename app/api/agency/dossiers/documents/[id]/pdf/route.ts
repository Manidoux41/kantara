import { z } from "zod";
import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
import { requirePropertyAccess } from "@/services/agency/access";
import { dossierDocumentHtml } from "@/lib/agency/dossier-document";
import { generateDocumentPdf } from "@/services/demo/pdf";

export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let download: Response | undefined;
  const response = await apiHandler(async () => {
    guardAgency(request);
    const id = z.uuid().parse((await params).id);
    const document = await agencyTransaction((state) => {
      const account = agencyAccount(state.team, request);
      const item = state.business.dossierDocuments?.find((entry) => entry.id === id);
      if (!item) throw new ApiError(404, "NOT_FOUND", "Document not found.");
      requirePropertyAccess(state, account, item.property.id);
      return item;
    });
    const pdf = await generateDocumentPdf((font) => dossierDocumentHtml(document, font), true);
    download = new Response(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="kantara-${document.input.kind.toLowerCase()}-${document.id}-en-km.pdf"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
    return { data: null };
  });
  return download ?? response;
}
