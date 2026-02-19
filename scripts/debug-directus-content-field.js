#!/usr/bin/env node
/**
 * Debug: inspect where Directus gets max_length for content field validation.
 * Helps identify if VALUE_TOO_LONG comes from schema, meta, options, or DB.
 *
 * Run: node scripts/debug-directus-content-field.js
 * Needs: DIRECTUS_TOKEN, PUBLIC_DIRECTUS_URL (or DIRECTUS_URL) in .env
 * Optional: Cloud SQL Proxy on 5433 for DB introspection
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env');
try {
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim().replace(/^["']|["']$/g, '');
        process.env[k] = v;
      }
    });
} catch {
  /* ignore */
}

const DIRECTUS_URL = (process.env.DIRECTUS_URL || process.env.PUBLIC_DIRECTUS_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error('Set DIRECTUS_URL (or PUBLIC_DIRECTUS_URL) and DIRECTUS_TOKEN in .env');
  process.exit(1);
}

async function main() {
  console.log('=== Directus API: GET /fields/updates/content ===\n');

  const res = await fetch(`${DIRECTUS_URL}/fields/updates/content`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (!res.ok) {
    console.error('API error:', res.status, await res.text());
    process.exit(1);
  }

  const field = await res.json();
  const data = field.data ?? field;
  console.log(JSON.stringify(data, null, 2));

  console.log('\n=== Key fields for validation ===');
  console.log('type:', data.type);
  console.log('schema:', JSON.stringify(data.schema, null, 2));
  console.log('meta:', JSON.stringify(data.meta, null, 2));
  if (data.meta?.options) {
    console.log('meta.options:', JSON.stringify(data.meta.options, null, 2));
  }

  // Try DB introspection if pg available
  const directusEnv = join(projectRoot, 'directus', '.env');
  let DB_HOST = process.env.DB_HOST || '127.0.0.1';
  let DB_PORT = parseInt(process.env.DB_PORT || '5433', 10);
  let DB_USER = 'directus';
  let DB_PASSWORD = '';
  let DB_DATABASE = 'local34site-directus-db';
  try {
    readFileSync(directusEnv, 'utf-8')
      .split('\n')
      .forEach((line) => {
        const m = line.match(/^\s*([^#=]+)=(.*)$/);
        if (m) {
          const k = m[1].trim();
          const v = m[2].trim().replace(/^["']|["']$/g, '');
          if (k === 'DB_USER') DB_USER = v;
          if (k === 'DB_PASSWORD') DB_PASSWORD = v;
          if (k === 'DB_DATABASE') DB_DATABASE = v;
        }
      });
  } catch {
    /* ignore */
  }

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE,
    });
    await client.connect();

    console.log('\n=== DB: information_schema.columns (updates.content) ===');
    const cols = await client.query(
      `SELECT column_name, data_type, character_maximum_length, character_octet_length
       FROM information_schema.columns
       WHERE table_name = 'updates' AND column_name = 'content'`
    );
    console.log(cols.rows.length ? cols.rows[0] : '(no row)');

    console.log('\n=== DB: directus_fields (content) ===');
    const fields = await client.query(
      `SELECT id, collection, field, special, interface, options, display, "display_options",
              "validation_message", "group" FROM directus_fields
       WHERE collection = 'updates' AND field = 'content'`
    );
    if (fields.rows.length) {
      const row = fields.rows[0];
      console.log('Columns:', Object.keys(row).join(', '));
      for (const [k, v] of Object.entries(row)) {
        if (v != null) console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v) : v);
      }
    } else {
      console.log('(no row)');
    }

    await client.end();
  } catch (err) {
    console.log('\n(DB introspection skipped:', err.message, '- run Cloud SQL Proxy on 5433 to inspect schema)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
