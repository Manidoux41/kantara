import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/services/team/domain";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
import { contractDocumentHtml } from "@/lib/demo/contract-document";
import { generateDocumentPdf } from "@/services/demo/pdf";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let download: Response | undefined;
  const response = await apiHandler(async () => {
    guardAgency(request); const { id } = await params;
    const contract = await agencyTransaction((state) => {
      requireAdmin(agencyAccount(state.team, request));
      const item = state.business.contracts.find((entry) => entry.id === id);
      if (!item) throw new ApiError(404, "NOT_FOUND", "Contract not found.");
      return item;
    });
    const pdf = await generateDocumentPdf((font) => contractDocumentHtml(contract, font, true), true);
    download = new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kantara-contract-${contract.id}.pdf"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    return { data: null };
  });
  return download ?? response;
}
