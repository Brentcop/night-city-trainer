import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { aggregateManifest, createRunManifest, gameRunManifest, manifestDeck, runDetailsLine, type RecordedEventInput } from '../src/lib/runManifest';
import { deckFingerprint } from '../src/engine/deck';
import { ERRATA_VERSION, FAQ_VERSION, RULES_VERSION } from '../src/lib/rulesVersions';
import type { DeckList } from '../src/engine/types';
import { buildH2H } from '../scripts/build-h2h';

const list = (name: string, main: string[], sideboard: string[] = []): DeckList => ({ name, legends: ['l1', 'l2', 'l3'], main, sideboard });
const A = list('A', ['x', 'x', 'y'], ['s']);
const B = list('B', ['y', 'z']);

describe('gameRunManifest (shared by the CLI scripts and the browser labs)', () => {
  it('records decks by fingerprint, preferring the library id, and fills the defaults', () => {
    const m = gameRunManifest({
      purpose: 'browser',
      decks: [{ deck: A, file: 'a.txt', deckId: 'library-id' }, B],
      fieldMode: 'meta',
      bot: 'medium',
      seedBase: 10_000,
      seatPolicy: 'alternate',
      plannedGames: 40,
      gamesPerPair: 20,
      simVersion: 3,
      createdAt: '2026-11-11T00:00:00.000Z',
    });
    expect(m).toMatchObject({
      schema: 1,
      runId: 'browser:2026-11-11T00:00:00.000Z:10000',
      purpose: 'browser',
      simVersion: 3,
      rulesVersion: RULES_VERSION,
      faqVersion: FAQ_VERSION,
      errataVersion: ERRATA_VERSION,
      bot: { level: 'medium' },
      decks: [
        { id: 'library-id', name: 'A', file: 'a.txt' },
        { id: deckFingerprint(B), name: 'B', file: undefined },
      ],
      field: { mode: 'meta', deckIds: ['library-id', deckFingerprint(B)] },
      sample: { plannedGames: 40, completedGames: 40, gamesPerPair: 20 },
      seedBase: 10_000,
      seatPolicy: 'alternate',
      trace: false,
    });
    expect(m.cardDataVersion).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(m.cardDataVersion).toBe(createRunManifest({ ...m, errataVersion: null }).cardDataVersion);
  });

  it('fingerprints a bare list with its sideboard, like the library does', () => {
    expect(manifestDeck(A).id).toBe(deckFingerprint(A));
    expect(manifestDeck({ name: 'A', legends: A.legends, main: A.main }).id).toBe(deckFingerprint({ ...A, sideboard: [] }));
    expect(manifestDeck(A).id).not.toBe(manifestDeck({ ...A, sideboard: [] }).id);
  });

  it('keeps an explicit field, completed count and config hash', () => {
    const m = gameRunManifest({ purpose: 'forge', decks: [A, B], fieldMode: 'meta', fieldDeckIds: ['f'], bot: 'lookahead', botConfigHash: 'h', seedBase: 1, seatPolicy: 'alternate', plannedGames: 10, completedGames: 7, gamesPerPair: null, trace: true, simVersion: 3 });
    expect(m.field.deckIds).toEqual(['f']);
    expect(m.sample).toEqual({ plannedGames: 10, completedGames: 7, gamesPerPair: null });
    expect(m.bot).toEqual({ level: 'lookahead', configHash: 'h' });
    expect(m.trace).toBe(true);
    expect(runDetailsLine(m)).toBe(`sim v3 · seed 1 · 7/10 games · lookahead bot · decks ${deckFingerprint(A).slice(0, 8)}, ${deckFingerprint(B).slice(0, 8)}`);
  });
});

describe('aggregateManifest (ratings, head-to-heads)', () => {
  const ev = (id: number, date: string, decks: Record<string, DeckList>, extra: Partial<RecordedEventInput> = {}): RecordedEventInput => ({
    id,
    date,
    bot: 'hard',
    decks: Object.fromEntries(Object.entries(decks).map(([n, d]) => [n, { legends: d.legends, main: d.main }])),
    ...extra,
  });
  const legacy = ev(1, '2026-01-01T00:00:00.000Z', { A: { ...A, sideboard: [] }, B });
  const current = ev(2, '2026-02-01T00:00:00.000Z', { A: list('A', ['x', 'y', 'y']), B }, { simVersion: 3, manifest: { runId: 'tournament:2' } });

  it('names every input event with its sim version and run id, and shows a mix of versions', () => {
    const m = aggregateManifest('h2h', [current, legacy], { games: 12 });
    expect(m.purpose).toBe('aggregate');
    expect(m.inputs).toEqual({
      kind: 'recorded-events',
      events: [
        { id: 1, simVersion: null, runId: null },
        { id: 2, simVersion: 3, runId: 'tournament:2' },
      ],
      simVersions: [null, 3],
      mixedSimVersions: true,
    });
    // the lowest input version, 0 for "none recorded": never claims the newest version for mixed inputs
    expect(m.simVersion).toBe(0);
    expect(m.sample).toEqual({ plannedGames: 12, completedGames: 12, gamesPerPair: null });
    // rules versions belong to the input events, which may differ: an aggregate claims none
    expect([m.rulesVersion, m.faqVersion, m.errataVersion]).toEqual([null, null, null]);
    // a name that covered two lists shows both
    expect(m.decks.filter((d) => d.name === 'A')).toHaveLength(2);
    expect(m.decks.filter((d) => d.name === 'B')).toEqual([{ id: deckFingerprint(B), name: 'B' }]);
  });

  it('is derived from the inputs only, so unchanged data gives the same manifest', () => {
    const a = aggregateManifest('ratings', [legacy, current], { games: 12 });
    const b = aggregateManifest('ratings', [current, legacy], { games: 12 });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.createdAt).toBe('2026-02-01T00:00:00.000Z');
    expect(a.runId).toMatch(/^aggregate:ratings:[0-9a-f]{16}$/);
    expect(aggregateManifest('ratings', [legacy], { games: 6 }).runId).not.toBe(a.runId);
    expect(aggregateManifest('h2h', [legacy, current], { games: 12 }).runId).not.toBe(a.runId);
  });

  it('reports a single version as unmixed', () => {
    const m = aggregateManifest('h2h', [current], { games: 3 });
    expect(m.inputs?.mixedSimVersions).toBe(false);
    expect(m.simVersion).toBe(3);
  });

  it('build-h2h writes the manifest and leaves the file untouched when the events have not changed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'h2h-'));
    const events = path.join(dir, 'events');
    fs.mkdirSync(events);
    const match = { a: 'A', b: 'B', games: [{ seed: 1, first: 0, winner: 0, turns: 9 }], score: [1, 0], winner: 'A' };
    for (const e of [legacy, current]) fs.writeFileSync(path.join(events, `event-${e.id}.json`), JSON.stringify({ ...e, champion: 'A', rounds: [{ matches: [match] }], bracket: [], standings: [] }));
    const out = path.join(dir, 'h2h.json');
    const first = buildH2H(events, out)!;
    expect(first.manifest?.inputs?.events.map((e) => e.id)).toEqual([1, 2]);
    expect(first.manifest?.sample.completedGames).toBe(2);
    const bytes = fs.readFileSync(out, 'utf8');
    const mtime = fs.statSync(out).mtimeMs;
    buildH2H(events, out);
    expect(fs.readFileSync(out, 'utf8')).toBe(bytes);
    expect(fs.statSync(out).mtimeMs).toBe(mtime);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
