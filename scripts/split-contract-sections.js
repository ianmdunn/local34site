#!/usr/bin/env node

/**
 * Split the 2021-2026 contract into reader-friendly section fragments.
 *
 * Run AFTER `astro build` (with CONTRACT_READER_BUILD=true). Reads the built
 * contract-extract page (full content), extracts intro + each article to
 * public/contract-sections/ and dist/contract-sections/. The contract
 * reader loads from /contract-sections/.
 *
 * Usage:
 *   node scripts/split-contract-sections.js
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');
const publicDir = join(projectRoot, 'public');
const extractPath = join(distDir, 'contract-extract', 'index.html');
const sectionsDirDist = join(distDir, 'contract-sections');
const sectionsDirPublic = join(publicDir, 'contract-sections');

// Match: <details ... class="...contract-accordion..." id="...">
const ACCORDION_START_RE =
  /<details(?:\s[^>]*?class="[^"]*contract-accordion[^"]*"[^>]*id="([^"]+)"|\s[^>]*?id="([^"]+)"[^>]*class="[^"]*contract-accordion[^"]*")[^>]*>/g;

function extractBodyHtml(html) {
  const marker = 'data-contract-extract-body';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const openEnd = html.indexOf('>', idx) + 1;
  if (openEnd === 0) return null;
  const start = openEnd;
  let depth = 1;
  let pos = openEnd;
  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div>', pos);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) return html.slice(start, nextClose);
      pos = nextClose + 6;
    }
  }
  return null;
}

function extractIntroAndSections(bodyHtml) {
  const firstAccordion = ACCORDION_START_RE.exec(bodyHtml);
  ACCORDION_START_RE.lastIndex = 0;

  let introHtml = '';
  if (firstAccordion) {
    introHtml = bodyHtml.slice(0, firstAccordion.index).trim();
  }

  const sections = [];
  let match;
  ACCORDION_START_RE.lastIndex = 0;

  while ((match = ACCORDION_START_RE.exec(bodyHtml)) !== null) {
    const sectionId = match[1] || match[2];
    const detailsOpenEnd = match.index + match[0].length;
    const summaryOpen = bodyHtml.indexOf('<summary', detailsOpenEnd);

    const summaryClose = bodyHtml.indexOf('</summary>', detailsOpenEnd);
    if (summaryClose === -1) continue;
    const summaryHtml = summaryOpen === -1 ? '' : bodyHtml.slice(summaryOpen, summaryClose + '</summary>'.length);
    const titleMatch = summaryHtml.match(/data-title="([^"]+)"/);
    const sectionTitle = titleMatch?.[1] || '';

    const bodyStart = summaryClose + '</summary>'.length;
    const detailsClose = bodyHtml.indexOf('</details>', bodyStart);
    if (detailsClose === -1) continue;

    const sectionHtml = bodyHtml.slice(bodyStart, detailsClose).trim();
    sections.push({ id: sectionId, title: sectionTitle, html: sectionHtml });
  }

  return { introHtml, sections };
}

async function main() {
  let html;
  try {
    html = await readFile(extractPath, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') {
      console.warn('[split-contract-sections] contract-extract not found, skipping.');
      return;
    }
    throw err;
  }

  const bodyHtml = extractBodyHtml(html);
  if (!bodyHtml) {
    console.warn('[split-contract-sections] Could not find contract body, skipping.');
    return;
  }

  const { introHtml, sections } = extractIntroAndSections(bodyHtml);

  for (const dir of [sectionsDirDist, sectionsDirPublic]) {
    await mkdir(dir, { recursive: true });
  }

  async function writeSection(id, html) {
    await Promise.all([
      writeFile(join(sectionsDirDist, `${id}.html`), html, 'utf8'),
      writeFile(join(sectionsDirPublic, `${id}.html`), html, 'utf8'),
    ]);
  }

  if (introHtml) {
    await writeSection('intro', introHtml);
  }

  const escapeHtml = (s) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  for (const { id, title, html: sectionHtml } of sections) {
    const titleHtml = title ? `<h2>${escapeHtml(title)}</h2>\n` : '';
    await writeSection(id, `${titleHtml}${sectionHtml}`);
  }

  console.log(`[split-contract-sections] Extracted intro + ${sections.length} sections`);
}

main().catch((err) => {
  console.error('[split-contract-sections]', err);
  process.exit(1);
});
