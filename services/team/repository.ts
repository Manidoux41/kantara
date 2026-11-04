import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { ApiError } from "@/lib/api/errors";
import { loginId, passwordInput, teamStateSchema, type TeamState } from "@/lib/team/schema";
import { hashPassword } from "./passwords";

const missing = (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT";
export class TeamRepository {
  constructor(private readonly directory: string) {}
  async transact<T>(operation: (state: TeamState) => Promise<T> | T): Promise<T> {
    let lock;
    const lockPath = join(this.directory, "agency.lock"), path = join(this.directory, "agency.json");
    try {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      for (let attempt = 0; attempt < 40; attempt++) {
        try { lock = await open(lockPath, "wx", 0o600); break; }
        catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
          if (attempt === 39) throw error;
          await setTimeout(50);
        }
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") throw new ApiError(409, "TEAM_BUSY", "A team operation is in progress. Retry.");
      throw new ApiError(503, "TEAM_STORAGE", "Unable to lock the local team repository. Check directory permissions.");
    }
    if (!lock) throw new ApiError(503, "TEAM_STORAGE", "Unable to acquire the team repository lock.");
    let temporary: string | undefined;
    try {
      let state: TeamState;
      try {
        const file = await open(path, "r");
        try {
          if ((await file.stat()).size > 48 * 1024 * 1024) throw new Error("Capacity");
          state = teamStateSchema.parse(JSON.parse(await file.readFile("utf8")));
        } finally { await file.close(); }
      } catch (error) {
        if (!missing(error)) throw new ApiError(503, "TEAM_STORAGE", "Local team storage is invalid or unreadable. No data was reset.");
        const adminLogin = loginId.safeParse(process.env.DEMO_ADMIN_LOGIN);
        const password = passwordInput.safeParse(process.env.DEMO_ADMIN_PASSWORD);
        if (!adminLogin.success || !password.success) throw new ApiError(503, "TEAM_SETUP", "Configure DEMO_ADMIN_LOGIN and DEMO_ADMIN_PASSWORD (12–128 characters) in .env.local.");
        state = { version: 1, revision: 0, accounts: [{
          id: randomUUID(), login: adminLogin.data, name: "Administration DEMO", role: "ADMIN", agentId: null,
          passwordHash: await hashPassword(password.data), active: true, mustChangePassword: false,
        }], candidates: [], sessions: [], attempts: [], propertyAssignments: {}, work: [], audit: [], inquiries: [] };
      }
      const result = await operation(state);
      const serialized = JSON.stringify(teamStateSchema.parse(state));
      if (Buffer.byteLength(serialized) > 48 * 1024 * 1024) throw new ApiError(409, "TEAM_CAPACITY", "Local team storage limit reached.");
      const temporaryPath = `${path}.${randomUUID()}.tmp`;
      temporary = temporaryPath;
      const file = await open(temporaryPath, "wx", 0o600);
      try { await file.writeFile(serialized); await file.sync(); } finally { await file.close(); }
      await rename(temporaryPath, path);
      temporary = undefined;
      return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "TEAM_STORAGE", "Unable to save the local team repository. No success was recorded; refresh and retry.");
    } finally {
      try { if (temporary) await unlink(temporary); }
      catch (error) { if (!missing(error)) console.error("Team temporary file cleanup failed"); }
      await lock.close();
      await unlink(lockPath);
    }
  }
}
export function teamRepository() {
  return new TeamRepository(resolve(/*turbopackIgnore: true*/ process.env.DEMO_TEAM_DATA_DIR ?? ".kantara-team"));
}
