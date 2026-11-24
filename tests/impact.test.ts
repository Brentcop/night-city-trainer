// The coach and the Deck Lab read src/data/impact.json. Since 2026-11-24 (REVIEW_2026-11-24 B.2) it is the per-list
// table of the pair the season breeder reads (impactDataOf in src/lib/breederImpact.ts: the current simulator version and
// Hard, Season 3's round robin plus the whole-library review telemetry src/data/analysis.json), so the coach, the Deck
// Lab, the forge's additions and the breeder read one table. These tests pin that the file is that rebuild, that the
// coach's and the Lab's numbers are the breeder's (to the file's 4 decimals), and that impact is matched by list
// fingerprint, never by deck name alone (backlog AI-11).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import analysis from '../src/data/analysis.json';
import impact from '../src/data/impact.json';
import type { DeckReport } from '../src/analysis/analyze';
import { findImpactDeck, IMPACT_MIN_DECK_GAMES, IMPACT_MIN_POOLED_GAMES, type ImpactDeck } from '../src/analysis/impactData';
import { cardImpact, impactDeckName, topImpactCards } from '../src/ai/impact';
import { deckImpactOf, GLOBAL_IMPACT } from '../src/lib/deckLab';
import { deckFingerprint, listFingerprint } from '../src/engine/deck';
import { Game } from '../src/engine/engine';
import type { DeckList } from '../src/engine/types';
import { loadLibrary } from '../scripts/lib-node';
import { buildImpactData, IMPACT_DATA_FILE } from '../scripts/breed-data';
import { IMPACT_DATA_DECIMALS, impactDataOf, impactDataText, impactDataWords, pooledOutsideLists, readImpactTables, type ImpactDataFile } from '../src/lib/breederImpact';
import { emptyCardImpact } from '../src/lib/seasonImpact';
import { emptyDeckImpact } from '../src/lib/seasonDeckImpact';
import { SIM_VERSION } from '../src/lib/tournament';
import { Scripted } from './engine-helpers';

const decks = (analysis as unknown as { decks: DeckReport[] }).decks;
const file = impact as unknown as ImpactDataFile;
const entries = file.decks as ImpactDeck[];
const lib = loadLibrary();
const ref = (d: Pick<DeckList, 'name' | 'legends' | 'main'>) => ({ name: d.name, listId: listFingerprint(d) });
const built = buildImpactData();
const T = built.tables;
/** half a unit in the file's last decimal: how far a stored mean is from the breeder's */
const ROUNDING = 0.5 * 10 ** -IMPACT_DATA_DECIMALS + 1e-12;

// Straightforward recomputation from impact.json: what src/ai/impact.ts and src/lib/deckLab.ts compute from it.
function reference() {
  const perDeck = new Map<string, Map<string, number>>();
  const pooled: Record<string, { s: number; n: number }> = {};
  for (const r of entries) {
    const m = new Map<string, number>();
    for (const [id, iwd, seen] of r.cards) {
      if (typeof iwd !== 'number' || !Number.isFinite(iwd)) continue;
      if (seen >= IMPACT_MIN_DECK_GAMES) m.set(id, iwd);
      pooled[id] ??= { s: 0, n: 0 };
      pooled[id].s += iwd * seen;
      pooled[id].n += seen;
    }
    perDeck.set(r.id!, m);
  }
  const global = new Map(Object.entries(pooled).filter(([, v]) => v.n >= IMPACT_MIN_POOLED_GAMES).map(([k, v]) => [k, v.s / v.n]));
  const cardImpactRef = (fp: string, id: string) => perDeck.get(fp)?.get(id) ?? 0.5 * (global.get(id) ?? 0);
  const topRef = (fp: string, n = 3) => {
    const m = perDeck.get(fp);
    if (!m) return [];
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, iwd]) => ({ id, iwd }));
  };
  return { cardImpactRef, topRef };
}

/** Library decks whose list the table onTable. */
const onTable = lib.filter((d) => entries.some((e) => e.id === listFingerprint(d.deck)));

