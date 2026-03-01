#!/usr/bin/env node

/**
 * Verify contract section clause-level indentation in built HTML.
 * Checks that (a),(b),(c),(d)... get contract-level-1 and (i),(ii),(iii) get contract-level-2.
 *
 * Usage: node scripts/verify-contract-indents.js [public/contract-sections]
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sectionsDir = process.argv[2] || join(__dirname, '..', 'public', 'contract-sections');

/** (a)-(u),(w),(y),(z) are unambiguously alpha; (v),(x) are also roman numerals so skip */
const ALPHA_MARKERS = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(j)', '(k)', '(l)', '(m)', '(n)', '(o)', '(p)', '(q)', '(r)', '(s)', '(t)', '(u)', '(w)', '(y)', '(z)'];
const ROMAN_MARKERS = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'];

function extractClauseClasses(html) {
  const results = [];
  const pRegex = /<p[^>]*class="[^"]*contract-level-(\d)[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
  const sectionRegex = /<p[^>]*class="[^"]*contract-section[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = pRegex.exec(html)) !== null) {
    const prefix = (m[2] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    results.push({ level: m[1], prefix });
  }
  while ((m = sectionRegex.exec(html)) !== null) {
    const prefix = (m[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    results.push({ level: 'section', prefix });
  }
  return results;
}

async function main() {
  let files;
  try {
    files = await readdir(sectionsDir);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      console.error(`[verify-contract-indents] Directory not found: ${sectionsDir}`);
      console.error('Run CONTRACT_READER_BUILD=true npm run build first.');
      process.exit(1);
    }
    throw err;
  }

  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  let totalSection = 0;
  let totalLevel1 = 0;
  let totalLevel2 = 0;
  const misclassified = [];

  for (const file of htmlFiles) {
    const html = await readFile(join(sectionsDir, file), 'utf8');
    const clauses = extractClauseClasses(html);

    for (const { level, prefix } of clauses) {
      if (level === 'section') totalSection++;
      else if (level === '1') totalLevel1++;
      else if (level === '2') totalLevel2++;

      const norm = prefix.replace(/\s+/g, ' ').trim();
      for (const alpha of ALPHA_MARKERS) {
        if (norm.startsWith(alpha + ' ') || norm.startsWith(alpha + '.')) {
          if (level === '2') {
            misclassified.push({ file, marker: alpha, prefix: norm.slice(0, 60), expected: 'level-1', got: 'level-2' });
          }
          break;
        }
      }
      for (const roman of ROMAN_MARKERS) {
        if (norm.startsWith(roman + ' ') || norm.startsWith(roman + '.')) {
          if (level === '1') {
            misclassified.push({ file, marker: roman, prefix: norm.slice(0, 60), expected: 'level-2', got: 'level-1' });
          }
          break;
        }
      }
    }
  }

  console.log(`[verify-contract-indents] ${htmlFiles.length} sections: ${totalSection} section, ${totalLevel1} level-1, ${totalLevel2} level-2`);
  if (misclassified.length) {
    console.error(`[verify-contract-indents] MISCLASSIFIED (${misclassified.length}):`);
    for (const m of misclassified.slice(0, 10)) {
      console.error(`  ${m.file}: ${m.marker} expected ${m.expected} got ${m.got} — "${m.prefix}..."`);
    }
    if (misclassified.length > 10) {
      console.error(`  ... and ${misclassified.length - 10} more`);
    }
    process.exit(1);
  }
  console.log('[verify-contract-indents] All clause levels OK');
}

main().catch((err) => {
  console.error('[verify-contract-indents]', err);
  process.exit(1);
});
