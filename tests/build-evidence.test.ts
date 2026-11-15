// The evidence builder (scripts/build-evidence.ts, scripts/evidence-build.ts; docs/EVIDENCE.md), from small fixtures:
// byte-identical rebuilds, change findings that are exactly what judgePooled says of the same ledger games, a screening
// figure that is always flagged, open questions, nothing from an empty ledger, a stale re-measurement, and --check before
// and after an input changes. Then on the real data: each finding equals the number the function that defines it gives.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEvidence, changeKeyOf, DEFAULT_PAIR_SD, eventMatches, heterogeneity as builderHeterogeneity, matchupCheck, pairSpread, parseChangeLabel, type EvidenceInputs, type ForgeReport } from '../scripts/evidence-build';
import { compareEvidence, evidenceTexts, loadEvidenceInputs, readStored, storedProblems, writeEvidence } from '../scripts/build-evidence';
import type { RecordedEvent } from '../scripts/lib-node';
import { listFingerprint } from '../src/engine/deck';
import { changeKey, fieldFingerprint, gamesToSettle, summarize, type LedgerBatch, type LedgerGame } from '../src/lib/changeLedger';
import { heterogeneity } from '../src/lib/pairedSplit';
import { ADOPTION_DEFAULTS, judgePooled, pairedInterval } from '../src/lib/evidence';
import { fieldInterval, fitRatings } from '../src/lib/ratingModel';
import { ratedGamesOf } from '../src/lib/ratingGames';
import { h2hFileLookup, h2hModelFields } from '../src/lib/h2hModel';
import { ratingsTable } from '../src/lib/eventFacts';
import { cardAnalysis, packageFact } from '../src/lib/cardFacts';
import { CATALOGUE_VERSION } from '../src/content/synergies';
import { shortIdDeck, strengthOf, type DeckEvidence, type Finding } from '../src/lib/findings';
import type { RemeasureFile } from '../src/lib/remeasure';

// ---------------------------------------------------------------- fixtures

const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const list = (tag: string) => ({ name: `Deck ${tag.toUpperCase()}`, legends: [`${tag}_l1`, `${tag}_l2`, `${tag}_l3`], main: Array.from({ length: 40 }, (_, i) => `${tag}_c${i % 20}`) });
const DECKS = ['a', 'b', 'c', 'd'].map(list);
const STRENGTH: Record<string, number> = { 'Deck A': 0.8, 'Deck B': 0.2, 'Deck C': 0, 'Deck D': -0.6 };

function events(n: number): RecordedEvent[] {
  const r = rng(7);
  const out: RecordedEvent[] = [];
  for (let id = 1; id <= n; id++) {
    const matches = [];
    for (let i = 0; i < DECKS.length; i++)
      for (let j = i + 1; j < DECKS.length; j++) {
        const a = DECKS[i]!.name;
        const b = DECKS[j]!.name;
        const games = [];
        for (let g = 0; g < 3; g++) {
          const first = ((id + g) % 2) as 0 | 1;
          const p = 1 / (1 + Math.exp(-(STRENGTH[a]! - STRENGTH[b]! + (first === 0 ? 0.1 : -0.1))));
          const won = r() < p;
          games.push({ seed: id * 1000 + g, first, winner: (won ? 0 : 1) as 0 | 1, turns: 10 + Math.floor(r() * 6), reason: r() < 0.6 ? 'controls 7+ Gigs at start of turn' : 'reached 7 Gigs in overtime' });
        }
        matches.push({ a, b, games, winner: a, score: [0, 0] as [number, number] });
      }
    out.push({ id, date: `2026-11-0${id}`, bot: 'hard', simVersion: 9, champion: DECKS[0]!.name, decks: Object.fromEntries(DECKS.map((d) => [d.name, { legends: d.legends, main: d.main }])), rounds: [{ matches }], bracket: [], standings: [] });
  }
  return out;
}

function ratingsOf(evs: RecordedEvent[]): NonNullable<EvidenceInputs['ratings']> {
  const games = ratedGamesOf(evs);
  const fit = fitRatings(games);
  const all = fit.names.map((_, k) => k);
  return {
    decks: fit.names.map((name, k) => {
      const iv = fieldInterval(fit, k, all);
      return { name, file: `${name}.txt`, rating: fit.r[k]!, se: iv.sdRating, games: fit.played[k]!, wrField: iv.wr, wrFieldLo: iv.lo, wrFieldHi: iv.hi, wrMeta: null, events: evs.length, titles: 0, top8: 0, avgFinish: null, matches: '', gamesRecord: '' };
    }),
    firstPlayerEdge: 1 / (1 + Math.exp(-fit.h)) - 0.5,
    manifest: { simVersion: 9, bot: { level: 'hard' } },
  };
}

function h2hOf(evs: RecordedEvent[]): NonNullable<EvidenceInputs['h2h']> {
  const games = ratedGamesOf(evs);
  const decks = [...new Set(games.flatMap((g) => [g.a, g.b]))];
  const acc = new Map<string, [number, number, number, number]>();
  for (const g of games) {
    const i = decks.indexOf(g.a);
    const j = decks.indexOf(g.b);
    const [lo, hi, w] = i < j ? [i, j, g.s] : [j, i, 1 - g.s];
    const c = acc.get(`${lo}|${hi}`) ?? [lo, hi, 0, 0];
    c[2] += w;
    c[3]++;
    acc.set(`${lo}|${hi}`, c);
  }
  const pairs = [...acc.values()];
  return { decks, pairs, ...h2hModelFields(decks, pairs, games), events: evs.length, games: games.length, manifest: { simVersion: 9, bot: { level: 'hard' } } };
}

