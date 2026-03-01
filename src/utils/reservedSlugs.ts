/**
 * Slugs that are served by dedicated pages in src/pages/ (e.g. about.astro, actions.astro).
 * [slug].astro must not generate static paths for these, so content collection entries
 * with these slugs don't override the fixed routes.
 */
export const RESERVED_SLUGS: readonly string[] = [
  'about',
  'actions',
  'meeting-backgrounds',
  'how-we-win',
  'our-contract',
  'contract',
  'updates',
  'yales-wealth',
  // Contract sub-pages (content exists but route is our-contract)
  'contract-1',
  'contract-2',
  'contract-3',
  '2021-2026-contract',
] as const;

const reservedSet = new Set<string>(RESERVED_SLUGS);

export function isReservedSlug(slug: string): boolean {
  return reservedSet.has(slug);
}