describe('impact.json', () => {
  it('is the card table of the pair the breeder reads (rebuild it with npx tsx scripts/build-impact.ts)', () => {
    expect(fs.readFileSync(IMPACT_DATA_FILE, 'utf8').trimEnd()).toBe(built.text);
    expect([file.simVersion, file.bot, file.match]).toEqual([SIM_VERSION, 'hard', 'exact']);
    expect(T.match).toBe('exact');
    expect(T.analysis.state).toBe('added');
    expect(pooledOutsideLists(T, file)).toBe(0);
  });

  it('covers every library list, each entry by the fingerprint of the list it onTable, named as the review telemetry names it', () => {
    expect(entries.filter((d) => !d.id).map((d) => d.deck)).toEqual([]);
    // every list the review telemetry played has its entry; a list edited after it (S2-05 and S2-08 on 2026-11-24,
    // REVIEW_2026-11-24 B.1) has none until its games are traced again, and the coach then reads the pooled figures
    const traced = new Set(decks.map((r) => r.id));
    const missing = lib.filter((d) => !entries.some((e) => e.id === listFingerprint(d.deck)));
    expect(missing.filter((d) => traced.has(listFingerprint(d.deck))).map((d) => d.deck.name)).toEqual([]);
    expect(missing.length).toBeLessThan(lib.length / 10);
    for (const r of decks) if (r.id) expect(entries.find((e) => e.id === r.id)?.deck).toBe(r.deck);
  });

  it('gives the coach the breeder\'s numbers, for the list they were onTable on', () => {
    const ref0 = reference();
    const ids = new Set(entries.flatMap((r) => r.cards.map((c) => c[0])));
    for (const d of onTable) {
      const me = ref(d.deck);
      const fp = me.listId;
      const own = T.deckImpact[fp] ?? {};
      for (const id of ids) {
        expect(Object.is(cardImpact(me, id), ref0.cardImpactRef(fp, id)), `${d.deck.name} / ${id}`).toBe(true);
        const breeder = own[id] ?? 0.5 * (T.impact[id] ?? 0);
        expect(Math.abs(cardImpact(me, id) - breeder), `${d.deck.name} / ${id}`).toBeLessThanOrEqual(ROUNDING);
      }
      expect(topImpactCards(me)).toEqual(ref0.topRef(fp));
      expect(topImpactCards(me, 100)).toEqual(ref0.topRef(fp, 100));
      expect(impactDeckName(me)).toBe(entries.find((e) => e.id === fp)!.deck);
    }
    const nobody = { name: 'no such deck', listId: '0000000000000000' };
    for (const id of ids) expect(Object.is(cardImpact(nobody, id), 0.5 * (GLOBAL_IMPACT[id] ?? 0))).toBe(true);
    expect(topImpactCards(nobody)).toEqual([]);
  });

  it('gives a custom deck that reuses a built-in name only the format-wide estimate', () => {
    const real = onTable[0]!.deck;
    // same name, one card different: another list
    const custom = { ...real, main: [...real.main.slice(1), real.main[0] === 'psycho_squad' ? 'v_streetkid' : 'psycho_squad'] };
    expect(topImpactCards(ref(custom))).toEqual([]);
    expect(impactDeckName(ref(custom))).toBeNull();
    for (const id of new Set(real.main)) expect(Object.is(cardImpact(ref(custom), id), 0.5 * (GLOBAL_IMPACT[id] ?? 0))).toBe(true);
    expect(deckImpactOf(custom)).toBeUndefined();
  });

  it('gives the Deck Lab the breeder\'s numbers (the format-wide table and each list\'s own)', () => {
    expect(Object.keys(GLOBAL_IMPACT).sort()).toEqual(Object.keys(T.impact).sort());
    for (const [id, v] of Object.entries(T.impact)) expect(Math.abs(GLOBAL_IMPACT[id]! - v), id).toBeLessThanOrEqual(ROUNDING);
    for (const d of onTable) {
      const lab = deckImpactOf(d.deck)!;
      const breeder = T.deckImpact[listFingerprint(d.deck)]!;
      expect(Object.keys(lab).sort()).toEqual(Object.keys(breeder).sort());
      for (const [id, v] of Object.entries(breeder)) expect(Math.abs(lab[id]! - v), `${d.deck.name} / ${id}`).toBeLessThanOrEqual(ROUNDING);
    }
    expect(deckImpactOf({ name: 'no such deck', legends: [], main: [] })).toBeUndefined();
  });

  it('gives every player in a game the fingerprint of the list it plays (sideboard left out)', () => {
    const d = { ...onTable[0]!.deck, sideboard: ['psycho_squad'] };
    const g = Game.create([d, { ...d, name: 'Renamed copy' }], [new Scripted(), new Scripted()], { seed: 1 });
    expect(g.P(0).listId).toBe(listFingerprint(d));
    expect(g.P(0).listId).toBe(deckFingerprint({ ...d, sideboard: [] }));
    expect(g.P(1).listId).toBe(g.P(0).listId);
    // impact belongs to the list: the built-in deck gets its numbers, and so does the same list under another name
    expect(topImpactCards(g.P(0))).toEqual(reference().topRef(listFingerprint(d)));
    expect(topImpactCards(g.P(1))).toEqual(reference().topRef(listFingerprint(d)));
  });
});

