// scripts/size.mjs
import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BUDGET_BYTES = 25 * 1024; // 25 KB gzip, per spec §8
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundlePath = join(root, 'dist', 'index.global.js');

let raw;
try {
  raw = readFileSync(bundlePath);
} catch {
  console.error(`size: bundle not found at ${bundlePath} — run \`tsup\` first`);
  process.exit(1);
}

const rawBytes = statSync(bundlePath).size;
const gzipBytes = gzipSync(raw, { level: 9 }).length;
const pct = ((gzipBytes / BUDGET_BYTES) * 100).toFixed(1);

console.log(
  `size: ${bundlePath}\n` +
    `  raw   ${(rawBytes / 1024).toFixed(2)} KB\n` +
    `  gzip  ${(gzipBytes / 1024).toFixed(2)} KB / ${(BUDGET_BYTES / 1024).toFixed(0)} KB budget (${pct}%)`
);

if (gzipBytes > BUDGET_BYTES) {
  console.error(
    `size: FAIL — gzip ${(gzipBytes / 1024).toFixed(2)} KB exceeds ${(BUDGET_BYTES / 1024).toFixed(0)} KB budget`
  );
  process.exit(1);
}
console.log('size: PASS');
