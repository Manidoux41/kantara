import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { getDemoSession, sessionCookie } from "@/services/demo/session";
import { generateContractPdf } from "@/services/demo/pdf";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let result: Response | undefined;
  const errorResponse = await apiHandler(async () => {
    const workspace = await getDemoSession(request);
    const contract = workspace.session.state.contracts.find((item) => item.id === id);
    if (!contract) throw new ApiError(404, "NOT_FOUND", "Contract not found in this workspace.");
    const pdf = await generateContractPdf(contract);
    result = sessionCookie(new Response(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="kantara-${contract.kind.toLowerCase()}-${contract.id}.pdf"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } }), workspace.cookie);
    return { data: null };
  });
  return result ?? errorResponse;
}
