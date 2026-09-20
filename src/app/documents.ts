import { syllableBefore } from '../editor/inspect';
import { newestFirst, type DocumentStore, type KeyValueStore, type StoredDocument } from './storage';

/** What the document manager needs from the editor. */
export interface EditorPort {
  getText(): string;
  /** Replaces the whole text and starts a fresh undo history. */
  load(text: string): void;
}

export interface DocumentInfo {
  id: string;
  title: string;
  updatedAt: number;
  current: boolean;
}

const CURRENT_KEY = 'palaka.current';
const DRAFT_KEY = 'palaka.draft';
const AUTOSAVE_DELAY_MS = 600;
const TITLE_LENGTH = 40;

interface Draft {
  id: string;
  name: string;
  text: string;
  at: number;
}

/** The name if there is one, else the first line with text, else Untitled. */
export function titleOf(document: Pick<StoredDocument, 'name' | 'text'>): string {
  if (document.name.trim()) return document.name.trim();
  const line = document.text.split('\n').find((l) => l.trim())?.trim() ?? '';
  if (!line) return 'Untitled';

  const points = Array.from(line);
  if (points.length <= TITLE_LENGTH) return line;
  let cut = points.slice(0, TITLE_LENGTH).join('').length;
  // Do not leave half a syllable at the end.
  const last = syllableBefore(line, cut);
  if (last && last.to > cut) cut = last.from;
  return line.slice(0, cut).trimEnd() + '…';
}

/**
 * Keeps the list of documents, autosaves the open one, and restores it after a restart.
 *
 * Saving to IndexedDB is asynchronous and may not finish when a tab closes, so `writeDraft`
 * also puts the open text into the synchronous key-value store; `start` picks a newer draft up.
 * An empty, unnamed document is never stored.
 */
export class DocumentManager {
  onChange: (() => void) | undefined;
  saved = true;

  private readonly store: DocumentStore;
  private readonly local: KeyValueStore;
  private readonly editor: EditorPort;
  private documents: StoredDocument[] = [];
  private current: StoredDocument;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> = Promise.resolve();
  /** Names as last written, to tell a rename from no change. */
  private readonly storedName = new Map<string, string>();

  constructor(store: DocumentStore, local: KeyValueStore, editor: EditorPort) {
    this.store = store;
    this.local = local;
    this.editor = editor;
    this.current = this.blank();
  }

  get currentId(): string {
    return this.current.id;
  }

  get currentTitle(): string {
    return titleOf({ name: this.current.name, text: this.editor.getText() });
  }

  async start(): Promise<void> {
    this.documents = await this.store.list();
    for (const d of this.documents) this.storedName.set(d.id, d.name);
    const wanted = this.local.getItem(CURRENT_KEY);
    this.current = this.documents.find((d) => d.id === wanted) ?? this.documents[0] ?? this.current;

    const draft = this.readDraft();
    const known = draft && this.documents.find((d) => d.id === draft.id);
    if (draft && draft.at > (known?.updatedAt ?? -1)) {
      this.current = known ?? { ...this.blank(), id: draft.id, name: draft.name };
      this.editor.load(draft.text);
      await this.persist();
    } else {
      this.editor.load(this.current.text);
    }
    this.local.removeItem(DRAFT_KEY);
    this.remember();
    this.onChange?.();
  }

  /** Stored documents, newest first, with the open one included even while it is still empty. */
  list(): DocumentInfo[] {
    const all = this.documents.includes(this.current) ? this.documents : [this.current, ...this.documents];
    return all.map((d) => ({
      id: d.id,
      title: d === this.current ? this.currentTitle : titleOf(d),
      updatedAt: d.updatedAt,
      current: d === this.current,
    }));
  }

  /** Call on every edit. */
  textChanged(): void {
    this.saved = false;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_DELAY_MS);
    this.onChange?.();
  }

  /** Saves now; resolves when the text is in IndexedDB. */
  flush(): Promise<void> {
    clearTimeout(this.timer);
    this.saving = this.saving.then(() => this.persist());
    return this.saving;
  }

  /** Synchronous safety net for pagehide. */
  writeDraft(): void {
    if (this.saved) return;
    const draft: Draft = { id: this.current.id, name: this.current.name, text: this.editor.getText(), at: Date.now() };
    try {
      this.local.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage full or blocked: the IndexedDB save that pagehide also starts is the only chance left.
    }
  }

  async create(): Promise<void> {
    await this.flush();
    if (this.isStorable(this.current)) this.switchTo(this.blank());
  }

  async open(id: string): Promise<void> {
    if (id === this.current.id) return;
    await this.flush();
    const next = this.documents.find((d) => d.id === id);
    if (next) this.switchTo(next);
  }

  async importText(name: string, text: string): Promise<void> {
    await this.flush();
    this.switchTo({ ...this.blank(), name });
    this.editor.load(text);
    await this.flush();
  }

  async rename(id: string, name: string): Promise<void> {
    await this.flush();
    const document = this.documents.find((d) => d.id === id) ?? (id === this.current.id ? this.current : undefined);
    if (!document) return;
    document.name = name.trim();
    if (document === this.current) await this.persist();
    else await this.store.put(document);
    this.onChange?.();
  }

  async remove(id: string): Promise<void> {
    clearTimeout(this.timer);
    await this.saving;
    await this.store.delete(id);
    this.documents = this.documents.filter((d) => d.id !== id);
    if (id === this.current.id) this.switchTo(this.documents[0] ?? this.blank());
    this.onChange?.();
  }

  private blank(): StoredDocument {
    const now = Date.now();
    return { id: crypto.randomUUID(), name: '', text: '', createdAt: now, updatedAt: now };
  }

  private isStorable(document: StoredDocument): boolean {
    return document.text !== '' || document.name !== '';
  }

  private switchTo(document: StoredDocument): void {
    this.current = document;
    this.saved = true;
    this.editor.load(document.text);
    this.remember();
    this.onChange?.();
  }

  private remember(): void {
    this.local.setItem(CURRENT_KEY, this.current.id);
  }

  private readDraft(): Draft | null {
    try {
      const draft = JSON.parse(this.local.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
      return draft && typeof draft.id === 'string' && typeof draft.text === 'string' ? draft : null;
    } catch {
      return null;
    }
  }

  /** Writes the open document if it differs from what is stored. */
  private async persist(): Promise<void> {
    const document = this.current;
    const text = this.editor.getText();
    const known = this.documents.includes(document);
    const changed = text !== document.text || document.name !== this.storedName.get(document.id);
    if (text !== document.text) {
      document.text = text;
      document.updatedAt = Date.now();
    }

    if (known && !changed) {
      // Nothing new: no need to write.
    } else if (this.isStorable(document)) {
      await this.store.put(document);
      this.storedName.set(document.id, document.name);
      if (!known) this.documents.push(document);
      this.documents.sort(newestFirst);
    } else if (known) {
      // Emptied and unnamed: it no longer needs a place in the list.
      await this.store.delete(document.id);
      this.documents = this.documents.filter((d) => d !== document);
    }

    if (document === this.current && this.editor.getText() === text) {
      this.saved = true;
      this.local.removeItem(DRAFT_KEY);
    }
    this.onChange?.();
  }
}
