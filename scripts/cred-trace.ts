// C.1's intended-effect metric (docs/REVIEW_2026-11-24.md B4, §10 C.1): how often a deck's Street Cred is even, counted
// in the games a duplicate botcheck plays (`npx tsx scripts/botcheck.ts A B --cred-trace`). The worker's `credTrace`
// (scripts/worker.ts) observes every end phase of the real game (never a lookahead copy) and counts, for each seat, its
// Street Cred's parity and whether it holds an even and an odd Gig, at the end of its own turn and of the rival's.
// Observe-only: the games are the same with or without it.
//
// The metric, written before any game was played (2026-11-24):
//   M1 (primary) the 11 library decks built around `cred-even` (synergiesIn(...).builtAround): the share of their own
//      turn ends at which their Street Cred is even (Null, no Gig, is not even), with config A piloting them against
//      with config B on the same deals. Pooled ratio per config; the A − B difference with a 95% interval from the
//      deal-and-seat clusters (delta method on the two ratios). C.1 is meant to raise it: A = switch on, B = off,
//      difference above 0 with the interval above 0, on Medium and on Hard.
//   M2 the same at the end of the rival's turn (the Street Cred the deck takes into its own turn, before it rolls in).
//   M1b the decks with a Street Cred card but not built around it (their plan changes too, by less).
//   C1 (control) the decks with Jackie Welles or Bootleg Black Sapphire Show and no Street Cred card, whose own plan the
//      switch does not change: the share of own turn ends with an even and an odd Gig. Reported, not a criterion.
import type { Game } from '../src/engine/engine';
import type { DeckList, PlayerId } from '../src/engine/types';
import { synergiesIn } from '../src/content/synergies';
import { CARDS } from '../src/engine/cards';
import { CRED_EVEN_PATTERN, CRED_ODD_PATTERN, GIG_PARITY_PATTERN } from '../src/ai/knowledge';

/** One seat's end phases of one kind: how many, and at how many its Street Cred was even, odd or Null, and it held an even and an odd Gig. */
export interface ParityCount {
  ends: number;
  even: number;
  odd: number;
  nul: number;
  evenOdd: number;
}
/** One seat's counts: at the end of its own turns and of the rival's. */
export interface CredEnds {
  own: ParityCount;
  rival: ParityCount;
}

const zero = (): ParityCount => ({ ends: 0, even: 0, odd: 0, nul: 0, evenOdd: 0 });
export const emptyCredEnds = (): [CredEnds, CredEnds] => [
  { own: zero(), rival: zero() },
  { own: zero(), rival: zero() },
];

/** Count both seats at an end phase whose turn was `active`'s (called after the end phase, before the next turn). */
export function countEnd(g: Game, active: PlayerId, into: [CredEnds, CredEnds]) {
  for (const p of [0, 1] as PlayerId[]) {
    const c = p === active ? into[p].own : into[p].rival;
    const gigs = g.gigsOf(p);
    c.ends++;
    if (!gigs.length) c.nul++;
    else if (gigs.reduce((a, x) => a + x.value, 0) % 2 === 0) c.even++;
    else c.odd++;
    if (gigs.some((x) => x.value % 2 === 0) && gigs.some((x) => x.value % 2 === 1)) c.evenOdd++;
  }
}

/** Observe every end phase of `g` (the real game: a lookahead copy is another object) into `into`. */
export function traceCred(g: Game, into: [CredEnds, CredEnds]) {
  const endPhase = g.endPhase.bind(g);
  g.endPhase = async () => {
    const active = g.s.active;
    await endPhase();
    countEnd(g, active, into);
  };
}

const CRED_IDS = new Set(CARDS.filter((c) => CRED_EVEN_PATTERN.test(c.text) || CRED_ODD_PATTERN.test(c.text)).map((c) => c.id));
const GIG_PARITY_IDS = new Set(CARDS.filter((c) => GIG_PARITY_PATTERN.test(c.text)).map((c) => c.id));

/** Which group of the metric a deck is in (null: none). */
export function credGroup(d: DeckList): 'built' | 'some' | 'gigParity' | null {
  const ids = [...d.legends, ...d.main];
  if (synergiesIn(d).some((s) => s.synergy.id === 'cred-even' && s.builtAround)) return 'built';
  if (ids.some((x) => CRED_IDS.has(x))) return 'some';
  if (ids.some((x) => GIG_PARITY_IDS.has(x))) return 'gigParity';
  return null;
}

