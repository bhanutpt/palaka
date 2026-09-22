// Copies the ONNX Runtime Web files TRVK mode needs out of node_modules into
// public/trvk/ort/, so that nothing is ever fetched from a CDN: the app makes no request to
// another origin, and the Playwright tests assert it.
//
// The model itself (public/trvk/model.int8.onnx and its vocabulary) is committed; only these
// three runtime files are copied, because they belong to the installed package and change
// with it. public/trvk/ort/ is gitignored.
//
// Usage: npm run trvk:runtime   (run by dev and build)

import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'node_modules', 'onnxruntime-web', 'dist');
const out = path.join(root, 'public', 'trvk', 'ort');

// The WASM-only build: the small ESM entry, the emscripten glue it loads at runtime from
// `wasmPaths`, and the wasm binary. No WebGPU, no WebGL. ORT 1.23 ships only the threaded
// binary, which runs single-threaded when numThreads is 1 — GitHub Pages sends no
// cross-origin isolation headers, so threads are not available anyway.
const FILES = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];

mkdirSync(out, { recursive: true });
const rows: { file: string; bytes: number; gzip: number }[] = [];
for (const name of FILES) {
  const source = path.join(dist, name);
  copyFileSync(source, path.join(out, name));
  const bytes = readFileSync(source);
  rows.push({ file: name, bytes: statSync(source).size, gzip: gzipSync(bytes, { level: 9 }).length });
}

const { version } = JSON.parse(readFileSync(path.join(root, 'node_modules', 'onnxruntime-web', 'package.json'), 'utf8'));
const mb = (n: number) => (n / 1e6).toFixed(2) + ' MB';
console.log(`onnxruntime-web ${version} -> ${path.relative(root, out)}`);
for (const row of rows) console.log(`  ${row.file.padEnd(30)} ${mb(row.bytes).padStart(9)}  gzip ${mb(row.gzip)}`);
