import "server-only";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { ApiError } from "@/lib/api/errors";
import type { BusinessContract } from "@/lib/demo/business-types";
import { contractDocumentHtml } from "@/lib/demo/contract-document";

let active = 0;
export async function generateContractPdf(contract: BusinessContract) {
  return generateDocumentPdf((font) => contractDocumentHtml(contract, font));
}
export async function generateDocumentPdf(render: (khmerFontBase64: string) => string) {
  const executablePath = process.env.PDF_CHROMIUM_PATH ?? [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].find((path) => existsSync(path));
  if (!executablePath || !existsSync(executablePath)) throw new ApiError(503, "PDF_BROWSER_MISSING", "Install Chromium and configure PDF_CHROMIUM_PATH.");
  if (active >= 2) throw new ApiError(503, "PDF_BUSY", "PDF generation is busy. Please retry.");
  active++;
  try {
    const font = await readFile(join(process.cwd(), "public/fonts/NotoSansKhmer.ttf"));
    const browser = await chromium.launch({ executablePath, headless: true, timeout: 20000 });
    try {
      const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
      await context.route("**/*", (route) => route.abort());
      const page = await context.newPage();
      await page.setContent(render(font.toString("base64")), { waitUntil: "load", timeout: 15000 });
      return await page.pdf({ format: "A4", printBackground: true,
        displayHeaderFooter: true, headerTemplate: "<span></span>",
        footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#666">KANTARA DEMO · DRAFT / BROUILLON — <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      });
    } finally { await browser.close(); }
  } finally { active--; }
}
