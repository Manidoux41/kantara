import assert from "node:assert/strict";
import test from "node:test";
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

test("home metadata, company header logo and real brand icons are served without indexing fictional listings", async () => {
  const response = await fetch(`${baseUrl}/fr`);
  const html = await response.text();
  assert.equal(response.status, 200);
  for (const token of ['property="og:title"', 'property="og:locale" content="fr_FR"', 'name="twitter:card" content="summary_large_image"', 'name="robots" content="noindex, nofollow"', "/images/kantara-logo.svg", "/favicon.ico", "/icon.svg", "/apple-icon.png"]) assert.ok(html.includes(token), token);
  for (const path of ["/icon.svg", "/images/kantara-logo.svg"]) {
    const image = await fetch(`${baseUrl}${path}`);
    assert.equal(image.status, 200);
    assert.match(image.headers.get("content-type")!, /image\/svg/);
    assert.ok((await image.text()).includes("#17334d"));
  }
  const favicon = new Uint8Array(await (await fetch(`${baseUrl}/favicon.ico`)).arrayBuffer());
  assert.deepEqual(Array.from(favicon.slice(0, 6)), [0, 0, 1, 0, 1, 0]);
  const social = await fetch(`${baseUrl}/api/brand/social`);
  assert.equal(social.status, 200);
  assert.match(social.headers.get("content-type")!, /image\/png/);
  assert.ok((await social.arrayBuffer()).byteLength > 10000);
});
