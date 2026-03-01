import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import { visitParents } from 'unist-util-visit-parents';
import type { RehypePlugin, RemarkPlugin } from '@astrojs/markdown-remark';

/** Roman clause markers (i)–(xx); use alternation not [ivxlcdm]+ to avoid matching (c),(d),(l),(m),(v),(x) as alpha */
const ROMAN_CLAUSE_PATTERN = 'i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx';

export const readingTimeRemarkPlugin: RemarkPlugin = () => {
  return function (tree, file) {
    const textOnPage = toString(tree);
    const readingTime = Math.ceil(getReadingTime(textOnPage).minutes);

    if (typeof file?.data?.astro?.frontmatter !== 'undefined') {
      file.data.astro.frontmatter.readingTime = readingTime;
    }
  };
};

export const responsiveTablesRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    if (!tree.children) return;

    for (let i = 0; i < tree.children.length; i++) {
      const child = tree.children[i];

      if (child.type === 'element' && child.tagName === 'table') {
        tree.children[i] = {
          type: 'element',
          tagName: 'div',
          properties: {
            style: 'overflow:auto',
          },
          children: [child],
        };

        i++;
      }
    }
  };
};

export const lazyImagesRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    if (!tree.children) return;

    visit(tree, 'element', function (node) {
      if (node.tagName === 'img') {
        node.properties.loading = 'lazy';
      }
    });
  };
};

/** Fix common contract formatting: double hyphen → em dash, P.M./A.M. spacing */
export const contractFormattingRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    visit(tree, 'text', function (node) {
      if (typeof node.value !== 'string') return;
      let s = node.value;
      // Double hyphen between word boundaries → em dash
      s = s.replace(/(\w)\s*--\s*(\w)/g, '$1—$2');
      // Fix P.M./A.M. spacing: "4:00P.M." → "4:00 P.M."
      s = s.replace(/(\d)([AP]\.M\.)/gi, '$1 $2');
      if (s !== node.value) node.value = s;
    });
  };
};

/** Get first ~30 chars of text from a HAST node (for prefix matching) */
function getTextPrefix(node: unknown, max = 30): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === 'text' && typeof n.value === 'string') return n.value.slice(0, max);
  if (Array.isArray(n.children)) {
    let s = '';
    for (const c of n.children) {
      s += getTextPrefix(c, max - s.length);
      if (s.length >= max) break;
    }
    return s;
  }
  return '';
}

function getTextContent(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === 'text' && typeof n.value === 'string') return n.value;
  if (!Array.isArray(n.children)) return '';
  return n.children.map((c) => getTextContent(c)).join('');
}

/**
 * Insert visual line breaks before inline clause markers in a single paragraph:
 * "(a) ...; (b) ...; (c) ..." -> "(a) ...;<br>(b) ...;<br>(c) ..."
 * while preserving existing non-text child nodes.
 */
export const contractInlineClauseBreaksRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    visit(tree, 'element', function (node) {
      if (node.tagName !== 'p' || !Array.isArray(node.children)) return;

      const prefix = getTextPrefix(node, 40).replace(/\s+/g, ' ').trim();
      const ROMAN_RE = new RegExp(`^\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i');
      const isClauseParagraph =
        /^\([a-z]\)/i.test(prefix) ||
        ROMAN_RE.test(prefix) ||
        /^\d+\.\s*\([a-z]\)/i.test(prefix) ||
        new RegExp(`^\\d+\\.\\s*\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i').test(prefix);
      if (!isClauseParagraph) return;

      const text = getTextContent(node);
      if (!/;\s+\([b-z]\)/i.test(text)) return;

      const splitPattern = /;\s+(\([b-z]\))/gi;
      const nextChildren: Array<any> = [];

      for (const child of node.children) {
        if (child.type !== 'text' || typeof child.value !== 'string') {
          nextChildren.push(child);
          continue;
        }

        const pieces = child.value.split(splitPattern);
        if (pieces.length === 1) {
          nextChildren.push(child);
          continue;
        }

        for (let i = 0; i < pieces.length; i++) {
          const piece = pieces[i];
          if (!piece) continue;
          if (i % 2 === 0) {
            if (piece) nextChildren.push({ type: 'text', value: piece });
          } else {
            // Preserve the semicolon that introduced this inline clause before the line break.
            nextChildren.push({ type: 'text', value: ';' });
            nextChildren.push({ type: 'element', tagName: 'br', properties: {}, children: [] });
            nextChildren.push({ type: 'text', value: `${piece} ` });
          }
        }
      }

      node.children = nextChildren;
    });
  };
};

