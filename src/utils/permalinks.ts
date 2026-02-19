import slugify from 'limax';

import { SITE, APP_BLOG } from 'astrowind:config';

import { trim } from '~/utils/utils';
import { getGcsUrl, isGcsEnabled } from '~/utils/gcs';

export const trimSlash = (s: string) => trim(trim(s, '/'));
const createPath = (...params: string[]) => {
  const paths = params
    .map((el) => trimSlash(el))
    .filter((el) => !!el)
    .join('/');

  if (SITE.trailingSlash && paths) {
    return `/${paths}/`;
  } else if (paths) {
    return `/${paths}`;
  } else {
    return '/';
  }
};

const BASE_PATHNAME = SITE.base || '/';

export const cleanSlug = (text = '') =>
  trimSlash(text)
    .split('/')
    .map((slug) => slugify(slug))
    .join('/');

export const BLOG_BASE = cleanSlug(APP_BLOG?.list?.pathname);
export const CATEGORY_BASE = cleanSlug(APP_BLOG?.category?.pathname);
export const TAG_BASE = cleanSlug(APP_BLOG?.tag?.pathname) || 'tag';

export const POST_PERMALINK_PATTERN = trimSlash(APP_BLOG?.post?.permalink || `${BLOG_BASE}/%slug%`);

/** Strip www from host so canonicals and nav links always use the non-www origin. */
function withoutWww(url: URL): string {
  const s = url.toString();
  return s.replace(/^(https?:\/\/)www\./, '$1');
}

/** Canonical origin (e.g. https://test.local34.org) with www stripped. Use for Astro.site, OG images, etc. */
export const getCanonicalOrigin = (): string => {
  const base = SITE.site ?? '';
  const url = new URL('/', base);
  return withoutWww(url).replace(/\/$/, '');
};

/** Canonical base URL (origin + base path) with trailing slash, for <base href>, RSS site, OG base URL. */
export const getCanonicalBaseHref = (): string => {
  const origin = getCanonicalOrigin();
  const baseTrimmed = trimSlash(BASE_PATHNAME);
  return baseTrimmed ? `${origin}/${baseTrimmed}/` : `${origin}/`;
};

/**
 * Path with base (e.g. /about or /subdir/about). Use for nav and in-page links so they resolve
 * against the current origin (works on local dev and with any base path).
 */
export const getPathWithBase = (path = ''): string => {
  const baseTrimmed = trimSlash(BASE_PATHNAME);
  let pathNormalized = trimSlash(path);

  // Remove baseTrimmed from the start of pathNormalized if it exists
  if (baseTrimmed && pathNormalized.startsWith(baseTrimmed)) {
    pathNormalized = pathNormalized.slice(baseTrimmed.length);
  }
  pathNormalized = trimSlash(pathNormalized);

  let out = baseTrimmed ? `/${baseTrimmed}` : '';
  out += pathNormalized ? `/${pathNormalized}` : '';
  out = out || '/';
  out = out.replace(/\/+/g, '/'); // Replace multiple slashes with a single one

  if (SITE.trailingSlash === false && out.endsWith('/') && out.length > 1) {
    out = out.slice(0, -1);
  } else if (SITE.trailingSlash === true && !out.endsWith('/')) {
    out = out + '/';
  }

  return out;
};

/**
 * Canonical full URL for a path. Respects SITE.base so nav and links work when deployed under a base path.
 * Path can be route-only (e.g. /about) or full pathname (e.g. /subdir/about); base is not doubled.
 */
export const getCanonical = (path = ''): string | URL => {
  const base = SITE.site ?? '';
  const pathOnly = getPathWithBase(path);
  const url = new URL(pathOnly, base);
  return withoutWww(url);
};

/** */
export const getPermalink = (slug = '', type = 'page'): string => {
  if (
    slug.startsWith('https://') ||
    slug.startsWith('http://') ||
    slug.startsWith('://') ||
    slug.startsWith('#') ||
    slug.startsWith('javascript:')
  ) {
    return slug;
  }

  let permalink: string;
  const trimmedSlug = trimSlash(slug);

  switch (type) {
    case 'home':
      permalink = getHomePermalink();
      break;
    case 'blog':
      permalink = getBlogPermalink();
      break;
    case 'asset':
      permalink = getAsset(slug);
      break;
    case 'category':
      permalink = createPath(CATEGORY_BASE, trimmedSlug);
      break;
    case 'tag':
      permalink = createPath(TAG_BASE, trimmedSlug);
      break;
    case 'post':
      permalink = createPath(trimmedSlug);
      break;
    case 'page':
    default:
      permalink = createPath(trimmedSlug);
      break;
  }

  return definitivePermalink(permalink);
};

/** */
export const getHomePermalink = (): string => getPermalink('/');

/** */
export const getBlogPermalink = (): string => getPermalink(BLOG_BASE);

/** */
export const getAsset = (path: string): string => {
  // If GCS is enabled, return GCS URL
  if (isGcsEnabled()) {
    const gcsUrl = getGcsUrl(path);
    if (gcsUrl) {
      return gcsUrl;
    }
  }

  // Otherwise, return local path
  return (
    '/' +
    [BASE_PATHNAME, path]
      .map((el) => trimSlash(el))
      .filter((el) => !!el)
      .join('/')
  );
};

/** */
const definitivePermalink = (permalink: string): string => createPath(BASE_PATHNAME, permalink);

/** */
interface ItemWithUrl {
  url: string;
  type?: string;
}

const resolveHref = (item: unknown): string | undefined => {
  if (typeof item === 'string') {
    return getPermalink(item);
  } else if (typeof item === 'object' && item !== null && 'url' in item) {
    const obj = item as ItemWithUrl;
    switch (obj.type) {
      case 'home':
        return getHomePermalink();
      case 'blog':
        return getBlogPermalink();
      case 'asset':
        return getAsset(obj.url);
      default:
        return getPermalink(obj.url, obj.type);
    }
  }
  return undefined;
};

export const applyGetPermalinks = (menu: object | unknown = {}): unknown => {
  if (Array.isArray(menu)) {
    return menu.map((item) => applyGetPermalinks(item));
  } else if (typeof menu === 'object' && menu !== null) {
    const obj: { [key: string]: unknown } = {};
    const menuObj = menu as Record<string, unknown>;
    for (const key in menuObj) {
      if (key === 'href') {
        obj[key] = resolveHref(menuObj[key]);
      } else {
        obj[key] = applyGetPermalinks(menuObj[key] as object);
      }
    }
    return obj;
  }
  return menu;
};
