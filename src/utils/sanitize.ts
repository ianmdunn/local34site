/**
 * Sanitize HTML from CMS/user input to prevent XSS.
 * Uses isomorphic-dompurify for safe server-side rendering.
 */
import DOMPurify from 'isomorphic-dompurify';

/** Allowed tags for rich prose content (articles, updates). */
const PROSE_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'mark',
  'small',
  'sub',
  'sup',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'hr',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
  'span',
  'section',
  'article',
  'figure',
  'figcaption',
];

const PROSE_ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'class',
  'id',
  'src',
  'alt',
  'width',
  'height',
  'loading',
  'colspan',
  'rowspan',
];

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: PROSE_ALLOWED_TAGS,
  ALLOWED_ATTR: PROSE_ALLOWED_ATTR,
  ADD_ATTR: ['target'] as string[],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize HTML string for safe rendering. Strips scripts, event handlers,
 * javascript: URLs, and other dangerous content while preserving prose formatting.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  const result = DOMPurify.sanitize(html, SANITIZE_OPTIONS);
  return typeof result === 'string' ? result : String(result);
}