/**
 * Merge contract continuation paragraphs where a marked clause line is split
 * into a second plain paragraph (e.g., "2. (a) ... to the" + next "Union ...").
 */
export const mergeContractContinuationParagraphsRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    visit(tree, 'element', function (node, index, parent) {
      if (node.tagName !== 'p') return;
      if (typeof index !== 'number' || !parent || !Array.isArray((parent as { children?: unknown[] }).children)) return;

      const siblings = (parent as { children: any[] }).children;
      const next = siblings[index + 1];
      if (!next || next.type !== 'element' || next.tagName !== 'p') return;

      const currPrefix = getTextPrefix(node, 50).replace(/\s+/g, ' ').trim();
      const nextPrefix = getTextPrefix(next, 25).replace(/\s+/g, ' ').trim();

      const ROMAN_RE = new RegExp(`^\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i');
      const isContractClauseLead =
        /^\d+\.\s*\([a-z]\)/i.test(currPrefix) ||
        new RegExp(`^\\d+\\.\\s*\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i').test(currPrefix) ||
        /^\([a-z]\)/i.test(currPrefix) ||
        ROMAN_RE.test(currPrefix) ||
        /^\d+\)/.test(currPrefix);
      if (!isContractClauseLead) return;

      const isNextLikelyNewClause =
        /^\d+\.\s/.test(nextPrefix) || /^\([a-z]\)/i.test(nextPrefix) || ROMAN_RE.test(nextPrefix);
      if (isNextLikelyNewClause) return;

      const currText = getTextContent(node).replace(/\s+/g, ' ').trim();
      if (!currText || /[.;:!?]$/.test(currText)) return;

      node.children = [...(node.children || []), { type: 'text', value: ' ' }, ...(next.children || [])];
      siblings.splice(index + 1, 1);
    });
  };
};

/** Add CSS classes to contract paragraphs based on bullet level for indentation hierarchy */
export const contractBulletLevelRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    visit(tree, 'element', function (node) {
      if (node.tagName !== 'p') return;
      const prefix = getTextPrefix(node).replace(/\s+/g, ' ').trim();
      if (prefix.length < 2) return;
      let cls: string | null = null;
      // (i) (ii) (iii) (iv) — second sub-level (check before alpha; (i) is roman not letter "i")
      if (new RegExp(`^\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i').test(prefix)) cls = 'contract-level-2';
      // 2. (i) / 12. (iv) — second sub-level with leading section number
      else if (new RegExp(`^\\d+\\.\\s*\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i').test(prefix)) cls = 'contract-level-2';
      // (a) (b) (c) — first sub-level
      else if (/^\([a-z]\)/.test(prefix)) cls = 'contract-level-1';
      // 2. (a) / 12. (c) — first sub-level with leading section number
      else if (/^\d+\.\s*\([a-z]\)/.test(prefix)) cls = 'contract-level-1';
      // 1) 2) 3) — numbered sub-points (same as lettered)
      else if (/^\d+\)/.test(prefix)) cls = 'contract-level-1';
      // 1. 2. 3. — top-level numbered sections (rendered as "1." etc.)
      else if (/^\d+\.\s/.test(prefix)) cls = 'contract-section';
      if (cls && node.properties) {
        const existing = (node.properties.class as string) || '';
        node.properties.class = existing ? `${existing} ${cls}` : cls;
      }
    });
  };
};

