// The profile's numbers, derived at read time from the recorded practice games (src/lib/practiceLog.ts) and the decks
// saved in this browser: nothing here is stored. Pure and plain data, so the page, the share payload and the tests all
// read the same figures.
import type { LibraryDeck } from './library';
import type { PracticeGame } from './practiceLog';
import { gradeFor } from './practiceLog';
import { SMALL_SAMPLE } from './playedRecord';
import { deckSource } from './deckSource';

export type Result = PracticeGame['result'];

/** Bot tiers as the practice log names them; legacy names map as src/ai/tiers.ts tierOf does (tests check they agree). */
export type BotTier = 'easy' | 'medium' | 'hard' | 'mixed' | 'other';
export const BOT_TIERS: readonly BotTier[] = ['easy', 'medium', 'hard', 'mixed', 'other'];
const LEGACY_LEVEL: Record<string, BotTier> = { fast: 'easy', lookahead: 'medium', deep: 'hard', 'hard-v1': 'hard' };
export function botTier(level: string): BotTier {
  if (level in LEGACY_LEVEL) return LEGACY_LEVEL[level] as BotTier;
  return level === 'easy' || level === 'medium' || level === 'hard' || level === 'mixed' ? level : 'other';
}
export const BOT_TIER_LABEL: Record<BotTier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', mixed: 'Hard + Medium', other: 'Other' };

/** Wins, losses and draws. */
export interface WLD {
  games: number;
  wins: number;
  losses: number;
  draws: number;
}
export const emptyWLD = (): WLD => ({ games: 0, wins: 0, losses: 0, draws: 0 });
function add(r: WLD, res: Result) {
  r.games++;
  if (res === 'win') r.wins++;
  else if (res === 'loss') r.losses++;
  else r.draws++;
}
/** Share of games won (a draw is not a win), or null with no games. */
export const winRate = (r: WLD): number | null => (r.games > 0 ? r.wins / r.games : null);
/** Below SMALL_SAMPLE games a rate is shown as a small sample. */
export const smallSample = (n: number) => n < SMALL_SAMPLE;
/** "12-5" or "12-5-1" with draws. */
export const wldText = (r: WLD) => `${r.wins}-${r.losses}${r.draws ? `-${r.draws}` : ''}`;

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/** The log newest first (stored oldest first; games with the same or no date keep their stored order, newest first). */
export function newestFirst(games: readonly PracticeGame[]): PracticeGame[] {
  return games
    .map((g, i) => ({ g, i }))
    .sort((a, b) => time(b.g.date) - time(a.g.date) || b.i - a.i)
    .map((x) => x.g);
}

export interface Streak {
  result: Result;
  n: number;
}

export interface Headline {
  record: WLD;
  conceded: number;
  byTier: (WLD & { tier: BotTier })[];
  /** the current run of the same result, newest game first (null with no games) */
  streak: Streak | null;
  bestWinStreak: number;
  /** the average share of fine moves over the games with a coach scorecard (null when none has one) */
  coach: { games: number; avgPct: number; grade: 'A' | 'B' | 'C' | 'D' } | null;
}

