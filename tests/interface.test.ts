import assert from "node:assert/strict";
import test from "node:test";
import { interfaceMessages } from "../lib/i18n/interface";
import { locales } from "../lib/i18n/routing";

test("interactive controls have matching nonempty translations in every supported language", () => {
  const expected = Object.keys(interfaceMessages("en")).sort();
  for (const locale of locales) {
    const messages = interfaceMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), expected);
    for (const [key, value] of Object.entries(messages)) {
      assert.equal(typeof value, "string", `${locale}.${key}`);
      assert.ok(value.trim().length > 0, `${locale}.${key}`);
    }
  }
});
