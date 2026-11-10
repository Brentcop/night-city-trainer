// Aggregate game summaries into per-deck / per-matchup statistics and plain-language insights.
import { CARD_BY_ID, cardLabel } from '../engine/cards';
import type { PlayerSummary } from './summarize';

export interface CardStat {
  id: string;
  name: string;
  seenGames: number;
  wrSeen: number; // win rate in games where the card was drawn/opened
  wrNotSeen: number;
  iwd: number; // improvement when drawn = wrSeen - wrNotSeen
  playedGames: number;
  wrPlayed: number;
  avgPlayTurn: number | null;
  soldRate: number; // of games seen, fraction where it was sold at least once
  openingGames: number;
  wrOpening: number;
  steals: number; // gigs stolen by this card per game it was played
}

export interface MatchupStat {
  opp: string;
  games: number;
  wr: number;
  wrFirst: number;
  wrSecond: number;
  avgTurns: number;
  overtimeRate: number;
  topCards: { name: string; iwd: number; n: number }[];
  attackRate: number; // attacks on gig area per game
}

export interface DeckReport {
  deck: string;
  games: number;
  wr: number;
  wrFirst: number;
  wrSecond: number;
  wrMulligan: number;
  mulliganRate: number;
  avgTurns: number;
  overtimeRate: number;
  overtimeWr: number;
  avgFirstAttack: number | null;
  gigAttacksPerGame: number;
  unitAttacksPerGame: number;
  /** P(win | gig lead/tie/deficit after own turn N) */
  tempo: { turn: number; leadWr: number; leadN: number; evenWr: number; evenN: number; behindWr: number; behindN: number }[];
  /** average gig differential after own turn N in wins vs losses */
  diffCurve: { turn: number; wins: number; losses: number }[];
  firstCall: { name: string; games: number; wr: number }[];
  reactCallRate: number;
  cards: CardStat[];
  matchups: MatchupStat[];
  winReasons: Record<string, number>;
  insights: string[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const wrOf = (xs: PlayerSummary[]) => (xs.length ? xs.reduce((a, g) => a + g.result, 0) / xs.length : NaN);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const nameOf = (id: string) => (CARD_BY_ID[id] ? cardLabel(CARD_BY_ID[id]) : id);

function cardStats(games: PlayerSummary[], minN = 8): CardStat[] {
  const ids = new Set<string>();
  for (const g of games) for (const id of g.seen) ids.add(id);
  const out: CardStat[] = [];
  for (const id of ids) {
    if (CARD_BY_ID[id]?.type === 'Legend') continue;
    const seen = games.filter((g) => g.seen.includes(id));
    const not = games.filter((g) => !g.seen.includes(id));
    if (seen.length < minN) continue;
    const played = games.filter((g) => g.played[id] !== undefined);
    const opening = games.filter((g) => g.opening.includes(id));
    const steals = played.reduce((a, g) => a + (g.steals[id] ?? 0), 0);
    out.push({
      id,
      name: nameOf(id),
      seenGames: seen.length,
      wrSeen: wrOf(seen),
      wrNotSeen: not.length ? wrOf(not) : NaN,
      iwd: not.length >= minN ? wrOf(seen) - wrOf(not) : NaN,
      playedGames: played.length,
      wrPlayed: wrOf(played),
      avgPlayTurn: played.length ? avg(played.map((g) => g.played[id])) : null,
      soldRate: seen.filter((g) => (g.sold[id] ?? 0) > 0).length / seen.length,
      openingGames: opening.length,
      wrOpening: wrOf(opening),
      steals: played.length ? steals / played.length : 0,
    });
  }
  return out.sort((a, b) => (isNaN(b.iwd) ? -1 : b.iwd) - (isNaN(a.iwd) ? -1 : a.iwd));
}

export function analyzeDeck(deck: string, all: PlayerSummary[]): DeckReport {
  const games = all.filter((g) => g.deck === deck);
  const first = games.filter((g) => g.first);
  const second = games.filter((g) => !g.first);
  const mull = games.filter((g) => g.mulligan);
  const ot = games.filter((g) => g.overtime);
  const wins = games.filter((g) => g.result === 1);
  const losses = games.filter((g) => g.result === 0);
  const tempo: DeckReport['tempo'] = [];
  const diffCurve: DeckReport['diffCurve'] = [];
  for (let t = 1; t <= 8; t++) {
    const at = games.filter((g) => g.diffAfterOwnTurn.length >= t);
    const lead = at.filter((g) => g.diffAfterOwnTurn[t - 1] > 0);
    const even = at.filter((g) => g.diffAfterOwnTurn[t - 1] === 0);
    const behind = at.filter((g) => g.diffAfterOwnTurn[t - 1] < 0);
    tempo.push({ turn: t, leadWr: wrOf(lead), leadN: lead.length, evenWr: wrOf(even), evenN: even.length, behindWr: wrOf(behind), behindN: behind.length });
    diffCurve.push({
      turn: t,
      wins: avg(wins.filter((g) => g.diffAfterOwnTurn.length >= t).map((g) => g.diffAfterOwnTurn[t - 1])),
      losses: avg(losses.filter((g) => g.diffAfterOwnTurn.length >= t).map((g) => g.diffAfterOwnTurn[t - 1])),
    });
  }
  const callGroups = new Map<string, PlayerSummary[]>();
  for (const g of games) {
    const c = g.calls[0]?.id;
    if (!c) continue;
    callGroups.set(c, [...(callGroups.get(c) ?? []), g]);
  }
  const firstCall = [...callGroups.entries()].map(([id, gs]) => ({ name: nameOf(id), games: gs.length, wr: wrOf(gs) })).sort((a, b) => b.games - a.games);
  const allCalls = games.flatMap((g) => g.calls);
  const opps = [...new Set(games.map((g) => g.opp))];
  const matchups: MatchupStat[] = opps
    .map((opp) => {
      const gs = games.filter((g) => g.opp === opp);
      const cs = cardStats(gs, 6)
        .filter((c) => !isNaN(c.iwd))
        .slice(0, 4)
        .map((c) => ({ name: c.name, iwd: c.iwd, n: c.seenGames }));
      return {
        opp,
        games: gs.length,
        wr: wrOf(gs),
        wrFirst: wrOf(gs.filter((g) => g.first)),
        wrSecond: wrOf(gs.filter((g) => !g.first)),
        avgTurns: avg(gs.map((g) => g.turns)),
        overtimeRate: gs.filter((g) => g.overtime).length / gs.length,
        topCards: cs,
        attackRate: avg(gs.map((g) => g.attacksGigs)),
      };
    })
    .sort((a, b) => b.wr - a.wr);
  const winReasons: Record<string, number> = {};
  for (const g of wins) {
    const r = /overtime/.test(g.reason) ? 'overtime 7 Gigs' : /start of turn/.test(g.reason) ? '7 Gigs at start of turn' : /empty deck/.test(g.reason) ? 'rival decked out' : g.reason;
    winReasons[r] = (winReasons[r] ?? 0) + 1;
  }
  const rep: DeckReport = {
    deck,
    games: games.length,
    wr: wrOf(games),
    wrFirst: wrOf(first),
    wrSecond: wrOf(second),
    wrMulligan: wrOf(mull),
    mulliganRate: mull.length / Math.max(1, games.length),
    avgTurns: avg(games.map((g) => g.turns)),
    overtimeRate: ot.length / Math.max(1, games.length),
    overtimeWr: wrOf(ot),
    avgFirstAttack: avg(games.filter((g) => g.firstAttackTurn !== null).map((g) => g.firstAttackTurn!)),
    gigAttacksPerGame: avg(games.map((g) => g.attacksGigs)),
    unitAttacksPerGame: avg(games.map((g) => g.attacksUnits)),
    tempo,
    diffCurve,
    firstCall,
    reactCallRate: allCalls.length ? allCalls.filter((c) => c.how === 'react').length / allCalls.length : 0,
    cards: cardStats(games),
    matchups,
    winReasons,
    insights: [],
  };
  rep.insights = insights(rep);
  return rep;
}

/** Turn statistics into concrete, plain-language advice. */
export function insights(r: DeckReport): string[] {
  const out: string[] = [];
  const keep = r.wr;
  if (r.games >= 100) {
    const seat = r.wrFirst - r.wrSecond;
    if (Math.abs(seat) >= 0.06)
      out.push(`**Seat:** ${pct(r.wrFirst)} on the play vs ${pct(r.wrSecond)} on the draw. When you choose (you lost the last game), choose to go **${seat > 0 ? 'first' : 'second'}**.`);
    else out.push(`**Seat:** about even (${pct(r.wrFirst)} on the play / ${pct(r.wrSecond)} on the draw), so pick based on the matchup table below.`);
  }
  const good = r.cards.filter((c) => !isNaN(c.iwd) && c.iwd >= 0.04).slice(0, 4);
  if (good.length) out.push(`**Cards that win games:** ${good.map((c) => `${c.name} (+${Math.round(c.iwd * 100)} pts when drawn)`).join(', ')}. Keep these over everything when you sell or mulligan.`);
  const weak = [...r.cards].filter((c) => !isNaN(c.iwd) && c.iwd <= -0.04).sort((a, b) => a.iwd - b.iwd).slice(0, 3);
  if (weak.length) out.push(`**Underperformers:** ${weak.map((c) => `${c.name} (${Math.round(c.iwd * 100)} pts)`).join(', ')}. Sell these first, and consider cutting them or moving them to the sideboard.`);
  const sellers = r.cards.filter((c) => c.soldRate >= 0.45).sort((a, b) => b.soldRate - a.soldRate).slice(0, 4);
  if (sellers.length) out.push(`**Usual Eddie fodder:** ${sellers.map((c) => `${c.name} (sold in ${pct(c.soldRate)} of games it's drawn)`).join(', ')}.`);
  const t4 = r.tempo[3];
  if (t4 && t4.leadN >= 20 && t4.behindN >= 20)
    out.push(`**Tempo check:** after your 4th turn you win ${pct(t4.leadWr)} when ahead on Gigs and ${pct(t4.behindWr)} when behind. ${t4.leadWr - t4.behindWr > 0.3 ? 'Early Gig pressure decides this deck’s games, so prioritise attacking the Gig area early.' : 'This deck recovers from early deficits, so don’t over-commit to early trades.'}`);
  if (r.overtimeRate >= 0.25) out.push(`**Overtime:** ${pct(r.overtimeRate)} of games reach overtime, and you win ${pct(r.overtimeWr)} of those. ${r.overtimeWr >= keep ? 'The deck is built for the long game; plan to be the one at 7 when overtime starts.' : 'You do worse in long games, so close it out before both players run out of dice.'}`);
  if (r.mulliganRate >= 0.08 && !isNaN(r.wrMulligan)) out.push(`**Mulligans:** ${pct(r.mulliganRate)} of hands are mulliganed, and those games are won ${pct(r.wrMulligan)} of the time (overall ${pct(keep)}).`);
  if (r.firstCall.length >= 2) {
    const best = [...r.firstCall].filter((c) => c.games >= 15).sort((a, b) => b.wr - a.wr);
    if (best.length >= 2) out.push(`**First Legend flipped:** ${best.map((c) => `${c.name} ${pct(c.wr)} (${c.games})`).join(' · ')}. You can't pick which face-down Legend you flip, but this shows which Legend's early effect matters most.`);
  }
  if (r.reactCallRate >= 0.1) out.push(`**Reactive Calls:** ${pct(r.reactCallRate)} of Legend Calls happen during the rival's attack, so keep 1 €$ open on the rival's turn.`);
  const worst = r.matchups[r.matchups.length - 1];
  const best = r.matchups[0];
  if (worst && best) out.push(`**Best matchup:** ${best.opp} (${pct(best.wr)}). **Worst:** ${worst.opp} (${pct(worst.wr)}). Sideboard for the worst one first.`);
  return out;
}

export function analyzeAll(all: PlayerSummary[]): DeckReport[] {
  const decks = [...new Set(all.map((g) => g.deck))];
  return decks.map((d) => analyzeDeck(d, all)).sort((a, b) => b.wr - a.wr);
}

export function reportMarkdown(reps: DeckReport[]): string {
  const lines: string[] = ['# Deck analysis (from bot-match telemetry)', ''];
  for (const r of reps) {
    lines.push(`## ${r.deck} — ${pct(r.wr)} over ${r.games} games`, '');
    lines.push(...r.insights.map((s) => `- ${s}`), '');
    lines.push('| Card | Seen | WR seen | WR not seen | Δ (IWD) | Avg turn played | Sold % | Steals/game |', '|---|---|---|---|---|---|---|---|');
    for (const c of r.cards)
      lines.push(
        `| ${c.name} | ${c.seenGames} | ${pct(c.wrSeen)} | ${isNaN(c.wrNotSeen) ? '—' : pct(c.wrNotSeen)} | ${isNaN(c.iwd) ? '—' : (c.iwd >= 0 ? '+' : '') + Math.round(c.iwd * 100)} | ${c.avgPlayTurn === null ? '—' : c.avgPlayTurn.toFixed(1)} | ${pct(c.soldRate)} | ${c.steals.toFixed(2)} |`,
      );
    lines.push('', '| Opponent | Games | WR | On play | On draw | Avg turns | Overtime | Key cards (IWD) |', '|---|---|---|---|---|---|---|---|');
    for (const m of r.matchups)
      lines.push(
        `| ${m.opp} | ${m.games} | ${pct(m.wr)} | ${pct(m.wrFirst)} | ${pct(m.wrSecond)} | ${m.avgTurns.toFixed(1)} | ${pct(m.overtimeRate)} | ${m.topCards.map((c) => `${c.name} ${c.iwd >= 0 ? '+' : ''}${Math.round(c.iwd * 100)}`).join(', ')} |`,
      );
    lines.push('');
  }
  return lines.join('\n');
}