/** One deck in one deal: its counts under config A and under config B (the same deal, the configs swapped). */
export interface PairedObs {
  deck: string;
  group: 'built' | 'some' | 'gigParity';
  a: CredEnds;
  b: CredEnds | null;
}

/** A pooled ratio Σnum/Σden per config, and A − B with a 95% interval by clusters (delta method). */
export interface RatioDiff {
  a: number;
  b: number;
  diff: number;
  lo: number;
  hi: number;
  /** clusters (deal × seat) and the denominators summed */
  n: number;
  denA: number;
  denB: number;
}

export function pairedRatio(obs: { aNum: number; aDen: number; bNum: number; bDen: number }[]): RatioDiff {
  const n = obs.length;
  const sum = (f: (o: (typeof obs)[number]) => number) => obs.reduce((s, o) => s + f(o), 0);
  const [aN, aD, bN, bD] = [sum((o) => o.aNum), sum((o) => o.aDen), sum((o) => o.bNum), sum((o) => o.bDen)];
  const rA = aD ? aN / aD : NaN;
  const rB = bD ? bN / bD : NaN;
  let v = 0;
  for (const o of obs) {
    const z = (o.aNum - rA * o.aDen) / aD - (o.bNum - rB * o.bDen) / bD;
    v += z * z;
  }
  const se = n > 1 ? Math.sqrt((v * n) / (n - 1)) : NaN;
  const diff = rA - rB;
  return { a: rA, b: rB, diff, lo: diff - 1.96 * se, hi: diff + 1.96 * se, n, denA: aD, denB: bD };
}

/** The report's lines: M1, M2, M1b, C1, and M1 deck by deck. */
export function credTraceLines(obs: PairedObs[]): string[] {
  const pc = (x: number) => (100 * x).toFixed(1);
  const fmt = (r: RatioDiff) => (r.n === 0 ? 'no games' : r.n === 1 ? fmtOne(r) : fmtAll(r));
  const fmtOne = (r: RatioDiff) => `A ${pc(r.a)}% vs B ${pc(r.b)}% (1 deck-deal, ${r.denA} / ${r.denB} turn ends)`;
  const fmtAll = (r: RatioDiff) => `A ${pc(r.a)}% vs B ${pc(r.b)}%: A − B ${r.diff >= 0 ? '+' : ''}${pc(r.diff)} points [${pc(r.lo)}, ${pc(r.hi)}] (95%, ${r.n} deck-deals, ${r.denA} / ${r.denB} turn ends)`;
  const paired = obs.filter((o): o is PairedObs & { b: CredEnds } => o.b !== null);
  const ratio = (group: PairedObs['group'], when: 'own' | 'rival', num: 'even' | 'evenOdd', of = paired) =>
    pairedRatio(of.filter((o) => o.group === group).map((o) => ({ aNum: o.a[when][num], aDen: o.a[when].ends, bNum: o.b[when][num], bDen: o.b[when].ends })));
  const nul = (group: PairedObs['group']) => {
    const g = paired.filter((o) => o.group === group);
    const s = (k: 'a' | 'b', f: 'nul' | 'ends') => g.reduce((x, o) => x + o[k].own[f], 0);
    if (!g.length) return 'no games';
    return `Null at own turn ends: A ${pc(s('a', 'nul') / s('a', 'ends'))}%, B ${pc(s('b', 'nul') / s('b', 'ends'))}%`;
  };
  const out = [
    'C.1 intended effect (scripts/cred-trace.ts): Street Cred parity, the deck piloted by A against by B on the same deals',
    `  M1  built around an even Street Cred, even at own turn ends: ${fmt(ratio('built', 'own', 'even'))}; ${nul('built')}`,
    `  M2  built around an even Street Cred, even at the rival's turn ends: ${fmt(ratio('built', 'rival', 'even'))}`,
    `  M1b a Street Cred card, not built around it, even at own turn ends: ${fmt(ratio('some', 'own', 'even'))}`,
    `  C1  Gig parity decks (control), an even and an odd Gig at own turn ends: ${fmt(ratio('gigParity', 'own', 'evenOdd'))}`,
    '  M1 by deck:',
  ];
  const decks = [...new Set(paired.filter((o) => o.group === 'built').map((o) => o.deck))].sort();
  for (const d of decks) out.push(`    ${d}: ${fmt(ratio('built', 'own', 'even', paired.filter((o) => o.deck === d)))}`);
  return out;
}
