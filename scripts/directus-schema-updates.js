#!/usr/bin/env node
/**
 * Set up the Directus "updates" collection schema via REST API.
 * Creates the collection if missing, adds recommended fields.
 *
 * Usage:
 *   DIRECTUS_TOKEN=your_token node scripts/directus-schema-updates.js
 *
 * Options:
 *   --dry-run   Show what would be created without making changes
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const val = valueParts
          .join('=')
          .trim()
          .replace(/^["']|["']$/g, '');
        process.env[key.trim()] = val;
      }
    }
  });
} catch {
  // .env optional
}

const DIRECTUS_URL = (process.env.DIRECTUS_URL || process.env.PUBLIC_DIRECTUS_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
const dryRun = process.argv.includes('--dry-run');

if (!DIRECTUS_TOKEN) {
  console.error('Set DIRECTUS_TOKEN (required even for --dry-run to fetch current schema)');
  process.exit(1);
}

if (!DIRECTUS_URL && !dryRun) {
  console.error('Set DIRECTUS_URL or PUBLIC_DIRECTUS_URL');
  process.exit(1);
}

const headers = () => ({
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
  },
});

/** Recommended fields for updates collection */
const RECOMMENDED_FIELDS = [
  {
    field: 'title',
    type: 'string',
    meta: { interface: 'input', required: true, width: 'full' },
    schema: { is_nullable: false, max_length: 255 },
  },
  {
    field: 'date',
    type: 'dateTime',
    meta: { interface: 'datetime', width: 'full' },
    schema: { is_nullable: true },
  },
  {
    field: 'content',
    type: 'text',
    meta: { interface: 'input-rich-text-html', width: 'full' },
    schema: { is_nullable: true, max_length: null },
  },
  {
    field: 'excerpt',
    type: 'string',
    meta: { interface: 'input-multiline', width: 'full' },
    schema: { is_nullable: true },
  },
  {
    field: 'image',
    type: 'uuid',
    meta: { interface: 'file-image', width: 'full' },
    schema: { is_nullable: true },
  },
  {
    field: 'image_url',
    type: 'string',
    meta: { interface: 'input', width: 'full', note: 'Fallback for migrated WP posts' },
    schema: { is_nullable: true },
  },
  {
    field: 'status',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: {
        choices: [
          { text: 'draft', value: 'draft' },
          { text: 'published', value: 'published' },
        ],
      },
      width: 'half',
    },
    schema: { is_nullable: true, default_value: 'draft', max_length: 64 },
  },
  {
    field: 'slug',
    type: 'string',
    meta: { interface: 'input', width: 'half' },
    schema: { is_nullable: true, max_length: 255 },
  },
  {
    field: 'author',
    type: 'string',
    meta: { interface: 'input', width: 'half' },
    schema: { is_nullable: true, max_length: 255 },
  },
  {
    field: 'featured',
    type: 'boolean',
    meta: { interface: 'boolean', width: 'half' },
    schema: { is_nullable: true, default_value: false },
  },
];

