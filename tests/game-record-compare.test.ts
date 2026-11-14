// Comparing a record with the coach and the bots (src/lib/gameRecord/coachCompare.ts) and the table before a line
// (src/lib/gameRecord/show.ts; docs/GAME_RECORD.md "Compare" and "Show"). One short pinned game (four turns, an Easy bot
// and a seat that picks some moves at random and chooses its own payments), so it stays quick.
import { describe, expect, it } from 'vitest';
import { advise, coachRequest, coachWorthAsking, gradeMove, scoreMoveRequest } from '../src/ai/coach';
import { makeTierBot } from '../src/ai/tiers';
import type { Game } from '../src/engine/engine';
import type { Agent, Decision, DeckList } from '../src/engine/types';
import { spawnSync } from 'node:child_process';
import {
  aggregateSeeds,
  compareJson,
  compareRecord,
  compareSeeds,
  compareText,
  costlyMoves,
  hiddenRefusal,
  replaySeeds,
  seedsJson,
  seedsText,
  settledCount,
  tallyText,
  type ComparedDecision,
  type CompareOptions,
  type CompareReport,
} from '../src/lib/gameRecord/coachCompare';
import { compareGames } from '../src/lib/gameRecord/compare';
import { exportGame, type ExportResult } from '../src/lib/gameRecord/exporter';
import { parseRecord, type DeckRef, type GameRecord } from '../src/lib/gameRecord/notation';
import { replayRecord } from '../src/lib/gameRecord/replay';
import { showAt } from '../src/lib/gameRecord/show';
import { loadLibrary } from '../scripts/lib-node';

const lib = loadLibrary();
const deck = (file: string): DeckList => {
  const d = lib.find((x) => x.file === file)!.deck;
  return { name: d.name, legends: [...d.legends], main: [...d.main], sideboard: [] };
};
const resolveDeck = (ref: DeckRef): DeckList | string => (ref.kind === 'list' ? { name: ref.name, legends: [...ref.legends], main: [...ref.main], sideboard: [] } : 'no deck');

/** A seat that picks some moves at random and chooses its own payments and ends of turn (as a person may). */
class Person implements Agent {
  name = 'person';
  choosesPayment = true;
  confirmsEndTurn = true;
  private inner = makeTierBot('easy', 5);
  constructor(private r: number) {}
  private rnd() {
    this.r = (Math.imul(this.r, 1664525) + 1013904223) >>> 0;
    return this.r / 2 ** 32;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'pay') return [this.rnd() < 0.5 ? 0 : Math.floor(this.rnd() * d.options.length)];
    if (d.options.length > 1 && this.rnd() < 0.3) return [Math.floor(this.rnd() * d.options.length)];
    if (d.kind === 'action' && d.options.length === 1) return [0];
    return this.inner.decide(g, d);
  }
}

let pinned: Promise<{ ex: ExportResult; rec: GameRecord }> | null = null;
function game() {
  pinned ??= exportGame({
    decks: [deck('meta-gry-trauma-team.txt'), deck('meta-yyb-rogue-gear.txt')],
    agents: [new Person(11), makeTierBot('easy', 12)],
    seed: 11,
    first: 1,
    maxTurns: 4,
  }).then((ex) => {
    const pr = parseRecord(ex.text);
    expect(pr.errors).toEqual([]);
    return { ex, rec: pr.record! };
  });
  return pinned;
}

const opts = (o: Partial<CompareOptions> = {}): CompareOptions => ({ seed: 3, resolveDeck, seats: [0, 1], bots: ['easy'], botSeed: 1, ...o });
let both: ReturnType<typeof compareRecord> | null = null;
const compareBoth = async () => (both ??= game().then(({ rec }) => compareRecord(rec, opts())));

