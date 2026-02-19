import { describe, expect, it } from 'vitest';
import { trim, toUiAmount } from './utils';

describe('trim', () => {
  it('trims whitespace by default', () => {
    expect(trim('  foo  ')).toBe('foo');
    expect(trim('\n\tbar\n')).toBe('bar');
  });

  it('trims custom character', () => {
    expect(trim('/foo/bar/', '/')).toBe('foo/bar');
    expect(trim('---test---', '-')).toBe('test');
  });

  it('handles empty string', () => {
    expect(trim('')).toBe('');
  });
});

describe('toUiAmount', () => {
  it('returns 0 for falsy values', () => {
    expect(toUiAmount(0)).toBe(0);
  });

  it('formats thousands with K', () => {
    expect(toUiAmount(1500)).toBe('1.5K');
    expect(toUiAmount(1000)).toBe('1K');
  });

  it('formats millions with M', () => {
    expect(toUiAmount(1500000)).toBe('1.5M');
    expect(toUiAmount(1000000)).toBe('1M');
  });

  it('formats billions with B', () => {
    expect(toUiAmount(1500000000)).toBe('1.5B');
    expect(toUiAmount(1000000000)).toBe('1B');
  });

  it('returns plain number for values under 1000', () => {
    expect(toUiAmount(999)).toBe('999');
    expect(toUiAmount(42)).toBe('42');
  });

  it('uses integer when decimal would be whole', () => {
    expect(toUiAmount(2000)).toBe('2K');
    expect(toUiAmount(2000000)).toBe('2M');
  });
});
