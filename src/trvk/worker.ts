/// <reference lib="webworker" />
/**
 * The TRVK inference worker: one ONNX Runtime Web session (WASM, self-hosted, single thread),
 * the tokenisation, the argmax over the logits and the label decode back to Palaka-HK.
 *
 * It runs off the typing thread, which is what keeps Palaka inside its frame budget. It sends
 * back Palaka-HK and nothing else; the engine in the editor turns that into Telugu.
 *
 * One window per request. Phase 3 measured that batching windows is both slower per window
 * and enough to change int8 answers, because every row is padded to the longest one.
 */

import * as ort from 'onnxruntime-web/wasm';
import type { CorrectRequest, FromWorker, LoadRequest, ReadyReply, ToWorker } from './protocol';
import { Vocab, targetOf, type VocabData } from './tokens';

const scope = self as unknown as DedicatedWorkerGlobalScope;

let session: ort.InferenceSession | null = null;
let vocab: Vocab | null = null;
let nLabels = 0;

const post = (message: FromWorker) => scope.postMessage(message);

/**
 * Fetches a file, reporting how much of it has arrived. The wasm binary is 11.8 MB and the
 * model 1.9 MB, which is several seconds on a phone: the first switch-on has to show it.
 */
async function fetchWithProgress(
  url: string,
  id: number,
  state: { loaded: number; total: number },
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);

  const length = Number(response.headers.get('content-length') ?? 0);
  state.total += length;
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    state.loaded += value.byteLength;
    post({ type: 'progress', id, loaded: state.loaded, total: Math.max(state.total, state.loaded) });
  }

  const bytes = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

async function load(request: LoadRequest): Promise<Omit<ReadyReply, 'type' | 'id'>> {
  const started = performance.now();
  ort.env.wasm.wasmPaths = request.wasmPaths;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false; // already in a worker
  ort.env.logLevel = 'error';

  const vocabResponse = await fetch(request.vocab);
  if (!vocabResponse.ok) throw new Error(`${request.vocab}: ${vocabResponse.status}`);
  vocab = new Vocab((await vocabResponse.json()) as VocabData);
  nLabels = vocab.labels.length;

  // The runtime and the model come down through our own fetch so that their progress can be
  // shown; ORT is handed the binary rather than fetching it a second time.
  const state = { loaded: 0, total: 0 };
  const wasmBinary = await fetchWithProgress(request.wasmBinary, request.id, state);
  ort.env.wasm.wasmBinary = wasmBinary.buffer as ArrayBuffer;
  const model = await fetchWithProgress(request.model, request.id, state);

  session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  return {
    ms: performance.now() - started,
    modelBytes: model.byteLength,
    nLabels,
    maxLen: vocab.maxLen,
    ortVersion: ort.env.versions?.common ?? 'unknown',
    threads: ort.env.wasm.numThreads ?? 1,
  };
}

/** Argmax of one row of the [batch, length, nLabels] logits. */
function argmaxRow(data: ArrayLike<number>, offset: number, n: number): number {
  let best = 0;
  let bestValue = data[offset];
  for (let j = 1; j < n; j++) {
    const value = data[offset + j];
    if (value > bestValue) {
      bestValue = value;
      best = j;
    }
  }
  return best;
}

async function correct(texts: string[]): Promise<string[]> {
  if (!session || !vocab) throw new Error('the model is not loaded');
  const encoded = texts.map((text) => vocab!.encodeText(text));
  const lengths = encoded.map((row) => row.length);
  const width = Math.max(1, ...lengths);
  const batch = texts.length;

  const ids = new BigInt64Array(batch * width);
  const mask = new Float32Array(batch * width);
  for (let i = 0; i < batch; i++) {
    for (let j = 0; j < lengths[i]; j++) {
      ids[i * width + j] = BigInt(encoded[i][j]);
      mask[i * width + j] = 1;
    }
  }

  const output = await session.run({
    ids: new ort.Tensor('int64', ids, [batch, width]),
    mask: new ort.Tensor('float32', mask, [batch, width]),
  });
  const logits = output.logits.data as Float32Array;

  return texts.map((text, i) => {
    const row = new Array<number>(lengths[i]);
    for (let j = 0; j < lengths[i]; j++) row[j] = argmaxRow(logits, (i * width + j) * nLabels, nLabels);
    return targetOf(text, vocab!.decodeLabels(row));
  });
}

scope.onmessage = async (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  try {
    if (message.type === 'load') {
      post({ type: 'ready', id: message.id, ...(await load(message)) });
    } else {
      const started = performance.now();
      const targets = await correct((message as CorrectRequest).texts);
      post({ type: 'result', id: message.id, targets, ms: performance.now() - started });
    }
  } catch (error) {
    post({ type: 'error', id: message.id, message: error instanceof Error ? error.message : String(error) });
  }
};
