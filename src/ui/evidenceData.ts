// The evidence files (public/data/evidence/, docs/EVIDENCE.md), fetched at runtime by the evidence page and the deck
// profile's evidence panel: the index on the overview (and beside a deck's page, for opponent names and the tools'
// record), a deck's file on its page, its runs file only when its runs are opened, and the short-id lookup only for a
// pasted cite id. One cached promise per file; never imported by the entry chunk (tests/evidence-ui.test.tsx).
import { useEffect, useState } from 'react';
import { EVIDENCE_IDS_KIND, EVIDENCE_INDEX_KIND, EVIDENCE_KIND, EVIDENCE_RUNS_KIND, EVIDENCE_SCHEMA, type DeckEvidence, type DeckRuns, type EvidenceIds, type EvidenceIndex } from '../lib/findings';
import { isListId } from '../lib/evidenceView';

/**
 * - missing: no usable file (not there, the connection failed, or not an evidence file)
 * - newer:   an evidence file of a schema this copy of the site does not know
 */
export type Loaded<T> = { state: 'loading' } | { state: 'missing' } | { state: 'newer' } | { state: 'ready'; data: T };

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** What a fetched file holds: its `kind` must match, a newer `schema` is told apart, and the fields the page reads must be there. */
function readAs<T>(j: unknown, kind: string, ok: (o: Record<string, unknown>) => boolean): Loaded<T> {
  if (!isObj(j) || j.kind !== kind || typeof j.schema !== 'number') return { state: 'missing' };
  if (j.schema > EVIDENCE_SCHEMA) return { state: 'newer' };
  if (j.schema !== EVIDENCE_SCHEMA || !ok(j)) return { state: 'missing' };
  return { state: 'ready', data: j as T };
}

export const readIndex = (j: unknown): Loaded<EvidenceIndex> =>
  readAs(j, EVIDENCE_INDEX_KIND, (o) => typeof o.simVersion === 'number' && Array.isArray(o.decks) && Array.isArray(o.top) && Array.isArray(o.health) && Array.isArray(o.gaps) && isObj(o.rules));
export const readDeck = (j: unknown): Loaded<DeckEvidence> =>
  readAs(j, EVIDENCE_KIND, (o) => typeof o.listId === 'string' && typeof o.deck === 'string' && Array.isArray(o.findings) && Array.isArray(o.open) && Array.isArray(o.gaps));
export const readRuns = (j: unknown): Loaded<DeckRuns> => readAs(j, EVIDENCE_RUNS_KIND, (o) => typeof o.listId === 'string' && Array.isArray(o.runs));
export const readIds = (j: unknown): Loaded<EvidenceIds> => readAs(j, EVIDENCE_IDS_KIND, (o) => isObj(o.decks));

const cache = new Map<string, Promise<Loaded<unknown>>>();

function load<T>(rel: string, read: (j: unknown) => Loaded<T>): Promise<Loaded<T>> {
  let p = cache.get(rel) as Promise<Loaded<T>> | undefined;
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${rel}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(read)
      .catch((): Loaded<T> => ({ state: 'missing' }));
    cache.set(rel, p);
  }
  return p;
}

const MISSING = Promise.resolve({ state: 'missing' } as const);

export const loadEvidenceIndex = (): Promise<Loaded<EvidenceIndex>> => load('evidence/index.json', readIndex);
export const loadDeckEvidence = (listId: string): Promise<Loaded<DeckEvidence>> => (isListId(listId) ? load(`evidence/${listId}.json`, readDeck) : MISSING);
export const loadDeckRuns = (listId: string): Promise<Loaded<DeckRuns>> => (isListId(listId) ? load(`evidence/${listId}.runs.json`, readRuns) : MISSING);
export const loadEvidenceIds = (): Promise<Loaded<EvidenceIds>> => load('evidence/ids.json', readIds);

/** Forget the fetched files (tests). */
export const clearEvidenceCache = (): void => cache.clear();

/** A file, fetched the first time `key` is set (null: nothing yet); a new key starts from 'loading' again. */
function useLoaded<T>(key: string | null, get: (key: string) => Promise<Loaded<T>>): Loaded<T> {
  const [got, setGot] = useState<{ key: string; loaded: Loaded<T> } | null>(null);
  useEffect(() => {
    if (key === null) return;
    let live = true;
    void get(key).then((loaded) => live && setGot({ key, loaded }));
    return () => {
      live = false;
    };
  }, [key, get]);
  return got && got.key === key ? got.loaded : { state: 'loading' };
}

/** The index (`enabled` false: not fetched yet). */
export const useEvidenceIndex = (enabled = true): Loaded<EvidenceIndex> => useLoaded(enabled ? 'index' : null, loadEvidenceIndex);
export const useDeckEvidence = (listId: string | null): Loaded<DeckEvidence> => useLoaded(listId, loadDeckEvidence);
/** A deck's runs, fetched only once `listId` is given (its runs are opened). */
export const useDeckRuns = (listId: string | null): Loaded<DeckRuns> => useLoaded(listId, loadDeckRuns);
