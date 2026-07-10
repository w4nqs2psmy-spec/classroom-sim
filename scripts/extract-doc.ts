// Build-time PDF text extraction for task source documents.
//
// Usage:   node scripts/extract-doc.ts docs/<file>.pdf ["Document title"]
// Output:  ui/src/source-docs/<file>.json  (committed — the app only ever
//          imports this JSON; pdfjs never ships in the bundle)
//
// Presentation-safety by design: extraction happens ONCE, here, on the
// author's machine, days before any talk. The committed JSON is
// deterministic, reviewable, and is the single runtime source of truth.
//
// Budget: source documents must stay at 1-2 pages so a future Stage-1
// injection (cached-prefix block) stays cheap. Token estimate is
// conservative (chars / 3 — safe for Finnish, which tokenizes denser than
// English). HARD FAIL above MAX_TOKENS, warn above WARN_TOKENS.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const MAX_TOKENS = 2000;
const WARN_TOKENS = 1500;
const MAX_PAGES = 2;
const MIN_CHARS_PER_PAGE = 40; // below this the PDF is likely scanned/image-only

async function main() {
  const [, , pdfPath, titleArg] = process.argv;
  if (!pdfPath) {
    console.error("Usage: node scripts/extract-doc.ts docs/<file>.pdf [\"Document title\"]");
    process.exit(1);
  }

  const abs = resolve(pdfPath);
  const data = new Uint8Array(readFileSync(abs));

  // Legacy build = Node-friendly (no worker/DOM assumptions).
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let doc;
  try {
    doc = await getDocument({ data, useSystemFonts: true }).promise;
  } catch (err) {
    console.error(`FAILED to open PDF (encrypted or corrupt?): ${(err as Error).message}`);
    process.exit(1);
  }

  if (doc.numPages > MAX_PAGES) {
    console.error(`FAILED: ${doc.numPages} pages — source documents must be ${MAX_PAGES} pages or fewer. Trim the PDF.`);
    process.exit(1);
  }

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Join items, inserting line breaks where pdfjs marks EOL.
    let text = "";
    for (const item of content.items as { str: string; hasEOL?: boolean }[]) {
      text += item.str;
      text += item.hasEOL ? "\n" : " ";
    }
    pageTexts.push(text.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim());
  }

  const text = pageTexts.map((t, i) => (doc.numPages > 1 ? `[Page ${i + 1}]\n${t}` : t)).join("\n\n");

  if (text.length < MIN_CHARS_PER_PAGE * doc.numPages) {
    console.error(
      `FAILED: only ${text.length} characters extracted from ${doc.numPages} page(s) — ` +
        `this PDF looks scanned/image-only. No OCR support; provide a text-based PDF.`,
    );
    process.exit(1);
  }

  const tokenEstimate = Math.ceil(text.length / 3);
  if (tokenEstimate > MAX_TOKENS) {
    console.error(
      `FAILED: ~${tokenEstimate} estimated tokens exceeds the ${MAX_TOKENS}-token budget. ` +
        `Source documents must stay at 1-2 short pages — trim the document.`,
    );
    process.exit(1);
  }
  if (tokenEstimate > WARN_TOKENS) {
    console.warn(`WARNING: ~${tokenEstimate} estimated tokens (soft limit ${WARN_TOKENS}). Consider trimming.`);
  }

  const id = basename(pdfPath).replace(/\.pdf$/i, "");
  const outDir = resolve(join(import.meta.dirname, "..", "ui", "src", "source-docs"));
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${id}.json`);

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        id,
        title: titleArg ?? id,
        pages: doc.numPages,
        tokenEstimate,
        sourceFile: basename(pdfPath),
        extractedAt: new Date().toISOString(),
        text,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`OK: ${outPath}`);
  console.log(`    ${doc.numPages} page(s), ${text.length} chars, ~${tokenEstimate} est. tokens`);
}

main();
