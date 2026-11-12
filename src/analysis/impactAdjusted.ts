// INFO-2: a less confounded card-impact estimate, next to the plain "win rate when drawn minus when not" (IWD,
// analyze.ts). The plain IWD pools every game of a deck, so a card that is drawn mostly in long games takes the win rate
// of long games, and the opponent and the seat mix differ between the "drawn" and "not drawn" groups. This estimate:
//   - landmark: at own turn T it compares "seen by then" with "not seen by then" among the games still running at T
//     (a game ended earlier can't have drawn the card later), for T in LANDMARK_TURNS, combined by inverse variance;
//   - stratified by opponent list and seat (on the play / on the draw): the difference is taken inside each stratum and
//     combined with Mantel–Haenszel weights n1·n0/(n1+n0);
//   - with a standard error (binomial within strata) and a shrunk value: a normal prior centred on 0 whose spread is
//     estimated from the deck's own cards (empirical Bayes), so small samples pull toward 0;
//   - and, when the run recorded sell decisions, "kept against sold": among games in which the card was offered as a
//     sell at a decision where the player sold something, those it was always kept against those it was sold in.
// Association, not causal value: the bot's own choices still decide which cards are kept and which games run long.
// Pure functions over plain data (PlayerSummary); nothing here plays a game. Not read by any bot.
import { CARD_BY_ID, cardLabel } from '../engine/cards';
import { parseOption, type DecisionRecord } from '../engine/telemetry';
import type { PlayerId } from '../engine/types';
import { spearman } from '../lib/rankStability';
import type { PlayerSummary } from './summarize';

/** Own-turn landmarks: the card was seen by the player's T-th turn (after its draw). */
export const LANDMARK_TURNS = [1, 2, 3, 4] as const;
/** Fewest games on either side ("seen" and "not seen", over all strata) for an estimate. */
export const ADJ_MIN_SIDE = 8;
/** Floor of the prior spread used for shrinkage (win-rate points as a fraction). */
export const ADJ_TAU_MIN = 0.02;
const Z95 = 1.96;

/** The global turn of a player's T-th own turn. */
export const globalTurnOf = (ownTurn: number, first: boolean) => (first ? 2 * ownTurn - 1 : 2 * ownTurn);

export interface Estimate {
  /** difference in win rate (exposed minus not), as a fraction; NaN when there is too little data */
  est: number;
  se: number;
  /** games on each side, over the strata that count (both sides present) */
  n1: number;
  n0: number;
}
const NONE: Estimate = { est: NaN, se: NaN, n1: 0, n0: 0 };

/** One game's row for a stratified comparison. */
export interface Row {
  stratum: string;
  exposed: boolean;
  result: number;
}

/**
 * Win-rate difference exposed − not, inside each stratum, combined with Mantel–Haenszel weights h = n1·n0/(n1+n0).
 * The variance is Σh²·v / (Σh)² with v the binomial variance of the stratum's difference (rates smoothed by ½ a game so a
 * stratum with all wins still has spread). Strata without both sides are left out. NaN under `minSide` games a side.
 */
export function stratifiedDiff(rows: readonly Row[], minSide = ADJ_MIN_SIDE): Estimate {
  const by = new Map<string, { n1: number; w1: number; n0: number; w0: number }>();
  for (const r of rows) {
    let s = by.get(r.stratum);
    if (!s) by.set(r.stratum, (s = { n1: 0, w1: 0, n0: 0, w0: 0 }));
    if (r.exposed) {
      s.n1++;
      s.w1 += r.result;
    } else {
      s.n0++;
      s.w0 += r.result;
    }
  }
  let H = 0;
  let num = 0;
  let varNum = 0;
  let n1 = 0;
  let n0 = 0;
  for (const s of by.values()) {
    if (!s.n1 || !s.n0) continue;
    const h = (s.n1 * s.n0) / (s.n1 + s.n0);
    const q1 = (s.w1 + 0.5) / (s.n1 + 1);
    const q0 = (s.w0 + 0.5) / (s.n0 + 1);
    H += h;
    num += h * (s.w1 / s.n1 - s.w0 / s.n0);
    varNum += h * h * ((q1 * (1 - q1)) / s.n1 + (q0 * (1 - q0)) / s.n0);
    n1 += s.n1;
    n0 += s.n0;
  }
  if (!H || n1 < minSide || n0 < minSide) return { ...NONE, n1, n0 };
  return { est: num / H, se: Math.sqrt(varNum) / H, n1, n0 };
}