const A = DECKS[0]!;
const swapped = (cut: string, add: string) => ({ ...A, main: A.main.map((c, i) => (i === A.main.indexOf(cut) ? add : c)) });
const FIELD = fieldFingerprint(DECKS.slice(1).map(listFingerprint));
function ledgerGames(n: number, seed: number, gain: number, s0: number): LedgerGame[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const base = r() < 0.5 ? 1 : 0;
    const flip = r();
    const cand = flip < 0.15 + gain ? 1 : flip < 0.3 ? 0 : base;
    return { seed: s0 + i, opp: listFingerprint(DECKS[1 + (i % 3)]!), first: (i % 2) as 0 | 1, base, cand };
  });
}
const KEY1 = changeKey(A, swapped('a_c3', 'z_new'));
const KEY2 = changeKey(A, swapped('a_c5', 'z_other'));
const batch = (change: string, kind: 'heldout' | 'screen', run: string, games: LedgerGame[]): LedgerBatch => ({ entry: { change, simVersion: 9, bot: 'medium', field: FIELD }, kind, label: change === KEY1 ? '-1 A3 → +1 New' : '-1 A5 → +1 Other', run, date: '2026-11-15', games });
const LEDGER: LedgerBatch[] = [
  batch(KEY1, 'screen', 'forge r1', ledgerGames(112, 1, 0.06, 1)),
  batch(KEY1, 'heldout', 'forge r1', ledgerGames(896, 2, 0.04, 10_000)),
  batch(KEY1, 'heldout', 'forge r2', ledgerGames(896, 3, 0.04, 20_000)),
  batch(KEY2, 'screen', 'forge r2', ledgerGames(112, 4, 0.08, 30_000)),
  batch(KEY2, 'heldout', 'forge r2', ledgerGames(224, 5, 0.05, 40_000)),
];

const REMEASURE: RemeasureFile = {
  kind: 'nct-remeasure',
  schema: 1,
  measurements: [{ id: 'b-old', deck: 'deck-b.txt', label: '-1 B1 → +1 Q', baseListId: listFingerprint(DECKS[1]!), candListId: '0000000000000000', cuts: ['b_c1'], adds: ['q'], bot: 'lookahead', simVersion: 8, games: 5000, mean: 0.05, se: 0.005, date: '2026-11-13', script: 'x.ts' }],
};

function inputs(o: { ledger?: LedgerBatch[]; remeasure?: boolean; nEvents?: number } = {}): EvidenceInputs {
  const evs = events(o.nEvents ?? 6);
  const led = o.ledger ?? [];
  return {
    library: DECKS.map((d) => ({ file: `deck-${d.name.slice(-1).toLowerCase()}.txt`, deck: d })),
    history: [],
    events: evs,
    ratings: ratingsOf(evs),
    h2h: h2hOf(evs),
    analysis: null,
    synergies: null,
    catalogueVersion: 'x',
    ledger: led.length ? [{ file: `${listFingerprint(A)}.jsonl`, batches: led }] : [],
    forge: [],
    remeasure: o.remeasure ? [{ file: 'data/evidence/test.json', data: REMEASURE }] : [],
    adjusted: null,
    paths: { ratings: 'src/data/ratings.json', h2h: 'public/data/h2h.json', analysis: 'src/data/analysis.json', synergies: 'public/data/synergies.json', events: 'public/tournaments', ledgerDir: 'data/ledger' },
    simVersion: 9,
  };
}

const deckOf = (b: ReturnType<typeof buildEvidence>, name: string) => b.decks.find((d) => d.deck === name)!;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

// ---------------------------------------------------------------- from fixtures

