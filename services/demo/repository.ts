import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, rename, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { BusinessState } from "@/lib/demo/business-types";
import { clientInput, businessPropertyInput, contractInput, demoMoney } from "@/lib/validations/demo-business";
import { appointmentInput, leadInput } from "@/lib/validations/crm";
import { leadStages } from "@/lib/demo/crm-types";
import { createBusinessState } from "./business";
import { createCrmState } from "./crm";
import { bankTransferSchema, dossierClosureSchema, dossierDocumentSchema } from "@/lib/agency/dossiers";

const clientSchema = clientInput.extend({ id: z.string() });
const propertySchema = businessPropertyInput.extend({
  id: z.string(), price: z.number().positive(), image: z.union([z.enum(["/images/khmer-residence.svg", "/images/khmer-courtyard.svg", "/images/river-apartment.svg"]), z.string().regex(/^\/api\/v1\/media\/[a-f0-9-]{36}$/)]),
  description: z.string().max(10000).optional(),
  coordinates: z.strictObject({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional(),
  availability: z.enum(["AVAILABLE", "SOLD", "RENTED"]), publication: z.enum(["DRAFT", "PUBLISHED"]), publishedAt: z.iso.datetime().nullable(),
});
export const businessStateSchema = z.strictObject({
  revision: z.number().int().min(0), clients: z.array(clientSchema).max(100), properties: z.array(propertySchema).max(100),
  contracts: z.array(contractInput.safeExtend({
    id: z.string(), createdAt: z.iso.datetime(), ownerSnapshot: clientSchema, counterpartySnapshot: clientSchema.optional(), propertySnapshots: z.array(propertySchema).max(10),
  })).max(100),
  transactions: z.array(z.strictObject({
    id: z.string(), contractId: z.string(), propertyId: z.string(), closedAt: z.iso.date(), commission: demoMoney,
    receipts: z.array(z.strictObject({ id: z.string(), amount: demoMoney, paidAt: z.iso.date(), reference: z.string() })).max(100),
    dossierClosure: dossierClosureSchema.optional(),
  })).max(100),
  dossierDocuments: z.array(dossierDocumentSchema).max(300).optional(),
  bankTransfers: z.array(bankTransferSchema).max(300).optional(),
  agents: z.array(z.strictObject({ id: z.string(), name: z.string(), active: z.boolean(), workdays: z.array(z.number().int().min(0).max(6)), startMinute: z.number(), endMinute: z.number() })).max(50),
  leads: z.array(leadInput.extend({ id: z.string(), stage: z.enum(leadStages), lostReason: z.string(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() })).max(200),
  appointments: z.array(appointmentInput.safeExtend({
    id: z.string(), status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]), feedback: z.string(),
    interest: z.enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"]), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), sequence: z.number().int().min(0),
  })).max(500),
  activities: z.array(z.strictObject({
    id: z.string(), at: z.iso.datetime(), action: z.string(), clientId: z.string().nullable(), leadId: z.string().nullable(),
    appointmentId: z.string().nullable(), channel: z.enum(["SYSTEM", "NOTE", "EMAIL", "WHATSAPP", "PHONE"]), text: z.string(),
  })).max(2000),
});
const documentSchema = z.strictObject({ version: z.literal(1), state: businessStateSchema });
export interface WorkspaceRepository {
  read(id: string): Promise<BusinessState | null>;
  create(id: string, initial?: BusinessState): Promise<BusinessState>;
  update(id: string, operation: (state: BusinessState) => BusinessState): Promise<BusinessState>;
}
function isMissing(error: unknown) { return error instanceof Error && "code" in error && error.code === "ENOENT"; }
function unavailable(): never { throw new ApiError(503, "DEMO_STORAGE_ERROR", "Local demo storage could not be read or written. Check the directory and permissions; no data was reset."); }
function validId(id: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new ApiError(400, "INVALID_WORKSPACE", "Invalid workspace identifier.");
}
export class FileWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly directory: string) {}
  private path(id: string) { validId(id); return join(this.directory, `${id}.json`); }
  async read(id: string): Promise<BusinessState | null> {
    const path = this.path(id);
    try {
      const handle = await open(path, "r");
      try {
        if ((await handle.stat()).size > 16 * 1024 * 1024) unavailable();
        return documentSchema.parse(JSON.parse(await handle.readFile("utf8"))).state;
      } finally { await handle.close(); }
    } catch (error) {
      if (isMissing(error)) return null;
      unavailable();
    }
  }
  private async locked<T>(id: string | null, operation: () => Promise<T>): Promise<T> {
    const path = id === null ? join(this.directory, ".capacity.lock") : `${this.path(id)}.lock`;
    let lock;
    try {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      lock = await open(path, "wx", 0o600);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new ApiError(409, "WORKSPACE_BUSY", "A workspace write is in progress. Refresh and retry. After a server crash, remove only its orphaned .lock file while the server is stopped.");
      }
      unavailable();
    }
    try { return await operation(); }
    finally { await lock.close(); await unlink(path); }
  }
  private async save(id: string, state: BusinessState) {
    const path = this.path(id), temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const data = JSON.stringify(documentSchema.parse({ version: 1, state }));
      if (Buffer.byteLength(data) > 16 * 1024 * 1024) throw new ApiError(409, "DEMO_CAPACITY", "Demo workspace exceeds 16 MiB.");
      const file = await open(temporary, "wx", 0o600);
      try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
      await rename(temporary, path);
    } catch (error) {
      try { await unlink(temporary); } catch (cleanup) { if (!isMissing(cleanup)) unavailable(); }
      if (error instanceof ApiError) throw error;
      unavailable();
    }
  }
  async create(id: string, initial = createBusinessState()) {
    return this.locked(null, () => this.locked(id, async () => {
      const existing = await this.read(id);
      if (existing) return existing;
      if ((await readdir(this.directory)).filter((name) => name.endsWith(".json")).length >= 50) throw new ApiError(503, "DEMO_CAPACITY", "Local demo workspace capacity reached.");
      await this.save(id, initial); return structuredClone(initial);
    }));
  }
  async update(id: string, operation: (state: BusinessState) => BusinessState) {
    return this.locked(id, async () => {
      const current = await this.read(id);
      if (!current) throw new ApiError(404, "NOT_FOUND", "Workspace no longer exists.");
      const next = operation(current);
      await this.save(id, next); return next;
    });
  }
}
type LegacySession = { state: BusinessState; expires: number };
const globals = globalThis as typeof globalThis & { kantaraDemoSessions?: Map<string, LegacySession> };
const memory = globals.kantaraDemoSessions ??= new Map();
const memoryRepository: WorkspaceRepository = {
  async read(id) {
    validId(id);
    const state = memory.get(id)?.state;
    return state ? structuredClone({ ...createCrmState(), ...state }) : null;
  },
  async create(id, initial = createBusinessState()) {
    validId(id);
    if (memory.size >= 50) throw new ApiError(503, "DEMO_CAPACITY", "Local demo workspace capacity reached.");
    memory.set(id, { state: structuredClone(initial), expires: Date.now() + 30 * 86400000 }); return structuredClone(initial);
  },
  async update(id, operation) {
    validId(id);
    const current = memory.get(id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Workspace not found.");
    const next = operation(structuredClone({ ...createCrmState(), ...current.state }));
    memory.set(id, { ...current, state: next }); return structuredClone(next);
  },
};
export function workspaceRepository(): WorkspaceRepository {
  const mode = process.env.DEMO_STORAGE ?? "file";
  if (mode === "memory") return memoryRepository;
  if (mode !== "file") throw new ApiError(503, "DEMO_STORAGE_CONFIG", "DEMO_STORAGE must be file or memory; PostgreSQL administration is not enabled yet.");
  return new FileWorkspaceRepository(resolve(/*turbopackIgnore: true*/ process.env.DEMO_DATA_DIR ?? ".kantara-demo"));
}
export async function recoverMemoryWorkspace(id: string): Promise<BusinessState | undefined> {
  return (await memoryRepository.read(id)) ?? undefined;
}
