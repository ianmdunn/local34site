#!/usr/bin/env node
/**
 * Fix VALUE_TOO_LONG: alter updates.content from VARCHAR to TEXT.
 * The Directus PATCH only updates metadata; the DB column stays VARCHAR.
 *
 * Run: node scripts/fix-directus-content-column.js
 * Requires: Cloud SQL Proxy on port 5433 (or docker directus-postgres).
 * Requires: pg package (npm install pg)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const directusEnv = join(__dirname, '..', 'directus', '.env');
const rootEnv = join(__dirname, '..', '.env');
let DB_HOST = process.env.DB_HOST || '127.0.0.1';
let DB_PORT = parseInt(process.env.DB_PORT || '5433', 10);
let DB_USER = 'directus';
let DB_PASSWORD = '';
let DB_DATABASE = 'local34site-directus-db';

try {
  const env = readFileSync(directusEnv, 'utf-8');
  env.split('\n').forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'DB_USER') DB_USER = val;
      if (key === 'DB_PASSWORD') DB_PASSWORD = val;
      if (key === 'DB_DATABASE') DB_DATABASE = val;
    }
  });
} catch {
  console.error('Could not read directus/.env');
  process.exit(1);
}

let DIRECTUS_URL = process.env.DIRECTUS_URL || process.env.PUBLIC_DIRECTUS_URL || '';
let DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
try {
  readFileSync(rootEnv, 'utf-8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim().replace(/^["']|["']$/g, '');
        if (k === 'PUBLIC_DIRECTUS_URL' || k === 'DIRECTUS_URL') DIRECTUS_URL = v;
        if (k === 'DIRECTUS_TOKEN') DIRECTUS_TOKEN = v;
      }
    });
} catch {
  /* root .env optional */
}

async function run() {
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('Install pg: npm install pg');
    process.exit(1);
  }

  const { Client } = pg.default;
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
  });

  try {
    await client.connect();
  } catch (err) {
    console.error('Could not connect:', err.message);
    console.error('Ensure Cloud SQL Proxy is running on port 5433:');
    console.error('  cloud-sql-proxy local34org-assets:us-west1:local34org-directus-b --port=5433');
    console.error('If port 5433 is in use, something else may be using it. Try: lsof -i :5433');
    process.exit(1);
  }

  try {
    // Verify current column type first
    const check = await client.query(
      `SELECT data_type, character_maximum_length FROM information_schema.columns 
       WHERE table_name = 'updates' AND column_name = 'content'`
    );
    const row = check.rows[0];
    if (row) {
      console.log(
        `Current content column: ${row.data_type}${row.character_maximum_length != null ? `(${row.character_maximum_length})` : ''}`
      );
    }

    await client.query('ALTER TABLE updates ALTER COLUMN content TYPE text;');
    console.log('Altered updates.content column to TEXT.');

    // Also alter excerpt if it's varchar (often 255)
    try {
      await client.query('ALTER TABLE updates ALTER COLUMN excerpt TYPE text;');
      console.log('Altered updates.excerpt column to TEXT.');
    } catch (excerptErr) {
      if (!excerptErr.message?.includes('does not exist')) console.warn('excerpt:', excerptErr.message);
    }

    // Verify after ALTER
    const verify = await client.query(
      `SELECT data_type, character_maximum_length FROM information_schema.columns 
       WHERE table_name = 'updates' AND column_name = 'content'`
    );
    if (verify.rows[0]) {
      console.log(
        `Verified content: ${verify.rows[0].data_type} (max_length: ${verify.rows[0].character_maximum_length ?? 'unlimited'})`
      );
    }

    // Also clear max_length in Directus metadata (it validates before hitting DB)
    try {
      const r = await client.query(
        `UPDATE directus_fields SET schema = jsonb_set(COALESCE(schema, '{}'::jsonb), '{max_length}', 'null')
         WHERE collection = 'updates' AND field = 'content' RETURNING id`
      );
      if (r.rowCount > 0) {
        console.log('Cleared max_length in Directus metadata.');
      } else {
        await client.query(
          `UPDATE directus_fields SET meta = jsonb_set(COALESCE(meta::jsonb, '{}'), '{max_length}', 'null')
           WHERE collection = 'updates' AND field = 'content'`
        );
      }
    } catch (metaErr) {
      console.warn('Could not update Directus metadata:', metaErr.message);
    }

    // Force schema update via Directus API (clears any server-side cache)
    if (DIRECTUS_URL && DIRECTUS_TOKEN) {
      try {
        const res = await fetch(`${DIRECTUS_URL.replace(/\/$/, '')}/fields/updates/content`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
          },
          body: JSON.stringify({
            type: 'text',
            schema: { max_length: null, data_type: 'text' },
          }),
        });
        if (res.ok) {
          console.log('Patched content field via Directus API.');
        }
      } catch (apiErr) {
        console.warn('API patch:', apiErr.message);
      }
    }

    console.log('Done. Run npm run migrate:wp again.');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
