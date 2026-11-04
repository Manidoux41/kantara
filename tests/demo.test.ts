import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { demoLocations, demoProperties, demoTypes, filterDemoProperties } from "../lib/demo/properties";

test("six isolated demo properties have unique references, local illustrations and valid values", async () => {
  assert.equal(demoProperties.length, 6);
  assert.equal(new Set(demoProperties.map((property) => property.id)).size, 6);
  for (const property of demoProperties) {
    assert.match(property.id, /^DEMO-\d{3}$/);
    assert.ok(property.price > 0 && Number.isInteger(property.price));
    assert.ok(property.area > 0);
    assert.ok(demoLocations.includes(property.location));
    assert.ok(demoTypes.includes(property.type));
    assert.ok(!("owner" in property));
    await access(new URL(`../public${property.image}`, import.meta.url));
  }
});

test("demo transaction filters have three sale and three rental properties", () => {
  const filters = { transaction: "all", location: "", type: "" } as const;
  assert.equal(filterDemoProperties(filters).length, 6);
  assert.equal(filterDemoProperties({ ...filters, transaction: "sale" }).length, 3);
  assert.equal(filterDemoProperties({ ...filters, transaction: "rent" }).length, 3);
  assert.equal(filterDemoProperties(filters).length, 6);
});

test("demo filters combine location, type and transaction without modifying fixtures", () => {
  const before = JSON.stringify(demoProperties);
  assert.deepEqual(filterDemoProperties({ location: "siem-reap", type: "villa", transaction: "sale" }).map((property) => property.id), ["DEMO-001"]);
  assert.equal(filterDemoProperties({ location: "kampot", type: "apartment", transaction: "all" }).length, 0);
  assert.equal(filterDemoProperties({ location: "siem-reap", type: "villa", transaction: "rent" }).length, 0);
  assert.equal(filterDemoProperties({ location: "", type: "apartment", transaction: "all" }).length, 2);
  assert.equal(before, JSON.stringify(demoProperties));
});

function luminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("the design's normal-size text colors meet WCAG AA contrast (4.5:1)", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  function token(name: string) {
    const value = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))?.[1];
    assert.ok(value, `Missing design token ${name}`);
    return value;
  }
  const backgroundColor = token("background");
  const foregroundColor = token("foreground");
  for (const [foreground, background] of [
    [token("foreground"), backgroundColor], [token("muted"), backgroundColor],
    [token("gold"), backgroundColor], [token("inverted"), foregroundColor],
    [token("inverted"), token("night")], ["#d5e7f5", token("night")],
    [token("sun"), token("night")], [token("accent"), token("accent-soft")],
    [token("inverted"), token("accent")], [token("gold"), token("sun-soft")],
    [foregroundColor, token("sun")], ["#912d22", "#fff0ed"],
    ...["accent-soft", "sun-soft", "surface"].flatMap((surface) => [
      [foregroundColor, token(surface)], [token("muted"), token(surface)], [token("accent"), token(surface)],
    ]),
  ]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    const ratio = (values[0] + 0.05) / (values[1] + 0.05);
    assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
  }
});
