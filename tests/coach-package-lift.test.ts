// INFO-8: the coach's package notes and warnings are shown only for a package whose measured lift (win rate when it
// came online minus win rate when it never did) has a 95% interval above 0, labelled as an association; with no synergy
// report they are worded as unmeasured ideas; with a report, a package without such a lift is left out.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { listFingerprint, parseDeck } from '../src/engine/deck';
import type { Decision, PlayerId } from '../src/engine/types';
import { advise, coachRequest, adviseRequest, packageNotes, packageWarnings } from '../src/ai/coach';
import { liftGate, liftLabel, newcombeDiff, readLiftSlice, seatLift, seatLiftFromSlice, type PackageLift, type SeatLift } from '../src/ai/packageLift';
import { readSynergyReport } from '../src/ui/synergyReport';
import type { SynergyReport, SynergyRow } from '../src/analysis/synergies';
import { fillerDeck, gig, Scripted } from './engine-helpers';

const deck = (f: string) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const BBG = deck('meta-bbg-cunningham-econ.txt');
const RRY = deck('meta-rry-smasher-aggro.txt');

function game(list = BBG): Game {
  const g = Game.create([list, fillerDeck('B')], [new Scripted(), new Scripted()], { seed: 5, first: 0 });
  g.s.turn = 3;
  g.s.phase = 'main';
  g.s.active = 0;
  for (const p of [0, 1] as PlayerId[]) for (const u of [...g.P(p).hand]) g.move(u, 'deck');
  return g;
}
function take(g: Game, p: PlayerId, id: string, zone: 'hand' | 'field' | 'trash') {
  const u = g.P(p).deck.find((x) => g.c(x).defId === id);
  if (u === undefined) throw new Error(`no ${id} left in the deck`);
  g.move(u, zone);
  return g.c(u);
}
/** BBG: the last Towerfall (Behind on Street Cred's only payoff) in hand beside a plain Unit; a sell decision. */
function bbgSell() {
  const g = game();
  take(g, 0, 'towerfall', 'trash');
  take(g, 0, 'towerfall', 'trash');
  const keep = take(g, 0, 'towerfall', 'hand');
  const sell = take(g, 0, 'psycho_squad', 'hand');
  const d: Decision = { player: 0, kind: 'action', prompt: '', min: 1, max: 1, options: [{ label: `Sell ${g.name(sell.uid)}`, action: { type: 'sell', uid: sell.uid } }, { label: `Sell ${g.name(keep.uid)}`, action: { type: 'sell', uid: keep.uid } }] };
  return { g, d };
}
/** RRY: Gunpoint Diplomacy (an Ahead on Street Cred payoff) in hand, Street Cred 2 against 5. */
function rryBehind() {
  const g = game(RRY);
  take(g, 0, 'gunpoint_diplomacy', 'hand');
  gig(g, 0, 4, 2);
  gig(g, 1, 6, 5);
  return g;
}

const lift = (low95: number, basis: PackageLift['basis'] = 'list'): PackageLift => ({ basis, online: 0.62, never: 0.48, onlineGames: 120, neverGames: 150, lift: 0.14, low95, high95: 0.26 });
const MEASURED: SeatLift = { 'low-cred': lift(0.02), 'high-cred': lift(0.05, 'pooled') };
const NOT_ABOVE_0: SeatLift = { 'low-cred': lift(-0.03), 'high-cred': lift(0) };

const KEEP = 'Keep Towerfall: it is your only payoff for Behind on Street Cred left, and it pairs with Jackie Welles: Pour One Out For Me in your deck.';
const BEHIND = 'Your Street Cred (2) is not above the rival’s (5); your deck wants it higher (Ahead on Street Cred).';

