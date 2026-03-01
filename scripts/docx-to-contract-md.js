#!/usr/bin/env node

/**
 * Convert a contract DOCX to web-ready Markdown.
 *
 * Pipeline: DOCX → HTML (mammoth) → Markdown (turndown) → post-process
 *
 * Post-processing:
 * - Merge broken sentence fragments (Word line breaks that split mid-sentence)
 * - Convert blockquote sub-clauses to regular paragraphs (Word indent → blockquote)
 * - Split combined clauses into one paragraph per (a)(b)(c) for proper hierarchy
 * - Normalize numbering and spacing
 *
 * Usage:
 *   node scripts/docx-to-contract-md.js [input.docx] [output.md]
 *   npm run contract:docx-to-md -- path/to/contract.docx tmp/contract.md
 *
 * Defaults: reads from first arg or stdin, writes to second arg or stdout.
 */

import { readFile, writeFile } from 'node:fs/promises';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { postProcessMarkdown } from './lib/contract-postprocess.js';

async function main() {
  const args = process.argv.slice(2);
  const inputPath = args[0] || null;
  const outputPath = args[1] || null;

  if (!inputPath) {
    console.error('Usage: node docx-to-contract-md.js <input.docx|input.md> [output.md]');
    console.error('  input.docx  - Convert DOCX to web-ready Markdown');
    console.error('  input.md    - Re-post-process existing Markdown (merge fragments, split clauses)');
    console.error('  output.md   - Write result (default: stdout)');
    process.exit(1);
  }

  let md;
  const isMd = inputPath.toLowerCase().endsWith('.md');

  if (isMd) {
    md = await readFile(inputPath, 'utf8');
  } else {
    const docxBuffer = await readFile(inputPath);
    const { value: html } = await mammoth.convertToHtml({ buffer: docxBuffer });
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    turndown.use(gfm);
    md = turndown.turndown(html);
  }

  md = postProcessMarkdown(md);

  if (outputPath) {
    await writeFile(outputPath, md, 'utf8');
    console.log(`[docx-to-contract-md] Wrote ${outputPath}`);
  } else {
    process.stdout.write(md);
  }
}

main().catch((err) => {
  console.error('[docx-to-contract-md]', err);
  process.exit(1);
});