describe('building from fixtures', () => {
  it('is byte-identical on a second build, and every stored strength is the rule\'s', () => {
    const a = evidenceTexts(buildEvidence(inputs({ ledger: LEDGER, remeasure: true })));
    const b = evidenceTexts(buildEvidence(inputs({ ledger: LEDGER, remeasure: true })));
    expect([...a.keys()]).toEqual([...b.keys()]);
    for (const [k, t] of a) expect(b.get(k)).toBe(t);
    const built = buildEvidence(inputs({ ledger: LEDGER, remeasure: true }));
    expect(built.problems).toEqual([]);
    for (const d of built.decks) for (const f of d.findings) expect(strengthOf(f, 9)).toBe(f.strength);
    expect(built.index.decks.map((d) => d.path)).toEqual(built.decks.map((d) => `evidence/${d.listId}.json`));
  });

  it('a change from the ledger is exactly what judgePooled says of its held-out games; its screening figure is flagged', () => {
    const built = buildEvidence(inputs({ ledger: LEDGER }));
    const d = deckOf(built, 'Deck A');
    const f = d.findings.find((x) => x.kind === 'change' && x.subject.change?.key === KEY1)!;
    const held = LEDGER.filter((b) => b.entry.change === KEY1 && b.kind === 'heldout').flatMap((b) => b.games);
    const j = judgePooled(
      held.map((g) => g.cand),
      held.map((g) => g.base),
      { alpha: ADOPTION_DEFAULTS.alpha, nominees: 1, minGainPp: ADOPTION_DEFAULTS.minGainPp, minGames: ADOPTION_DEFAULTS.minGames },
    );
    expect(f.nature).toBe('effect');
    expect(f.method).toBe('paired-pooled');
    expect(f.sequential).toBe('always-valid');
    expect([f.estimate, f.lower, f.upper, f.games]).toEqual([r6(j.iv.mean), r6(j.iv.lower), r6(j.iv.upper), 1792]);
    expect(f.detail?.verdict).toBe(j.verdict === 'continue' ? 'undecided' : j.verdict);
    const plain = pairedInterval(held.map((g) => g.cand), held.map((g) => g.base), 1.96);
    expect(f.p95).toEqual([r6(plain.lower), r6(plain.upper)]);
    expect(f.corrected).toBe(j.iv.lower > 0 || j.iv.upper < 0);
    const screen = LEDGER[0]!.games;
    const sc = pairedInterval(screen.map((g) => g.cand), screen.map((g) => g.base), 1.96);
    expect(f.detail?.screen).toEqual({ games: 112, mean: r6(sc.mean), lower: r6(sc.lower), upper: r6(sc.upper), flag: 'screening' });
    expect(f.detail?.runs).toBe(2);
    expect(f.flags).toContain('medium-only');
    expect(f.sources[0]!.file).toBe(`data/ledger/${listFingerprint(A)}.jsonl`);
  });

  it('the heterogeneity test is the one in src/lib/pairedSplit.ts, read from the ledger games by opponent', () => {
    expect(builderHeterogeneity).toBe(heterogeneity);
    const built = buildEvidence(inputs({ ledger: LEDGER }));
    const f = deckOf(built, 'Deck A').findings.find((x) => x.subject.change?.key === KEY1)!;
    const held = LEDGER.filter((b) => b.entry.change === KEY1 && b.kind === 'heldout').flatMap((b) => b.games);
    const het = heterogeneity(summarize(held).byOpp)!;
    expect(f.detail?.heterogeneity).toEqual({ chi2: r6(het.chi2), df: het.df, p: r6(het.p) });
    expect(f.flags.includes('depends-on-opponent')).toBe(het.p < 0.05);
  });

  it('a forge nominee with its held-out games by opponent and seat carries them, and the flag when they differ; an older report does not', () => {
    const base = listFingerprint(A);
    const opps = DECKS.slice(1).map(listFingerprint);
    const nominee = (split: boolean) => ({
      label: '-1 A3 → +1 New',
      screen: { games: 112, mean: 0.06, lower: 0.01, upper: 0.11 },
      heldOut: { games: 630, mean: 0.02, lower: -0.01, upper: 0.05, z: 2.01, looks: 2, baseWr: 0.5, candWr: 0.52 },
      outcome: 'inconclusive' as const,
      ...(split
        ? {
            byOpp: opps.map((opp, i) => ({ opp, games: 210, mean: [0.09, 0.0, -0.03][i]!, se: 0.02 })),
            bySeat: [
              { first: 0 as const, games: 315, mean: 0.03, se: 0.02 },
              { first: 1 as const, games: 315, mean: 0.01, se: 0.02 },
            ],
            heterogeneity: { chi2: 21.0, df: 2, p: 0.0001 },
          }
        : {}),
    });
    const report = (split: boolean): ForgeReport =>
      ({
        deck: 'Deck A',
        file: 'deck-a.txt',
        date: '2026-11-15',
        field: 'Deck B, Deck C, Deck D · bot lookahead · 140 games per test',
        adoption: { rule: 'evidence', minGainPp: 1, packageMinGainPp: 1, alpha: 0.05, correction: 'obrien-fleming', capStages: 4, minGames: 200, firstStage: 280, nominees: 1, cardsPerChange: 1, packagesPerChange: 1, futilityAfterStages: 2, futilityMaxGainPp: 0 },
        gens: [{ gen: 1, baseline: 50, swaps: [{ swap: '-1 A3 → +1 New', wr: 56, delta: 6 }], verdict: 'inconclusive', nominees: [nominee(split)] }],
        manifest: { runId: 'forge r9', simVersion: 9, bot: { level: 'lookahead' }, decks: [{ id: base }], field: { deckIds: opps }, sample: { completedGames: 2000 } },
      }) as unknown as ForgeReport;
    const findingOf = (split: boolean) => {
      const built = buildEvidence({ ...inputs(), forge: [{ file: 'reports/forge/deck-a.json', report: report(split) }] });
      return deckOf(built, 'Deck A').findings.find((x) => x.method === 'paired-staged')!;
    };
    const withSplit = findingOf(true);
    expect(withSplit.detail?.byOpp).toEqual(nominee(true).byOpp);
    expect(withSplit.detail?.bySeat).toEqual(nominee(true).bySeat);
    expect(withSplit.detail?.heterogeneity).toEqual({ chi2: 21, df: 2, p: 0.0001 });
    expect(withSplit.flags).toContain('depends-on-opponent');
    const older = findingOf(false);
    expect(older.detail).not.toHaveProperty('byOpp');
    expect(older.detail).not.toHaveProperty('heterogeneity');
    expect(older.flags).not.toContain('depends-on-opponent');
    // the rest of the finding is the same either way
    const { detail: _a, flags: _b, ...rest } = withSplit;
    const { detail: _c, flags: _d, ...restOlder } = older;
    expect(rest).toEqual(restOlder);
  });

  it('an undecided, live change is an open question with the games it would need', () => {
    const built = buildEvidence(inputs({ ledger: LEDGER }));
    const d = deckOf(built, 'Deck A');
    const f2 = d.findings.find((x) => x.subject.change?.key === KEY2)!;
    expect(f2.detail?.verdict).toBe('undecided');
    const open = d.open.find((o) => o.change.key === KEY2)!;
    expect(open).toBeTruthy();
    expect(open.finding).toBe(f2.id);
    const held = LEDGER[4]!.games;
    const need = gamesToSettle(held, ADOPTION_DEFAULTS, { nominees: 1, minGainPp: 1 });
    expect(open.heldout).toBe(224);
    expect(open.screen).toBe(112);
    expect(open.toSettle).toBe(Number.isFinite(need) ? need : null);
    if (open.toSettle !== null) expect(open.more).toBe(open.toSettle - 224);
    // the runs: one per ledger run, each with what it screened and held out
    const runs = built.runs.find((r) => r.listId === d.listId)!;
    expect(runs.runs.map((r) => r.id)).toEqual(['forge r1', 'forge r2']);
    expect(runs.runs[1]!.trials.map((t) => t.outcome)).toEqual(['nominated', 'nominated']);
    // the runs live in their own file, which the index names
    expect(built.runs.map((r) => r.listId)).toEqual([d.listId]);
    expect(built.index.decks.find((x) => x.listId === d.listId)).toMatchObject({ runs: 2, runsPath: `evidence/${d.listId}.runs.json` });
    expect(built.index.decks.filter((x) => x.listId !== d.listId).every((x) => x.runs === 0 && x.runsPath === null)).toBe(true);
    expect([...evidenceTexts(built).keys()]).toContain(`${d.listId}.runs.json`);
  });

  it('an empty ledger gives no change finding and no open question', () => {
    const built = buildEvidence(inputs());
    for (const d of built.decks) {
      expect(d.findings.filter((f) => f.kind === 'change')).toEqual([]);
      expect(d.open).toEqual([]);
    }
    expect(built.runs).toEqual([]);
    expect(deckOf(built, 'Deck A').gaps.map((g) => g.code)).toContain('no-changes');
  });

  it('a finding measured under an older simulator version is stale and never strong', () => {
    const built = buildEvidence(inputs({ remeasure: true }));
    const f = deckOf(built, 'Deck B').findings.find((x) => x.kind === 'change')!;
    expect(f.flags).toEqual(['stale', 'medium-only']);
    expect(f.method).toBe('paired');
    expect(f.games).toBe(5000);
    expect(f.strength).toBe('moderate');
    expect(strengthOf({ ...f, simVersion: 9 }, 9)).toBe('strong');
    // and it stays out of the overview's lists
    expect(built.index.top.flatMap((t) => t.items).some((i) => i.id === f.id)).toBe(false);
  });

  it('results come from the recorded games: the seat split, the length thirds and the endings', () => {
    const built = buildEvidence(inputs());
    const d = deckOf(built, 'Deck A');
    const kinds = d.findings.map((f) => f.kind);
    expect(kinds.filter((k) => k === 'matchup')).toHaveLength(3);
    expect(kinds).toEqual(expect.arrayContaining(['deck-strength', 'seat', 'length', 'ending']));
    const seat = d.findings.find((f) => f.kind === 'seat')!;
    expect(seat.detail!.first!.decided + seat.detail!.second!.decided).toBe(seat.games);
    const endings = d.findings.filter((f) => f.kind === 'ending');
    expect(endings.reduce((a, f) => a + f.estimate, 0)).toBeCloseTo(1, 5);
    expect(endings.every((f) => f.family.size === 2 && f.family.correction === 'bh')).toBe(true);
    // seat and length are tested across decks
    expect(seat.family).toEqual({ key: 'all:seat', size: 4, correction: 'bh' });
    expect(d.findings.find((f) => f.kind === 'length')!.family).toEqual({ key: 'all:length', size: 4, correction: 'bh' });
    // without a pairing table the matchup interval uses the default pair spread, and says so
    const mu = d.findings.filter((f) => f.kind === 'matchup');
    expect(mu.every((f) => f.flags.includes('spread-default') && f.detail?.pairSd === DEFAULT_PAIR_SD)).toBe(true);
    expect(built.index.rules.matchup).toMatchObject({ spreadSd: DEFAULT_PAIR_SD, spreadMeasured: false, spreadPairings: 0 });
    expect(built.index.rules.length.shortMax).toBeLessThan(built.index.rules.length.longMin);
  });

  it('--check passes after a build, ignores a last-bit difference, and fails after an input changes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-evidence-'));
    try {
      const built = buildEvidence(inputs({ ledger: LEDGER }));
      writeEvidence(dir, built);
      expect(compareEvidence(dir, built)).toEqual([]);
      expect(compareEvidence(dir, buildEvidence(inputs({ ledger: LEDGER })))).toEqual([]);
      // a difference of a digit in the sixth decimal (and float error on top) is not one
      const file = path.join(dir, `${listFingerprint(A)}.json`);
      const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as DeckEvidence;
      doc.findings[0]!.estimate += 1.5e-6;
      fs.writeFileSync(file, JSON.stringify(doc));
      expect(compareEvidence(dir, built)).toEqual([]);
      // new ledger games, or another event, are
      const more = [...LEDGER, batch(KEY2, 'heldout', 'forge r3', ledgerGames(224, 9, 0.05, 50_000))];
      expect(compareEvidence(dir, buildEvidence(inputs({ ledger: more }))).length).toBeGreaterThan(0);
      expect(compareEvidence(dir, buildEvidence(inputs({ ledger: LEDGER, nEvents: 7 }))).length).toBeGreaterThan(0);
      // a stray deck file that is no longer built is a difference too
      fs.writeFileSync(path.join(dir, 'ffffffffffffffff.json'), '{}');
      expect(compareEvidence(dir, built)).toEqual(['ffffffffffffffff.json is not built any more (a list changed or a deck left the library)']);
      fs.rmSync(path.join(dir, 'ffffffffffffffff.json'));
      // the short-id lookup: every deck file's short ids, in order, and nothing else
      const stored = readStored(dir)!;
      expect(stored.ids).toEqual(built.ids);
      expect(storedProblems(dir, stored.decks, 'data/ledger', 9, stored.ids).filter((p) => p.startsWith('ids.json'))).toEqual([]);
      const broken = { ...stored.ids!, decks: { ...stored.ids!.decks, [listFingerprint(A)]: stored.ids!.decks[listFingerprint(A)]!.slice(8) } };
      expect(storedProblems(dir, stored.decks, 'data/ledger', 9, broken).filter((p) => p.startsWith('ids.json'))).toEqual([`ids.json: the short ids of ${listFingerprint(A)} are not those of its deck file`]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a card association is strong only with an adjusted, shrunk estimate that clears the bar (--adjusted)', () => {
    const listId = listFingerprint(A);
    const card = { id: 'a_c1', name: 'A1', seenGames: 600, wrSeen: 0.7, wrNotSeen: 0.5, iwd: 0.2, playedGames: 500, wrPlayed: 0.7, avgPlayTurn: 3, soldRate: 0, openingGames: 200, steals: 0 };
    const analysis = { manifest: { simVersion: 9, bot: { level: 'deep' }, field: { mode: 'meta', deckIds: [] } }, decks: [{ id: listId, deck: 'Deck A', games: 1200, cards: [card] }] } as unknown as EvidenceInputs['analysis'];
    const adjusted = (adj: number, shrunk: number) => ({
      file: 'scratch/impact-adjusted-latest.json',
      data: { kind: 'impact-adjusted' as const, manifest: { simVersion: 9, bot: { level: 'hard' } } as never, decks: [{ deck: 'Deck A', id: listId, games: 1200, tau: 0.1, rhoOldAdj: 1, rhoOldShrunk: 1, cards: [{ id: 'a_c1', name: 'A1', iwd: 0.2, seenGames: 600, adj, se: 0.03, lo: adj - 0.0588, hi: adj + 0.0588, shrunk, n1: 600, n0: 600, byT: [] }] }] },
    });
    const cardOf = (b: ReturnType<typeof buildEvidence>) => deckOf(b, 'Deck A').findings.find((f) => f.kind === 'card-assoc')!;
    const plain = cardOf(buildEvidence({ ...inputs(), analysis }));
    expect(plain.nature).toBe('association');
    expect(plain.corrected).toBe(true);
    expect(plain.strength).toBe('moderate');
    expect(plain.adjusted).toBeUndefined();
    const withAdj = cardOf(buildEvidence({ ...inputs(), analysis, adjusted: adjusted(0.15, 0.12) }));
    expect(withAdj.adjusted).toMatchObject({ method: 'landmark-stratified-shrunk', estimate: 0.15, shrunk: 0.12, source: { file: 'scratch/impact-adjusted-latest.json', path: 'decks[0].cards[0].shrunk' } });
    expect(withAdj.adjusted!.shrunkLower).toBeGreaterThan(0);
    expect(withAdj.strength).toBe('strong');
    // an adjusted estimate that does not clear the bar (or points the other way) leaves it moderate
    expect(cardOf(buildEvidence({ ...inputs(), analysis, adjusted: adjusted(0.02, 0.008) })).strength).toBe('moderate');
    expect(cardOf(buildEvidence({ ...inputs(), analysis, adjusted: adjusted(-0.15, -0.12) })).strength).toBe('moderate');
  });

  it('the matchup check scores every held-out match, game by game', () => {
    const c = matchupCheck(events(5).map(eventMatches), 0.0036);
    expect(c.matches).toBe(5 * 6);
    expect(c.games).toBe(5 * 18);
    expect(Number.isFinite(c.slope) && c.slopeSe > 0).toBe(true);
    expect(Number.isFinite(c.squaredDistance) && c.squaredDistanceSe > 0).toBe(true);
    expect(c.claimedVariance).toBeGreaterThan(c.claimedWithoutSpread);
  });

  it('the pair spread is measured on a pairing table, or is the default when the table cannot be read', () => {
    const names = ['P', 'Q', 'R', 'S', 'T', 'U'];
    const strength = [0.6, 0.3, 0, -0.1, -0.3, -0.5];
    const r = rng(11);
    const decks = names.map((deck, i) => ({
      deck,
      matchups: names.flatMap((opp, j) => {
        if (i === j) return [];
        const p = 1 / (1 + Math.exp(-(strength[i]! - strength[j]!)));
        const wf = Array.from({ length: 100 }, () => (r() < p + 0.06 ? 1 : 0)).reduce((a: number, x) => a + x, 0) / 100;
        const ws = Array.from({ length: 100 }, () => (r() < p - 0.06 ? 1 : 0)).reduce((a: number, x) => a + x, 0) / 100;
        return [{ opp, games: 200, wr: (wf + ws) / 2, wrFirst: wf, wrSecond: ws }];
      }),
    }));
    const sp = pairSpread({ decks } as unknown as EvidenceInputs['analysis']);
    expect(sp).toMatchObject({ measured: true, pairings: 15, games: 3000, df: 9 });
    expect(sp.tau2).toBeGreaterThanOrEqual(0);
    expect(sp.sd).toBeCloseTo(Math.sqrt(sp.tau2), 12);
    // half a game won on a seat (a tie) is not a whole number of wins: the table is refused
    const odd = decks.map((d, i) => (i ? d : { ...d, matchups: d.matchups.map((m, j) => (j ? m : { ...m, wrFirst: m.wrFirst + 0.005 })) }));
    expect(pairSpread({ decks: odd } as unknown as EvidenceInputs['analysis'])).toMatchObject({ measured: false, sd: DEFAULT_PAIR_SD });
    // too few pairings
    expect(pairSpread({ decks: decks.slice(0, 5) } as unknown as EvidenceInputs['analysis'])).toMatchObject({ measured: false, sd: DEFAULT_PAIR_SD });
    expect(pairSpread(null).measured).toBe(false);
  });

  it('a re-measurement with its field listed shares its question with the ledger entry of the same change', () => {
    const opponents = DECKS.slice(1).map(listFingerprint);
    const m = { id: 'a-v9', deck: 'deck-a.txt', label: '-1 A3 → +1 New', baseListId: listFingerprint(A), candListId: listFingerprint(swapped('a_c3', 'z_new')), cuts: ['a_c3'], adds: ['z_new'], bot: 'lookahead', simVersion: 9, games: 2000, mean: 0.03, se: 0.007, opponents, date: '2026-11-15', script: 'x.ts' };
    const built = buildEvidence({ ...inputs({ ledger: LEDGER }), remeasure: [{ file: 'data/evidence/v9.json', data: { kind: 'nct-remeasure', schema: 1, measurements: [m] } }] });
    const both = deckOf(built, 'Deck A').findings.filter((f) => f.subject.change?.key === KEY1);
    expect(both.map((f) => f.method).sort()).toEqual(['paired', 'paired-pooled']);
    expect(both.map((f) => f.field)).toEqual([FIELD, FIELD]);
    expect(both[0]!.question).toBe(both[1]!.question);
    expect(both[0]!.id).not.toBe(both[1]!.id);
  });

  it('a Medium change is flagged by what the Hard measurement of the same question shows, and a strong Hard one names it in the effects list', () => {
    const opponents = DECKS.slice(1).map(listFingerprint);
    const row = (id: string, cut: string, add: string, bot: string, mean: number, se: number, games: number) => ({
      id,
      deck: 'deck-a.txt',
      label: `-1 ${cut} → +1 ${add}`,
      baseListId: listFingerprint(A),
      candListId: listFingerprint(swapped(cut, add)),
      cuts: [cut],
      adds: [add],
      bot,
      simVersion: 9,
      games,
      mean,
      se,
      opponents,
      date: '2026-11-15',
      script: 'x.ts',
    });
    const measurements = [
      // Hard's range excludes no difference in the same direction
      row('m-agree', 'a_c1', 'z1', 'medium', 0.04, 0.006, 2800),
      row('h-agree', 'a_c1', 'z1', 'hard', 0.03, 0.006, 2800),
      // Hard measured, but its games do not settle it
      row('m-unsettled', 'a_c2', 'z2', 'medium', 0.03, 0.006, 2800),
      row('h-unsettled', 'a_c2', 'z2', 'hard', 0.012, 0.014, 560),
      // Hard finds no difference of a point or more
      row('m-none', 'a_c4', 'z4', 'medium', 0.03, 0.006, 2800),
      row('h-none', 'a_c4', 'z4', 'hard', 0.002, 0.005, 2800),
      // Hard reads the other direction
      row('m-opposite', 'a_c6', 'z6', 'medium', 0.03, 0.006, 2800),
      row('h-opposite', 'a_c6', 'z6', 'hard', -0.03, 0.006, 2800),
      // the Medium measurement has no direction of its own, and Hard decides
      row('m-open', 'a_c7', 'z7', 'medium', 0.006, 0.012, 560),
      row('h-decides', 'a_c7', 'z7', 'hard', 0.03, 0.006, 2800),
      // no Hard measurement at all
      row('m-only', 'a_c8', 'z8', 'medium', 0.03, 0.006, 2800),
    ];
    const built = buildEvidence({ ...inputs(), remeasure: [{ file: 'data/evidence/bots.json', data: { kind: 'nct-remeasure', schema: 1, measurements } }] });
    const fs = deckOf(built, 'Deck A').findings.filter((f) => f.kind === 'change');
    const flagOf = (cut: string, bot: string) => fs.find((f) => f.subject.change!.cuts[0] === cut && f.bot === bot)!.flags.filter((x) => x === 'medium-only' || x.startsWith('hard-'));
    expect(flagOf('a_c1', 'medium')).toEqual(['hard-confirms']);
    expect(flagOf('a_c2', 'medium')).toEqual(['hard-unsettled']);
    expect(flagOf('a_c4', 'medium')).toEqual(['hard-no-difference']);
    expect(flagOf('a_c6', 'medium')).toEqual(['hard-opposite']);
    expect(flagOf('a_c7', 'medium')).toEqual(['hard-decides']);
    expect(flagOf('a_c8', 'medium')).toEqual(['medium-only']);
    // a Hard finding carries none of them
    for (const cut of ['a_c1', 'a_c2', 'a_c4', 'a_c6', 'a_c7']) expect(flagOf(cut, 'hard')).toEqual([]);
    // the effects list names a question once: by its Hard measurement when that is strong or moderate, else by its best-supported one
    const effects = built.index.top.find((t) => t.key === 'effects')!.items;
    const named = (cut: string) => effects.filter((i) => i.claim.startsWith(`-1 ${cut} `));
    expect(named('a_c1').map((i) => [i.bot, i.others])).toEqual([['hard', 1]]);
    expect(named('a_c7').map((i) => i.bot)).toEqual(['hard']);
    expect(named('a_c6').map((i) => i.bot)).toEqual(['hard']);
    expect(named('a_c2').map((i) => i.bot)).toEqual(['medium']);
    expect(named('a_c4').map((i) => i.bot)).toEqual(['medium']);
    expect(named('a_c8').map((i) => i.bot)).toEqual(['medium']);
  });
});

