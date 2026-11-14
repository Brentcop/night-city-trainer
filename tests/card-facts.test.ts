// Card and package facts by code (src/lib/cardFacts.ts, docs/RAG_PLAN.md step 2.4): each function against the report
// files' own fields on real data, then on invented fixtures for a thin slice, a card on several lists, a package that
// never came online, a list no longer in the library, an older sim version and a missing report.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IWD_CAVEAT, type DeckReport } from '../src/analysis/analyze';
import { MIN_SLICE_GAMES, stageOf, type DecisionReport, type ModeReport, type Slice } from '../src/analysis/decisions';
import type { ImpactData } from '../src/analysis/impactData';
import type { SynergyReport, SynergyRow } from '../src/analysis/synergies';
import { liftGate, newcombeDiff, seatLift } from '../src/ai/packageLift';
import { CATALOGUE_VERSION } from '../src/content/synergies';
import {
  cardAnalysis,
  cardAnalysisLists,
  cardUse,
  cardUseLists,
  packageFact,
  packageLists,
  pooledImpact,
  reportBasis,
  winRateOf,
  type AnalysisInput,
} from '../src/lib/cardFacts';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { buildStats, cardStatText, packageStatText } from '../src/lib/kb/build/stats';

const ROOT = path.resolve(__dirname, '..');
const read = <T,>(f: string): T | null => (fs.existsSync(path.join(ROOT, f)) ? (JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) as T) : null);
const DEC_FILE = 'public/data/decisions.json';
const SYN_FILE = 'public/data/synergies.json';
const ANA_FILE = 'src/data/analysis.json';
const IMP_FILE = 'src/data/impact.json';
const DEC = read<DecisionReport>(DEC_FILE);
const SYN = read<SynergyReport>(SYN_FILE);
const ANA = read<AnalysisInput>(ANA_FILE);
const IMP = read<ImpactData>(IMP_FILE);