describe('impactDataOf (the coach\'s table from the breeder\'s)', () => {
  const key = { simVersion: 9, bot: 'hard' };
  const L1 = 'aaaaaaaaaaaaaaaa';
  const L2 = 'bbbbbbbbbbbbbbbb';
  const L3 = 'cccccccccccccccc';
  const cardFile = { ...emptyCardImpact(), entries: [{ simVersion: 9, bot: 'hard', sources: [{ kind: 'season' as const, season: 3 }], cards: { c: { s: 3, n: 40 }, d: { s: 1, n: 30 } } }] };
  const deckFile = {
    ...emptyDeckImpact(),
    entries: [{ simVersion: 9, bot: 'hard', sources: [{ kind: 'season' as const, season: 3 }], lists: { [L2]: { name: 'Old B', cards: { c: { s: 2, n: 20 }, d: { s: 1, n: 30 } } }, [L1]: { name: 'A', cards: { c: { s: 1, n: 20 } } } } }],
  };
  const analysisOf = (level: string) => ({ manifest: { simVersion: 9, bot: { level }, runId: 'an' }, decks: [{ deck: 'B', id: L2, cards: [{ id: 'c', iwd: 0.1, seenGames: 10 }] }, { deck: 'C', id: L3, cards: [{ id: 'd', iwd: 1 / 3, seenGames: 30 }] }] });

  it('lists the review telemetry\'s lists first under its names, then the others by fingerprint, cards by mean to 4 decimals', () => {
    const f = impactDataOf({ cardFile, deckFile, analysis: analysisOf('hard'), key });
    expect(f).toEqual({
      simVersion: 9,
      bot: 'hard',
      match: 'exact',
      sources: ['season 3', 'review telemetry (an)'],
      decks: [
        { deck: 'B', id: L2, cards: [['c', 0.1, 30], ['d', 0.0333, 30]] },
        { deck: 'C', id: L3, cards: [['d', 0.3333, 30]] },
        { deck: 'A', id: L1, cards: [['c', 0.05, 20]] },
      ],
    });
    expect(impactDataText(f)).toBe(JSON.stringify(f));
    const t = readImpactTables({ cardFile, deckFile, analysis: analysisOf('hard'), key });
    expect(pooledOutsideLists(t, f)).toBe(0);
    expect(impactDataWords(t, f)).toEqual(['Card table for the coach and the Deck Lab (src/data/impact.json): simulator version 9, hard bot, the pair the breeder reads: 3 lists, 110 drawn-games; from season 3, review telemetry (an).']);
  });

  it('leaves out a review telemetry of another bot, as the breeder does, and says when no list holds some pooled games', () => {
    const f = impactDataOf({ cardFile, deckFile, analysis: analysisOf('deep'), key });
    expect(f.decks.map((d) => d.deck)).toEqual(['A', 'Old B']);
    const t = readImpactTables({ cardFile: { ...cardFile, entries: [{ ...cardFile.entries[0]!, cards: { ...cardFile.entries[0]!.cards, e: { s: 1, n: 5 } } }] }, deckFile, analysis: null, key });
    expect(pooledOutsideLists(t, f)).toBe(5);
    expect(impactDataWords(t, f)[1]).toBe("Note: 5 drawn-games of the pooled table are in no list, so the coach's format-wide figure leaves them out and differs from the breeder's.");
  });

  it('reads the closest pair with a warning, and nothing when there is none', () => {
    const other = impactDataOf({ cardFile, deckFile, analysis: null, key: { simVersion: 9, bot: 'medium' } });
    expect([other.bot, other.match]).toEqual(['hard', 'other-bot']);
    const t = readImpactTables({ cardFile, deckFile, analysis: null, key: { simVersion: 9, bot: 'medium' } });
    expect(impactDataWords(t, other)[0]).toMatch(/^Warning: no card-impact numbers for simulator version 9, medium bot, so the coach and the Deck Lab read those of simulator version 9, hard bot, as the breeder does/);
    const none = impactDataOf({ cardFile: emptyCardImpact(), deckFile: emptyDeckImpact(), analysis: null, key });
    expect(none).toEqual({ simVersion: null, bot: null, match: 'none', sources: [], decks: [] });
  });
});

