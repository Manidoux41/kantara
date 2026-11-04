import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashPassword } from "../services/team/passwords";
import { encryptAgency } from "../services/agency/crypto";
import { getPrisma } from "../lib/prisma";
import type { AgencyState } from "../services/agency/repository";

loadEnvConfig(process.cwd());
async function main() {
  const credentials = z.object({ email: z.email(), password: z.string().min(16).max(128) }).safeParse({
    email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD,
  });
  if (!credentials.success) throw new Error("Set ADMIN_EMAIL and a new ADMIN_PASSWORD (16–128 characters) privately before bootstrap.");
  const state: AgencyState = { version: 1,
    business: { revision: 0, clients: [], properties: [], contracts: [], transactions: [], agents: [], leads: [], appointments: [], activities: [] },
    team: { version: 1, revision: 0, accounts: [{
      id: randomUUID(), login: credentials.data.email.toLowerCase(), name: "KANTARA Administrator", role: "ADMIN", agentId: null,
      passwordHash: await hashPassword(credentials.data.password), active: true, mustChangePassword: false,
    }], candidates: [], sessions: [], attempts: [], propertyAssignments: {}, inquiries: [], work: [], audit: [] } };
  const prisma = getPrisma();
  try {
    const result = await prisma.agencyWorkspace.createMany({ data: [{ id: "main", payload: encryptAgency(state) }], skipDuplicates: true });
    console.log(result.count ? "Production agency initialized: one administrator, zero fictional records." : "Agency already initialized. No password or data changed.");
  } finally { await prisma.$disconnect(); }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error && error.message.startsWith("Set ADMIN_") ? error.message : "Agency initialization failed. Check migrations and private configuration.");
  process.exitCode = 1;
});
