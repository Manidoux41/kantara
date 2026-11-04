import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { createBusinessState, executeBusinessCommand } from "../services/demo/business";
import { contractDocumentHtml, escapeDocumentText } from "../lib/demo/contract-document";
import { generateContractPdf } from "../services/demo/pdf";
import { sampleContract } from "./helpers/business";

function fixture(kind: "SALE_MANDATE" | "RENTAL_MANDATE" | "LEASE", language: "fr-km" | "en-km") {
  const state = createBusinessState();
  state.clients.push({ ...state.clients[0], id: "TENANT-DEMO", role: "TENANT", name: "Tenant DEMO" });
  return executeBusinessCommand(state, { action: "createContract", revision: 0, input: {
    ...sampleContract(kind), language,
  } }, new Date("2026-11-04T00:00:00Z")).contracts[0];
}

test("all document kinds include bilingual identity, financial terms, appropriate legal references and draft boundaries", () => {
  for (const kind of ["SALE_MANDATE", "RENTAL_MANDATE", "LEASE"] as const) {
    for (const language of ["fr-km", "en-km"] as const) {
      const contract = fixture(kind, language);
      const html = contractDocumentHtml(contract);
      assert.match(html, /lang="km"/);
      assert.ok(html.includes(contract.ownerSnapshot.identityReference));
      assert.ok(html.includes(contract.propertySnapshots[0].titleReference));
      assert.ok(html.includes("1000.25 USD"));
      assert.ok(html.includes("Article 44") || html.includes("art. 44"));
      assert.ok(html.includes(kind === "SALE_MANDATE" ? "528–530" : "596–602"));
      assert.ok(html.includes(language === "fr-km" ? "NE PAS SIGNER" : "DO NOT SIGN"));
      assert.ok(html.includes("https://www.jica.go.jp/"));
      assert.ok(html.includes("637–644") === (kind !== "LEASE"));
    }
  }
});

test("document rendering escapes client text instead of executing markup or fetching remote resources", () => {
  const contract = fixture("SALE_MANDATE", "fr-km");
  contract.ownerSnapshot.name = '<img src="https://invalid.example/" onerror="alert(1)">';
  contract.terms = "<script>throw new Error('injected')</script>";
  const html = contractDocumentHtml(contract);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img "));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(escapeDocumentText('<>&"\''), "&lt;&gt;&amp;&quot;&#39;");
});
test("production mandates and leases omit draft banners and provide actual signature fields without changing stored terms", () => {
  for (const kind of ["SALE_MANDATE", "RENTAL_MANDATE", "LEASE"] as const) {
    for (const language of ["fr-km", "en-km"] as const) {
      const contract = fixture(kind, language);
      const html = contractDocumentHtml(contract, undefined, true);
      assert.doesNotMatch(html, /\bDRAFT\b|BROUILLON|DO NOT SIGN|NE PAS SIGNER|Demonstration data only|Données de démonstration/);
      assert.ok(html.includes('class="signature"'));
      assert.equal((html.match(/____________________________/g) ?? []).length, kind === "LEASE" ? 3 : 2);
      assert.ok(html.includes(contract.terms));
      assert.ok(html.includes(contract.ownerSnapshot.name));
      assert.ok(html.includes("ហត្ថលេខា"));
    }
  }
});

const browserAvailable = Boolean(process.env.PDF_CHROMIUM_PATH) || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium",
  "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
].some(existsSync);
test("six real Chromium PDFs contain typed terms, amounts and rendered Khmer glyphs without missing font glyphs", {
  skip: !browserAvailable && "Requires an installed Chromium browser and Khmer fonts; configure PDF_CHROMIUM_PATH.",
  timeout: 180000,
}, async () => {
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  for (const kind of ["SALE_MANDATE", "RENTAL_MANDATE", "LEASE"] as const) {
    for (const language of ["fr-km", "en-km"] as const) {
      const pdf = await generateContractPdf(fixture(kind, language));
      assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true });
      const document = await task.promise;
      try {
        assert.ok(document.numPages >= 3);
        const pages: string[] = [];
        let khmerGlyphs = 0;
        for (let i = 1; i <= document.numPages; i++) {
          const page = await document.getPage(i);
          const text = await page.getTextContent();
          pages.push(text.items.flatMap((item) => "str" in item ? [item.str] : []).join(" "));
          const operators = await page.getOperatorList();
          for (let index = 0; index < operators.fnArray.length; index++) {
            if (operators.fnArray[index] !== OPS.showText) continue;
            const glyphs: unknown[] = operators.argsArray[index][0];
            for (const glyph of glyphs) {
              if (!glyph || typeof glyph !== "object" || !("unicode" in glyph)) continue;
              if (typeof glyph.unicode === "string" && /[\u1780-\u17ff]/.test(glyph.unicode)) khmerGlyphs++;
              if ("isInFont" in glyph && typeof glyph.unicode === "string" && glyph.unicode.trim()) {
                assert.equal(glyph.isInFont, true, `PDF contains a missing font glyph: ${JSON.stringify(glyph)}`);
              }
            }
          }
        }
        const text = pages.join(" ");
        assert.match(text, /1000\.25/);
        assert.ok(khmerGlyphs > 200, "PDF must contain rendered Khmer text, not just a Khmer label");
        assert.ok(!text.includes("\uFFFD"));
        assert.ok(text.includes("KANTARA"));
        assert.ok(text.includes(language === "fr-km" ? "NE PAS SIGNER" : "DO NOT SIGN"));
      } finally { await task.destroy(); }
    }
  }
});
