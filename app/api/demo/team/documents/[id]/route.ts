import { ApiError } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/response";
import { teamRepository } from "@/services/team/repository";
import { guardTeamRequest, requireAccount } from "@/services/team/session";
import { requireAdmin } from "@/services/team/domain";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let download: Response | undefined;
  const response = await apiHandler(async () => {
    guardTeamRequest(request);
    const { id } = await params;
    const document = await teamRepository().transact((state) => {
      requireAdmin(requireAccount(state, request));
      const item = state.candidates.flatMap((candidate) => candidate.documents).find((entry) => entry.id === id);
      if (!item) throw new ApiError(404, "NOT_FOUND", "Document not found.");
      return item;
    });
    const extension = document.mime === "application/pdf" ? "pdf" : document.mime === "image/png" ? "png" : "jpg";
    download = new Response(Buffer.from(document.base64, "base64"), { headers: {
      "Content-Type": document.mime, "Content-Disposition": `attachment; filename="hiring-${document.id}.${extension}"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'",
    } });
    return { data: null };
  });
  return download ?? response;
}
