/**
 * Strip all indentation, then reapply indent by clause level.
 * Level 0 (4 spaces): ## ### headings, section numbers N\., standalone text
 * Level 1 (8 spaces): (a) (b) (c)
 * Level 2 (12 spaces): (i) (ii) (iii)
 * Level 3 (16 spaces): (1) (2) (3)
 * Continuation lines: same as previous
 */

const HEADING_RE = /^#{1,6}\s/;
const SECTION_NUM_RE = /^\d+\\\.\s/;  // matches 2\. 3\. etc
const ALPHA_RE = /^\([a-z]\)\s/i;
const ROMAN_RE = /^\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\)\s/i;
const NUM_PAREN_RE = /^\(\d+\)\s/;

function getClauseLevel(line) {
  const t = line.trim();
  if (!t) return -1; // blank, keep 0
  if (HEADING_RE.test(t)) return 0;
  if (SECTION_NUM_RE.test(t)) return 0;
  if (NUM_PAREN_RE.test(t)) return 3;
  if (ROMAN_RE.test(t)) return 2;
  if (ALPHA_RE.test(t)) return 1;
  return null; // continuation - use previous
}

function reindentByClauseLevel(md) {
  const lines = md.split('\n');
  const out = [];
  const INDENT = '    '; // 4 spaces per level
  let lastLevel = 0; // 0=top, 1=(a), 2=(i), 3=(1)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmedFull = raw.trim();

    if (!trimmedFull) {
      out.push('');
      continue;
    }

    const level = getClauseLevel(trimmedFull);
    const indentLevel = level === null ? lastLevel : level;
    if (level !== null) lastLevel = level;
    const indent = INDENT.repeat(indentLevel + 1); // base 4 spaces (level 0 -> 4)

    out.push(indent + trimmedFull);
  }

  return out.join('\n');
}

export function reindentContractBody(md) {
  const stripped = md
    .split('\n')
    .map((l) => l.trimStart())
    .join('\n');
  return reindentByClauseLevel(stripped);
}
