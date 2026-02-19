/**
 * Google Cloud Storage utilities
 *
 * Configure GCS by setting environment variables:
 * - GCS_BUCKET_NAME: Your GCS bucket name (e.g., "local34-assets")
 * - GCS_BUCKET_URL: Public URL of your bucket (e.g., "https://storage.googleapis.com/local34-assets" or custom domain)
 * - GCS_ENABLED: Set to "true" to enable GCS URLs, "false" or unset to use local paths
 */

const GCS_BUCKET_NAME = import.meta.env.GCS_BUCKET_NAME || process.env.GCS_BUCKET_NAME;
const GCS_BUCKET_URL = import.meta.env.GCS_BUCKET_URL || process.env.GCS_BUCKET_URL;
const GCS_ENABLED =
  import.meta.env.GCS_ENABLED === 'true' ||
  import.meta.env.PUBLIC_GCS_ENABLED === 'true' ||
  process.env.GCS_ENABLED === 'true';

/**
 * Get the base URL for GCS assets
 */
export const getGcsBaseUrl = (): string | null => {
  if (!GCS_ENABLED || !GCS_BUCKET_URL) {
    return null;
  }

  // Ensure URL doesn't end with a slash
  return GCS_BUCKET_URL.replace(/\/$/, '');
};

/**
 * Check if GCS is enabled
 */
export const isGcsEnabled = (): boolean => {
  return GCS_ENABLED && !!GCS_BUCKET_URL;
};

/**
 * Convert a local asset path to a GCS URL
 * @param path - Asset path (e.g., "how-we-win/logo.svg" or "/how-we-win/logo.svg")
 * @returns Full GCS URL or null if GCS is not enabled
 */
export const getGcsUrl = (path: string): string | null => {
  if (!isGcsEnabled()) {
    return null;
  }

  const baseUrl = getGcsBaseUrl();
  if (!baseUrl) {
    return null;
  }

  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  return `${baseUrl}/${cleanPath}`;
};

/**
 * Get bucket name (useful for upload scripts)
 */
export const getGcsBucketName = (): string | null => {
  return GCS_BUCKET_NAME || null;
};
