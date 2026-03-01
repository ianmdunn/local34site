/**
 * Dev-only Vite plugin: /api/contract-mdx
 * GET - load full doc or single section (?section=article-v-fair-treatment...|intro)
 * POST - save full doc or merge section ({ content, section? })
 * Reads/writes src/content/sitePages/2021-2026-contract.mdx.
 * Only active when running `astro dev`.
 */
import type { Plugin } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const contractPath = join(projectRoot, 'src/content/sitePages/2021-2026-contract.mdx');

const BODY_INDENT = '    ';

/** Ensure body lines have 4-space indent for MDX accordion structure. */
function indentBody(body: string): string {
  return body
    .trimEnd()
    .split('\n')
    .map((line) => (line === '' ? '' : BODY_INDENT + line.replace(/^(\s*)/, '')))
    .join('\n');
}

/** Extract accordion body content for section id. Returns null if not found. */
function extractSection(fullDoc: string, sectionId: string): string | null {
  const escaped = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<details[^>]*id="${escaped}"[^>]*>[\\s\\S]*?<div class="contract-accordion-body">\\n?([\\s\\S]*?)\\n  </div>\\s*</details>`,
    'i'
  );
  const m = fullDoc.match(re);
  return m ? m[1].trim() : null;
}

/** Extract intro (content from after frontmatter to first <details>). */
function extractIntro(fullDoc: string): string | null {
  const fmEnd = fullDoc.match(/^---\s*\n[\s\S]*?\n---\s*\n\n?/);
  const afterFm = fmEnd ? fullDoc.slice(fmEnd[0].length) : fullDoc;
  const firstDetails = afterFm.indexOf('<details ');
  if (firstDetails === -1) return afterFm.trim();
  return afterFm.slice(0, firstDetails).trim();
}

/** Replace accordion body content for section id. Returns new full doc or null. */
function replaceSection(fullDoc: string, sectionId: string, newBody: string): string | null {
  const escaped = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<details[^>]*id="${escaped}"[^>]*>[\\s\\S]*?<div class="contract-accordion-body">)\\n?[\\s\\S]*?(\\n  </div>\\s*</details>)`,
    'i'
  );
  const indented = indentBody(newBody);
  const replaced = fullDoc.replace(re, `$1\n${indented}\n$2`);
  return replaced === fullDoc ? null : replaced;
}

/** Replace intro. Returns new full doc or null. */
function replaceIntro(fullDoc: string, newIntro: string): string | null {
  const fmMatch = fullDoc.match(/^(---\s*\n[\s\S]*?\n---\s*\n\n?)/);
  if (!fmMatch) return null;
  const firstDetails = fullDoc.indexOf('<details ');
  if (firstDetails === -1) return fmMatch[1] + newIntro.trimEnd() + '\n';
  return fmMatch[1] + newIntro.trimEnd() + '\n\n' + fullDoc.slice(firstDetails);
}

export function contractMdxApiPlugin(): Plugin {
  return {
    name: 'contract-mdx-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/contract-mdx', async (req, res, next) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const section = url.searchParams.get('section');

        if (req.method === 'GET') {
          try {
            const fullDoc = await readFile(contractPath, 'utf8');
            if (section === 'intro') {
              const introContent = extractIntro(fullDoc);
              if (!introContent) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Intro not found' }));
                return;
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ content: introContent, section: 'intro', fullContent: fullDoc }));
            } else if (section) {
              const sectionContent = extractSection(fullDoc, section);
              if (!sectionContent) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `Section not found: ${section}` }));
                return;
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ content: sectionContent, section, fullContent: fullDoc }));
            } else {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ content: fullDoc }));
            }
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const { content, section: sectionParam } = data;
              if (typeof content !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'content must be a string' }));
                return;
              }
              if (sectionParam && typeof sectionParam === 'string') {
                const fullDoc = await readFile(contractPath, 'utf8');
                const merged =
                  sectionParam === 'intro'
                    ? replaceIntro(fullDoc, content)
                    : replaceSection(fullDoc, sectionParam, content);
                if (!merged) {
                  res.statusCode = 404;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: `Section not found: ${sectionParam}` }));
                  return;
                }
                await writeFile(contractPath, merged, 'utf8');
              } else {
                await writeFile(contractPath, content, 'utf8');
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}
