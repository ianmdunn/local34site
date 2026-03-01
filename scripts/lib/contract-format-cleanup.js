/**
 * Contract MDX format cleanup with smart checks.
 * Uses grep-like patterns to find issues, validates before applying fixes.
 *
 * Safe fixes (always applied when pattern matches):
 * - Normalize over-indented section numbers (8+ spaces before N\. → 4 spaces)
 * - Merge orphaned continuation lines (e.g. "Members" after "Staff" on previous line)
 *
 * Context-aware fixes (only when smart check passes):
 * - Malformed "1\.  X" after "(a)" in same clause block → "(b) X"
 *
 * Usage: imported by reprocess-contract-mdx, or run standalone with --dry-run.
 */

/** Section number: 1\. 2\. etc. (escaped for markdown) */
const SECTION_NUM_RE = /^(\s*)(\d+)\\.(\s+)/;
/** Over-indented: 8+ spaces before section number (content has \. from escapeNumberedListDots) */
const OVER_INDENTED_SECTION_RE = /^(\s{8,})(\d+)\\\\.(\s+)/;
/** Top-level section: 0 indent (indentBody adds 4 later) */
const TARGET_INDENT = '';
/** Alpha sub-item: (a) (b) etc. */
const ALPHA_ITEM_RE = /^\(([a-z])\)\s+/i;
/** Malformed "1\.  " that likely should be (b) when following (a) */
const MALFORMED_ONE_DOT_RE = /^(\s*)1\\.\s{2,}/;

/**
 * Smart check: is this line an orphaned word that continues the previous line?
 * e.g. "Members" when prev line ends with "Staff"
 * Conservative: only merge when pattern is very clear.
 */
function isOrphanedContinuation(line, prevLine) {
  const t = line.trim();
  const prev = (prevLine || '').trim();
  if (!t || !prev || t.length > 50) return false;
  if (/\n/.test(t)) return false; // multi-line
  // Explicit safe patterns
  if (prev.endsWith('Staff') && /^Members?\b/i.test(t)) return true;
  if (prev.endsWith('position at') && /^Yale\b/i.test(t)) return true;
  if (prev.endsWith('the ') && /^Department\s+of\s+Human\s+Resources/i.test(t)) return true;
  if (prev.endsWith('by the ') && /^University\b/i.test(t)) return true;
  return false;
}

/**
 * Smart check: does "1\.  X" follow "(a) ..." and should become "(b) X"?
 * Only when we're clearly inside a clause block (recent alpha items above).
 */
function shouldConvertMalformedOneToBravo(lines, i) {
  if (i < 1) return false;
  const line = lines[i];
  if (!MALFORMED_ONE_DOT_RE.test(line)) return false;
  // Scan back for (a) within last ~10 lines
  for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
    const l = lines[j].trim();
    if (!l) continue;
    if (ALPHA_ITEM_RE.test(l)) return true;
    if (SECTION_NUM_RE.test(l) && !l.startsWith('1\\.')) return false; // new section
  }
  return false;
}

/**
 * Normalize over-indented section numbers to 4 spaces.
 * Safe: only reduces leading space, never adds content.
 */
function normalizeOverIndentedSections(md) {
  return md.replace(OVER_INDENTED_SECTION_RE, (_, spaces, num, rest) => {
    return TARGET_INDENT + num + '\\.' + rest;
  });
}

/**
 * Merge orphaned continuation lines with previous line.
 */
function mergeOrphanedContinuations(md) {
  const lines = md.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = out[out.length - 1];
    if (prev !== undefined && isOrphanedContinuation(line, prev)) {
      out[out.length - 1] = prev.trimEnd() + ' ' + line.trim();
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

/**
 * Convert malformed "1\.  X" to "(b) X" when smart check passes.
 * Tracks the last (a), (b), etc. to infer next letter.
 */
function fixMalformedOneDots(md) {
  const lines = md.split('\n');
  const out = [];
  let lastAlpha = 'a';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const m = line.match(ALPHA_ITEM_RE);
    if (m) lastAlpha = m[1].toLowerCase();
    if (shouldConvertMalformedOneToBravo(lines, i)) {
      const next = String.fromCharCode(lastAlpha.charCodeAt(0) + 1);
      if (next <= 'z') {
        line = line.replace(MALFORMED_ONE_DOT_RE, (_, indent) => indent + '(' + next + ') ');
        lastAlpha = next;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Run all cleanup passes. Returns { result, changes[] }.
 */
export function cleanupContractFormat(md, options = {}) {
  const { dryRun = false, applyMalformedFix = false } = options;
  const changes = [];
  let result = md;

  // 1. Over-indented sections (always safe)
  const before1 = result;
  result = normalizeOverIndentedSections(result);
  if (result !== before1) {
    const count = (before1.match(OVER_INDENTED_SECTION_RE) || []).length;
    changes.push({ type: 'indent', count, desc: 'normalized over-indented section numbers' });
  }

  // 2. Orphaned continuations (smart merge)
  const before2 = result;
  result = mergeOrphanedContinuations(result);
  if (result !== before2) {
    const lineDiff = before2.split('\n').length - result.split('\n').length;
    changes.push({ type: 'merge', count: lineDiff, desc: 'merged orphaned continuation lines' });
  }

  // 3. Malformed 1\. → (b) - opt-in, context-aware
  if (applyMalformedFix) {
    const before3 = result;
    result = fixMalformedOneDots(result);
    if (result !== before3) {
      changes.push({ type: 'malformed', desc: 'converted malformed 1\\. to alpha markers' });
    }
  }

  return { result, changes };
}