describe('compare: the coach and the bots at every decision', () => {
  it('replays to the end and counts every decision: compared, skipped (with why) or of a seat not asked', async () => {
    const { ex } = await game();
    const r = await compareBoth();
    expect(r.ok).toBe(true);
    expect(r.result).toEqual({ winner: ex.state.winner, turn: ex.state.turn, reason: 'turn limit' });
    expect(r.compared.length).toBeGreaterThan(5);
    expect(r.compared.length + r.skipped.length + r.otherSeats).toBe(r.decisions);
    expect(r.otherSeats).toBe(0);
    // the Person seat chooses its payments: the coach does not advise on those; a lone End turn is forced
    expect(r.skipped.some((s) => s.reason === 'not-advised')).toBe(true);
    expect(r.skipped.some((s) => s.reason === 'forced')).toBe(true);
    const text = compareText(r);
    expect(text).toMatch(/skipped, a payment or an effect order \(the coach does not advise on these\): \d+/);
    expect(text).toMatch(/Scorecard, as the Play page counts it/);
    expect(text).toContain("it is not the truth about the game");
    for (const c of r.compared) {
      expect(c.bots).toHaveLength(1);
      expect(c.bots[0]!.index).not.toBeNull();
      expect(c.coach.grade.verdict).not.toBe('pending');
    }
  }, 60_000);

  // Directly = advise() on a copy of the replayed position made here (the engine's own copier, the live pending effects),
  // not on the live game itself: the evaluation caches each seat's Gig plan on the player-state object (src/ai/eval.ts
  // planFor), so advise() on one long-lived game reuses the plan of its first call, while the Play page always advises
  // on a fresh snapshot (coachRequest), as compare does.
  it("the coach's pick and grade are what advise and gradeMove give when called directly on the same replayed position", async () => {
    const { rec } = await game();
    const r = await compareBoth();
    const direct: { n: number; index: number; why: string; verdict: string; gap: number | null; se?: number }[] = [];
    let n = 0;
    const plain = await replayRecord(rec, {
      seed: 3,
      resolveDeck,
      async onDecision({ game: g, decision: d, answer }) {
        n++;
        if (!coachWorthAsking(d)) return;
        const copy = g.probeCopy();
        copy.pending = g.pending.map((x) => ({ ...x }));
        let a;
        try {
          a = await advise(copy, d);
        } catch {
          return;
        }
        let gr = gradeMove(d, answer, a, g.s.turn);
        if (gr.verdict === 'pending') gr = gradeMove(d, answer, a, g.s.turn, await scoreMoveRequest({ req: coachRequest(g, d), chosen: answer, coach: a.index, ...(a.grade ? { grade: a.grade } : {}) }));
        direct.push({ n, index: a.index, why: a.why, verdict: gr.verdict, gap: gr.gap, ...(gr.se !== undefined ? { se: gr.se } : {}) });
      },
    });
    expect(plain.ok).toBe(true);
    expect(r.compared.map((c) => ({ n: c.n, index: c.coach.index, why: c.coach.why, verdict: c.coach.grade.verdict, gap: c.coach.grade.gap, ...(c.coach.grade.se !== undefined ? { se: c.coach.grade.se } : {}) }))).toEqual(direct);
  }, 60_000);

  it('gives the same report twice, and comparing does not disturb the replay', async () => {
    const { rec } = await game();
    const a = await compareBoth();
    const b = await compareRecord(rec, opts());
    expect(compareText(b)).toBe(compareText(a));
    expect(JSON.stringify(compareJson(b))).toBe(JSON.stringify(compareJson(a)));
    // a plain replay (as `npm run record -- check` runs it) makes the same decisions and ends in the same state
    const plain = await replayRecord(rec, { seed: 3, resolveDeck });
    expect(plain.ok).toBe(true);
    const c = compareGames({ state: plain.state!, decisions: plain.decisions }, { state: a.replay!.state!, decisions: a.replay!.decisions });
    expect(c.same, c.decisionDiff ?? c.stateDiff ?? c.logDiff ?? '').toBe(true);
  }, 60_000);

  it("compares one seat's decisions only, with the same verdicts as when both are compared", async () => {
    const { rec } = await game();
    const all = await compareBoth();
    const p2 = await compareRecord(rec, opts({ seats: [1] }));
    expect(p2.compared.every((c) => c.seat === 1)).toBe(true);
    expect(p2.skipped.every((s) => s.seat === 1)).toBe(true);
    expect(p2.otherSeats).toBe(all.compared.filter((c) => c.seat === 0).length + all.skipped.filter((s) => s.seat === 0).length);
    expect(p2.compared).toEqual(all.compared.filter((c) => c.seat === 1));
    expect(compareText(p2)).toMatch(/Seats compared: p2\./);
  }, 60_000);

  it('refuses a record with a hidden card on a compared seat, in one sentence', async () => {
    const { ex } = await game();
    const text = ex.text.replace(/^p1 hand: .*$/m, 'p1 hand: ?, ?, ?, ?, ?, ?');
    const rec = parseRecord(text).record!;
    const r = await compareRecord(rec, opts({ seats: [0] }));
    expect(r.ok).toBe(false);
    expect(r.refused).toMatch(/^Line \d+ says “p1 hand: \?, \?, \?, \?, \?, \?”, which hides a card or value of p1, the seat being compared: compare needs a full-information record/);
    expect(r.refused!.split(/(?<=\.) /)).toHaveLength(1);
    expect(r.compared).toEqual([]);
    // a hidden card of the other seat is not compare's refusal (the replay itself still needs every card)
    expect(hiddenRefusal(rec, [1])).toBeNull();
    const other = await compareRecord(rec, opts({ seats: [1] }));
    expect(other.ok).toBe(false);
    expect(other.stop?.message).toMatch(/hidden card or value/);
  }, 60_000);
});

