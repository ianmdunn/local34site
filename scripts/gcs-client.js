#!/usr/bin/env node
/**
 * GCS client with fallback to Application Default Credentials (gcloud auth).
 * When the service account JSON is invalid (e.g. "account not found"), retries
 * using gcloud auth: gcloud auth application-default login
 */

import { Storage } from '@google-cloud/storage';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function isInvalidGrantError(err) {
  const msg = String(err?.message || err?.toString?.() || '');
  const data = err?.response?.data ?? err?.response ?? {};
  return msg.includes('invalid_grant') || msg.includes('account not found') || data?.error === 'invalid_grant';
}

/**
 * Get a working Storage client and bucket. Falls back to ADC if the JSON key fails.
 * @param {string} bucketName
 * @param {Object} [options] - { keyPath: path to service account JSON }
 * @returns {Promise<{ storage: Storage, bucket: import('@google-cloud/storage').Bucket }>}
 */
export async function getBucket(bucketName, options = {}) {
  const keyPath = options.keyPath ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyFilename = keyPath ? join(projectRoot, keyPath) : undefined;

  const tryStorage = (opts = {}) => {
    const storage = new Storage(opts);
    return storage.bucket(bucketName);
  };

  const bucket = tryStorage({ keyFilename });

  try {
    await bucket.exists();
    return { bucket };
  } catch (err) {
    if (isInvalidGrantError(err) && keyFilename) {
      console.warn(
        'Service account key invalid; falling back to gcloud auth (gcloud auth application-default login)\n'
      );
      const saved = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      try {
        const adcBucket = tryStorage({});
        await adcBucket.exists();
        return { bucket: adcBucket };
      } finally {
        if (saved !== undefined) process.env.GOOGLE_APPLICATION_CREDENTIALS = saved;
      }
    }
    throw err;
  }
}
