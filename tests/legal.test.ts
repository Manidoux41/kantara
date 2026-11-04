import assert from "node:assert/strict";
import test from "node:test";
import { agencyResources, informationSections, informationTopics, legalMessages } from "../lib/i18n/legal";
import { locales } from "../lib/i18n/routing";

test("all information topics have complete localized titles, disclosures and substantive sections", () => {
  const expected = Object.keys(legalMessages("en")).sort();
  for (const locale of locales) {
    const messages = legalMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), expected, locale);
    for (const [key, text] of Object.entries(messages)) assert.ok(text.trim().length > 0, `${locale}.${key}`);
    for (const topic of informationTopics) {
      assert.ok(messages[topic]);
      assert.ok(informationSections[topic].length >= 2);
      for (const section of informationSections[topic]) {
        assert.ok(messages[section.title].length > 0);
        assert.ok(Buffer.byteLength(messages[section.text], "utf8") >= 120, `${locale}.${section.text}`);
      }
    }
  }
});

test("agency resources are explicit HTTPS references and disclosures do not invent licensing or fees", () => {
  assert.equal(new Set(agencyResources.map((source) => source.url)).size, agencyResources.length);
  for (const source of agencyResources) {
    assert.equal(new URL(source.url).protocol, "https:");
    assert.ok(source.label);
  }
  const text = legalMessages("en");
  assert.match(text.publisherText, /No agency licence/);
  assert.match(text.feePolicyText, /No commercial fee schedule/);
  assert.match(text.cookiesText, /expiry does not delete server files/);
  assert.match(text.ownershipText, /Article 44/);
  assert.match(text.notice, /not legal advice/);
});