describe('on the real reports', () => {
  it.skipIf(!DEC)('the basis is read from the report’s own manifest', () => {
    const b = reportBasis(DEC_FILE, DEC!);
    expect(b).toEqual({
      file: DEC_FILE,
      simVersion: DEC!.manifest!.simVersion,
      bot: DEC!.manifest!.bot.level,
      asOf: DEC!.manifest!.createdAt,
      runId: DEC!.manifest!.runId,
      games: DEC!.manifest!.sample.completedGames,
      stale: DEC!.manifest!.simVersion < CURRENT_SIM_VERSION,
    });
    // analysis.json's top-level `games` is games per pairing: the basis takes the run's games from the manifest
    if (ANA?.manifest) expect(reportBasis(ANA_FILE, ANA).games).toBe(ANA.manifest.sample.completedGames);
  });

  it.skipIf(!DEC)('cardUse gives the decision report’s own numbers, on a list and pooled', () => {
    const deck = DEC!.decks[0]!;
    const row = deck.cards[0]!;
    const f = cardUse(DEC!, DEC_FILE, row.id, { listId: deck.listId })!;
    expect(f).toMatchObject({ scope: 'list', listId: deck.listId, deck: deck.name, deckGames: deck.games, lists: 1, minSliceGames: DEC!.minSliceGames, stages: DEC!.stages });
    expect(f.modes.map((m) => m.mode)).toEqual(row.modes.map((m) => m.mode));
    row.modes.forEach((m, i) => {
      const x = f.modes[i]!;
      expect([x.uses, x.offered, x.chosen, x.windows, x.windowsUsed]).toEqual([m.all.uses, m.offered, m.chosen, m.windows, m.windowsUsed]);
      expect(x.won.games).toBe(m.all.games);
      expect([x.won.rate, x.won.low95, x.won.high95, x.won.thin]).toEqual(m.all.thin ? [null, null, null, true] : [m.all.winRate, m.all.low95, m.all.high95, false]);
      for (const s of ['early', 'middle', 'late'] as const) expect([x.stage[s].uses, x.stage[s].won.games]).toEqual([m.stage[s].uses, m.stage[s].games]);
      for (const s of ['ahead', 'even', 'behind'] as const) expect([x.standing[s].uses, x.standing[s].won.rate]).toEqual([m.standing[s].uses, m.standing[s].winRate]);
    });
    const pooledRow = DEC!.pooled.find((c) => c.id === row.id)!;
    const p = cardUse(DEC!, DEC_FILE, row.id)!;
    expect(p.scope).toBe('pooled');
    expect(p.lists).toBe(cardUseLists(DEC!, row.id).length);
    expect(p.modes.map((m) => [m.mode, m.uses, m.won.games])).toEqual(pooledRow.modes.map((m) => [m.mode, m.all.uses, m.all.games]));
    expect(cardUse(DEC!, DEC_FILE, 'no_such_card')).toBeNull();
    expect(cardUse(DEC!, DEC_FILE, row.id, { listId: 'no-such-list' })).toBeNull();
  });

  it.skipIf(!DEC)('the stages are the decision report’s, from stageOf in src/analysis/decisions.ts', () => {
    expect([stageOf(1), stageOf(4), stageOf(5), stageOf(8), stageOf(9)]).toEqual(['early', 'early', 'middle', 'middle', 'late']);
    expect(DEC!.stages).toEqual({ early: 'turns 1–4', middle: 'turns 5–8', late: 'turn 9+' });
  });

  it.skipIf(!ANA)('cardAnalysis gives the per-deck analysis’ own numbers, with the caveat it exports', () => {
    let checked = 0;
    for (const d of ANA!.decks)
      for (const c of d.cards) {
        const f = cardAnalysis(ANA!, ANA_FILE, c.id, d.id!)!;
        expect([f.drawnGames, f.playedGames, f.openingGames, f.deckGames]).toEqual([c.seenGames, c.playedGames, c.openingGames, d.games]);
        expect(f.storedGap).toBe(c.iwd);
        expect(f.soldGames).toBe(Math.round(c.soldRate * c.seenGames));
        expect(f.meanTurnPlayed).toBe(c.avgPlayTurn);
        expect(f.caveat).toBe(IWD_CAVEAT);
        if (!f.wonDrawn.thin) expect(f.wonDrawn.rate!).toBeCloseTo(c.wrSeen, 12);
        // the gap is the stored one whenever both sides have enough games
        if (f.gap) {
          expect(f.gap.gap).toBeCloseTo(c.iwd, 12);
          expect(f.gap.low95).toBeLessThanOrEqual(f.gap.gap);
          expect(f.gap.high95).toBeGreaterThanOrEqual(f.gap.gap);
          checked++;
        }
      }
    expect(checked).toBeGreaterThan(50);
    expect(cardAnalysisLists(ANA!, ANA!.decks[0]!.cards[0]!.id)).toContain(ANA!.decks[0]!.id);
  });

  it.skipIf(!ANA || !IMP)('the coach’s impact table holds the analysis’ own gaps, and pooledImpact is its weighted mean', () => {
    for (const d of IMP!.decks) {
      const a = ANA!.decks.find((x) => x.id === d.id)!;
      expect(d.cards).toEqual(a.cards.map((c) => [c.id, c.iwd, c.seenGames]));
    }
    const id = IMP!.decks[0]!.cards[0]![0];
    const rows = IMP!.decks.flatMap((d) => d.cards.filter((c) => c[0] === id));
    const n = rows.reduce((s, r) => s + r[2], 0);
    expect(pooledImpact(IMP!, id)).toMatchObject({ lists: rows.length, drawnGames: n, coachUses: n >= 60 });
    expect(pooledImpact(IMP!, id)!.gap!).toBeCloseTo(rows.reduce((s, r) => s + r[1]! * r[2], 0) / n, 12);
    expect(pooledImpact(IMP!, 'no_such_card')).toBeNull();
  });

  it.skipIf(!SYN)('packageFact gives the synergy report’s own numbers, and the coach’s gate as the coach computes it', () => {
    let measured = 0;
    for (const d of SYN!.decks)
      for (const r of d.synergies) {
        const f = packageFact(SYN!, SYN_FILE, r.id, { listId: d.listId, catalogueVersion: SYN!.catalogueVersion })!;
        expect([f.games, f.assembled.n, f.assembled.of, f.online.n, f.online.of, f.wonOnline.games, f.wonNever.games]).toEqual([
          r.games,
          r.assembledRate.n,
          r.assembledRate.of,
          r.onlineRate.n,
          r.onlineRate.of,
          r.online.games,
          r.never.games,
        ]);
        expect(f.gate).toBe(liftGate(seatLift(SYN!, d.listId) ?? undefined, r.id));
        if (f.lift) expect([f.lift.low95, f.lift.high95]).toEqual(Object.values(newcombeDiff(r.online.winRate!, r.online.low95!, r.online.high95!, r.never.winRate!, r.never.low95!, r.never.high95!)));
        else expect(r.online.thin || r.never.thin).toBe(true);
        if (f.gate === 'measured') measured++;
      }
    expect(measured).toBeGreaterThan(0);
    const pooled = SYN!.pooled[0]!;
    const p = packageFact(SYN!, SYN_FILE, pooled.id, { catalogueVersion: SYN!.catalogueVersion })!;
    expect([p.scope, p.games, p.gate]).toEqual(['pooled', pooled.games, liftGate(seatLift(SYN!, undefined) ?? undefined, pooled.id)]);
    expect(packageLists(SYN!, pooled.id).length).toBeGreaterThan(0);
    // a report made with another catalogue counts as no report for the gate
    expect(packageFact(SYN!, SYN_FILE, pooled.id, { catalogueVersion: 'other' })!.gate).toBe('unmeasured');
  });

  it.skipIf(!SYN)('the synergy report was made with the current catalogue', () => {
    expect(SYN!.catalogueVersion).toBe(CATALOGUE_VERSION);
  });
});