export function headline(games: readonly PracticeGame[]): Headline {
  const record = emptyWLD();
  const tiers = new Map<BotTier, WLD>();
  let conceded = 0;
  const pcts: number[] = [];
  for (const g of games) {
    add(record, g.result);
    const t = botTier(g.level);
    if (!tiers.has(t)) tiers.set(t, emptyWLD());
    add(tiers.get(t)!, g.result);
    if (g.conceded) conceded++;
    if (g.coach && g.coach.measured > 0) pcts.push((100 * g.coach.fine) / g.coach.measured);
  }
  const order = newestFirst(games);
  let streak: Streak | null = null;
  const first = order[0];
  if (first) {
    let n = 0;
    while (n < order.length && order[n]!.result === first.result) n++;
    streak = { result: first.result, n };
  }
  let best = 0;
  let run = 0;
  for (const g of [...order].reverse()) {
    run = g.result === 'win' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const avgPct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  return {
    record,
    conceded,
    byTier: BOT_TIERS.flatMap((tier) => (tiers.has(tier) ? [{ tier, ...tiers.get(tier)! }] : [])),
    streak,
    bestWinStreak: best,
    coach: avgPct === null ? null : { games: pcts.length, avgPct, grade: gradeFor(avgPct) },
  };
}

/** The deck played most (ties go to the one played most recently), or null with no games. */
export function mostPlayed(games: readonly PracticeGame[]): string | null {
  const n = new Map<string, number>();
  for (const g of games) n.set(g.deck, (n.get(g.deck) ?? 0) + 1);
  let best: string | null = null;
  for (const g of newestFirst(games)) if (best === null || (n.get(g.deck) ?? 0) > (n.get(best) ?? 0)) best = g.deck;
  return best;
}

export interface DeckStatRow extends WLD {
  deck: string;
  /** you went first / second */
  first: WLD;
  second: WLD;
  /** average turns (games without a turn count left out), null when none has one */
  avgTurns: number | null;
  /** the most recent game's date ('' when none is dated) */
  last: string;
  byOpp: (WLD & { opp: string })[];
  byTier: (WLD & { tier: BotTier })[];
}

/** One row per deck you played, most played first. */
export function deckStatRows(games: readonly PracticeGame[]): DeckStatRow[] {
  const rows = new Map<string, DeckStatRow & { turns: number[]; opp: Map<string, WLD>; tier: Map<BotTier, WLD> }>();
  for (const g of games) {
    let r = rows.get(g.deck);
    if (!r) {
      r = { deck: g.deck, ...emptyWLD(), first: emptyWLD(), second: emptyWLD(), avgTurns: null, last: '', byOpp: [], byTier: [], turns: [], opp: new Map(), tier: new Map() };
      rows.set(g.deck, r);
    }
    add(r, g.result);
    add(g.first ? r.first : r.second, g.result);
    if (g.turns > 0) r.turns.push(g.turns);
    if (time(g.date) > time(r.last)) r.last = g.date;
    if (!r.opp.has(g.opp)) r.opp.set(g.opp, emptyWLD());
    add(r.opp.get(g.opp)!, g.result);
    const t = botTier(g.level);
    if (!r.tier.has(t)) r.tier.set(t, emptyWLD());
    add(r.tier.get(t)!, g.result);
  }
  return [...rows.values()]
    .map(({ turns, opp, tier, ...r }) => ({
      ...r,
      avgTurns: turns.length ? turns.reduce((a, b) => a + b, 0) / turns.length : null,
      byOpp: [...opp.entries()].map(([o, w]) => ({ opp: o, ...w })).sort((a, b) => b.games - a.games || a.opp.localeCompare(b.opp)),
      byTier: BOT_TIERS.flatMap((t) => (tier.has(t) ? [{ tier: t, ...tier.get(t)! }] : [])),
    }))
    .sort((a, b) => b.games - a.games || a.deck.localeCompare(b.deck));
}

export type DeckSortKey = 'deck' | 'games' | 'winRate' | 'avgTurns' | 'last';
export const DECK_SORT_LABEL: Record<DeckSortKey, string> = { deck: 'Deck', games: 'Games', winRate: 'Win rate', avgTurns: 'Avg turns', last: 'Last played' };

/** Rows sorted by a column; ties and missing values go last, then by name. */
export function sortDeckStats<T extends WLD & Pick<DeckStatRow, 'deck' | 'avgTurns' | 'last'>>(rows: readonly T[], key: DeckSortKey, dir: 'asc' | 'desc'): T[] {
  const val = (r: T): number | string | null =>
    key === 'deck' ? r.deck : key === 'games' ? r.games : key === 'winRate' ? winRate(r) : key === 'avgTurns' ? r.avgTurns : r.last ? time(r.last) : null;
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x === null || y === null) return x === y ? a.deck.localeCompare(b.deck) : x === null ? 1 : -1;
    const c = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number);
    return c * sign || a.deck.localeCompare(b.deck);
  });
}

export interface HistoryFilter {
  /** deck name ('' = any) */
  deck: string;
  result: '' | Result;
}

/** The games a filter shows, newest first. */
export function filterHistory(games: readonly PracticeGame[], f: HistoryFilter): PracticeGame[] {
  return newestFirst(games).filter((g) => (!f.deck || g.deck === f.deck) && (!f.result || g.result === f.result));
}

/** One page of a list (1-based, clamped to the pages there are). */
export function pageOf<T>(list: readonly T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: list.slice((p - 1) * size, p * size), page: p, pages };
}

/** Where a deck saved in this browser came from, for "My decks". */
export type MyDeckGroup = 'imported' | 'created' | 'tuned' | 'bred' | 'unrecorded';
export const MY_DECK_GROUPS: readonly MyDeckGroup[] = ['imported', 'created', 'tuned', 'bred', 'unrecorded'];
export const MY_DECK_LABEL: Record<MyDeckGroup, string> = {
  imported: 'Imported',
  created: 'Created',
  tuned: 'Tuned in the Lab',
  bred: 'Bred in the Lab',
  unrecorded: 'Imported or created (saved before this was recorded)',
};

export interface MyDeck {
  file: string;
  name: string;
  legends: string[];
  group: MyDeckGroup;
  /** when it was saved here, if known (ISO) */
  added: string | null;
}

/**
 * The decks saved in this browser, by origin: tuned and Lab-bred by src/lib/deckSource.ts, imported or created by the
 * mark the deck editor saves with them (decks saved before that mark existed are 'unrecorded'). Newest first.
 */
export function myDecks(lib: readonly LibraryDeck[]): MyDeck[] {
  return lib
    .filter((d) => d.kind === 'custom')
    .map((d) => {
      const src = deckSource(d);
      const group: MyDeckGroup = src === 'tuned' ? 'tuned' : src === 'lab' ? 'bred' : (d.saved ?? 'unrecorded');
      const added = d.added ?? d.tuned?.date ?? d.manifest?.createdAt ?? null;
      return { file: d.file, name: d.deck.name, legends: d.deck.legends, group, added: added && !Number.isNaN(Date.parse(added)) ? added : null };
    })
    .sort((a, b) => time(b.added ?? '') - time(a.added ?? '') || a.name.localeCompare(b.name));
}

export function myDeckCounts(decks: readonly MyDeck[]): Record<MyDeckGroup, number> {
  const c = Object.fromEntries(MY_DECK_GROUPS.map((g) => [g, 0])) as Record<MyDeckGroup, number>;
  for (const d of decks) c[d.group]++;
  return c;
}
