import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import icon from 'astro-icon';
import compress from 'astro-compress';
import type { AstroIntegration } from 'astro';

import astrowind from './vendor/integration';

import { readingTimeRemarkPlugin, responsiveTablesRehypePlugin, lazyImagesRehypePlugin } from './src/utils/frontmatter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// How the site runs
// ---------------------------------------------------------------------------
// - output: static → prerender all pages at build time. Opt out with export const prerender = false
//   on specific pages when using an adapter for SSR.
// - site / base / trailingSlash: overridden by astrowind integration from src/config.yaml.
// - Routing: file-based (src/pages/*). [slug].astro serves content from content/sitePages/
//   except slugs in reservedSlugs (those have dedicated pages).
// - Config: config.yaml → vendor integration → virtual module astrowind:config → SITE, METADATA, etc.
// ---------------------------------------------------------------------------

const hasExternalScripts = false;
const whenExternalScripts = (items: (() => AstroIntegration) | (() => AstroIntegration)[] = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

export default defineConfig({
  // Fallback; astrowind integration overwrites from config.yaml
  site: 'https://dev.local34.org',
  output: 'static',

  devToolbar: {
    enabled: false,
  },

  // Prefetch all links for faster transitions (Monogram: https://monogram.io/blog/a-guide-to-astro-navigation)
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },

  // Clean URLs: redirect default/index routes to shorter paths if needed
  redirects: {},

  image: {
    remotePatterns: [],
  },

  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    sitemap(),
    mdx(),
    icon({
      include: {
        tabler: ['*'],
        'flat-color-icons': [
          'template',
          'gallery',
          'approval',
          'document',
          'advertising',
          'currency-exchange',
          'voice-presentation',
          'business-contact',
          'database',
        ],
      },
    }),

    ...whenExternalScripts(() =>
      partytown({
        config: { forward: ['dataLayer.push'] },
      })
    ),

    compress({
      CSS: true,
      HTML: {
        'html-minifier-terser': {
          removeAttributeQuotes: false,
        },
      },
      Image: true,
      JavaScript: true,
      SVG: false,
      Logger: 1,
    }),

    astrowind({
      config: './src/config.yaml',
    }),
  ],

  markdown: {
    remarkPlugins: [readingTimeRemarkPlugin],
    rehypePlugins: [responsiveTablesRehypePlugin, lazyImagesRehypePlugin],
  },

  vite: {
    envPrefix: ['VITE_'],
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
      // Ensure a single React instance (avoids "Invalid hook call" with islands)
      dedupe: ['react', 'react-dom'],
    },
    assetsInclude: ['**/*.yaml'],
    // Use production JSX runtime in dev to avoid "jsxDEV is not a function" (React 19 + Vite dev)
    esbuild: {
      jsxDev: false,
    },
  },
});