describe('change keys from labels', () => {
  it('changeKeyOf is changeKey of the lists', () => {
    const cand = { ...A, main: [...A.main.slice(2), 'x', 'y'], legends: [...A.legends.slice(1), 'l_new'] };
    expect(changeKeyOf(listFingerprint(A), { cuts: ['a_c0', 'a_c1'], adds: ['y', 'x'], legendCuts: ['a_l1'], legendAdds: ['l_new'] })).toBe(changeKey(A, cand));
  });

  it('reads the forge labels: a swap, and a package move with names that hold colons', () => {
    expect(parseChangeLabel('-1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon')).toEqual({ cuts: ['we_gotta_live_together'], adds: ['yorinobu_arasaka_steel_dragon'] });
    expect(parseChangeLabel('Swap Ahead on Street Cred → Even Street Cred: +1 Field Operator, +1 Pepe Najarro: Working Doubles / -2 Gunpoint Diplomacy')).toEqual({ cuts: ['gunpoint_diplomacy', 'gunpoint_diplomacy'], adds: ['field_operator', 'pepe_najarro_working_doubles'] });
    expect(parseChangeLabel('-1 No Such Card → +1 Field Operator')).toBeNull();
  });
});

// ---------------------------------------------------------------- on the real data

describe('on the real data, each finding is the number its defining function gives', () => {
  const { inputs: real, problems } = loadEvidenceInputs('.');
  const built = buildEvidence(real);
  const all: Finding[] = built.decks.flatMap((d) => d.findings);

  it('builds without a problem', () => {
    expect(problems).toEqual([]);
    expect(built.problems).toEqual([]);
    expect(built.decks.length).toBe(real.library.length);
  });

  it('deck-strength is its ratingsTable row', () => {
    const rows = new Map(ratingsTable(real.ratings!).rows.map((r) => [r.deck, r]));
    const fs = all.filter((f) => f.kind === 'deck-strength');
    expect(fs.length).toBe(rows.size);
    for (const f of fs) {
      const r = rows.get(f.subject.deck)!;
      expect([f.estimate, f.lower, f.upper, f.games]).toEqual([r6(r.wrField), r6(r.lo), r6(r.hi), r.ratedGames]);
    }
  });

  it("a matchup's estimate is h2hFileLookup's shrunk figure, with the raw record beside it", () => {
    const look = h2hFileLookup(real.h2h!);
    const fs = all.filter((f) => f.method === 'shrunk');
    expect(fs.length).toBeGreaterThan(1000);
    for (const f of fs) {
      const rec = look(f.subject.deck, f.subject.opponent!.deck);
      expect(f.estimate).toBe(r6(rec.p!));
      expect(f.detail?.raw).toEqual({ wins: rec.w, games: rec.g });
      expect(f.lower).toBeLessThanOrEqual(f.estimate);
      expect(f.upper).toBeGreaterThanOrEqual(f.estimate);
    }
  });

  it('a package-assoc is packageFact\'s lift, a card-assoc cardAnalysis\'s gap', () => {
    const pk = all.filter((f) => f.kind === 'package-assoc');
    expect(pk.length).toBeGreaterThan(100);
    for (const f of pk) {
      const lift = packageFact(real.synergies!, 'public/data/synergies.json', f.subject.package!.id, { listId: f.subject.listId, catalogueVersion: CATALOGUE_VERSION })!.lift!;
      expect([f.estimate, f.lower, f.upper]).toEqual([r6(lift.gap), r6(lift.low95), r6(lift.high95)]);
    }
    const cd = all.filter((f) => f.kind === 'card-assoc');
    expect(cd.length).toBeGreaterThan(50);
    for (const f of cd) {
      const gap = cardAnalysis(real.analysis!, 'src/data/analysis.json', f.subject.card!.id, f.subject.listId)!.gap!;
      expect([f.estimate, f.lower, f.upper]).toEqual([r6(gap.gap), r6(gap.low95), r6(gap.high95)]);
    }
  });

  it('the pair spread is measured on the meta pairings, and each meta pairing has a direct matchup sharing its question', () => {
    expect(built.index.rules.matchup).toMatchObject({ spreadMeasured: true, spreadPairings: 21, spreadGames: 4200, df: 14 });
    expect(built.index.rules.matchup.spreadSd).toBeGreaterThan(0.04);
    const direct = all.filter((f) => f.method === 'direct-games');
    expect(direct.length).toBe(7 * 6);
    for (const f of direct) {
      const deck = real.analysis!.decks.find((d) => d.id === f.subject.listId)!;
      const m = deck.matchups.find((x) => x.opp === f.subject.opponent!.deck)!;
      expect([f.estimate, f.games]).toEqual([r6(m.wr), m.games]);
      expect(f.family.key).toBe(`${f.subject.listId}:direct-matchups`);
      const shrunk = all.find((x) => x.method === 'shrunk' && x.subject.listId === f.subject.listId && x.subject.opponent!.listId === f.subject.opponent!.listId)!;
      expect(shrunk.question).toBe(f.question);
      expect(f.flags).not.toContain('medium-only');
    }
  });

  it('the short-id lookup finds every finding', () => {
    for (const d of built.decks) {
      expect(built.ids.decks[d.listId]).toBe(d.findings.map((f) => f.short).join(''));
      for (const f of d.findings.slice(0, 5)) expect(shortIdDeck(built.ids, `F:${f.short}`)).toBe(d.listId);
    }
    expect(shortIdDeck(built.ids, 'F:zzzzzzzz')).toBeNull();
  });

  it('the re-measurements are effects on the change another tool measured: older versions stale, current ones not', () => {
    const re = all.filter((f) => f.method === 'paired');
    expect(re.length).toBeGreaterThanOrEqual(24);
    for (const f of re) expect(f.flags.includes('stale')).toBe(f.simVersion !== built.index.simVersion);
    // experiment E2 of the tuning study (SIM_VERSION 8): eight rows, all stale today
    expect(re.filter((f) => f.simVersion === 8).length).toBe(8);
    const s203 = all.filter((f) => f.kind === 'change' && f.subject.deck === 'S2-03 Cross (RGY)');
    expect(new Set(s203.map((f) => f.question)).size).toBe(1);
    expect(s203.every((f) => f.subject.change!.relation === 'to-this-list')).toBe(true);
    // one change of S2-05, measured by the forge (v5), re-measured (v8 and v9) and held in the ledger: one question
    const s205 = all.filter((f) => f.kind === 'change' && f.subject.deck === 'S2-05 Counter (RRG)' && f.subject.change!.cuts.join() === 'we_gotta_live_together' && f.subject.change!.adds.join() === 'yorinobu_arasaka_steel_dragon');
    expect(new Set(s205.map((f) => f.method))).toEqual(new Set(['paired', 'paired-pooled', 'paired-staged']));
    expect(new Set(s205.map((f) => f.question)).size).toBe(1);
    expect(s205.every((f) => f.subject.change!.relation === 'from-this-list')).toBe(true);
  });

  it('the index carries each deck\'s strength finding, and its results and patterns lists are not filled by one deck or kind', () => {
    for (const d of built.index.decks) {
      const f = all.find((x) => x.kind === 'deck-strength' && x.subject.listId === d.listId);
      expect(d.strength?.id ?? null).toBe(f?.id ?? null);
      if (f) expect([d.strength!.estimate, d.strength!.lower, d.strength!.upper, d.strength!.strength]).toEqual([f.estimate, f.lower, f.upper, f.strength]);
    }
    for (const key of ['results', 'patterns'] as const) {
      const items = built.index.top.find((t) => t.key === key)!.items;
      const count = (of: (i: (typeof items)[number]) => string) => Math.max(0, ...Object.values(items.reduce<Record<string, number>>((a, i) => ({ ...a, [of(i)]: (a[of(i)] ?? 0) + 1 }), {})));
      expect(count((i) => i.listId)).toBeLessThanOrEqual(3);
      expect(count((i) => i.kind)).toBeLessThanOrEqual(5);
    }
    // an ending and its mirror are one fact: a deck's endings appear at most once in the results
    const endings = built.index.top.find((t) => t.key === 'results')!.items.filter((i) => i.kind === 'ending');
    expect(new Set(endings.map((i) => i.listId)).size).toBe(endings.length);
    for (const i of endings) expect(i.estimate).toBeGreaterThanOrEqual(i.baseline);
  });

  it('the effects list names each question once and counts its other measurements', () => {
    const effects = built.index.top.find((t) => t.key === 'effects')!;
    expect(effects.items.length).toBeGreaterThan(0);
    expect(new Set(effects.items.map((i) => i.question)).size).toBe(effects.items.length);
    for (const i of effects.items) {
      const same = all.filter((f) => f.nature === 'effect' && f.question === i.question && !f.flags.includes('stale'));
      expect(i.others).toBe(same.length - 1);
      expect(i.flags).not.toContain('stale');
    }
  });
});
