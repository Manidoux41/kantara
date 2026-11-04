import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/services/team/domain";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
import { employmentDocumentHtml } from "@/lib/team/employment-document";
import { generateDocumentPdf } from "@/services/demo/pdf";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let download: Response | undefined;
  const response = await apiHandler(async () => {
    guardAgency(request); const { id } = await params;
    const contract = await agencyTransaction(({ team }) => {
      requireAdmin(agencyAccount(team, request));
      const item = team.candidates.find((entry) => entry.id === id)?.contract;
      if (!item) throw new ApiError(404, "NOT_FOUND", "Employment draft not found.");
      return item;
    });
    const pdf = await generateDocumentPdf((font) => employmentDocumentHtml(contract, font, true), true);
    download = new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kantara-employment-${contract.id}-en-km.pdf"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    return { data: null };
  });
  return download ?? response;
}
