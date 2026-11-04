import { loadEnvConfig } from "@next/env";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile, rm, access, mkdir, writeFile, mkdtemp, copyFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { join, resolve, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "pg";
import { databaseUrl } from "../lib/database-config";

loadEnvConfig(process.cwd());
const schema = `kantara_validation_${randomUUID().replaceAll("-", "")}`;
const dist = ".next-agency-validation";
const configuration = ".next-agency-validation-tsconfig.json";
const port = process.env.TEST_AGENCY_PORT ?? "3110";
const production = process.argv.includes("--production");
const environment = { ...process.env, NODE_ENV: production ? "production" : "development", AGENCY_MODE: "production", AGENCY_DB_SCHEMA: schema,
  ADMIN_EMAIL: "validation@example.invalid", ADMIN_PASSWORD: randomBytes(24).toString("base64url"),
  AGENCY_ENCRYPTION_KEY: randomBytes(32).toString("hex"), CONTACT_ENABLED: "false",
  NEXT_DIST_DIR: dist, SITE_URL: `http://localhost:${port}`, TEST_BASE_URL: `http://localhost:${port}`, TEST_AGENCY_API: "true",
  AGENCY_TEST_TSCONFIG: configuration,
} satisfies NodeJS.ProcessEnv;
async function command(command: string, args: string[]) {
  const child = spawn(command, args, { env: environment, stdio: "inherit" });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`Validation command failed with exit code ${code}.`);
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 10000))]);
  if (child.exitCode === null) { child.kill("SIGKILL"); await once(child, "exit"); }
}
async function verifyPdfTraces() {
  const directory = await mkdtemp(join(tmpdir(), "kantara-pdf-trace-"));
  try {
    for (const route of ["team/employment/[id]", "admin/contracts/[id]/pdf", "dossiers/documents/[id]/pdf"]) {
      const tracePath = resolve(dist, "server/app/api/agency", route, "route.js.nft.json");
      const trace: { files: string[] } = JSON.parse(await readFile(tracePath, "utf8"));
      const files = trace.files.map((file) => resolve(dirname(tracePath), file));
      for (const asset of ["node_modules/playwright-core/browsers.json", "public/fonts/NotoSansKhmer.ttf", "node_modules/@sparticuz/chromium/bin/chromium.br"]) {
        if (!files.includes(resolve(asset))) throw new Error(`Missing PDF runtime asset in ${route}: ${asset}`);
      }
      if (route.startsWith("team/")) {
        for (const file of files.filter((file) => file.startsWith(resolve("node_modules/playwright-core") + "/"))) {
          const target = join(directory, relative(process.cwd(), file));
          await mkdir(dirname(target), { recursive: true }); await copyFile(file, target);
        }
      }
    }
    const child = spawn(process.execPath, ["-e", "require('playwright-core'); console.log('Isolated serverless PDF runtime import passed.');"],
      { cwd: directory, env: { ...process.env, NODE_PATH: "" }, stdio: "inherit" });
    const [code] = await once(child, "exit");
    if (code !== 0) throw new Error(`Traced PDF runtime import failed with exit code ${code}.`);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
async function main() {
  try { await access(dist); throw new Error("Validation directory already exists; inspect it before reusing this test runner."); }
  catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
  try { await access(configuration); throw new Error("Validation TypeScript configuration already exists; inspect before reusing."); }
  catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
  const db = new Client({ connectionString: databaseUrl(process.env, true), connectionTimeoutMillis: 10000 });
  let created = false, server: ChildProcess | undefined, serverLog = "";
  try {
    await mkdir(dist);
    await writeFile(configuration, JSON.stringify({ extends: "./tsconfig.json", include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"], exclude: ["node_modules"] }));
    await db.connect();
    await db.query(`CREATE SCHEMA "${schema}"`); created = true;
    await db.query(`SET search_path TO "${schema}"`);
    const root = join(process.cwd(), "prisma/migrations");
    for (const entry of (await readdir(root, { withFileTypes: true })).filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await db.query(await readFile(join(root, entry.name, "migration.sql"), "utf8"));
    }
    console.log("Created isolated PostgreSQL validation schema; production records are untouched.");
    await command(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--conditions=react-server", "scripts/bootstrap-agency.ts"]);
    if (production) {
      await command(process.execPath, ["node_modules/next/dist/bin/next", "build"]);
      await verifyPdfTraces();
    }
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", production ? "start" : "dev", "--port", port], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
    server.stdout?.on("data", (chunk: Buffer) => { serverLog = (serverLog + chunk.toString()).slice(-8000); });
    server.stderr?.on("data", (chunk: Buffer) => { serverLog = (serverLog + chunk.toString()).slice(-8000); });
    const deadline = Date.now() + 120000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error("Validation server exited unexpectedly.");
      try { ready = (await fetch(`${environment.TEST_BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(2000) })).ok; }
      catch { /* The server has not begun listening yet; bounded readiness retry. */ }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error("Validation startup timed out.");
    await command(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--test", "--test-concurrency=1",
      "tests/http/agency-auth.test.ts", "tests/http/agency-business.test.ts", "tests/http/agency-dossiers.test.ts", "tests/http/agency-browser.test.ts",
      "tests/http/agency-property-media.test.ts"]);
    console.log("Production agency validation passed; all test data will be removed.");
  } catch (error) {
    if (serverLog) console.error(serverLog);
    throw error;
  } finally {
    if (server) await stop(server);
    if (created) {
      if (!/^kantara_validation_[a-f0-9]{32}$/.test(schema)) throw new Error("Unexpected validation schema; cleanup refused.");
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      console.log("Removed only this run's isolated validation schema.");
    }
    await db.end();
    await rm(dist, { recursive: true, force: true });
    await rm(configuration, { force: true });
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Agency validation failed."); process.exitCode = 1;
});
