import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentManager, titleOf, type EditorPort } from '../../src/app/documents';
import { DocumentStore, type KeyValueStore } from '../../src/app/storage';

let dbCount = 0;

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function fakeEditor(): EditorPort & { text: string } {
  return {
    text: '',
    getText() {
      return this.text;
    },
    load(text) {
      this.text = text;
    },
  };
}

async function setup(local = memoryStore(), dbName = `palaka-test-${++dbCount}`) {
  const store = new DocumentStore(dbName);
  const editor = fakeEditor();
  const manager = new DocumentManager(store, local, editor);
  await manager.start();
  return { store, local, editor, manager, dbName };
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
afterEach(() => vi.useRealTimers());

describe('titleOf', () => {
  it('uses the name, then the first line with text, then Untitled', () => {
    expect(titleOf({ name: 'notes.txt', text: 'పలక' })).toBe('notes.txt');
    expect(titleOf({ name: '', text: '\n\n  తెలుగు పాఠం  \nrest' })).toBe('తెలుగు పాఠం');
    expect(titleOf({ name: '', text: '   ' })).toBe('Untitled');
  });

  it('shortens a long first line without cutting a syllable apart', () => {
    const title = titleOf({ name: '', text: 'కా'.repeat(60) });
    expect(Array.from(title).length).toBeLessThanOrEqual(41);
    expect(title.endsWith('…')).toBe(true);
    expect(title.slice(0, -1)).toBe('కా'.repeat(20));
  });
});

describe('DocumentStore', () => {
  it('stores, lists newest first, and deletes', async () => {
    const store = new DocumentStore(`palaka-test-${++dbCount}`);
    await store.put({ id: 'a', name: '', text: 'ఒకటి', createdAt: 1, updatedAt: 1 });
    await store.put({ id: 'b', name: '', text: 'రెండు', createdAt: 2, updatedAt: 5 });
    await store.put({ id: 'a', name: '', text: 'ఒకటి!', createdAt: 1, updatedAt: 3 });

    expect((await store.get('a'))?.text).toBe('ఒకటి!');
    expect((await store.list()).map((d) => d.id)).toEqual(['b', 'a']);
    await store.delete('b');
    expect((await store.list()).map((d) => d.id)).toEqual(['a']);
    expect(await store.get('b')).toBeUndefined();
  });
});

describe('DocumentManager', () => {
  it('starts with an empty document and stores nothing until there is text', async () => {
    const { store, manager, editor } = await setup();
    expect(editor.text).toBe('');
    expect(await store.list()).toEqual([]);
    expect(manager.list()).toHaveLength(1);
  });

  it('autosaves after a pause in typing', async () => {
    const { store, manager, editor } = await setup();
    editor.text = 'పలక';
    manager.textChanged();
    expect(manager.saved).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(manager.saved).toBe(true));
    expect((await store.list())[0].text).toBe('పలక');
  });

  it('reopens the last document after a restart', async () => {
    const first = await setup();
    first.editor.text = 'మొదటి';
    first.manager.textChanged();
    await first.manager.flush();
    vi.setSystemTime(Date.now() + 10);
    await first.manager.create();
    first.editor.text = 'రెండవ';
    first.manager.textChanged();
    await first.manager.flush();

    const second = await setup(first.local, first.dbName);
    expect(second.editor.text).toBe('రెండవ');
    expect(second.manager.list().map((d) => d.title)).toEqual(['రెండవ', 'మొదటి']);
  });

  it('recovers text from the draft when the tab closed before the save finished', async () => {
    const first = await setup();
    first.editor.text = 'పాత';
    first.manager.textChanged();
    await first.manager.flush();

    first.editor.text = 'పాత కొత్త';
    first.manager.textChanged();
    vi.setSystemTime(Date.now() + 10);
    first.manager.writeDraft(); // what pagehide does, synchronously

    const second = await setup(first.local, first.dbName);
    expect(second.editor.text).toBe('పాత కొత్త');
    await second.manager.flush();
    expect((await second.store.get(second.manager.currentId))?.text).toBe('పాత కొత్త');
  });

  it('ignores a draft that is older than the stored document', async () => {
    const first = await setup();
    first.editor.text = 'ముసాయిదా';
    first.manager.textChanged();
    first.manager.writeDraft();
    vi.setSystemTime(Date.now() + 10);
    first.editor.text = 'చివరి';
    first.manager.textChanged();
    await first.manager.flush();
    first.local.setItem('palaka.draft', JSON.stringify({ id: first.manager.currentId, text: 'ముసాయిదా', at: 0 }));

    const second = await setup(first.local, first.dbName);
    expect(second.editor.text).toBe('చివరి');
  });

  it('switches between documents and saves the one it leaves', async () => {
    const { manager, editor, store } = await setup();
    editor.text = 'ఒకటి';
    manager.textChanged();
    const firstId = manager.currentId;
    await manager.create();
    expect(editor.text).toBe('');
    editor.text = 'రెండు';
    manager.textChanged();
    await manager.open(firstId);
    expect(editor.text).toBe('ఒకటి');
    expect((await store.list()).map((d) => d.text).sort()).toEqual(['ఒకటి', 'రెండు'].sort());
  });

  it('does not pile up empty documents', async () => {
    const { manager, store } = await setup();
    await manager.create();
    await manager.create();
    expect(manager.list()).toHaveLength(1);
    expect(await store.list()).toEqual([]);
  });

  it('imports a file as a new named document', async () => {
    const { manager, editor } = await setup();
    await manager.importText('lesson.txt', 'పాఠం');
    expect(editor.text).toBe('పాఠం');
    expect(manager.list()[0].title).toBe('lesson.txt');
  });

  it('renames and deletes', async () => {
    const { manager, editor, store } = await setup();
    editor.text = 'ఒకటి';
    manager.textChanged();
    await manager.flush();
    await manager.rename(manager.currentId, 'మొదటిది');
    expect(manager.list()[0].title).toBe('మొదటిది');

    await manager.remove(manager.currentId);
    expect(await store.list()).toEqual([]);
    expect(editor.text).toBe('');
    expect(manager.list()).toHaveLength(1);
  });

  it('tells its listener when the list or the saved state changes', async () => {
    const { manager, editor } = await setup();
    const seen = vi.fn();
    manager.onChange = seen;
    editor.text = 'పలక';
    manager.textChanged();
    await manager.flush();
    expect(seen).toHaveBeenCalled();
  });
});
