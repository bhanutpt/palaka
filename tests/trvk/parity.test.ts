import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as ort from 'onnxruntime-web/wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { toTelugu } from '../../src/engine';
import { Vocab, targetOf } from '../../src/trvk/tokens';
import { parity, vocabData } from './fixtures/load';

/**
 * The shipped model, run one window at a time exactly as the editor runs it, against what
 * Python's onnxruntime recorded for the same 700 windows.
 *
 * Phase 3 established what "identical" means here: with the same fp32 graph the two runtimes
 * agree at every character, and the int8 graph disagrees at two characters out of ~19,000
 * where the top-two logit margin is under 0.07 — a property of dynamic quantisation, not of
 * the runtime. Neither flip changes a word, so this test asserts decoded Palaka-HK words.
 */

const BUNDLE = 'public/trvk/';
const vocab = new Vocab(vocabData);

let session: ort.InferenceSession;

beforeAll(async () => {
  ort.env.wasm.numThreads = 1;
  ort.env.logLevel = 'error';
  ort.env.wasm.wasmPaths = pathToFileURL(`${BUNDLE}ort/`).href;
  ort.env.wasm.wasmBinary = readFileSync(`${BUNDLE}ort/ort-wasm-simd-threaded.wasm`).buffer as ArrayBuffer;
  session = await ort.InferenceSession.create(new Uint8Array(readFileSync(`${BUNDLE}model.int8.onnx`)));
}, 60_000);

/** One window, the way the worker sends it: no padding, no batch. */
async function run(text: string): Promise<string> {
  const encoded = vocab.encodeText(text);
  const ids = BigInt64Array.from(encoded, (id) => BigInt(id));
  const mask = new Float32Array(encoded.length).fill(1);
  const output = await session.run({
    ids: new ort.Tensor('int64', ids, [1, encoded.length]),
    mask: new ort.Tensor('float32', mask, [1, encoded.length]),
  });
  const logits = output.logits.data as Float32Array;
  const n = vocab.labels.length;
  const row = new Array<number>(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    let best = 0;
    for (let j = 1; j < n; j++) if (logits[i * n + j] > logits[i * n + best]) best = j;
    row[i] = best;
  }
  return targetOf(text, vocab.decodeLabels(row));
}

describe('the shipped model against the Python export', () => {
  let answers: string[] = [];

  beforeAll(async () => {
    answers = [];
    for (const window of parity.windows) answers.push(await run(window.text));
  }, 300_000);

  it('serves the model the fixture was recorded from', () => {
    const manifest = JSON.parse(readFileSync(`${BUNDLE}manifest.json`, 'utf8')) as {
      name: string;
      files: { int8: { sha256: string }; vocab: { sha256: string } };
    };
    expect(manifest.name).toBe(parity.bundle.name);
    expect(manifest.files.int8.sha256).toBe(parity.bundle.int8_sha256);
    expect(manifest.files.vocab.sha256).toBe(parity.bundle.vocab_sha256);
  });

  it('decodes every one of the 700 windows to the Palaka-HK Python decoded', () => {
    const differ = parity.windows
      .map((window, i) => ({ text: window.text, python: window.target, here: answers[i] }))
      .filter((row) => row.python !== row.here);
    expect(differ).toEqual([]);
  });

  it('holds its accuracy floor on the recorded gold spellings', () => {
    // Not an exact-string assertion: a retrained model may differ word by word, and the floor
    // is what the writer actually feels. Phase 3 measured 0.8614 over these windows.
    const right = parity.windows.filter((window, i) => window.gold === answers[i]).length;
    const accuracy = right / parity.windows.length;
    expect(accuracy, `word accuracy ${accuracy.toFixed(4)} over ${parity.windows.length} windows`).toBeGreaterThanOrEqual(0.85);
  });

  it('writes Palaka-HK the engine turns into Telugu, never Telugu itself', () => {
    for (const answer of answers) {
      expect(answer).not.toMatch(/[ఀ-౿]/);
      expect(toTelugu(answer)).not.toMatch(/^\s*$/);
    }
  });
});
