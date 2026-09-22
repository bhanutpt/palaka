import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrvkModel } from '../../src/trvk';
import type { FromWorker, ToWorker } from '../../src/trvk/protocol';

/** A reply with its id left to the fake worker; distributed so each member keeps its shape. */
type Reply<T = FromWorker> = T extends { id: number } ? Omit<T, 'id'> & { id?: number } : never;

/** A worker that never runs ONNX: the test decides what comes back, and when. */
class FakeWorker {
  sent: ToWorker[] = [];
  onmessage: ((event: { data: FromWorker }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  terminated = false;

  postMessage(message: ToWorker): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Replies to the request that is waiting, as the real worker would. */
  reply(message: Reply): void {
    const id = message.id ?? this.sent[this.sent.length - 1].id;
    this.onmessage?.({ data: { ...message, id } as FromWorker });
  }

  ready(): void {
    this.reply({ type: 'ready', ms: 200, modelBytes: 1954562, nLabels: 220, maxLen: 96, ortVersion: '1.23.0', threads: 1 });
  }
}

const READY_INFO = { nLabels: 220, maxLen: 96, ortVersion: '1.23.0' };

let worker: FakeWorker;
const model = (onState?: (state: string) => void) =>
  new TrvkModel({
    base: 'trvk/',
    createWorker: () => worker as unknown as Worker,
    onState: onState as never,
  });

beforeEach(() => {
  worker = new FakeWorker();
});

describe('loading the model', () => {
  it('starts idle and downloads nothing until it is asked to', () => {
    const trvk = model();
    expect(trvk.state).toBe('idle');
    expect(worker.sent).toEqual([]);
  });

  it('tells the worker where the files are and becomes ready', async () => {
    const trvk = model();
    const loading = trvk.load();
    expect(trvk.state).toBe('loading');
    const sent = worker.sent[0];
    expect(sent.type).toBe('load');
    expect(sent).toMatchObject({ model: 'trvk/model.int8.onnx', vocab: 'trvk/vocab.json', wasmPaths: 'trvk/ort/' });

    worker.ready();
    expect(await loading).toBe(true);
    expect(trvk.state).toBe('ready');
    expect(trvk.info).toMatchObject(READY_INFO);
  });

  it('reports every state change, so the toggle can show the download', async () => {
    const states: string[] = [];
    const trvk = model((state) => states.push(state));
    const loading = trvk.load();
    worker.ready();
    await loading;
    expect(states).toEqual(['loading', 'ready']);
  });

  it('reports download progress while the files come down', async () => {
    const seen: number[] = [];
    const trvk = new TrvkModel({
      base: 'trvk/',
      createWorker: () => worker as unknown as Worker,
      onProgress: (loaded, total) => seen.push(Math.round((loaded / total) * 100)),
    });
    const loading = trvk.load();
    worker.reply({ type: 'progress', loaded: 7_000_000, total: 14_000_000 });
    worker.ready();
    await loading;
    expect(seen).toEqual([50]);
  });

  it('loads once however often it is asked', async () => {
    const trvk = model();
    const first = trvk.load();
    const second = trvk.load();
    worker.ready();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(await trvk.load()).toBe(true);
    expect(worker.sent.filter((message) => message.type === 'load')).toHaveLength(1);
  });
});

describe('when the model cannot be loaded', () => {
  it('becomes unavailable instead of throwing, and says why', async () => {
    const states: string[] = [];
    const trvk = model((state) => states.push(state));
    const loading = trvk.load();
    worker.reply({ type: 'error', message: 'WebAssembly is not supported' });
    expect(await loading).toBe(false);
    expect(trvk.state).toBe('unavailable');
    expect(trvk.error).toMatch(/WebAssembly/);
    expect(states).toEqual(['loading', 'unavailable']);
  });

  it('becomes unavailable when the worker itself fails', async () => {
    const trvk = model();
    const loading = trvk.load();
    worker.onerror?.({ message: 'worker blocked' });
    expect(await loading).toBe(false);
    expect(trvk.state).toBe('unavailable');
  });

  it('stays unavailable rather than trying again on every keystroke', async () => {
    const trvk = model();
    const loading = trvk.load();
    worker.reply({ type: 'error', message: 'no' });
    await loading;
    expect(await trvk.load()).toBe(false);
    expect(worker.sent.filter((message) => message.type === 'load')).toHaveLength(1);
  });
});

describe('correcting a window', () => {
  const ready = async () => {
    const trvk = model();
    const loading = trvk.load();
    worker.ready();
    await loading;
    return trvk;
  };

  it('sends one window per request, as the int8 graph needs', async () => {
    const trvk = await ready();
    const pending = trvk.correct('nenu eeroju');
    expect(worker.sent[1]).toMatchObject({ type: 'correct', texts: ['nenu eeroju'] });

    worker.reply({ type: 'result', targets: ['nEnu'], ms: 3 });
    expect(await pending).toBe('nEnu');
  });

  it('keeps requests apart, so a slow reply lands on its own request', async () => {
    const trvk = await ready();
    const first = trvk.correct('nenu');
    const second = trvk.correct('intiki');
    const [firstId, secondId] = worker.sent.slice(1).map((message) => message.id);

    worker.reply({ type: 'result', id: secondId, targets: ['iMTiki'], ms: 3 });
    worker.reply({ type: 'result', id: firstId, targets: ['nEnu'], ms: 3 });
    expect(await first).toBe('nEnu');
    expect(await second).toBe('iMTiki');
  });

  it('ignores a reply that belongs to no request', async () => {
    await ready();
    expect(() => worker.reply({ type: 'result', id: 9999, targets: ['x'], ms: 1 })).not.toThrow();
  });

  it('refuses to correct before the model is ready', async () => {
    const trvk = model();
    await expect(trvk.correct('nenu')).rejects.toThrow(/not ready/i);
  });

  it('rejects a request the model failed on', async () => {
    const trvk = await ready();
    const pending = trvk.correct('nenu');
    worker.reply({ type: 'error', message: 'session gone' });
    await expect(pending).rejects.toThrow(/session gone/);
  });

  it('gives up its worker when the mode is switched off', async () => {
    const trvk = await ready();
    const pending = trvk.correct('nenu');
    trvk.terminate();
    expect(worker.terminated).toBe(true);
    expect(trvk.state).toBe('idle');
    await expect(pending).rejects.toThrow();
  });
});

describe('the window it builds for a word', () => {
  it('marks the word and carries the context around it', async () => {
    const trvk = model();
    const loading = trvk.load();
    worker.ready();
    await loading;
    const send = vi.spyOn(worker, 'postMessage');
    void trvk.correctWord(['nenu', 'eeroju', 'intiki'], 1);
    expect((send.mock.calls[0][0] as { texts: string[] }).texts[0]).toBe('nenu eeroju intiki');
  });
});