/** The stratum of a game: opponent list and seat. */
const stratumOf = (g: Pick<PlayerSummary, 'opp' | 'first'>) => `${g.opp}\u0000${g.first ? 'play' : 'draw'}`;

/** Landmark comparison at own turn T: games still running at T, the card seen by then or not. */
export function landmarkDiff(games: readonly PlayerSummary[], id: string, T: number, minSide = ADJ_MIN_SIDE): Estimate {
  const rows: Row[] = [];
  for (const g of games) {
    if (!g.seenAt) continue;
    const at = globalTurnOf(T, g.first);
    if (g.turns < at) continue;
    const t = g.seenAt[id];
    rows.push({ stratum: stratumOf(g), exposed: t !== undefined && t <= at, result: g.result });
  }
  return stratifiedDiff(rows, minSide);
}

/**
 * Landmark estimates over several T combined by inverse variance. They come from overlapping games, so the combined
 * standard error is taken as the same weighted mean of the per-T standard errors (exact if they were perfectly
 * correlated, conservative otherwise).
 */
export function combineLandmarks(byT: readonly Estimate[]): Estimate {
  const ok = byT.filter((e) => Number.isFinite(e.est) && e.se > 0);
  if (!ok.length) return NONE;
  let W = 0;
  let est = 0;
  let se = 0;
  for (const e of ok) {
    const w = 1 / (e.se * e.se);
    W += w;
    est += w * e.est;
    se += w * e.se;
  }
  return { est: est / W, se: se / W, n1: Math.max(...ok.map((e) => e.n1)), n0: Math.max(...ok.map((e) => e.n0)) };
}

/** "Kept against sold": games where the card was offered at a sell decision; exposed = it was never sold there. */
export function keptVsSold(games: readonly PlayerSummary[], id: string, minSide = ADJ_MIN_SIDE): Estimate & { kept: number; sold: number } {
  const rows: Row[] = [];
  for (const g of games) {
    const c = g.sellChoice?.[id];
    if (c === undefined) continue;
    rows.push({ stratum: stratumOf(g), exposed: c === 0, result: g.result });
  }
  const e = stratifiedDiff(rows, minSide);
  return { ...e, kept: rows.filter((r) => r.exposed).length, sold: rows.filter((r) => !r.exposed).length };
}

/**
 * One player's sell choices in a game, from its decision records: every card offered as a sell at a main-phase decision
 * where the player sold a card is 1 if it was sold there at least once in the game, else 0 (kept every time).
 */
export function sellChoicesOf(records: readonly Pick<DecisionRecord, 'p' | 'w' | 'o' | 'ch'>[], p: PlayerId): Record<string, 0 | 1> {
  const out: Record<string, 0 | 1> = {};
  for (const r of records) {
    if (r.p !== p || r.w !== 'main') continue;
    const ch = parseOption(r.ch[0] ?? 'pass');
    if (ch.kind !== 'sell' || !ch.id || ch.id === '?') continue;
    for (const code of r.o) {
      const o = parseOption(code);
      if (o.kind !== 'sell' || !o.id || o.id === '?') continue;
      if (out[o.id] !== 1) out[o.id] = o.id === ch.id ? 1 : 0;
    }
    out[ch.id] = 1;
  }
  return out;
}

/** Empirical-Bayes prior spread from a deck's estimates: τ² = max(τmin², mean(est²) − mean(se²)). */
export function priorSpread(es: readonly Estimate[], tauMin = ADJ_TAU_MIN): number {
  const ok = es.filter((e) => Number.isFinite(e.est));
  if (!ok.length) return tauMin;
  const m2 = ok.reduce((s, e) => s + e.est * e.est, 0) / ok.length;
  const v = ok.reduce((s, e) => s + e.se * e.se, 0) / ok.length;
  return Math.sqrt(Math.max(tauMin * tauMin, m2 - v));
}
/** Posterior mean under a normal prior N(0, τ²). */
export const shrink = (e: Estimate, tau: number) => (Number.isFinite(e.est) ? (e.est * tau * tau) / (tau * tau + e.se * e.se) : NaN);