/** Add section ids to contract clause paragraphs for deep linking (article-x-s1, article-x-s2-a, etc.) */
export const contractSectionIdsRehypePlugin: RehypePlugin = () => {
  let curArticleId: string | null = null;
  let curSection = 0;
  let curAlpha: string | null = null;

  return function (tree) {
    visitParents(tree, 'element', function (node, ancestors) {
      if (node.type !== 'element') return;
      const el = node as { tagName?: string; properties?: Record<string, unknown>; children?: unknown[] };

      if (el.tagName === 'details') {
        const id = el.properties?.id;
        if (typeof id === 'string' && /^article-[a-z0-9-]+$/.test(id)) {
          curArticleId = id;
          curSection = 0;
          curAlpha = null;
        }
        return;
      }

      if (el.tagName === 'p' && curArticleId) {
        const inAccordionBody = ancestors.some((a) => {
          const an = a as { tagName?: string; properties?: { class?: string; className?: string } };
          if (an.tagName !== 'div') return false;
          const cls = an.properties?.class ?? an.properties?.className ?? '';
          const clsStr = Array.isArray(cls) ? cls.join(' ') : String(cls);
          return clsStr.includes('contract-accordion-body');
        });
        if (!inAccordionBody) return;

        const prefix = getTextPrefix(node, 60).replace(/\s+/g, ' ').trim();
        if (prefix.length < 2) return;

        const m = {
          secAlphaRoman: new RegExp(`^(\\d+)\\.\\s*\\(([a-z])\\)\\s*\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i'),
          secAlpha: new RegExp(`^(\\d+)\\.\\s*\\(([a-z])\\)`, 'i'),
          secRoman: new RegExp(`^(\\d+)\\.\\s*\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i'),
          sec: /^(\d+)\./,
          alphaRoman: new RegExp(`^\\(([a-z])\\)\\s*\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i'),
          alpha: /^\(([a-z])\)/i,
          roman: new RegExp(`^\\((${ROMAN_CLAUSE_PATTERN})\\)`, 'i'),
        };

        let r: RegExpMatchArray | null;
        let path: string;

        if ((r = prefix.match(m.secAlphaRoman))) {
          curSection = parseInt(r[1], 10);
          curAlpha = r[2].toLowerCase();
          path = `s${curSection}-${curAlpha}-${r[3].toLowerCase()}`;
        } else if ((r = prefix.match(m.secAlpha))) {
          curSection = parseInt(r[1], 10);
          curAlpha = r[2].toLowerCase();
          path = `s${curSection}-${curAlpha}`;
        } else if ((r = prefix.match(m.secRoman))) {
          curSection = parseInt(r[1], 10);
          curAlpha = null;
          path = `s${curSection}-${r[2].toLowerCase()}`;
        } else if ((r = prefix.match(m.sec))) {
          curSection = parseInt(r[1], 10);
          curAlpha = null;
          path = `s${curSection}`;
        } else if ((r = prefix.match(m.alphaRoman))) {
          curAlpha = r[1].toLowerCase();
          path = curSection ? `s${curSection}-${curAlpha}-${r[2].toLowerCase()}` : `s1-${curAlpha}-${r[2].toLowerCase()}`;
        } else if ((r = prefix.match(m.alpha))) {
          curAlpha = r[1].toLowerCase();
          path = curSection ? `s${curSection}-${curAlpha}` : `s1-${curAlpha}`;
        } else if ((r = prefix.match(m.roman))) {
          const roman = r[1].toLowerCase();
          path = curSection
            ? curAlpha
              ? `s${curSection}-${curAlpha}-${roman}`
              : `s${curSection}-${roman}`
            : curAlpha
              ? `s1-${curAlpha}-${roman}`
              : `s1-${roman}`;
        } else {
          return;
        }

        if (!el.properties) el.properties = {};
        el.properties.id = `${curArticleId}-${path}`;
      }
    });
  };
};
