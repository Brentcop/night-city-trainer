// Parent strength for the breeders (src/lib/parentStrength.ts; docs/SYNERGIES.md "A bred deck's test against its
// parent"): a season leaderboard entry counts only when every season behind it ran under the current simulator version;
// a stale entry is neither blended nor used; the season script (scripts/breed-data.ts strengthOf) and the Deck Lab
// (src/lib/deckLab.ts rankedParents) rank parents the same way from the same data. Also: with every entry current the
// script's numbers are the old formula's exactly, and the Lab's are the old Lab formula's once the ratings have no
// width, so the change is only the one intended.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { DeckList } from '../src/engine/types';
import { RATINGS, SEASONS } from '../src/data/index';
import { rankedParents } from '../src/lib/deckLab';
import type { LibraryDeck } from '../src/lib/library';
import { conservativeRating, parentStrength, rankParents, seasonVersions, staleLeaderRow, type RatedDeck } from '../src/lib/parentStrength';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { keptOutTriples, leaderStrength, seasonVersionsOnDisk, strengthOf } from '../scripts/breed-data';
import { BUILTIN } from '../src/lib/browserLibrary';

/** The leaderboard rows with only Season 3 behind them (2026-11-16): its six bred decks and two decks that joined then. */
const SEASON_3_ONLY = [
  'ladder-rrg-v-smasher-padre.txt',
  'nc-07-braindance-burn-rrb.txt',
  's3-02-mutant-rgy.txt',
  's3-03-cross-rrr.txt',
  's3-05-counter-rrg.txt',
  's3-06-counter-rbg.txt',
  's3-07-explorer-rrg.txt',
  's3-08-explorer-rrb.txt',
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-strength-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const deck = (name: string, n: number): DeckList => ({ name, legends: [`legend_${n}`], main: [`card_${n}`], sideboard: [] });
const lib: LibraryDeck[] = ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({ file: `${name.toLowerCase()}.txt`, deck: deck(name, i), kind: 'custom', prov: {} }));
const rated = (name: string, wrField: number, half = 0.04, games = 100): RatedDeck => ({ name, games, wrField, wrFieldLo: wrField - half, wrFieldHi: wrField + half });
const V = { '1': 5, '2': 5, '3': CURRENT_SIM_VERSION, '4': null } as Record<string, number | null>;

describe('stale leaderboard entries', () => {
  it('an entry is current only when every season behind it ran under the current simulator version', () => {
    expect(staleLeaderRow({ seasons: { '3': 0.5 } }, V)).toBe(false);
    expect(staleLeaderRow({ seasons: { '0': 0.6 } }, V)).toBe(true); // the seed data
    expect(staleLeaderRow({ seasons: { '1': 0.6, '3': 0.5 } }, V)).toBe(true); // one old season is enough
    expect(staleLeaderRow({ seasons: { '4': 0.6 } }, V)).toBe(true); // recorded without a version
    expect(staleLeaderRow({ seasons: { '9': 0.6 } }, V)).toBe(true); // a season with no record
    expect(staleLeaderRow({ seasons: {} }, V)).toBe(true);
    expect(staleLeaderRow({ seasons: { '3': 0.5 } }, V, 10)).toBe(true);
    expect(seasonVersions([{ season: 1, manifest: { simVersion: 5 } }, { season: 2 }, { season: 3, manifest: { simVersion: 'x' } }])).toEqual({ '1': 5, '2': null, '3': null });
  });

  it('on the bundled data: the rows with only Season 3 behind them are current, every other row is stale', () => {
    // seasons 1 and 2 ran under version 5, Season 3 (2026-11-16) under the current one; the script reads the same
    // versions from the season files on disk
    const versions = seasonVersions(SEASONS.seasons);
    expect(versions).toEqual({ '1': 5, '2': 5, '3': CURRENT_SIM_VERSION });
    expect(seasonVersionsOnDisk()).toEqual(versions);
    expect(SEASONS.leaderboard).toHaveLength(36);
    const current = SEASONS.leaderboard.filter((r) => !staleLeaderRow(r, versions));
    // the six Season 3 decks and the two decks that joined the leaderboard in Season 3
    expect(current.map((r) => r.file).sort()).toEqual(SEASON_3_ONLY);
    for (const r of current) expect(Object.keys(r.seasons ?? {}), r.file).toEqual(['3']);
    // every other row has the seed data (season 0) or Season 1 or 2 behind it
    const stale = SEASONS.leaderboard.filter((r) => staleLeaderRow(r, versions));
    expect(stale).toHaveLength(28);
    for (const r of stale) expect(Object.keys(r.seasons ?? {}).some((k) => ['0', '1', '2'].includes(k)), r.file).toBe(true);
  });
});

