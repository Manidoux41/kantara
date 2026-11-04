import test from "node:test";
import assert from "node:assert/strict";
import { createBusinessState, executeBusinessCommand } from "../services/demo/business";
import { businessStateSchema } from "../services/demo/repository";
import { businessPropertyInput } from "../lib/validations/demo-business";
import { agencyDetailsInput } from "../lib/properties/agency-details";
import { furnishingLevels, publicFurnishing } from "../lib/properties/furnishing";
import { propertyEditorMessages } from "../lib/i18n/property-editor";
import { locales } from "../lib/i18n/routing";

test("property furnishing: three explicit levels persist without inventing a value for legacy properties", () => {
  const initial = createBusinessState();
  assert.equal(businessStateSchema.safeParse(initial).success, true);
  assert.equal(initial.properties[0].furnishing, undefined);
  for (const furnishing of furnishingLevels) {
    const state = executeBusinessCommand(initial, { action: "createProperty", revision: initial.revision, input: {
      title: "EDITOR TEST", address: "EDITOR TEST ADDRESS", titleReference: "TEST-TITLE", ownerId: initial.clients[0].id,
      transaction: "rent", type: "villa", location: "siem-reap", price: "1000", area: 120, bedrooms: 2, bathrooms: 2, rooms: 3, furnishing,
    } });
    assert.equal(state.properties.at(-1)!.furnishing, furnishing);
    assert.equal(businessStateSchema.parse(state).properties.at(-1)!.furnishing, furnishing);
  }
});
test("property furnishing: validation rejects unknown values and supports editing existing property details", () => {
  const details = { action: "propertyDetails", revision: 0, propertyId: "00000000-0000-4000-8000-000000000001",
    description: "PROPERTY TEST DESCRIPTION", coordinates: null };
  for (const furnishing of furnishingLevels) assert.equal(agencyDetailsInput.parse({ ...details, furnishing }).furnishing, furnishing);
  for (const furnishing of ["YES", "no", "", null, true]) {
    assert.equal(agencyDetailsInput.safeParse({ ...details, furnishing }).success, false);
    assert.equal(businessPropertyInput.shape.furnishing.safeParse(furnishing).success, false);
  }
  assert.equal(agencyDetailsInput.safeParse(details).success, true);
});
test("property furnishing: public projection preserves partial and legacy uncertainty, and rejects corrupt values", () => {
  for (const furnishing of furnishingLevels) {
    assert.equal(publicFurnishing({ address: "TEST", furnishing }, false), furnishing);
  }
  assert.equal(publicFurnishing(null, false), null);
  assert.equal(publicFurnishing({ address: "TEST" }, false), null);
  assert.equal(publicFurnishing(null, true), "FURNISHED");
  assert.throws(() => publicFurnishing({ furnishing: "INVALID" }, false));
});
test("property editor: all seven languages have furnishing and accessible gallery/photo-picker labels", () => {
  for (const locale of locales) {
    const messages = propertyEditorMessages(locale);
    assert.deepEqual(Object.keys(messages), Object.keys(propertyEditorMessages("en")));
    assert.ok(Object.values(messages).every((message) => message.length > 0));
    assert.ok(messages.photoHelp.includes("20"));
  }
});
