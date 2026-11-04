import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api/errors";
import { teamStateSchema, type TeamState } from "@/lib/team/schema";
import { businessStateSchema } from "@/services/demo/repository";
import type { BusinessState } from "@/lib/demo/business-types";
import { decryptAgency, encryptAgency } from "./crypto";
import { syncPublicProperties } from "./public";
import type { Prisma } from "@/generated/prisma/client";

export type AgencyState = { version: 1; business: BusinessState; team: TeamState };
export async function agencyTransaction<T>(operation: (state: AgencyState, tx: Prisma.TransactionClient) => T | Promise<T>, write = false): Promise<T> {
  return getPrisma().$transaction(async (tx) => {
    if (write) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${process.env.AGENCY_DB_SCHEMA ?? "public"}:kantara-agency`}))::text`;
    const row = await tx.agencyWorkspace.findUnique({ where: { id: "main" } });
    if (!row) throw new ApiError(503, "AGENCY_SETUP", "Initialize the production agency with npm run db:bootstrap.");
    const raw = decryptAgency(row.payload);
    if (!raw || typeof raw !== "object" || !("version" in raw) || raw.version !== 1 || !("business" in raw) || !("team" in raw)) {
      throw new ApiError(503, "AGENCY_STORAGE", "Unsupported agency storage version; no data was reset.");
    }
    const business = businessStateSchema.safeParse(raw.business), team = teamStateSchema.safeParse(raw.team);
    if (!business.success || !team.success) throw new ApiError(503, "AGENCY_STORAGE", "Stored agency data failed validation; no records were reset.");
    const state: AgencyState = { version: 1, business: business.data, team: team.data };
    const previous = structuredClone(state.business);
    const result = await operation(state, tx);
    if (write) {
      businessStateSchema.parse(state.business); teamStateSchema.parse(state.team);
      if (JSON.stringify(state).length > 48 * 1024 * 1024) throw new ApiError(409, "AGENCY_CAPACITY", "Agency storage limit reached; archive records before continuing.");
      await syncPublicProperties(tx, state, previous);
      await tx.agencyWorkspace.update({ where: { id: "main" }, data: { payload: encryptAgency(state), revision: { increment: 1 } } });
    }
    return result;
  }, { maxWait: 10000, timeout: 30000 });
}
