import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { locales } from "../lib/i18n/routing";
import { demoProperties } from "../lib/demo/properties";

test("all seven language dictionaries have the same nonempty keys", async () => {
  const expected = ["language", "status", "tagline", "title"];
  assert.deepEqual([...locales], ["en", "fr", "km", "zh", "ja", "de", "es"]);
  for (const locale of locales) {
    const messages = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    assert.deepEqual(Object.keys(messages.Home).sort(), expected);
    for (const value of Object.values(messages.Home)) {
      assert.equal(typeof value, "string");
      assert.ok(String(value).trim().length > 0);
    }
  }
});

function leaves(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") {
    assert.ok(value.trim().length > 0, prefix);
    return { [prefix]: value };
  }
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), prefix);
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      Object.entries(leaves(child, prefix ? `${prefix}.${key}` : key))),
  );
}

test("preview translations have matching complete keys and property content in every locale", async () => {
  const english = JSON.parse(await readFile(new URL("../messages/en.json", import.meta.url), "utf8"));
  const expected = Object.keys(leaves(english.Preview)).sort();
  for (const locale of locales) {
    const messages = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    const entries = leaves(messages.Preview);
    assert.deepEqual(Object.keys(entries).sort(), expected, locale);
    for (const property of demoProperties) {
      assert.ok(entries[`properties.${property.key}.title`]);
      assert.ok(entries[`properties.${property.key}.description`]);
    }
  }
});