async function api(path, options = {}) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, { ...headers(), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function collectionExists() {
  const json = await api('/collections');
  const collections = json?.data ?? json;
  return Array.isArray(collections) && collections.some((c) => c.collection === 'updates');
}

async function getExistingFields() {
  const json = await api('/fields/updates');
  const fields = json?.data ?? json;
  return Array.isArray(fields) ? fields.map((f) => f.field) : [];
}

async function createCollection() {
  if (dryRun) {
    console.log('[dry-run] Would create collection: updates');
    return;
  }
  await api('/collections', {
    method: 'POST',
    body: JSON.stringify({
      collection: 'updates',
      meta: { icon: 'article', note: 'News and updates' },
      schema: { name: 'updates' },
      fields: RECOMMENDED_FIELDS.map((f) => ({ ...f, collection: 'updates' })),
    }),
  });
  console.log('Created collection: updates (with all fields)');
}

/** Patch content field to ensure unlimited length (fixes VALUE_TOO_LONG for long content) */
async function patchContentFieldUnlimited() {
  if (dryRun) {
    console.log('[dry-run] Would patch content field: ensure type text, max_length null');
    return;
  }
  const patchBodies = [
    { type: 'text', schema: { max_length: null, data_type: 'text' } },
    { schema: { max_length: null } },
  ];
  for (const patchBody of patchBodies) {
    try {
      const res = await fetch(`${DIRECTUS_URL}/fields/updates/content`, {
        method: 'PATCH',
        ...headers(),
        body: JSON.stringify(patchBody),
      });
      if (res.ok) {
        console.log('Patched content field: max_length=unlimited');
        return;
      }
      const text = await res.text();
      if (patchBodies.indexOf(patchBody) < patchBodies.length - 1) {
        console.warn(`Content patch (${JSON.stringify(patchBody)}): ${res.status}, trying fallback...`);
      } else {
        console.warn(`Could not patch content field: ${res.status} ${text.slice(0, 150)}`);
      }
    } catch (err) {
      console.warn(`Skip content patch: ${err.message}`);
      if (patchBodies.indexOf(patchBody) < patchBodies.length - 1) continue;
    }
  }
}

async function addMissingFields(existing) {
  const toAdd = RECOMMENDED_FIELDS.filter((f) => !existing.includes(f.field));
  if (toAdd.length === 0) {
    console.log('All recommended fields already exist.');
    return;
  }
  for (const def of toAdd) {
    if (dryRun) {
      console.log(`[dry-run] Would add field: ${def.field} (${def.type})`);
      continue;
    }
    try {
      await api('/fields/updates', {
        method: 'POST',
        body: JSON.stringify({ ...def, collection: 'updates' }),
      });
      console.log(`Added field: ${def.field}`);
    } catch (err) {
      console.warn(`Skip ${def.field}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Ensure updates collection and fields exist. Callable from migration script.
 * @param {{ directusUrl: string; token: string; dryRun?: boolean }} opts
 */
export async function ensureUpdatesSchema(opts) {
  const { directusUrl, token, dryRun: schemaDryRun = false } = opts;
  const url = directusUrl.replace(/\/$/, '');
  const authHeaders = () => ({
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  async function api(path, options = {}) {
    const res = await fetch(`${url}${path}`, { ...authHeaders(), ...options });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  const json = await api('/collections');
  const collections = json?.data ?? json;
  const exists = Array.isArray(collections) && collections.some((c) => c.collection === 'updates');

  if (!exists) {
    if (schemaDryRun) {
      console.log('[dry-run] Would create collection: updates');
      return;
    }
    await api('/collections', {
      method: 'POST',
      body: JSON.stringify({
        collection: 'updates',
        meta: { icon: 'article', note: 'News and updates' },
        schema: { name: 'updates' },
        fields: RECOMMENDED_FIELDS.map((f) => ({ ...f, collection: 'updates' })),
      }),
    });
    console.log('Created collection: updates (with all fields)');
    return;
  }

  const fieldsJson = await api('/fields/updates');
  const fields = fieldsJson?.data ?? fieldsJson;
  const existing = Array.isArray(fields) ? fields.map((f) => f.field) : [];
  const toAdd = RECOMMENDED_FIELDS.filter((f) => !existing.includes(f.field));

  if (toAdd.length > 0) {
    for (const def of toAdd) {
      if (schemaDryRun) {
        console.log(`[dry-run] Would add field: ${def.field}`);
        continue;
      }
      try {
        await api('/fields/updates', {
          method: 'POST',
          body: JSON.stringify({ ...def, collection: 'updates' }),
        });
        console.log(`Added field: ${def.field}`);
      } catch (err) {
        console.warn(`Skip ${def.field}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Patch content field to ensure unlimited length (fixes VALUE_TOO_LONG)
  if (existing.includes('content') || toAdd.some((f) => f.field === 'content')) {
    if (schemaDryRun) {
      console.log('[dry-run] Would patch content field: ensure type text, max_length unlimited');
    } else {
      const patchBodies = [
        { type: 'text', schema: { max_length: null, data_type: 'text' } },
        { schema: { max_length: null } },
      ];
      for (const patchBody of patchBodies) {
        try {
          const patchRes = await fetch(`${url}/fields/updates/content`, {
            method: 'PATCH',
            ...authHeaders(),
            body: JSON.stringify(patchBody),
          });
          if (patchRes.ok) {
            console.log('Patched content field: max_length=unlimited');
            break;
          }
          const errText = (await patchRes.text()).slice(0, 100);
          if (patchBodies.indexOf(patchBody) < patchBodies.length - 1) {
            console.warn(`Content patch: ${patchRes.status}, trying fallback...`);
          } else {
            console.warn(`Content patch: ${patchRes.status} ${errText}`);
          }
        } catch (err) {
          console.warn(`Skip content patch: ${err.message}`);
        }
      }
    }
  }
}

async function main() {
  console.log('Checking Directus schema...');
  const exists = await collectionExists();
  if (!exists) {
    console.log('Collection "updates" does not exist.');
    await createCollection();
    return;
  }
  console.log('Collection "updates" exists.');
  const existing = await getExistingFields();
  console.log(`Existing fields: ${existing.join(', ') || '(none)'}`);
  await addMissingFields(existing);
  await patchContentFieldUnlimited();
  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

// Run main only when executed directly (not when imported)
if (process.argv[1]?.endsWith('directus-schema-updates.js')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