describe('findImpactDeck (lookup rules)', () => {
  const L1 = 'aaaaaaaaaaaaaaaa';
  const L2 = 'bbbbbbbbbbbbbbbb';
  const measured: ImpactDeck[] = [
    { deck: 'Meta A', id: L1, cards: [] },
    { deck: 'Meta B', id: L2, cards: [] },
  ];
  const legacy: ImpactDeck[] = [{ deck: 'Meta A', cards: [] }];
  const pins = { 'Meta A': L1 };

  it('matches by fingerprint, whatever either side is called', () => {
    expect(findImpactDeck(measured, { name: 'Meta A', listId: L1 }, {})).toBe(measured[0]);
    expect(findImpactDeck(measured, { name: 'Meta A (renamed)', listId: L1 }, {})).toBe(measured[0]);
  });

  it('never falls back to the name when the stored entry has a fingerprint', () => {
    expect(findImpactDeck(measured, { name: 'Meta A', listId: 'cccccccccccccccc' }, { 'Meta A': 'cccccccccccccccc' })).toBeUndefined();
  });

  it('accepts a legacy name-only entry for the built-in deck of that name', () => {
    expect(findImpactDeck(legacy, { name: 'Meta A', listId: L1 }, pins)).toBe(legacy[0]);
  });

  it('gives a custom deck that reuses a built-in name nothing', () => {
    expect(findImpactDeck(legacy, { name: 'Meta A', listId: L2 }, pins)).toBeUndefined();
    expect(findImpactDeck(legacy, { name: 'Meta A', listId: L2 }, {})).toBeUndefined();
  });

  it('does not let a renamed built-in list claim a legacy entry by name, but finds it once the data has fingerprints', () => {
    expect(findImpactDeck(legacy, { name: 'Renamed', listId: L1 }, pins)).toBeUndefined();
    expect(findImpactDeck(measured, { name: 'Renamed', listId: L1 }, pins)).toBe(measured[0]);
  });

  it('matches nothing without a list id, and ignores inherited object keys', () => {
    expect(findImpactDeck(legacy, { name: 'Meta A' }, pins)).toBeUndefined();
    expect(findImpactDeck([{ deck: 'constructor', cards: [] }], { name: 'constructor', listId: L1 }, {})).toBeUndefined();
  });
});
