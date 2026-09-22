/**
 * TRVK mode's model, seen from the app: a worker that is not started until the writer asks
 * for the mode, a state anyone can show, and one window per request.
 *
 * The model reads loose roman (TRVK) and writes Palaka-HK. It never writes Telugu: the
 * engine does that, exactly as it does for every key typed by hand. Nothing here is loaded,
 * fetched or evaluated until `load()` is called, and nothing is fetched from another origin.
 */

import type { FromWorker, ToWorker } from './protocol';
import { cutWindow, type WindowOptions } from './windowing';

export type ModelState = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface ModelInfo {
  /** How long the load took, in milliseconds. */
  ms: number;
  modelBytes: number;
  nLabels: number;
  maxLen: number;
  ortVersion: string;
  threads: number;
}

export interface TrvkOptions {
  /** Folder the model files are served from, relative to the page. */
  base?: string;
  /** Makes the worker. The default one is only reached in a browser; tests pass their own. */
  createWorker?: () => Worker;
  onState?: (state: ModelState, error?: string) => void;
  /** Bytes of the runtime and the model that have arrived, while the state is `loading`. */
  onProgress?: (loaded: number, total: number) => void;
}

interface Pending {
  resolve: (targets: string[]) => void;
  reject: (error: Error) => void;
}

const defaultWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export class TrvkModel {
  state: ModelState = 'idle';
  info: ModelInfo | null = null;
  error: string | null = null;

  private readonly base: string;
  private readonly options: TrvkOptions;
  private worker: Worker | null = null;
  private loading: Promise<boolean> | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(options: TrvkOptions = {}) {
    this.options = options;
    this.base = options.base ?? 'trvk/';
  }

  /**
   * Downloads the runtime and the model and opens the session. Resolves false instead of
   * throwing when that cannot be done: the mode reports itself unavailable and the app is
   * exactly as it was. One load per model, however often it is called.
   */
  load(): Promise<boolean> {
    if (this.state === 'ready') return Promise.resolve(true);
    if (this.state === 'unavailable') return Promise.resolve(false);
    if (this.loading) return this.loading;

    this.setState('loading');
    this.loading = new Promise<boolean>((resolve) => {
      let worker: Worker;
      try {
        worker = (this.options.createWorker ?? defaultWorker)();
      } catch (error) {
        this.fail(error instanceof Error ? error.message : String(error));
        resolve(false);
        return;
      }
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<FromWorker>) => this.receive(event.data);
      worker.onerror = (event) => {
        const message = (event as unknown as { message?: string }).message ?? 'the model worker failed';
        this.failAll(message);
        this.fail(message);
        resolve(false);
      };

      const id = this.nextId++;
      this.pending.set(id, {
        resolve: () => resolve(true),
        reject: (error) => {
          this.fail(error.message);
          resolve(false);
        },
      });
      this.send({
        type: 'load',
        id,
        model: `${this.base}model.int8.onnx`,
        vocab: `${this.base}vocab.json`,
        wasmPaths: `${this.base}ort/`,
        wasmBinary: `${this.base}ort/ort-wasm-simd-threaded.wasm`,
      });
    });
    return this.loading;
  }

  /** Palaka-HK for the marked word of one window text. */
  async correct(text: string): Promise<string> {
    if (this.state !== 'ready' || !this.worker) throw new Error('the TRVK model is not ready');
    const targets = await this.request(text);
    return targets[0] ?? '';
  }

  /** Palaka-HK for word `k` of a loose sentence, with the window cut around it. */
  correctWord(words: readonly string[], k: number, options?: WindowOptions): Promise<string> {
    return this.correct(cutWindow(words, k, options).text);
  }

  /** Stops the worker and frees its memory; the mode can be switched on again later. */
  terminate(): void {
    this.failAll('the TRVK model was switched off');
    this.worker?.terminate();
    this.worker = null;
    this.loading = null;
    this.info = null;
    this.error = null;
    this.setState('idle');
  }

  private request(text: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      // One window per request: batching is slower per window and changes int8 answers.
      this.send({ type: 'correct', id, texts: [text] });
    });
  }

  private send(message: ToWorker): void {
    this.worker?.postMessage(message);
  }

  private receive(message: FromWorker): void {
    if (message.type === 'progress') {
      this.options.onProgress?.(message.loaded, message.total);
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);

    if (message.type === 'error') {
      pending.reject(new Error(message.message));
    } else if (message.type === 'ready') {
      const { type, id, ...info } = message;
      void type;
      void id;
      this.info = info;
      this.error = null;
      this.setState('ready');
      pending.resolve([]);
    } else {
      pending.resolve(message.targets);
    }
  }

  private failAll(message: string): void {
    for (const [, pending] of this.pending) pending.reject(new Error(message));
    this.pending.clear();
  }

  private fail(message: string): void {
    this.error = message;
    this.setState('unavailable');
  }

  private setState(state: ModelState): void {
    if (this.state === state) return;
    this.state = state;
    this.options.onState?.(state, this.error ?? undefined);
  }
}
