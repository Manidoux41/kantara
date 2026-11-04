export function databaseUrl(environment: Record<string, string | undefined> = process.env, migration = false) {
  const keys = migration
    ? ["POSTGRES_URL", "DATABASE_URL", "DATABASE_URL_POOLED", "PRISMA_DATABASE_URL"]
    : ["DATABASE_URL_POOLED", "DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL"];
  for (const key of keys) {
    const value = environment[key];
    if (value && /^(postgres|postgresql):\/\//.test(value)) return value;
  }
  return undefined;
}
export function agencyEnabled() { return process.env.AGENCY_MODE === "production"; }
