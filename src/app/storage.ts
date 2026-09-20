/** Browser storage: IndexedDB for documents, a localStorage-like store for settings and the crash draft. */

export interface StoredDocument {
  id: string;
  /** Set when the document came from a file or was renamed; otherwise the title is its first line. */
  name: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

/** The part of localStorage the app uses; tests pass a Map-backed one. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORE = 'documents';

/** Most recently edited first; ties fall back to creation time and id so that the order never flickers. */
export const newestFirst = (a: StoredDocument, b: StoredDocument) =>
  b.updatedAt - a.updatedAt || b.createdAt - a.createdAt || a.id.localeCompare(b.id);

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class DocumentStore {
  private db: Promise<IDBDatabase> | undefined;
  private readonly name: string;

  constructor(name = 'palaka') {
    this.name = name;
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async get(id: string): Promise<StoredDocument | undefined> {
    return done<StoredDocument | undefined>((await this.store('readonly')).get(id));
  }

  /** All documents, most recently edited first. */
  async list(): Promise<StoredDocument[]> {
    const all = await done<StoredDocument[]>((await this.store('readonly')).getAll());
    return all.sort(newestFirst);
  }

  async put(document: StoredDocument): Promise<void> {
    await done((await this.store('readwrite')).put(document));
  }

  async delete(id: string): Promise<void> {
    await done((await this.store('readwrite')).delete(id));
  }
}
