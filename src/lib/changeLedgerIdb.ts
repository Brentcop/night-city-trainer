// IndexedDB storage for the change ledger in this browser (src/lib/changeLedgerStore.ts, LedgerStorage). Kept thin on
// purpose, so it can be checked by reading; the store's logic is tested on memoryLedgerStorage().
//
// Database `nct.ledger.v1`, version 1, one object store `batches`: rows { id (auto), base, batch }, where `batch` is a
// CompactBatch (encodeBatch) and `base` its change's base list fingerprint, with an index on `base`. Rows are only
// added, read and cleared, never edited. Ids grow, so reading by id (or by base, then id) is the order they were added.
//
// openLedgerStorage() resolves null when IndexedDB is missing or refuses to open (some private windows): the Lab then
// runs without earlier held-out games and says so.
import type { CompactBatch } from './changeLedger';
import type { LedgerStorage } from './changeLedgerStore';

export const LEDGER_DB = 'nct.ledger.v1';
const STORE = 'batches';
const BY_BASE = 'base';

interface Row {
  id?: number;
  base: string;
  batch: CompactBatch;
}

const result = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });

export async function openLedgerStorage(idb: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB): Promise<LedgerStorage | null> {
  if (!idb) return null;
  let db: IDBDatabase;
  try {
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = idb.open(LEDGER_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }).createIndex(BY_BASE, 'base');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error('IndexedDB would not open'));
      r.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
    });
  } catch {
    return null;
  }
  // another tab upgrading the database: let it (this page then reads and writes nothing more)
  db.onversionchange = () => db.close();
  return {
    async forBase(base) {
      const rows = (await result(db.transaction(STORE, 'readonly').objectStore(STORE).index(BY_BASE).getAll(base))) as Row[];
      return rows.map((r) => r.batch);
    },
    async all() {
      const rows = (await result(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())) as Row[];
      return rows.map((r) => r.batch);
    },
    async add(base, batch) {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({ base, batch } satisfies Row);
      await finished(tx);
    },
    async clear() {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      await finished(tx);
    },
  };
}
