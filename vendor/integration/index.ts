import fs from 'node:fs';
import os from 'node:os';
import type { AstroConfig, AstroIntegration } from 'astro';

import configBuilder, { type Config } from './utils/configBuilder';
import loadConfig from './utils/loadConfig';

export default ({ config: _themeConfig = 'src/config.yaml' } = {}): AstroIntegration => {
  let cfg: AstroConfig;
  return {
    name: 'astrowind-integration',

    hooks: {
      'astro:config:setup': async ({
        // command,
        config,
        // injectRoute,
        // isRestart,
        logger,
        updateConfig,
        addWatchFile,
      }) => {
        const buildLogger = logger.fork('astrowind');

        const virtualModuleId = 'astrowind:config';
        const resolvedVirtualModuleId = '\0' + virtualModuleId;

        const rawJsonConfig = (await loadConfig(_themeConfig)) as Config;
        const built = configBuilder(rawJsonConfig);
        let { SITE, I18N, METADATA, APP_BLOG, UI, ANALYTICS } = built;
        // Allow override from env (e.g. SITE_URL=https://dev.local34.org for staging)
        const envSiteUrl = process.env.SITE_URL?.trim();
        const baseSiteUrl =
          envSiteUrl || (typeof SITE.site === 'string' ? SITE.site : undefined);
        // Force non-www so sitemap, canonicals, and host never add www
        const siteUrl =
          typeof baseSiteUrl === 'string'
            ? baseSiteUrl.replace(/^(https?:\/\/)www\.(.+)$/, '$1$2')
            : SITE.site;
        const SITE_NORMALIZED = { ...SITE, site: siteUrl };
        // Noindex staging/dev so search engines don't index (e.g. dev.local34.org)
        const isDevHost =
          typeof siteUrl === 'string' &&
          /^https?:\/\/(dev\.|staging\.|preview\.)/i.test(siteUrl);
        if (isDevHost) {
          METADATA = {
            ...METADATA,
            robots: { index: false, follow: false },
          };
        }

        updateConfig({
          site: siteUrl,
          base: SITE.base,

          trailingSlash: SITE.trailingSlash ? 'always' : 'never',

          vite: {
            plugins: [
              {
                name: 'vite-plugin-astrowind-config',
                resolveId(id) {
                  if (id === virtualModuleId) {
                    return resolvedVirtualModuleId;
                  }
                },
                load(id) {
                  if (id === resolvedVirtualModuleId) {
                    return `
                    export const SITE = ${JSON.stringify(SITE_NORMALIZED)};
                    export const I18N = ${JSON.stringify(I18N)};
                    export const METADATA = ${JSON.stringify(METADATA)};
                    export const APP_BLOG = ${JSON.stringify(APP_BLOG)};
                    export const UI = ${JSON.stringify(UI)};
                    export const ANALYTICS = ${JSON.stringify(ANALYTICS)};
                    `;
                  }
                },
              },
            ],
          },
        });

        if (typeof _themeConfig === 'string') {
          addWatchFile(new URL(_themeConfig, config.root));

          buildLogger.info(`Astrowind \`${_themeConfig}\` has been loaded.`);
        } else {
          buildLogger.info(`Astrowind config has been loaded.`);
        }
      },
      'astro:config:done': async ({ config }) => {
        cfg = config;
      },

      'astro:build:done': async ({ logger }) => {
        const buildLogger = logger.fork('astrowind');
        const isDevHost =
          typeof cfg.site === 'string' &&
          /^https?:\/\/(dev\.|staging\.|preview\.)/i.test(cfg.site);

        try {
          const outDir = cfg.outDir;
          const publicDir = cfg.publicDir;
          const robotsTxtFileInOut = new URL('robots.txt', outDir);

          if (isDevHost) {
            buildLogger.info('Writing noindex `robots.txt` for dev/staging host.');
            fs.writeFileSync(
              robotsTxtFileInOut,
              `User-agent: *${os.EOL}Disallow: /${os.EOL}`,
              { encoding: 'utf8', flag: 'w' }
            );
          } else {
            buildLogger.info('Updating `robots.txt` with `sitemap-index.xml` ...');
            const sitemapName = 'sitemap-index.xml';
            const sitemapFile = new URL(sitemapName, outDir);
            const robotsTxtFile = new URL('robots.txt', publicDir);

            const hasIntegration =
              Array.isArray(cfg?.integrations) &&
              cfg.integrations?.find((e) => e?.name === '@astrojs/sitemap') !== undefined;
            const sitemapExists = fs.existsSync(sitemapFile);

            if (hasIntegration && sitemapExists) {
              const robotsTxt = fs.readFileSync(robotsTxtFile, { encoding: 'utf8', flag: 'a+' });
              const sitemapUrl = new URL(sitemapName, String(new URL(cfg.base, cfg.site)));
              const pattern = /^Sitemap:(.*)$/m;

              if (!pattern.test(robotsTxt)) {
                fs.writeFileSync(
                  robotsTxtFileInOut,
                  `${robotsTxt}${os.EOL}${os.EOL}Sitemap: ${sitemapUrl}`,
                  { encoding: 'utf8', flag: 'w' }
                );
              } else {
                fs.writeFileSync(
                  robotsTxtFileInOut,
                  robotsTxt.replace(pattern, `Sitemap: ${sitemapUrl}`),
                  { encoding: 'utf8', flag: 'w' }
                );
              }
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          /* empty */
        }
      },
    },
  };
};
