/**
 * Post-process contract markdown: merge fragments, split clauses, escape list dots.
 * Used by docx-to-contract-md and reprocess-contract-mdx.
 */

const SECTION_RE = /^\d+\.\s+/;
const ALPHA_RE = /^\([a-z]\)\s+/i;
const ROMAN_RE = /^\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\)\s+/i;
const NUM_PAREN_RE = /^\d+\)\s+/;

function isContinuation(line) {
  const t = line.trim();
  if (!t) return false;
  // Exclude headers, list markers, clause starters, numbered clauses (1. 2. 1\. etc.)
  const tNorm = t.replace(/^\\/, '');
  if (
    tNorm.startsWith('#') ||
    /^\d+\.?\s/.test(tNorm) ||
    SECTION_RE.test(tNorm) ||
    ALPHA_RE.test(tNorm) ||
    ROMAN_RE.test(tNorm) ||
    NUM_PAREN_RE.test(tNorm)
  ) {
    return false;
  }
  const first = t[0];
  return first === first.toLowerCase() && first !== '(';
}

function prevEndsSentence(s) {
  const t = s.trim();
  return /[.;:!?]$/.test(t);
}

function splitCombinedClauses(md) {
  const lines = md.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    const clauseSplitRe =
      /(?<=[.;:])\s+(?=(?:\d+\.\s*)?\\?\((?:[a-z]|i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\)\s)/gi;
    const parts = trimmed.split(clauseSplitRe).map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) {
      out.push(line);
      continue;
    }
    const first = parts[0];
    const rest = parts.slice(1);
    out.push(first);
    for (const p of rest) {
      out.push('');
      out.push(p);
    }
  }
  return out.join('\n');
}

function mergeBlockquoteFragments(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('>')) {
      const content = trimmed.slice(1).trim();
      if (!content) {
        i++;
        continue;
      }
      const unblocked = content.replace(/^>\s*/gm, '').trim();

      if (out.length > 0 && isContinuation(unblocked)) {
        out[out.length - 1] = out[out.length - 1] + ' ' + unblocked;
      } else if (ALPHA_RE.test(unblocked) || ROMAN_RE.test(unblocked) || NUM_PAREN_RE.test(unblocked)) {
        if (out.length > 0) out.push('');
        out.push(unblocked);
      } else if (out.length > 0 && !prevEndsSentence(out[out.length - 1])) {
        out[out.length - 1] = out[out.length - 1] + ' ' + unblocked;
      } else {
        out.push(unblocked);
      }
      i++;
      continue;
    }

    if (trimmed && out.length > 0 && isContinuation(trimmed) && !prevEndsSentence(out[out.length - 1])) {
      out[out.length - 1] = out[out.length - 1] + ' ' + trimmed;
    } else {
      out.push(line);
    }
    i++;
  }

  return out.join('\n');
}

function mergeContinuationLines(md) {
  const lines = md.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('>')) {
      const content = trimmed.slice(1).trim().replace(/^>\s*/gm, '');
      if (out.length > 0 && isContinuation(content) && !prevEndsSentence(out[out.length - 1])) {
        out[out.length - 1] = out[out.length - 1] + ' ' + content;
      } else {
        out.push(line);
      }
      continue;
    }

    if (trimmed && out.length > 0 && isContinuation(trimmed) && !prevEndsSentence(out[out.length - 1])) {
      out[out.length - 1] = out[out.length - 1] + ' ' + trimmed;
    } else {
      out.push(line);
    }
  }

  return out.join('\n');
}

function escapeNumberedListDots(md) {
  return md.replace(/^(\s*)(\d+)\.(\s+)/gm, '$1$2\\.$3');
}

/** Split merged content: "## X ### Y" or "### X 1\. Y" (heading + numbered clause on same line) */
function splitMergedHeadings(md) {
  // Split "## X ### Y" into separate headings
  let result = md.replace(/^(#{1,6}\s+.+?)\s+(#{1,6}\s+.+)$/gm, '$1\n\n$2');
  // Split "### X 1. Y" or "### X 1\. Y" - heading merged with numbered clause
  result = result.replace(/^(\s*)(#{1,6}\s+[^#\n]+?)\s+(\d+[\\]?\\.\s+.+)$/gm, '$1$2\n\n$1$3');
  return result;
}

export function postProcessMarkdown(md) {
  let result = md;
  result = mergeBlockquoteFragments(result);
  result = mergeContinuationLines(result);
  result = splitMergedHeadings(result); // fix any headers merged by continuation
  result = splitCombinedClauses(result);
  result = escapeNumberedListDots(result);
  return result;
}
