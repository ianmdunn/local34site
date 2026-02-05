/**
 * Re-export theme config types so astrowind:config module declaration resolves.
 * Actual config building lives in utils/configBuilder.
 */
export type {
  Config,
  SiteConfig,
  I18NConfig,
  MetaDataConfig,
  AppBlogConfig,
  AnalyticsConfig,
  UIConfig,
} from './utils/configBuilder';
