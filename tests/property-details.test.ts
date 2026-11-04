import assert from "node:assert/strict";
import test from "node:test";
import { demoProperties, filterDemoProperties, initialDemoFilters } from "../lib/demo/properties";
import { propertyPath, propertyPosition } from "../lib/properties/presentation";
import { propertyMessages } from "../lib/i18n/property";
import { locales } from "../lib/i18n/routing";

test("map positions cover each fictional fixture, are distinct and never invent coordinates for new properties", () => {
  const coordinates = new Set<string>();
  for (const property of demoProperties) {
    const point = propertyPosition(property.id);
    assert.ok(point);
    assert.ok(point.latitude > 10 && point.latitude < 15);
    assert.ok(point.longitude > 102 && point.longitude < 107);
    coordinates.add(JSON.stringify(point));
    for (const locale of locales) assert.equal(propertyPath(locale, property.id), `/${locale}/properties/${property.id}`);
  }
  assert.equal(coordinates.size, 6);
  assert.equal(propertyPosition("new-unlocated-property"), undefined);
  assert.equal(propertyPath("fr", "a/b?c"), "/fr/properties/a%2Fb%3Fc");
  const result = filterDemoProperties({ ...initialDemoFilters, location: "siem-reap", transaction: "sale", minBedrooms: "3" });
  assert.deepEqual(result.map((item) => item.id), ["DEMO-001"]);
});

test("property, map, consent, provider-failure and inquiry interfaces are complete in all seven languages", () => {
  const keys = Object.keys(propertyMessages("en")).sort();
  for (const locale of locales) {
    const messages = propertyMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), keys);
    for (const [key, value] of Object.entries(messages)) assert.ok(value.trim(), `${locale}/${key}`);
    assert.ok(messages.consent.includes("Resend"));
  }
});
