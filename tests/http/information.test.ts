import assert from "node:assert/strict";
import test from "node:test";
import { agencyResources, informationTopics, legalMessages } from "../../lib/i18n/legal";
import { locales } from "../../lib/i18n/routing";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("all localized information pages and shared footer links resolve without implying certified agency status", async () => {
  for (const locale of locales) {
    const messages = legalMessages(locale);
    for (const topic of informationTopics) {
      const response = await fetch(`${baseUrl}/${locale}/information/${topic}`);
      assert.equal(response.status, 200, `${locale}/${topic}`);
      const html = await response.text();
      assert.ok(html.includes(`<html lang="${locale}"`));
      assert.match(html, /name="robots" content="noindex, nofollow"/);
      assert.ok(html.includes(messages[topic]));
      assert.ok(html.includes(messages.notice));
      assert.equal((html.match(/<footer\b/g) ?? []).length, 1);
      assert.ok(html.includes(`href="/en/information/${topic}"`), "language selector preserves topic");
      for (const link of informationTopics) assert.ok(html.includes(`href="/${locale}/information/${link}"`));
      if (topic === "cambodia") for (const source of agencyResources) assert.ok(html.includes(`href="${source.url}"`), source.label);
    }
    for (const path of [`/${locale}`, `/${locale}/demo/admin`]) {
      const html = await (await fetch(`${baseUrl}${path}`)).text();
      assert.equal((html.match(/<footer\b/g) ?? []).length, 1, path);
      assert.ok(html.includes(`href="/${locale}/information/legal"`), path);
    }
  }
  for (const path of ["/fr/information/not-a-policy", "/it/information/legal", "/fr/information/LEGAL"]) {
    assert.equal((await fetch(`${baseUrl}${path}`)).status, 404, path);
  }
});
