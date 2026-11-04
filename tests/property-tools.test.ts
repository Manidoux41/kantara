import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { demoProperties, demoSorts, filterDemoProperties, initialDemoFilters, validDemoRanges } from "../lib/demo/properties";
import { locales } from "../lib/i18n/routing";

test("advanced filters combine destination, price, living area, bedrooms and rooms inclusively", () => {
  const result = filterDemoProperties({
    ...initialDemoFilters, transaction: "sale", location: "siem-reap", type: "villa",
    minPrice: "285000", maxPrice: "285000", minArea: "240", maxArea: "240",
    minBedrooms: "3", maxBedrooms: "3", minRooms: "5", maxRooms: "5",
  });
  assert.deepEqual(result.map((item) => item.id), ["DEMO-001"]);
  assert.equal(filterDemoProperties({ ...initialDemoFilters, maxRooms: "2" })[0].id, "DEMO-005");
  assert.equal(filterDemoProperties({ ...initialDemoFilters, minArea: "500" }).length, 0);
  assert.equal(filterDemoProperties({ ...initialDemoFilters, minBedrooms: "0", maxBedrooms: "0" }).length, 0);
});

test("all numeric sorts are deterministic, nonmutating and price sorting never mixes sale and monthly rent", () => {
  const before = JSON.stringify(demoProperties);
  for (const sort of demoSorts) {
    const results = filterDemoProperties({ ...initialDemoFilters, sort });
    assert.equal(results.length, 6);
    if (sort === "default") continue;
    if (sort === "publishedAsc" || sort === "publishedDesc") {
      const dates = results.map((item) => item.publishedAt);
      assert.deepEqual(dates, [...dates].sort((a, b) => (a ?? "").localeCompare(b ?? "") * (sort === "publishedAsc" ? 1 : -1)));
      continue;
    }
    const field = sort.startsWith("price") ? "price" : sort.startsWith("area") ? "area"
      : sort.startsWith("bedrooms") ? "bedrooms" : "rooms";
    for (let index = 1; index < results.length; index++) {
      const a = results[index - 1], b = results[index];
      if (field === "price" && a.transaction !== b.transaction) {
        assert.equal(a.transaction, "sale"); assert.equal(b.transaction, "rent");
        continue;
      }
      assert.ok(sort.endsWith("Desc") ? a[field] >= b[field] : a[field] <= b[field], sort);
      if (a[field] === b[field]) assert.ok(a.id < b.id);
    }
  }
  assert.equal(JSON.stringify(demoProperties), before);
  assert.deepEqual(filterDemoProperties({ ...initialDemoFilters, transaction: "rent", sort: "priceAsc" }).map((item) => item.price), [650, 850, 1400]);
});

test("invalid ranges are rejected instead of silently turning into empty results", () => {
  for (const invalid of [
    { minPrice: "20", maxPrice: "10" }, { minArea: "-1" }, { minArea: "NaN" },
    { minBedrooms: "1.5" }, { maxRooms: "Infinity" }, { minRooms: "5", maxRooms: "3" },
    { minPrice: "1e6" }, { maxPrice: "1.001" },
  ]) {
    const filters = { ...initialDemoFilters, ...invalid };
    assert.equal(validDemoRanges(filters), false);
    assert.throws(() => filterDemoProperties(filters), RangeError);
  }
});

function keys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") { assert.ok(child.trim(), path); return [path]; }
    assert.ok(child && typeof child === "object" && !Array.isArray(child), path);
    return keys(child as Record<string, unknown>, path);
  }).sort();
}

test("all seven locales have matching nonempty search and media translations", async () => {
  let expected: string[] | undefined;
  for (const locale of locales) {
    const dictionary = JSON.parse(await readFile(new URL(`../messages/tools/${locale}.json`, import.meta.url), "utf8"));
    const actual = keys(dictionary);
    expected ??= actual;
    assert.deepEqual(actual, expected, locale);
    for (const sort of demoSorts.filter((sort) => !sort.startsWith("published"))) assert.ok(dictionary.sorts[sort]);
  }
});
