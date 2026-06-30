import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '..', 'dist', 'index.global.js');
const LIMIT = 25600; // 25KB gzip budget

const gzipped = gzipSync(readFileSync(target)).length;
console.log(`gzip(${target}) = ${gzipped} bytes (limit ${LIMIT})`);
if (gzipped > LIMIT) {
  console.error(`FAIL: bundle ${gzipped} bytes exceeds ${LIMIT} bytes gzip budget`);
  process.exit(1);
}
console.log('OK: within budget');