// ---------------------------------------------------------------- fixtures

const MANIFEST = (simVersion: number) => ({ simVersion, bot: { level: 'fixture' }, createdAt: '2026-01-02T03:04:05.000Z', runId: 'fixture:1', sample: { plannedGames: 100, completedGames: 100, gamesPerPair: 10 } });
const slice = (uses: number, games: number, winRate: number): Slice =>
  games < MIN_SLICE_GAMES ? { uses, games, winRate: null, low95: null, high95: null, thin: true } : { uses, games, winRate, low95: winRate - 0.1, high95: winRate + 0.1, thin: false };
const mode = (m: ModeReport['mode'], games: number, winRate = 0.5): ModeReport => ({
  mode: m,
  all: slice(games * 2, games, winRate),
  stage: { early: slice(games, games, winRate), middle: slice(games, Math.floor(games / 2), winRate), late: slice(0, 0, 0) },
  standing: { ahead: slice(games, games, winRate), even: slice(1, 1, 0), behind: slice(0, 0, 0) },
  offered: games * 3,
  chosen: games * 2,
  windows: games * 2,
  windowsUsed: games,
  notChosenRate: 0.5,
  selfPaid: 0,
});
const decReport = (simVersion = 8): DecisionReport =>
  ({
    kind: 'decision-telemetry',
    reportSchema: 1,
    telemetrySchema: 1,
    note: '',
    minSliceGames: MIN_SLICE_GAMES,
    stages: { early: 'turns 1–4', middle: 'turns 5–8', late: 'turn 9+' },
    games: 100,
    records: 0,
    manifest: MANIFEST(simVersion),
    decks: [
      { listId: 'LIST_A', name: 'Deck A', games: 60, winRate: 0.5, decisions: 0, cards: [{ id: 'kilo', name: 'Kilo Byte', modes: [mode('play', 40, 0.6), mode('sell', 12)] }], decisionTypes: [], reactions: {} },
      { listId: 'LIST_B', name: 'Deck B', games: 40, winRate: 0.5, decisions: 0, cards: [{ id: 'kilo', name: 'Kilo Byte', modes: [mode('play', 30, 0.4)] }], decisionTypes: [], reactions: {} },
      { listId: 'LIST_GONE', name: 'Retired', games: 20, winRate: 0.5, decisions: 0, cards: [{ id: 'kilo', name: 'Kilo Byte', modes: [mode('play', 20)] }], decisionTypes: [], reactions: {} },
    ],
    pooled: [{ id: 'kilo', name: 'Kilo Byte', modes: [mode('play', 90, 0.5), mode('sell', 12)] }],
  }) as unknown as DecisionReport;
