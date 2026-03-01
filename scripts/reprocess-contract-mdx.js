#!/usr/bin/env node

/**
 * Reprocess the 2021-2026 contract MDX: apply post-processing (merge fragments,
 * split clauses, escape list dots) + format cleanup to intro and each accordion body.
 *
 * Usage:
 *   node scripts/reprocess-contract-mdx.js [input.mdx] [output.mdx]
 *   npm run contract:reprocess-mdx
 *   npm run contract:reprocess-mdx -- --dry-run          # report changes, don't write
 *   npm run contract:reprocess-mdx -- --fix-malformed     # also fix 1\. → (b) etc.
 *
 * Defaults: src/content/sitePages/2021-2026-contract.mdx (in place)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { postProcessMarkdown } from './lib/contract-postprocess.js';
import { cleanupContractFormat } from './lib/contract-format-cleanup.js';
import { reindentContractBody } from './lib/contract-reindent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const defaultPath = join(projectRoot, 'src/content/sitePages/2021-2026-contract.mdx');

/** Strip consistent leading indent from body (4 spaces per line). */
function unindentBody(raw) {
  const lines = raw.split('\n');
  const minIndent = lines
    .filter((l) => l.trim())
    .reduce((min, l) => Math.min(min, l.match(/^\s*/)[0].length), Infinity);
  if (minIndent === Infinity) return raw;
  return lines.map((l) => (l.length >= minIndent ? l.slice(minIndent) : l)).join('\n');
}

/** Add 4-space indent to body lines. */
function indentBody(md) {
  return md
    .split('\n')
    .map((line) => (line === '' ? '' : '    ' + line))
    .join('\n');
}

/**
 * Process MDX: post-process intro and each accordion body.
 * Preserves frontmatter and details structure exactly.
 */
function reprocessContractMdx(content) {
  // Find frontmatter (*** or --- delimited)
  const fmMatch = content.match(/^([\*\-]{3,}[\s\S]*?[\*\-]{3,})\s*\n\n/s);
  const fmEnd = fmMatch ? fmMatch[0].length : 0;
  const frontmatter = content.slice(0, fmEnd).trimEnd();
  const body = content.slice(fmEnd).replace(/^\n+/, '');

  const firstDetails = body.indexOf('<details ');
  if (firstDetails === -1) {
    return frontmatter + '\n\n' + postProcessMarkdown(body);
  }

  const intro = body.slice(0, firstDetails).trim();
  const detailsSection = body.slice(firstDetails);

  const re =
    /<details\s+([^>]+)>([\s\S]*?)<div\s+class="contract-accordion-body">\s*\n([\s\S]*?)\n\s*<\/div>\s*<\/details>/gi;

  const dryRun = process.argv.includes('--dry-run');
  const applyMalformed = process.argv.includes('--fix-malformed');
  const processedDetails = detailsSection.replace(re, (full, attrs, between, rawBody) => {
    const unindented = unindentBody(rawBody.trim());
    const processed = postProcessMarkdown(unindented);
    const { result: cleaned, changes } = cleanupContractFormat(processed, {
      dryRun,
      applyMalformedFix: applyMalformed,
    });
    if (changes.length > 0 && dryRun) {
      console.log('[format-cleanup]', changes.map((c) => c.desc).join('; '));
    }
    const indented = reindentContractBody(cleaned);
    return `<details ${attrs}>${between}<div class="contract-accordion-body">\n${indented}\n  </div>\n</details>`;
  });

  let processedIntro = intro ? postProcessMarkdown(intro) : '';
  if (processedIntro) {
    const { result } = cleanupContractFormat(processedIntro, { dryRun, applyMalformedFix: applyMalformed });
    processedIntro = result;
  }
  return frontmatter + '\n\n' + (processedIntro ? processedIntro + '\n\n' : '') + processedDetails;
}

async function main() {
  const allArgs = process.argv.slice(2);
  const dryRun = allArgs.includes('--dry-run');
  const args = allArgs.filter((a) => !a.startsWith('--'));
  const inputPath = args[0] || defaultPath;
  const outputPath = args[1] || inputPath;

  const content = await readFile(inputPath, 'utf8');
  const result = reprocessContractMdx(content);

  const sectionCount = (result.match(/<details\s+[^>]+>/g) || []).length;
  if (!dryRun) {
    await writeFile(outputPath, result, 'utf8');
    console.log(`[reprocess-contract-mdx] Processed ${sectionCount} sections → ${outputPath}`);
  } else {
    console.log(`[reprocess-contract-mdx] Dry run: would process ${sectionCount} sections → ${outputPath} (no changes written)`);
  }
}

main().catch((err) => {
  console.error('[reprocess-contract-mdx]', err);
  process.exit(1);
});