describe('compare under several replay seeds', () => {
  it('one seed gives exactly the single-seed report, text and JSON', async () => {
    const { rec } = await game();
    const one = await compareBoth();
    const viaSeeds = await compareSeeds(rec, opts(), [3]);
    expect(viaSeeds).toHaveLength(1);
    expect(seedsText(viaSeeds)).toBe(compareText(one));
    expect(JSON.stringify(seedsJson(viaSeeds))).toBe(JSON.stringify(compareJson(one)));
    expect(replaySeeds(3, 1)).toEqual([3]);
    expect(replaySeeds(1, 5)).toEqual([1, 2, 3, 4, 5]);
  }, 60_000);

  it('three seeds twice give the same text, with each decision counted over the seeds', async () => {
    const { rec } = await game();
    const seeds = replaySeeds(3, 3);
    const a = await compareSeeds(rec, opts(), seeds);
    const b = await compareSeeds(rec, opts(), seeds);
    const text = seedsText(a);
    expect(seedsText(b)).toBe(text);
    expect(a.map((r) => r.seed)).toEqual([3, 4, 5]);
    // the first seed's run is the single-seed run
    expect(compareText(a[0]!)).toBe(compareText(await compareBoth()));
    expect(text).toMatch(/Replay seeds 3, 4, 5/);
    expect(text).toMatch(/ in 3 of 3/);
    expect(text).toMatch(/Costliest moves, settled \(a Mistake or worse under at least 3 of the 3 seeds\)/);
    expect(text).toMatch(/Sometimes a Mistake, NOT settled/);
    expect(text).toMatch(/a different replay seed re-deals them differently/);
    for (const d of aggregateSeeds(a)) {
      expect(d.seeds).toBe(3);
      expect(d.ratings.reduce((s, t) => s + t.count, 0)).toBe(3);
      expect(d.picks.reduce((s, t) => s + t.count, 0)).toBe(3);
    }
  }, 60_000);

  it('a move graded a Mistake under only some seeds is "sometimes", not settled (made-up grades)', () => {
    const verdicts: Record<number, ['mistake' | 'close' | 'agree', number][]> = {
      // n: per seed [verdict, gap]
      1: [['mistake', 0.6], ['mistake', 0.9], ['mistake', 0.5]],
      2: [['mistake', 1.2], ['close', 0.1], ['mistake', 1.0]],
      3: [['agree', 0], ['agree', 0], ['agree', 0]],
    };
    const reports = [0, 1, 2].map((k): CompareReport => ({
      ok: true,
      seats: [0],
      bots: [],
      seed: 10 + k,
      botSeed: 1,
      simVersion: 0,
      players: ['A', 'B'],
      decks: ['x', 'y'],
      decisions: 3,
      skipped: [],
      otherSeats: 0,
      result: null,
      compared: Object.entries(verdicts).map(([n, per]): ComparedDecision => {
        const [verdict, gap] = per[k]!;
        const name = verdict === 'mistake' ? 'Mistake' : verdict === 'close' ? 'Close call' : 'Best';
        return {
          n: +n,
          line: 10 * +n,
          turn: 2,
          seat: 0,
          kind: 'main',
          recorded: null,
          played: 'Play X',
          playedIndex: 0,
          coach: { index: verdict === 'agree' ? 0 : 1, pick: verdict === 'agree' ? 'Play X' : 'End turn', why: '', grade: { turn: 2, chose: 'Play X', coach: 'End turn', gap, verdict }, rating: name, words: name, agrees: verdict === 'agree' },
          bots: [],
        };
      }),
    }));
    expect(settledCount(3)).toBe(3);
    expect(settledCount(5)).toBe(4);
    expect(settledCount(2)).toBe(2);
    const ds = aggregateSeeds(reports);
    expect(ds.map((d) => [d.n, d.mistakes, d.medianGap])).toEqual([
      [1, 3, 0.6],
      [2, 2, 1.0],
      [3, 0, 0],
    ]);
    expect(tallyText(ds[1]!.ratings, 3)).toBe('Mistake in 2 of 3, Close call in 1');
    expect(tallyText(ds[0]!.ratings, 3)).toBe('Mistake in 3 of 3');
    const { settled, sometimes } = costlyMoves(ds, 3);
    expect(settled.map((d) => d.n)).toEqual([1]);
    expect(sometimes.map((d) => d.n)).toEqual([2]);
    const text = seedsText(reports);
    const settledPart = text.slice(text.indexOf('Costliest moves, settled'), text.indexOf('Sometimes a Mistake'));
    const sometimesPart = text.slice(text.indexOf('Sometimes a Mistake'));
    expect(settledPart).toContain('line 10,');
    expect(settledPart).not.toContain('line 20,');
    expect(sometimesPart).toContain('line 20, turn 2, p1: Play X  →  coach: End turn; Mistake in 2 of 3, Close call in 1; median −1.0 Gigs');
    expect(text).toMatch(/the coach: 1 of 3 \(33%\) of the compared decisions/);
    expect(text).toMatch(/p1 \(A\): grade [A-F] to [A-F], 1–2 of 3 \(33%–67%\) measured moves/);
  });

  it('--seeds must be 1 to 9 (exit 2)', () => {
    for (const n of ['0', '10']) {
      const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/record.ts', 'compare', 'no-such-record.txt', '--seeds', n], { encoding: 'utf8' });
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/--seeds must be (at least 1|at most 9)/);
    }
  }, 60_000);
});

