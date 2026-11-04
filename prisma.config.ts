import { defineConfig } from "prisma/config";
import { loadEnvConfig } from "@next/env";
import { databaseUrl } from "./lib/database-config";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl(process.env, true) },
});
