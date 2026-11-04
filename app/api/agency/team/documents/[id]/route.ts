import { apiHandler } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/services/team/domain";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let download: Response | undefined;
  const response = await apiHandler(async () => {
    guardAgency(request); const { id } = await params;
    const document = await agencyTransaction(({ team }) => {
      requireAdmin(agencyAccount(team, request));
      const item = team.candidates.flatMap((entry) => entry.documents).find((entry) => entry.id === id);
      if (!item) throw new ApiError(404, "NOT_FOUND", "Document not found.");
      return item;
    });
    const inline = new URL(request.url).searchParams.get("preview") === "1" && document.mime.startsWith("image/");
    download = new Response(Buffer.from(document.base64, "base64"), { headers: {
      "Content-Type": document.mime, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="hiring-${document.id}.${document.mime === "application/pdf" ? "pdf" : document.mime === "image/png" ? "png" : "jpg"}"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'",
    } }); return { data: null };
  });
  return download ?? response;
}
