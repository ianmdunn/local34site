#!/usr/bin/env node

/**
 * Full pipeline: DOCX → MD → contract MDX (with details/accordion structure).
 *
 * Usage:
 *   node scripts/docx-to-contract-mdx.js <input.docx> [output.mdx]
 *
 * Default output: src/content/sitePages/2021-2026-contract.mdx
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const defaultOutput = join(projectRoot, 'src/content/sitePages/2021-2026-contract.mdx');

/** Roman numeral to lowercase (for slug) */
const ROMAN_TO_LOWER = { I: 'i', II: 'ii', III: 'iii', IV: 'iv', V: 'v', VI: 'vi', VII: 'vii', VIII: 'viii', IX: 'ix', X: 'x', XI: 'xi', XII: 'xii', XIII: 'xiii', XIV: 'xiv', XV: 'xv', XVI: 'xvi', XVII: 'xvii', XVIII: 'xviii', XIX: 'xix', XX: 'xx', XXI: 'xxi', XXII: 'xxii', XXIII: 'xxiii', XXIV: 'xxiv', XXV: 'xxv', XXVI: 'xxvi', XXVII: 'xxvii', XXVIII: 'xxviii', XXIX: 'xxix', XXX: 'xxx', XXXI: 'xxxi', XXXII: 'xxxii', XXXIII: 'xxxiii', XXXIV: 'xxxiv', XXXV: 'xxxv', XXXVI: 'xxxvi', XXXVII: 'xxxvii', XXXVIII: 'xxxviii', XXXIX: 'xxxix', XL: 'xl', XLI: 'xli', XLII: 'xlii', XLIII: 'xliii', XLIV: 'xliv', XLV: 'xlv', XLVI: 'xlvi' };

/** Slug from title: "Article I — Recognition" → "article-i-recognition" */
function toSlug(title) {
  return title
    .replace(/\s*[—–-]\s*/g, '-')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/** Convert DOCX to MD via docx-to-contract-md */
async function convertDocxToMd(docxPath) {
  const scriptPath = join(__dirname, 'docx-to-contract-md.js');
  const buf = execSync(`node "${scriptPath}" "${docxPath}"`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return buf;
}

/** Split MD into intro + articles. Returns { intro, articles } */
function parseContractMd(md) {
  const ARTICLE_RE = /^(ARTICLE\s+([IVXLCDM]+))(?:\s*\[[^\]]*\])?\s*\*\*([^*]+)\*\*(.*)$|^(ARTICLE\s+([IVXLCDM]+))\s*\*\*([^*]+)\*\*$/m;
  const lines = md.split('\n');

  let introEnd = 0;
  const articles = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^ARTICLE\s+([IVXLCDM]+).*?\*\*([^*]+)\*\*/);
    if (m) {
      if (articles.length === 0) introEnd = i;
      const roman = m[1];
      const titlePart = m[2].trim();
      const fullTitle = `Article ${roman} — ${titlePart}`;
      const slug = `article-${(ROMAN_TO_LOWER[roman] || roman.toLowerCase())}-${toSlug(titlePart)}`;
      const bodyStart = i;
      let bodyEnd = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^ARTICLE\s+[IVXLCDM]+/)) {
          bodyEnd = j;
          break;
        }
      }
      const bodyLines = lines.slice(bodyStart, bodyEnd);
      const firstLine = bodyLines[0] || '';
      const stripped = firstLine.replace(/^ARTICLE\s+[IVXLCDM]+.*?\*\*[^*]+\*\*\s*/, '').trim();
      const restContent = bodyLines.slice(1).join('\n').trim();
      const body = `## ARTICLE ${roman}\n\n### ${titlePart}\n\n${stripped}${restContent ? '\n\n' + restContent : ''}`.trim();

      articles.push({
        id: slug,
        title: fullTitle,
        body: body.trim(),
      });
    }
  }

  const intro = lines.slice(0, introEnd).join('\n').trim();
  return { intro, articles };
}

/** Build MDX from parsed sections */
function buildContractMdx({ intro, articles }, title = '2021 - 2026 Contract', description = 'Full text of the 2021–2026 collective bargaining agreement between Local 34 and Yale University.') {
  const parts = [
    '---',
    `title: '${title}'`,
    `description: '${description}'`,
    '---',
    '',
    intro.replace(/^\*\*Agreement\*\*/, '## Agreement'),
    '',
  ];

  for (const { id, title: sectionTitle, body } of articles) {
    parts.push(`<details id="${id}" class="contract-accordion contract-accordion--article">`);
    parts.push(`  <summary data-title="${sectionTitle}" aria-label="${sectionTitle}" />`);
    parts.push('');
    parts.push('  <div class="contract-accordion-body">');
    const indented = body
      .split('\n')
      .map((line) => (line === '' ? '' : '    ' + line))
      .join('\n');
    parts.push(indented);
    parts.push('  </div>');
    parts.push('</details>');
    parts.push('');
  }

  return parts.join('\n').trimEnd();
}

async function main() {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  const outputPath = args[1] || defaultOutput;

  if (!inputPath) {
    console.error('Usage: node docx-to-contract-mdx.js <input.docx> [output.mdx]');
    process.exit(1);
  }

  console.log('[docx-to-contract-mdx] Converting DOCX to MD...');
  const md = await convertDocxToMd(inputPath);

  console.log('[docx-to-contract-mdx] Parsing sections...');
  const parsed = parseContractMd(md);

  console.log(`[docx-to-contract-mdx] Found ${parsed.articles.length} articles`);

  const mdx = buildContractMdx(parsed);

  await writeFile(outputPath, mdx, 'utf8');
  console.log(`[docx-to-contract-mdx] Wrote ${outputPath}`);
}

main().catch((err) => {
  console.error('[docx-to-contract-mdx]', err);
  process.exit(1);
});
