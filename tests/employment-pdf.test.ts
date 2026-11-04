import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { employmentDocumentHtml } from "../lib/team/employment-document";
import { generateDocumentPdf } from "../services/demo/pdf";
import { initialTeam, onboard } from "./helpers/team";

test("employment draft snapshots both languages, indefinite duration and user-entered terms without executable HTML", async () => {
  const state = await initialTeam();
  const { candidate } = await onboard(state);
  const contract = candidate.contract!;
  contract.employee.name = '<script>alert("injection")</script>';
  const html = employmentDocumentHtml(contract, "");
  for (const text of ["Indefinite-term", "600.00", "EMPLOYMENT-DRAFT-1", "UNSIGNED", "NOT LEGALLY VALIDATED", "កិច្ចសន្យាការងារ", "No statutory right is waived", contract.input.dutiesKhmer]) assert.ok(html.includes(text), text);
  assert.ok(!html.includes("<script>") && html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("data:image"));
});
test("production employment agreement has bilingual signature fields without the draft banner or certification claims", async () => {
  const state = await initialTeam(), { candidate } = await onboard(state);
  const html = employmentDocumentHtml(candidate.contract!, "", true);
  assert.doesNotMatch(html, /\bDRAFT\b|UNSIGNED|NOT LEGALLY VALIDATED|DO NOT SIGN|administrative drafting aid|សេចក្តីព្រាង/);
  assert.ok(html.includes("Signatures"));
  assert.ok(html.includes("ហត្ថលេខា"));
  assert.equal((html.match(/____________________________/g) ?? []).length, 2);
  assert.ok(html.includes(candidate.name));
  assert.ok(html.includes(candidate.contract!.input.dutiesKhmer));
  assert.ok(html.includes("No statutory right is waived."));
});

const available = Boolean(process.env.PDF_CHROMIUM_PATH) || existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") || existsSync("/usr/bin/chromium");
test("actual employment PDF contains English terms, substantial Khmer glyphs and no missing glyph outlines", {
  skip: !available, timeout: 60000,
}, async () => {
  const state = await initialTeam(), { candidate } = await onboard(state);
  const pdf = await generateDocumentPdf((font) => employmentDocumentHtml(candidate.contract!, font));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true });
  const document = await task.promise;
  try {
    assert.ok(document.numPages >= 2);
    let text = "", khmer = 0;
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      text += (await page.getTextContent()).items.flatMap((item) => "str" in item ? [item.str] : []).join(" ");
      const operators = await page.getOperatorList();
      for (let index = 0; index < operators.fnArray.length; index++) {
        if (operators.fnArray[index] !== OPS.showText) continue;
        const glyphs: unknown[] = operators.argsArray[index][0];
        for (const glyph of glyphs) {
          if (!glyph || typeof glyph !== "object" || !("unicode" in glyph) || typeof glyph.unicode !== "string") continue;
          if (/[\u1780-\u17ff]/.test(glyph.unicode)) khmer++;
          if ("isInFont" in glyph && glyph.unicode.trim()) assert.equal(glyph.isInFont, true);
        }
      }
    }
    assert.ok(khmer > 400, `Khmer glyphs: ${khmer}`);
    for (const word of ["600.00", "DRAFT", "Indefinite-term", "UNSIGNED", candidate.name]) assert.ok(text.includes(word), word);
  } finally { await task.destroy(); }
});
