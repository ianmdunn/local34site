#!/usr/bin/env node

/**
 * Deploy pipeline with real-time progress feedback.
 * Runs each step with clear headers, elapsed time, and streams all output.
 *
 * Usage: node scripts/deploy-with-progress.js
 */

import { spawn } from 'child_process';
import { stdin, stdout, stderr } from 'process';

const STEPS = [
  { name: 'Checking GCS setup', cmd: 'npm', args: ['run', 'check:gcs'] },
  { name: 'Uploading public assets to GCS', cmd: 'npm', args: ['run', 'upload:assets'], env: { ALLOW_PRIVATE_UPLOADS: 'true' } },
  { name: 'Optimizing Directus images', cmd: 'npm', args: ['run', 'optimize:directus-images'] },
  { name: 'Building site (Astro)', cmd: 'npm', args: ['run', 'build'] },
  { name: 'Uploading optimized _astro images to GCS', cmd: 'npm', args: ['run', 'upload:optimized'] },
  { name: 'Cleaning dist for deploy', cmd: 'npm', args: ['run', 'cleanup:dist'] },
  { name: 'Pushing dist to live site (FTP)', cmd: 'npm', args: ['run', 'push:ftp'] },
];

function fmt(t) {
  return t >= 1000 ? `${(t / 1000).toFixed(1)}s` : `${t}ms`;
}

function runStep(step, index) {
  return new Promise((resolve, reject) => {
    const total = STEPS.length;
    const label = `[${index + 1}/${total}]`;
    const start = Date.now();

    stdout.write(`\n${'─'.repeat(60)}\n`);
    stdout.write(`${label} ${step.name} …\n`);
    stdout.write(`${'─'.repeat(60)}\n\n`);

    const child = spawn(step.cmd, step.args, {
      stdio: 'inherit',
      env: { ...process.env, ...step.env },
      shell: true,
    });

    child.on('error', (err) => reject(err));
    child.on('exit', (code) => {
      const elapsed = Date.now() - start;
      if (code === 0) {
        stdout.write(`\n✓ ${step.name} — ${fmt(elapsed)}\n`);
        resolve();
      } else {
        reject(new Error(`${step.name} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const start = Date.now();
  stdout.write('\n🚀 Deploy pipeline starting…\n');

  try {
    for (let i = 0; i < STEPS.length; i++) {
      await runStep(STEPS[i], i);
    }
    const total = Date.now() - start;
    stdout.write(`\n${'═'.repeat(60)}\n`);
    stdout.write(`✓ Deploy complete — ${fmt(total)} total\n`);
    stdout.write(`${'═'.repeat(60)}\n\n`);
  } catch (err) {
    stderr.write(`\n✗ Deploy failed: ${err.message}\n`);
    process.exit(1);
  }
}

main();
