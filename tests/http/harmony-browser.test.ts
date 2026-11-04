import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright-core";
import { informationTopics, legalMessages } from "../../lib/i18n/legal";
import { locales } from "../../lib/i18n/routing";

const executablePath = process.env.PDF_CHROMIUM_PATH ?? [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
].find(existsSync);
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("browser: legal footer journeys preserve locale/topic, real content, keyboard navigation and mobile layout", {
  skip: !executablePath, timeout: 90000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const locale of locales) {
      const messages = legalMessages(locale);
      await page.goto(`${baseUrl}/${locale}`);
      await page.locator("footer").getByRole("link", { name: messages.legal, exact: true }).click();
      await page.getByRole("heading", { name: messages.legal, exact: true }).waitFor();
      for (const topic of informationTopics) {
        await page.locator(".information-nav:visible").getByRole("link", { name: messages[topic], exact: true }).click();
        await page.getByRole("heading", { name: messages[topic], exact: true }).waitFor();
        assert.ok(Buffer.byteLength(await page.locator(".information-article:visible").innerText(), "utf8") >= 300);
        assert.equal(await page.locator(".information-nav:visible a[aria-current=page]").innerText(), messages[topic]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${locale}/${topic}`);
      }
      await page.locator(".language-menu:visible summary").click();
      await page.locator(".language-menu:visible .language-options a[lang=en]").click();
      await page.getByRole("heading", { name: legalMessages("en").cambodia, exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, "/en/information/cambodia");
    }
    await page.goto(`${baseUrl}/fr/demo/admin`);
    const legalLink = page.locator("footer").getByRole("link", { name: "Mentions légales", exact: true });
    await legalLink.focus();
    await legalLink.press("Enter");
    await page.getByRole("heading", { name: "Mentions légales", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "Mentions légales", exact: true }).waitFor();
    await page.locator(".information-page:visible > .text-link").click();
    await page.locator(".property-card").first().waitFor();
    assert.equal(new URL(page.url()).pathname, "/fr");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("browser: desktop scroll parallax is measurable and mobile/reduced-motion keep a static readable hero", {
  skip: !executablePath, timeout: 45000,
}, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, reducedMotion: "no-preference" });
    await page.goto(`${baseUrl}/fr`);
    const art = page.locator(".hero-art > img");
    await art.waitFor();
    assert.equal(await art.evaluate((node) => (node as HTMLImageElement).complete), true);
    assert.equal(await page.locator("h1").isVisible(), true);
    const supported = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
    if (supported) {
      assert.equal(await art.evaluate((node) => getComputedStyle(node).animationName), "hero-parallax");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const before = await art.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42);
      await page.evaluate(() => window.scrollTo({ top: 460, behavior: "instant" }));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const after = await art.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42);
      assert.ok(after - before > 5 && after - before < 100, `Measured parallax: ${after - before}px`);
    } else assert.equal(await art.evaluate((node) => getComputedStyle(node).animationName), "none");
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await art.evaluate((node) => getComputedStyle(node).animationName), "none");
    assert.equal(await art.evaluate((node) => getComputedStyle(node).transform), "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 812 });
      assert.equal(await art.evaluate((node) => getComputedStyle(node).animationName), "none");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `width ${width}`);
    }
    await page.locator(".detail-button").first().click();
    await page.locator("dialog[open]").waitFor();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("dialog[open]")!).opacity) >= .95);
    await page.locator("dialog[open]").press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
  } finally { await browser.close(); }
});
