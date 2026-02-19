import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('returns empty string for empty or non-string input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as unknown as string)).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });

  it('preserves safe HTML', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('strips script tags', () => {
    const html = '<p>Safe</p><script>alert("xss")</script>';
    expect(sanitizeHtml(html)).not.toContain('<script>');
    expect(sanitizeHtml(html)).toContain('<p>Safe</p>');
  });

  it('strips event handlers', () => {
    const html = '<p onclick="alert(1)">Click</p>';
    expect(sanitizeHtml(html)).not.toContain('onclick');
  });

  it('strips javascript: URLs', () => {
    const html = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('javascript:');
  });

  it('keeps allowed div and content', () => {
    const html = '<div class="card">Content</div>';
    expect(sanitizeHtml(html)).toContain('Content');
  });

  it('preserves links with safe href', () => {
    const html = '<a href="https://example.com">Link</a>';
    expect(sanitizeHtml(html)).toContain('href="https://example.com"');
  });

  it('preserves common prose elements', () => {
    const html = '<ul><li>Item</li></ul><blockquote>Quote</blockquote>';
    expect(sanitizeHtml(html)).toContain('<ul>');
    expect(sanitizeHtml(html)).toContain('<blockquote>Quote</blockquote>');
  });
});