describe('parent strength', () => {
  it('a stale entry is not blended: a rated deck is its conservative rating alone; a deck with only a stale entry has none', () => {
    const s = parentStrength([rated('A', 0.6)], [
      { name: 'A', rating: 0.9, stale: true },
      { name: 'B', rating: 0.8, stale: true },
    ]);
    expect(s).toEqual({ A: 0.6 - 0.5 * 0.04 });
  });

  it('a current entry blends 65/35 with the conservative rating, and stands alone for an unrated deck', () => {
    const s = parentStrength([rated('A', 0.6)], [
      { name: 'A', rating: 0.9, stale: false },
      { name: 'B', rating: 0.8, stale: false },
    ]);
    expect(s.A).toBeCloseTo(0.65 * 0.58 + 0.35 * 0.9, 12);
    expect(s.B).toBe(0.8);
  });

  it('a rating on fewer than 20 games is not used', () => {
    expect(parentStrength([rated('A', 0.7, 0.04, 19)], [])).toEqual({});
    expect(conservativeRating(rated('A', 0.6, 0.1))).toBeCloseTo(0.55, 12);
  });

  it('with every entry current, the script gives the old formula’s numbers exactly (the change is staleness only)', () => {
    // the strengthOf of commit c3f3c61, for the comparison
    const old = (leaderboard: Record<string, number>, decks: RatedDeck[]) => {
      const out: Record<string, number> = { ...leaderboard };
      for (const d of decks) {
        if (!(d.games >= 20) || !Number.isFinite(d.wrField)) continue;
        const half = Math.max(0, (d.wrFieldHi - d.wrFieldLo) / 2);
        const r = d.wrField - 0.5 * half;
        out[d.name] = d.name in leaderboard ? 0.65 * r + 0.35 * leaderboard[d.name]! : r;
      }
      return out;
    };
    const decks = [rated('A', 0.6), rated('C', 0.5, 0.08), rated('D', 0.45, 0.02, 10), rated('E', 0.52)];
    const lb = { A: 0.7, B: 0.55, C: 0.4 };
    expect(parentStrength(decks, Object.entries(lb).map(([name, rating]) => ({ name, rating, stale: false })))).toEqual(old(lb, decks));
  });

  it('with every entry current and no width, the Lab gives the old Lab formula’s numbers (it now discounts by width)', () => {
    // the Deck Lab's rankedParents of commit c3f3c61, for the comparison
    const oldLab = (rows: { file: string; rating: number }[], decks: RatedDeck[]) => {
      const strength = new Map<string, number>();
      for (const r of rows) {
        const d = lib.find((x) => x.file === r.file);
        if (d && Number.isFinite(r.rating)) strength.set(d.deck.name, r.rating);
      }
      for (const r of decks) if (r.games >= 20 && Number.isFinite(r.wrField)) strength.set(r.name, strength.has(r.name) ? 0.65 * r.wrField + 0.35 * strength.get(r.name)! : r.wrField);
      return [...strength.entries()].map(([name, wr]) => ({ name, wr })).sort((a, b) => b.wr - a.wr);
    };
    const decks = [rated('A', 0.6, 0), rated('C', 0.5, 0), rated('E', 0.52, 0)];
    const rows = [
      { file: 'a.txt', rating: 0.7 },
      { file: 'b.txt', rating: 0.55 },
    ];
    const seasons = { seasons: [{ season: 1, manifest: { simVersion: CURRENT_SIM_VERSION } }], leaderboard: rows.map((r) => ({ ...r, name: r.file, origin: '', colors: '', arch: '', vsMeta: 0, metaG: 1, percentile: 0, seasons: { '1': 0.5 } })) } as unknown as Parameters<typeof rankedParents>[2];
    const now = rankedParents(lib, decks, seasons, CURRENT_SIM_VERSION).map((x) => ({ name: x.deck.name, wr: x.wr }));
    const before = oldLab(rows, decks);
    expect(now.map((x) => x.name)).toEqual(before.map((x) => x.name));
    now.forEach((x, i) => expect(x.wr).toBeCloseTo(before[i]!.wr, 12));
  });
});