const anaReport: AnalysisInput = {
  manifest: MANIFEST(8) as AnalysisInput['manifest'],
  decks: [
    {
      deck: 'Deck A',
      id: 'LIST_A',
      games: 60,
      cards: [{ id: 'kilo', name: 'Kilo Byte', seenGames: 45, wrSeen: 0.6, wrNotSeen: 0.4, iwd: 0.2, playedGames: 40, wrPlayed: 0.6, avgPlayTurn: 3.5, soldRate: 0.2, openingGames: 20, wrOpening: 0.5, steals: 0.25 }],
    } as unknown as DeckReport,
  ],
};
const pkgRow = (id: string, o: { online: number; never: number; onlineWr?: number; neverWr?: number }): SynergyRow =>
  ({
    id,
    name: `Package ${id}`,
    family: 'tempo',
    bond: 'helps',
    copies: { enabler: 4, payoff: 2, both: 0, piece: 0 },
    builtAround: true,
    games: o.online + o.never,
    assembledRate: { rate: 0.9, low95: 0.8, high95: 0.95, n: Math.round((o.online + o.never) * 0.9), of: o.online + o.never },
    assembled: slice(0, Math.round((o.online + o.never) * 0.9), 0.5),
    byRound: [2, 4, 6].map((round) => ({ round, reached: o.online + o.never, assembled: { rate: 0.5, low95: 0.4, high95: 0.6, n: 10, of: 20 }, online: { rate: 0, low95: 0, high95: 0.1, n: 0, of: 20 }, expected: 0.5 })),
    onlineRate: { rate: o.online / (o.online + o.never), low95: 0, high95: 0.2, n: o.online, of: o.online + o.never },
    online: slice(0, o.online, o.onlineWr ?? 0.5),
    never: slice(0, o.never, o.neverWr ?? 0.5),
    gap: null,
    medianRound: o.online ? 3 : null,
    meanTurnsOnline: o.online ? 2 : null,
    meanDrawn: { enabler: 1, payoff: 1, both: 0, piece: 0 },
    cards: [{ id: 'kilo', name: 'Kilo Byte', role: 'enabler', present: slice(5, 30, 0.6), absent: slice(2, 5, 0.2) }],
  }) as SynergyRow;
const synReport = (catalogueVersion = 'CAT'): SynergyReport =>
  ({
    kind: 'synergy-report',
    reportSchema: 1,
    aggregateSchema: 1,
    catalogueVersion,
    note: '',
    minSliceGames: MIN_SLICE_GAMES,
    rounds: [2, 4, 6],
    games: 100,
    manifest: MANIFEST(8),
    decks: [
      { listId: 'LIST_A', name: 'Deck A', games: 60, winRate: 0.5, synergies: [pkgRow('dead', { online: 0, neverWr: 0.45, never: 60 }), pkgRow('hot', { online: 40, never: 20, onlineWr: 0.8, neverWr: 0.3 })] },
      { listId: 'LIST_GONE', name: 'Retired', games: 20, winRate: 0.5, synergies: [pkgRow('hot', { online: 10, never: 10 })] },
    ],
    pooled: [pkgRow('dead', { online: 0, never: 60 }), pkgRow('hot', { online: 50, never: 30, onlineWr: 0.7, neverWr: 0.4 })],
  }) as unknown as SynergyReport;

