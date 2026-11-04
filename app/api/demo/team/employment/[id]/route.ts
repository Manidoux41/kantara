import { ApiError } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/response";
import { employmentDocumentHtml } from "@/lib/team/employment-document";
import { teamRepository } from "@/services/team/repository";
import { guardTeamRequest, requireAccount } from "@/services/team/session";
import { requireAdmin } from "@/services/team/domain";
import { generateDocumentPdf } from "@/services/demo/pdf";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let download: Response | undefined;
  const response = await apiHandler(async () => {
    guardTeamRequest(request);
    const { id } = await params;
    const contract = await teamRepository().transact((state) => {
      requireAdmin(requireAccount(state, request));
      const item = state.candidates.find((entry) => entry.id === id)?.contract;
      if (!item) throw new ApiError(404, "NOT_FOUND", "Employment draft not found.");
      return item;
    });
    const pdf = await generateDocumentPdf((font) => employmentDocumentHtml(contract, font));
    download = new Response(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="kantara-employment-${contract.id}-en-km.pdf"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
    return { data: null };
  });
  return download ?? response;
}
