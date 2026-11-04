import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  adminModules, adminDemoRecords, filterAdminRecords, getAdminDemoSummary,
} from "../lib/demo/administration";
import { demoProperties } from "../lib/demo/properties";
import { locales } from "../lib/i18n/routing";

test("every administration module has fictional records with valid property relationships", () => {
  assert.equal(adminModules.length, 12);
  assert.equal(new Set(adminDemoRecords.map((record) => record.id)).size, adminDemoRecords.length);
  for (const moduleKey of adminModules) {
    if (moduleKey !== "dashboard") assert.ok(adminDemoRecords.some((record) => record.module === moduleKey));
  }
  for (const record of adminDemoRecords) {
    if (record.propertyId) assert.ok(demoProperties.some((property) => property.id === record.propertyId), record.id);
    if (record.amount !== undefined) assert.ok(record.amount >= 0);
    assert.ok(!("email" in record) && !("password" in record) && !("documentUrl" in record));
  }
  assert.deepEqual(adminDemoRecords.filter((record) => record.module === "properties").map((record) => record.id),
    demoProperties.map((property) => property.id));
});

test("dashboard aggregates are derived from the fictional data", () => {
  assert.deepEqual(getAdminDemoSummary(), {
    properties: 6, leads: 3, pendingDocuments: 1, commissions: 8700, completedCommissions: 6000,
  });
  for (const moduleKey of ["documents", "contracts", "appointments"]) {
    assert.ok(adminDemoRecords.some((record) => record.module === moduleKey && record.status === "pending"));
  }
});

test("administration search and status filters compose and never mutate fixtures", () => {
  const before = JSON.stringify(adminDemoRecords);
  const title = (record: { titleKey: string }) => record.titleKey === "identity" ? "Pièce d’identité" : record.titleKey;
  assert.equal(filterAdminRecords("properties", "", "all", title).length, 6);
  assert.equal(filterAdminRecords("documents", "  identité ", "pending", title).length, 1);
  assert.equal(filterAdminRecords("documents", "DOC-002", "completed", title).length, 0);
  assert.equal(filterAdminRecords("finance", "agent a01", "pending", title).length, 1);
  assert.equal(filterAdminRecords("crm", "demo-001", "active", title).length, 1);
  assert.equal(filterAdminRecords("crm", "not-a-record", "all", title).length, 0);
  assert.equal(JSON.stringify(adminDemoRecords), before);
});

function messageLeaves(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") {
    assert.ok(value.trim().length, prefix);
    return { [prefix]: value };
  }
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) =>
    Object.entries(messageLeaves(child, prefix ? `${prefix}.${key}` : key))));
}

test("administration has complete matching translations for seven locales and every record", async () => {
  let expected: string[] | undefined;
  for (const locale of locales) {
    const messages = messageLeaves(JSON.parse(await readFile(new URL(`../messages/admin/${locale}.json`, import.meta.url), "utf8")));
    const keys = Object.keys(messages).sort();
    expected ??= keys;
    assert.deepEqual(keys, expected, locale);
    for (const moduleKey of adminModules) {
      assert.ok(messages[`modules.${moduleKey}`]);
      assert.ok(messages[`descriptions.${moduleKey}`]);
    }
    for (const record of adminDemoRecords) {
      if (!record.titleKey.startsWith("property:")) assert.ok(messages[`records.${record.titleKey}`]);
    }
  }
});