describe('show: the table before a line', () => {
  it('prints each side before a draw, and refuses a line in the setup', async () => {
    const { rec } = await game();
    const draw = rec.lines.find((l) => l.ev.k === 'draw' && l.ev.p === 0)!;
    const before = await showAt(rec, draw.line, { seed: 3, resolveDeck });
    const after = await showAt(rec, draw.line + 1, { seed: 3, resolveDeck });
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(before.text).toMatch(new RegExp(`^Before line ${draw.line} \\(“p1 draws `));
    expect(before.text).toMatch(/\n {2}Legends: .*\n {2}Field: .*\n {2}Gigs: .*\n {2}Fixer area: .*\n {2}Eddies: .*\n {2}Hand \(\d+\): .*\n {2}Deck: \d+ {3}Trash: \d+/);
    const hand = (s: typeof before.state) => s.players[0].hand.length;
    const n = draw.ev.k === 'draw' ? draw.ev.cards.length : 0;
    expect(hand(after.state)).toBe(hand(before.state) + n);
    expect(after.state.players[0].deck.length).toBe(before.state.players[0].deck.length - n);
    const setup = rec.lines.find((l) => l.ev.k === 'hand')!;
    const s = await showAt(rec, setup.line, { seed: 3, resolveDeck });
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.message).toMatch(/is in the setup/);
    const end = await showAt(rec, 100_000, { seed: 3, resolveDeck });
    expect(end.ok && end.text.startsWith('The end of the record: the game is over')).toBe(true);
  }, 60_000);
});