describe('the script and the Deck Lab rank parents alike', () => {
  const decks = [rated('A', 0.6), rated('B', 0.55, 0.1), rated('C', 0.5, 0.02), rated('E', 0.58, 0.2)];
  const seasons = {
    seasons: [
      { season: 1, manifest: { simVersion: 5 } },
      { season: 2, manifest: { simVersion: CURRENT_SIM_VERSION } },
    ],
    leaderboard: [
      { file: 'a.txt', name: 'A', rating: 0.75, seasons: { '2': 0.7 } },
      { file: 'b.txt', name: 'B', rating: 0.65, seasons: { '1': 0.6, '2': 0.62 } },
      { file: 'd.txt', name: 'D', rating: 0.61, seasons: { '2': 0.6 } },
      { file: 'e.txt', name: 'E', rating: 0.3, seasons: { '0': 0.4 } },
    ],
  };

  it('from the same ratings and leaderboard', () => {
    const ratingsFile = path.join(tmp, 'ratings.json');
    fs.writeFileSync(ratingsFile, JSON.stringify({ decks }));
    const versions = seasonVersions(seasons.seasons);
    const script = rankParents(strengthOf(seasons.leaderboard.map((e) => leaderStrength(e, e.rating, versions, CURRENT_SIM_VERSION)), ratingsFile), lib);
    const lab = rankedParents(lib, decks, seasons as unknown as Parameters<typeof rankedParents>[2], CURRENT_SIM_VERSION);
    expect(lab.map((x) => [x.deck.name, x.wr])).toEqual(script.map((x) => [x.deck.name, x.wr]));
    // A blended (current): 0.65 · 0.58 + 0.35 · 0.75; D current and unrated: 0.61; B and E stale, so their ratings alone
    // (0.50 and 0.48); C rated only (0.49)
    expect(script.map((x) => [x.deck.name, +x.wr.toFixed(4)])).toEqual([
      ['A', 0.6395],
      ['D', 0.61],
      ['B', 0.5],
      ['C', 0.49],
      ['E', 0.48],
    ]);
  });

  it('on the bundled data: the eight current rows blend at 35% (all are rated since event 15), stale rows count for nothing', () => {
    const versions = seasonVersions(SEASONS.seasons);
    const lab = rankedParents(BUILTIN);
    const strength = new Map(lab.map((x) => [x.deck.name, x.wr]));
    const ratedRows = new Map(RATINGS.decks.filter((d) => d.games >= 20).map((d) => [d.name, d]));
    const blended: string[] = [];
    const alone: string[] = [];
    for (const r of SEASONS.leaderboard) {
      const name = BUILTIN.find((d) => d.file === r.file)?.deck.name;
      expect(name, r.file).toBeDefined();
      const rd = ratedRows.get(name!);
      if (staleLeaderRow(r, versions)) {
        // a stale row is neither blended nor used: a rated deck is its conservative rating alone, an unrated one has none
        expect(strength.get(name!), name).toBe(rd ? conservativeRating(rd) : undefined);
      } else if (rd) {
        blended.push(name!);
        expect(strength.get(name!)!, name).toBeCloseTo(0.65 * conservativeRating(rd) + 0.35 * r.rating, 12);
      } else {
        alone.push(name!);
        expect(strength.get(name!), name).toBe(r.rating);
      }
    }
    // the rows with only Season 3 behind them. Until event 15 (2026-11-16) the six Season 3 decks had no rating and stood on
    // their row alone; that event rated them, so all eight blend (a row standing alone is covered by the cases above)
    expect(blended.sort()).toEqual(['Ladder: V / Smasher / Padre (RRG)', 'NC-07 Braindance Burn (RRB)', 'S3-02 Mutant (RGY)', 'S3-03 Cross (RRR)', 'S3-05 Counter (RRG)', 'S3-06 Counter (RBG)', 'S3-07 Explorer (RRG)', 'S3-08 Explorer (RRB)']);
    expect(alone).toEqual([]);
    // the season script ranks the library the same way from data/seasons/leaderboard.json and the season files
    const lb = JSON.parse(fs.readFileSync('data/seasons/leaderboard.json', 'utf8')) as Record<string, { name: string; metaW: number; metaG: number; seasons?: Record<string, number> }>;
    const prior = 60;
    const entries = Object.values(lb)
      .filter((e) => e.metaG > 0)
      .map((e) => leaderStrength(e, (e.metaW + 0.5 * prior) / (e.metaG + prior), seasonVersionsOnDisk(), CURRENT_SIM_VERSION));
    expect(entries.filter((e) => !e.stale).map((e) => e.name).sort()).toEqual([...blended, ...alone].sort());
    const script = rankParents(strengthOf(entries), BUILTIN);
    expect(script.map((x) => x.deck.name)).toEqual(lab.map((x) => x.deck.name));
    script.forEach((x, i) => expect(x.wr, x.deck.name).toBeCloseTo(lab[i]!.wr, 12));
  });
});

describe('Legend trios kept out by earlier seasons', () => {
  it('are read from the season files, except the season being re-run', () => {
    const dir = path.join(tmp, 'seasons');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'season-3.json'), JSON.stringify({ season: 3, gate: { decks: [{ entered: false, legends: ['z', 'a', 'm'] }, { entered: true, legends: ['b', 'c', 'd'] }] } }));
    fs.writeFileSync(path.join(dir, 'season-4.json'), JSON.stringify({ season: 4, gate: { decks: [{ entered: false, legends: ['q', 'r', 's'] }] } }));
    fs.writeFileSync(path.join(dir, 'season-5.json'), JSON.stringify({ season: 5, bred: [] }));
    expect(keptOutTriples(dir)).toEqual(['a|m|z', 'q|r|s']);
    expect(keptOutTriples(dir, 4)).toEqual(['a|m|z']);
    expect(keptOutTriples(path.join(tmp, 'none'))).toEqual([]);
  });
});
