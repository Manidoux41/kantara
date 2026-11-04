import { connection } from "next/server";
import { apiHandler } from "@/lib/api/response";
import { readJson } from "@/lib/api/read-json";
import { ApiError } from "@/lib/api/errors";
import { dossierCommand } from "@/lib/agency/dossiers";
import { agencyTransaction } from "@/services/agency/repository";
import { agencyAccount, guardAgency } from "@/services/agency/session";
import { applyDossierCommand, dossierSnapshot } from "@/services/agency/dossiers";
import { requireAdmin } from "@/services/team/domain";
import { requirePropertyAccess } from "@/services/agency/access";

export async function GET(request: Request) {
  await connection();
  return apiHandler(async () => {
    guardAgency(request);
    return { data: await agencyTransaction((state) => dossierSnapshot(state, agencyAccount(state.team, request))) };
  });
}
export function POST(request: Request) {
  return apiHandler(async () => {
    guardAgency(request);
    const command = dossierCommand.parse(await readJson(request));
    return { data: await agencyTransaction(async (state, tx) => {
      const account = agencyAccount(state.team, request);
      if (command.action === "reviewTransfer" || command.action === "closeDossier") requireAdmin(account);
      if (command.action === "submitTransfer") {
        const transaction = state.business.transactions.find((item) => item.id === command.transactionId);
        if (!transaction) throw new ApiError(404, "NOT_FOUND", "Transaction not found.");
        requirePropertyAccess(state, account, transaction.propertyId);
      }
      if (command.action === "submitTransfer" || (command.action === "reviewTransfer" && command.approved)) {
        const evidenceId = command.action === "submitTransfer" ? command.evidenceId
          : state.business.bankTransfers?.find((item) => item.id === command.transferId)?.evidenceId;
        const asset = evidenceId ? await tx.agencyAsset.findUnique({ where: { id: evidenceId } }) : null;
        const transactionId = command.action === "submitTransfer" ? command.transactionId
          : state.business.bankTransfers?.find((item) => item.id === command.transferId)?.transactionId;
        const transaction = state.business.transactions.find((item) => item.id === transactionId);
        if (!asset || asset.kind !== "DOCUMENT" || !transaction || asset.propertyId !== transaction.propertyId) {
          throw new ApiError(400, "INVALID_EVIDENCE", "Upload a private bank-transfer proof to this property dossier first.");
        }
      }
      applyDossierCommand(state, account, command);
      return dossierSnapshot(state, account);
    }, true) };
  });
}
