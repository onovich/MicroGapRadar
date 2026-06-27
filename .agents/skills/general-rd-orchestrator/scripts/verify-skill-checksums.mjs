#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const checksumsPath = resolve(root, 'CHECKSUMS.sha256');
if (!existsSync(checksumsPath)) {
  console.error('CHECKSUMS.sha256 not found at Skill root');
  process.exit(1);
}

const lines = readFileSync(checksumsPath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

let failures = 0;
for (const line of lines) {
  const match = line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
  if (!match) {
    console.error(`Invalid checksum line: ${line}`);
    failures++;
    continue;
  }
  const [, expected, rel] = match;
  const filePath = resolve(root, rel);
  const backRel = relative(root, filePath);
  if (backRel.startsWith('..') || backRel === '' || backRel.split(sep).includes('..')) {
    console.error(`Unsafe checksum path: ${rel}`);
    failures++;
    continue;
  }
  if (!existsSync(filePath)) {
    console.error(`Missing file: ${rel}`);
    failures++;
    continue;
  }
  const actual = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    console.error(`Checksum mismatch: ${rel}`);
    console.error(`  expected ${expected}`);
    console.error(`  actual   ${actual}`);
    failures++;
  }
}

if (failures) {
  console.error(`Skill checksum verification failed: ${failures} error(s)`);
  process.exit(1);
}
console.log(`Skill checksum verification OK: ${lines.length} file(s)`);