describe('package lift (src/ai/packageLift.ts)', () => {
  it("Newcombe's interval for a difference of two rates", () => {
    // equal rates with symmetric Wilson bounds: centred on 0
    const r = newcombeDiff(0.5, 0.4, 0.6, 0.5, 0.4, 0.6);
    expect(r.low95).toBeCloseTo(-Math.SQRT2 * 0.1, 12);
    expect(r.high95).toBeCloseTo(Math.SQRT2 * 0.1, 12);
    const s = newcombeDiff(0.7, 0.6, 0.78, 0.4, 0.3, 0.5);
    expect(s.low95).toBeCloseTo(0.3 - Math.hypot(0.1, 0.1), 12);
    expect(s.high95).toBeCloseTo(0.3 + Math.hypot(0.08, 0.1), 12);
  });

  it("reads the list's own slices, pooled when they are thin, nothing for a thin pooled row or another catalogue", () => {
    const slice = (games: number, wr: number, lo: number, hi: number, thin = false) => ({ uses: 0, games, winRate: thin ? null : wr, low95: thin ? null : lo, high95: thin ? null : hi, thin });
    const row = (id: string, on: ReturnType<typeof slice>, nv: ReturnType<typeof slice>) => ({ id, name: id, online: on, never: nv }) as unknown as SynergyRow;
    const report = {
      kind: 'synergy-report',
      decks: [{ listId: 'L1', name: 'x', games: 300, winRate: 0.5, synergies: [row('a', slice(100, 0.7, 0.6, 0.78), slice(100, 0.4, 0.3, 0.5)), row('b', slice(10, 0, 0, 0, true), slice(200, 0.5, 0.43, 0.57))] }],
      pooled: [row('a', slice(500, 0.5, 0.46, 0.54), slice(500, 0.5, 0.46, 0.54)), row('b', slice(400, 0.6, 0.55, 0.65), slice(400, 0.5, 0.45, 0.55)), row('c', slice(5, 0, 0, 0, true), slice(500, 0.5, 0.46, 0.54))],
    } as unknown as SynergyReport;
    const t = seatLift(report, 'L1')!;
    expect(t.a!.basis).toBe('list');
    expect(t.a!.lift).toBeCloseTo(0.3, 12);
    expect(t.b!.basis).toBe('pooled');
    expect(t.c).toBeUndefined();
    expect(Object.keys(seatLift(report, 'other')!).sort()).toEqual(['a', 'b']);
    expect(seatLift(report, 'L1', false)).toBeNull();
    expect(seatLift(null, 'L1')).toBeNull();
    // gates: above 0 measured; touching or below 0 hidden; no report unmeasured
    expect(liftGate(t, 'a')).toBe('measured');
    expect(liftGate(seatLift(report, 'other'), 'a')).toBe('hidden');
    expect(liftGate(t, 'c')).toBe('hidden');
    expect(liftGate(null, 'a')).toBe('unmeasured');
    expect(liftGate(undefined, 'a')).toBe('unmeasured');
    expect(liftLabel(null, [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])).toBe('(A and B are ideas from the package catalogue, not measured in bot games.)');
  });
});

describe('coach package notes, gated by measured lift', () => {
  it('BBG sell: unmeasured without a report, labelled as an association when measured, left out otherwise', () => {
    const { g, d } = bbgSell();
    expect(packageNotes(g, d, 0)).toEqual([`${KEEP} (Behind on Street Cred is an idea from the package catalogue, not measured in bot games.)`]);
    expect(packageNotes(g, d, 0, null)).toEqual(packageNotes(g, d, 0));
    expect(packageNotes(g, d, 0, MEASURED)).toEqual([
      `${KEEP} (In bot games on this list, games where Behind on Street Cred came online were won 62% of the time, against 48% when it never did: an association, not proof that it wins games.)`,
    ]);
    expect(packageNotes(g, d, 0, NOT_ABOVE_0)).toEqual([]);
    expect(packageNotes(g, d, 0, {})).toEqual([]);
  });

  it('RRY warning: the same three cases', () => {
    const g = rryBehind();
    expect(packageWarnings(g, 0)).toEqual([`${BEHIND} (Ahead on Street Cred is an idea from the package catalogue, not measured in bot games.)`]);
    expect(packageWarnings(g, 0, MEASURED)).toEqual([
      `${BEHIND} (In bot games pooled over every list that holds it, games where Ahead on Street Cred came online were won 62% of the time, against 48% when it never did: an association, not proof that it wins games.)`,
    ]);
    expect(packageWarnings(g, 0, NOT_ABOVE_0)).toEqual([]);
  });

  it('the advice carries the gate, and the lift crosses to the worker in the request', async () => {
    const { g, d } = bbgSell();
    const plain = await advise(g, d);
    expect(plain.why).toContain('not measured in bot games');
    const hidden = await advise(g, d, NOT_ABOVE_0);
    expect(hidden.why).not.toContain('Towerfall: it is your only payoff');
    const req = structuredClone(coachRequest(g, d, MEASURED));
    expect(req.lift).toEqual(MEASURED);
    expect((await adviseRequest(req)).why).toContain('an association, not proof');
    expect('lift' in coachRequest(g, d)).toBe(false);
  }, 30_000);

  it('with the bundled synergy report: notes for two decks', () => {
    const loaded = readSynergyReport(JSON.parse(readFileSync('public/data/synergies.json', 'utf8')));
    expect(loaded.state).toBe('ready');
    if (loaded.state !== 'ready') return;
    const bbg = seatLift(loaded.report, listFingerprint(BBG), loaded.current);
    const rry = seatLift(loaded.report, listFingerprint(RRY), loaded.current);
    // the Play page's path: the tracked lift slice gives the same tables (RAG_PLAN step 0.1)
    const slice = readLiftSlice(JSON.parse(readFileSync('public/data/lift.json', 'utf8')));
    expect(seatLiftFromSlice(slice, listFingerprint(BBG), loaded.current)).toEqual(bbg);
    expect(seatLiftFromSlice(slice, listFingerprint(RRY), loaded.current)).toEqual(rry);
    const { g, d } = bbgSell();
    const r = rryBehind();
    expect({
      bbg: { lowCred: liftGate(bbg, 'low-cred'), sellNotes: packageNotes(g, d, 0, bbg) },
      rry: { highCred: liftGate(rry, 'high-cred'), warnings: packageWarnings(r, 0, rry) },
    }).toMatchSnapshot();
  });
});