describe('on fixtures', () => {
  it('a thin slice has no rate, and its text says too few games', () => {
    expect(winRateOf(9, 12)).toEqual({ games: 12, rate: null, low95: null, high95: null, thin: true });
    const r = winRateOf(12, 20);
    expect([r.rate, r.thin]).toEqual([0.6, false]);
    expect(r.low95! < 0.6 && r.high95! > 0.6).toBe(true);
    const f = cardUse(decReport(), 'fixture.json', 'kilo', { listId: 'LIST_A' })!;
    const sell = f.modes.find((m) => m.mode === 'sell')!;
    expect([sell.won.games, sell.won.rate, sell.won.thin]).toEqual([12, null, true]);
    const text = cardStatText({ card: 'Kilo Byte', deck: 'Deck A', use: f, analysis: null });
    expect(text).toContain('Sold for an Eddie: 24 times in 12 of the list\'s 60 games');
    expect(text).toContain('Win rate of those games: 12 games, too few games for a rate.');
    expect(text).toMatch(/even 1 use, won 1 game, too few games/);
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('a card on several lists: one fact per list, and the pooled row counts the lists that hold it', () => {
    const rep = decReport();
    expect(cardUseLists(rep, 'kilo')).toEqual(['LIST_A', 'LIST_B', 'LIST_GONE']);
    expect(cardUse(rep, 'f', 'kilo', { listId: 'LIST_B' })!.modes[0]!.won.rate).toBe(0.4);
    const p = cardUse(rep, 'f', 'kilo')!;
    expect([p.scope, p.lists, p.listsInReport, p.modes[0]!.won.games]).toEqual(['pooled', 3, 3, 90]);
  });

  it('the analysis rebuilds the gap with an interval, and leaves out a thin side', () => {
    const a = cardAnalysis(anaReport, 'a.json', 'kilo', 'LIST_A')!;
    expect(a.storedGap).toBe(0.2);
    expect(a.wonDrawn.rate).toBeCloseTo(0.6, 12);
    expect(a.wonNotDrawn.thin).toBe(true); // 15 games without it
    expect(a.gap).toBeNull();
    const wide = cardAnalysis({ ...anaReport, decks: [{ ...anaReport.decks[0]!, games: 90 }] }, 'a.json', 'kilo', 'LIST_A')!;
    expect(wide.gap!.gap).toBeCloseTo(0.2, 12);
    expect(wide.gap!.low95 < 0.2 && wide.gap!.high95 > 0.2).toBe(true);
    expect([a.soldGames, a.drawnGames]).toEqual([9, 45]);
  });

  it('a package that never came online: no online rate, no lift, hidden by the gate', () => {
    const f = packageFact(synReport(), 's.json', 'dead', { listId: 'LIST_A', catalogueVersion: 'CAT' })!;
    expect([f.online.n, f.online.of, f.wonOnline.games, f.wonOnline.thin, f.lift, f.gate, f.medianRound]).toEqual([0, 60, 0, true, null, 'hidden', null]);
    const text = packageStatText(f, { deck: 'Deck A' });
    expect(text).toContain('Came online (its board condition held at some point): 0 of 60 games (0.0%, 95% interval 0.0%–20.0%).');
    expect(text).toContain('in the games it came online: 0 games, too few games for a rate');
    expect(text).toContain('Lift: too few games on one side to give one.');
    const hot = packageFact(synReport(), 's.json', 'hot', { listId: 'LIST_A', catalogueVersion: 'CAT' })!;
    expect([hot.gate, hot.gateBasis]).toEqual(['measured', 'list']);
    expect(hot.lift!.gap).toBeCloseTo(0.5, 12);
    expect(packageFact(synReport(), 's.json', 'hot', { listId: 'LIST_A', catalogueVersion: 'NEW' })!.gate).toBe('unmeasured');
    expect(packageLists(synReport(), 'hot')).toEqual(['LIST_A', 'LIST_GONE']);
  });

  it('a list no longer in the library is skipped and counted; a missing report is counted', () => {
    const skipped: Record<string, number> = {};
    const decks: Record<string, { file: string; name: string }> = { LIST_A: { file: 'deck-a.txt', name: 'Deck A' }, LIST_B: { file: 'deck-b.txt', name: 'Deck B' } };
    const rs = buildStats(
      { decisions: { file: 'd.json', data: decReport() }, synergies: { file: 's.json', data: synReport() }, analysis: { file: 'a.json', data: anaReport }, impact: null, catalogueVersion: 'CAT' },
      { deckOf: (l) => decks[l], cardName: () => 'Kilo Byte', hasCard: () => true, hasPackage: (id) => id !== 'dead', skipped },
    );
    expect(rs.map((r) => r.id).sort()).toEqual(['cardstat:deck-a/kilo', 'cardstat:deck-b/kilo', 'cardstat:kilo', 'pkgstat:dead', 'pkgstat:deck-a/dead', 'pkgstat:deck-a/hot', 'pkgstat:hot']);
    expect(skipped).toEqual({ 'stats: impact table missing': 1, 'stats: list not in the library (cards)': 1, 'stats: list not in the library (packages)': 1 });
    const a = rs.find((r) => r.id === 'cardstat:deck-a/kilo')!;
    expect(a.links).toEqual([
      { rel: 'card', to: 'card:kilo' },
      { rel: 'deck', to: 'deck:deck-a' },
      { rel: 'parent', to: 'cardstat:kilo' },
    ]);
    expect(rs.find((r) => r.id === 'pkgstat:deck-a/dead')!.links.map((l) => l.rel)).toEqual(['deck', 'parent']);
    expect(a.stamps).toEqual({ asOf: '2026-01-02T03:04:05.000Z', bot: 'fixture', listId: 'LIST_A', simVersion: 8 });
    expect(a.text.split('\n')[0]).toContain('measured by the fixture bot on sim version 8 (2026-01-02, 100 games in the run)');
    // no report at all: nothing built, each missing report counted
    const none: Record<string, number> = {};
    expect(buildStats({ decisions: null, synergies: null, analysis: null, impact: null, catalogueVersion: 'CAT' }, { deckOf: () => undefined, cardName: () => undefined, hasCard: () => false, hasPackage: () => false, skipped: none })).toEqual([]);
    expect(Object.keys(none).sort()).toEqual(['stats: decision report missing', 'stats: deck analysis missing', 'stats: impact table missing', 'stats: synergy report missing']);
    expect(reportBasis('gone.json', null)).toEqual({ file: 'gone.json', simVersion: null, bot: null, asOf: null, runId: null, games: null, stale: true });
  });

  it('a report from an older sim version is stale and says so', () => {
    const old = cardUse(decReport(CURRENT_SIM_VERSION - 1), 'old.json', 'kilo', { listId: 'LIST_A' })!;
    expect(old.basis.stale).toBe(true);
    expect(cardStatText({ card: 'Kilo Byte', deck: 'Deck A', use: old, analysis: null }).split('\n')[0]).toContain(`(stale: the current sim version is ${CURRENT_SIM_VERSION})`);
    const rs = buildStats(
      { decisions: { file: 'd.json', data: decReport(CURRENT_SIM_VERSION - 1) }, synergies: null, analysis: null, impact: null, catalogueVersion: 'CAT' },
      { deckOf: (l) => (l === 'LIST_A' ? { file: 'deck-a.txt', name: 'Deck A' } : undefined), cardName: () => 'Kilo Byte', hasCard: () => true, hasPackage: () => true, skipped: {} },
    );
    expect(rs.every((r) => r.fields?.stale === true)).toBe(true);
  });
});
