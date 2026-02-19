// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite/client" />
/// <reference types="../vendor/integration/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_LEADERBOARD_API: string;
  readonly PUBLIC_DIRECTUS_URL: string;
  /** Image proxy URL (token stays server-side). From .env for build. */
  readonly PUBLIC_DIRECTUS_IMAGE_PROXY_URL?: string;
  /** Server-only. From .env DIRECTUS_TOKEN. */
  readonly DIRECTUS_TOKEN?: string;
}

// Augments Vite's ImportMeta – intentionally not referenced in file
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    __closeMobileMenu?: () => void;
    /** Analytics: called by React components to send custom events to GA/Meta */
    __trackEvent?: (eventName: string, params?: Record<string, unknown>) => void;
  }
}

export {};