export interface AdjustedCard {
  id: string;
  name: string;
  /** the plain IWD and its sample, as in analysis.json (unchanged) */
  iwd: number;
  seenGames: number;
  /** the landmark, stratified estimate (fraction), its standard error, 95% interval, and the shrunk value */
  adj: number;
  se: number;
  lo: number;
  hi: number;
  shrunk: number;
  /** games with the card seen by the landmark / not (largest over the landmarks) */
  n1: number;
  n0: number;
  byT: { T: number; est: number; se: number; n1: number; n0: number }[];
  /** kept − sold at sell decisions, when the run recorded them */
  keptVsSold?: { est: number; se: number; kept: number; sold: number; shrunk: number };
}
export interface AdjustedDeck {
  deck: string;
  id?: string;
  games: number;
  /** prior spread used for shrinkage (landmark estimate; kept-vs-sold has its own) */
  tau: number;
  tauSell?: number;
  /** Spearman rank correlation of the plain IWD against the adjusted estimate, over cards with both */
  rhoOldAdj: number;
  /** ... and against the shrunk adjusted estimate */
  rhoOldShrunk: number;
  cards: AdjustedCard[];
}

const nameOf = (id: string) => {
  const c = CARD_BY_ID[id];
  return c ? cardLabel(c) : id;
};

/** Plain IWD of a card over a deck's games (as analyze.ts computes it: NaN under `minN` games a side). */
export function plainIwd(games: readonly PlayerSummary[], id: string, minN = 8): { iwd: number; seenGames: number } {
  let n1 = 0;
  let w1 = 0;
  let n0 = 0;
  let w0 = 0;
  for (const g of games) {
    if (g.seen.includes(id)) {
      n1++;
      w1 += g.result;
    } else {
      n0++;
      w0 += g.result;
    }
  }
  return { iwd: n1 >= minN && n0 >= minN ? w1 / n1 - w0 / n0 : NaN, seenGames: n1 };
}

/** The adjusted estimate for every main-deck card a deck saw, from its games' summaries. */
export function adjustedDeck(deck: string, all: readonly PlayerSummary[], o: { id?: string; turns?: readonly number[]; minSide?: number } = {}): AdjustedDeck {
  const games = all.filter((g) => g.deck === deck);
  const turns = o.turns ?? LANDMARK_TURNS;
  const minSide = o.minSide ?? ADJ_MIN_SIDE;
  const ids = new Set<string>();
  for (const g of games) for (const id of g.seen) if (CARD_BY_ID[id]?.type !== 'Legend') ids.add(id);
  const hasSell = games.some((g) => g.sellChoice);
  const raw = [...ids].map((id) => {
    const byT = turns.map((T) => ({ T, ...landmarkDiff(games, id, T, minSide) }));
    return { id, ...plainIwd(games, id), comb: combineLandmarks(byT), byT, sell: hasSell ? keptVsSold(games, id, minSide) : undefined };
  });
  const tau = priorSpread(raw.map((r) => r.comb));
  const tauSell = hasSell ? priorSpread(raw.map((r) => r.sell!)) : undefined;
  const cards: AdjustedCard[] = raw
    .filter((r) => r.seenGames >= minSide)
    .map((r) => ({
      id: r.id,
      name: nameOf(r.id),
      iwd: r.iwd,
      seenGames: r.seenGames,
      adj: r.comb.est,
      se: r.comb.se,
      lo: r.comb.est - Z95 * r.comb.se,
      hi: r.comb.est + Z95 * r.comb.se,
      shrunk: shrink(r.comb, tau),
      n1: r.comb.n1,
      n0: r.comb.n0,
      byT: r.byT,
      ...(r.sell && Number.isFinite(r.sell.est) ? { keptVsSold: { est: r.sell.est, se: r.sell.se, kept: r.sell.kept, sold: r.sell.sold, shrunk: shrink(r.sell, tauSell!) } } : {}),
    }))
    .sort((a, b) => (Number.isFinite(b.shrunk) ? b.shrunk : -9) - (Number.isFinite(a.shrunk) ? a.shrunk : -9));
  const both = cards.filter((c) => Number.isFinite(c.iwd) && Number.isFinite(c.adj));
  return {
    deck,
    ...(o.id ? { id: o.id } : {}),
    games: games.length,
    tau,
    ...(tauSell !== undefined ? { tauSell } : {}),
    rhoOldAdj: both.length >= 3 ? spearman(both.map((c) => c.iwd), both.map((c) => c.adj)) : NaN,
    rhoOldShrunk: both.length >= 3 ? spearman(both.map((c) => c.iwd), both.map((c) => c.shrunk)) : NaN,
    cards,
  };
}

