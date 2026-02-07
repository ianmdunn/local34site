#!/usr/bin/env node
/**
 * Inlines CSS class fill values into SVG elements.
 * Replaces class="cls-X" with fill="#xxx" for faster canvas rasterization.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FRAMES = ['Frame1', 'Frame2', 'Frame3', 'Frame4', 'Frame5'];
const ASSETS_DIR = join(__dirname, '..', 'src', 'assets', 'images');

for (const name of FRAMES) {
  const path = join(ASSETS_DIR, `${name}.svg`);
  let svg = readFileSync(path, 'utf8');

  // Extract class -> fill mapping from style block
  const styleMatch = svg.match(/<style>([^<]+)<\/style>/);
  if (!styleMatch) continue;

  const classToFill = {};
  const ruleRegex = /\.cls-(\d+)\s*\{\s*fill:\s*([^}]+)\s*\}/g;
  let m;
  while ((m = ruleRegex.exec(styleMatch[1])) !== null) {
    classToFill[`cls-${m[1]}`] = m[2].trim();
  }

  // Replace class="cls-X" with fill="..." and remove class
  for (const [cls, fill] of Object.entries(classToFill)) {
    const classRegex = new RegExp(
      `class="${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
      'g'
    );
    svg = svg.replace(classRegex, `fill="${fill}"`);
  }

  // Remove any remaining class="cls-X" (orphaned)
  svg = svg.replace(/\s+class="cls-\d+"/g, '');

  // Remove empty defs/style block
  svg = svg.replace(/<defs><style>[^<]*<\/style><\/defs>/, '');

  writeFileSync(path, svg);
  console.log(`Inlined fills in ${name}.svg`);
}