/** Every deck in the summaries. `ids`: deck name → list fingerprint, written into each report. */
export function adjustedAll(all: readonly PlayerSummary[], ids?: ReadonlyMap<string, string>): AdjustedDeck[] {
  const decks = [...new Set(all.map((g) => g.deck))].sort();
  return decks.map((d) => adjustedDeck(d, all, { id: ids?.get(d) }));
}

const pts = (x: number) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)}` : '—');

/** Cards whose rank or sign changes most between the plain IWD and the shrunk adjusted estimate. */
export function biggestChanges(d: AdjustedDeck, n = 5): { id: string; name: string; iwd: number; shrunk: number; rankOld: number; rankNew: number; signFlip: boolean }[] {
  const both = d.cards.filter((c) => Number.isFinite(c.iwd) && Number.isFinite(c.shrunk));
  const byOld = [...both].sort((a, b) => b.iwd - a.iwd);
  const byNew = [...both].sort((a, b) => b.shrunk - a.shrunk);
  return both
    .map((c) => ({ id: c.id, name: c.name, iwd: c.iwd, shrunk: c.shrunk, rankOld: byOld.indexOf(c) + 1, rankNew: byNew.indexOf(c) + 1, signFlip: Math.sign(c.iwd) !== Math.sign(c.shrunk) && Math.abs(c.iwd) >= 0.02 }))
    .sort((a, b) => Number(b.signFlip) - Number(a.signFlip) || Math.abs(b.rankNew - b.rankOld) - Math.abs(a.rankNew - a.rankOld))
    .slice(0, n);
}

export function adjustedMarkdown(decks: readonly AdjustedDeck[], o: { manifestLine?: string } = {}): string {
  const L: string[] = [
    '# Card impact, adjusted (INFO-2)',
    '',
    'Plain IWD = win rate when the card was seen minus when not, pooled (the number the Hard bot reads from impact.json).',
    `Adjusted = seen by own turn T against not seen by then, among games still running at T (T = ${LANDMARK_TURNS.join(', ')}), inside each opponent × seat stratum; ` +
      'combined by inverse variance; ± is 1.96 standard errors; "shrunk" pulls toward 0 by sample size. Kept vs sold: games the card was offered as a sell and always kept, against games it was sold. ' +
      'All in win-rate points; association, not causal value.',
    '',
  ];
  if (o.manifestLine) L.push(o.manifestLine, '');
  for (const d of decks) {
    L.push(`## ${d.deck} — ${d.games} games`, '', `Rank correlation plain IWD vs adjusted: ${d.rhoOldAdj.toFixed(2)} (vs shrunk ${d.rhoOldShrunk.toFixed(2)}); prior spread ${pts(d.tau)} pts.`, '');
    const ch = biggestChanges(d, 4);
    if (ch.length) L.push(`Biggest changes: ${ch.map((c) => `${c.name} ${pts(c.iwd)} → ${pts(c.shrunk)} (rank ${c.rankOld} → ${c.rankNew}${c.signFlip ? ', sign flips' : ''})`).join('; ')}.`, '');
    L.push('| Card | Seen | Plain IWD | Adjusted ± | Shrunk | Seen by T / not | Kept vs sold (kept / sold games) |', '|---|---|---|---|---|---|---|');
    for (const c of d.cards)
      L.push(
        `| ${c.name} | ${c.seenGames} | ${pts(c.iwd)} | ${pts(c.adj)} ± ${Number.isFinite(c.se) ? (100 * Z95 * c.se).toFixed(1) : '—'} | ${pts(c.shrunk)} | ${c.n1} / ${c.n0} | ${c.keptVsSold ? `${pts(c.keptVsSold.est)} ± ${(100 * Z95 * c.keptVsSold.se).toFixed(1)} (${c.keptVsSold.kept} / ${c.keptVsSold.sold})` : '—'} |`,
      );
    L.push('');
  }
  return L.join('\n');
}
