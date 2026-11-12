// Partner-aware cut and add ranking for the list tuners (docs/SYNERGIES.md "Partner-aware ranking"): the forge
// (scripts/builder-moves.ts forgeSwaps), the optimizer (optimizeCandidates) and the Deck Lab tuner (src/lib/deckLab.ts
// candidateSwaps) all pick the cards to cut from one per-card score. Measured card by card, a payoff looks weak in every
// game its enabler was missing, and an enabler looks weak because its value shows up on the payoff. This module is the
// one shared place that corrects for that:
//
//   1. the partner-aware score: for a card in a package the list holds, its "Δ when drawn" measured only over the games
//      in which a partner piece was there too (wr(drawn with a partner) − wr(not drawn)), shrunk toward the plain score
//      by PARTNER_SHRINK_GAMES pseudo-games when that sample is small. The plain number is kept beside it;
//   2. the stranding cost: cutting one copy of a piece lowers the odds of holding the package's needed pieces by your
//      own turn ODDS_ROUND (holdOdds, exact). The drop, times STRAND_VALUE (½ for a `helps` package), is added to the
//      card's score, so a cut that strands a package costs in proportion and a surplus piece (whose cut barely moves
//      the odds) stays a fair cut. A cut below a kept package's working set is still refused outright by the plan;
//   3. the add side: a card that completes or deepens a package the list is built around (or holds one side of at its
//      built-around count) gets the assembly odds it adds, times the same weight.
//
// Association, not causal value, like every telemetry number here. Pure functions over plain data; no game is played.
// Opt-in: the callers use it only when asked (CLI: --partner-aware, on with any package flag; the Deck Lab: on by default).
import { CARD_BY_ID, cardLabel } from '../engine/cards';
import { counts } from '../engine/deck';
import type { DeckList } from '../engine/types';
import type { PlayerSummary } from '../analysis/summarize';
import { cardsSeenBy, holdOdds, roleMap, roleMatches, SYNERGIES, synergiesIn, zeroRoles, type RoleCounts, type Synergy, type SynergyRole } from '../content/synergies';

/** Pseudo-games of the plain score mixed into the partner-present score (it moves halfway at 20 partner-present games). */
export const PARTNER_SHRINK_GAMES = 20;
/** Fewest games a win rate needs before it is used (the card report's own floor, src/analysis/analyze.ts). */
export const MIN_SPLIT_GAMES = 8;
/** Your own turn the assembly odds are read at: the opening 6 plus 4 draws. */
export const ODDS_ROUND = 4;
/**
 * What holding a package's needed pieces is taken to be worth, in win rate (0.10 = 10 points): each point of assembly
 * odds a cut costs adds 0.1 points to the card's score. Smaller than the measured "won when online vs never" gaps of the
 * built-around packages (e.g. ROCKER +16 points, docs/SYNERGIES.md "Runs"), which are association and so overstate it.
 */
export const STRAND_VALUE = 0.1;
/** A cut that moves the assembly odds by less than this is a surplus piece (said so in the explanation). */
export const SURPLUS_ODDS = 0.01;

/** Every package with its role map (computed once). */
const PACKAGE_ROLES: readonly { synergy: Synergy; roles: Map<string, SynergyRole> }[] = SYNERGIES.map((s) => ({ synergy: s, roles: roleMap(s) }));
const bondWeight = (s: Synergy) => (s.bond === 'requires' ? 1 : 0.5);
const label = (id: string) => {
  const c = CARD_BY_ID[id];
  return c ? cardLabel(c) : id;
};

/** The roles that partner a piece of `role` in package `s` (the synergy observer's rule, src/analysis/synergies.ts). */
function partners(role: SynergyRole): (r: SynergyRole) => boolean {
  if (role === 'enabler') return (r) => roleMatches(r, ['payoff']);
  if (role === 'payoff') return (r) => roleMatches(r, ['enabler']);
  return () => true;
}

// ---------------------------------------------------------------- the partner split (from the list's own telemetry)

export interface WinCell {
  games: number;
  wins: number;
}
export interface PartnerSplit {
  pkg: string;
  role: SynergyRole;
  /** games the card was drawn with a partner piece drawn too (or a partner Legend face-up) at some point that game */
  with: WinCell;
  /** games it was drawn and no partner piece was */
  without: WinCell;
  /** games it was not drawn */
  notSeen: WinCell;
}

const cell = (): WinCell => ({ games: 0, wins: 0 });
const wr = (c: WinCell) => (c.games ? c.wins / c.games : null);

/**
 * Per main-deck member card of each (active) package the list holds: its games split by whether a partner piece was
 * there too. Game level (anywhere in the game), from the tuner's own baseline summaries (`sums`, filtered to games of
 * `deck.name`); the published synergy report splits each use by the turn instead, which needs board telemetry.
 */
export function partnerSplits(deck: Pick<DeckList, 'name' | 'legends' | 'main'>, sums: readonly PlayerSummary[]): Map<string, PartnerSplit[]> {
  const games = sums.filter((g) => g.deck === deck.name);
  const out = new Map<string, PartnerSplit[]>();
  const inMain = new Set(deck.main);
  for (const ls of synergiesIn(deck)) {
    const s = ls.synergy;
    if (s.dormant) continue;
    const roles = new Map(ls.cards.map((c) => [c.id, c.role]));
    for (const [id, role] of roles) {
      if (!inMain.has(id)) continue;
      const isPartner = partners(role);
      const sp: PartnerSplit = { pkg: s.id, role, with: cell(), without: cell(), notSeen: cell() };
      for (const g of games) {
        const seen = new Set(g.seen);
        if (!seen.has(id)) {
          sp.notSeen.games++;
          sp.notSeen.wins += g.result;
          continue;
        }
        const up = new Set([...g.calls.map((c) => c.id), ...g.solos, ...g.legendPlays]);
        const present =
          [...seen].some((x) => x !== id && roles.has(x) && isPartner(roles.get(x)!)) || deck.legends.some((l) => roles.has(l) && isPartner(roles.get(l)!) && up.has(l));
        const c = present ? sp.with : sp.without;
        c.games++;
        c.wins += g.result;
      }
      const list = out.get(id) ?? [];
      list.push(sp);
      out.set(id, list);
    }
  }
  return out;
}

// ---------------------------------------------------------------- assembly odds

/** Odds of holding package `s`'s needed pieces by your own turn ODDS_ROUND with `main` copies per role in the main deck. */
const oddsOf = (s: Synergy, main: RoleCounts, legends: RoleCounts, size: number) => holdOdds(main, legends, size, cardsSeenBy(ODDS_ROUND), s.needs);

function roleCounts(roles: ReadonlyMap<string, SynergyRole>, ids: readonly string[]): RoleCounts {
  const r = zeroRoles();
  for (const id of ids) {
    const x = roles.get(id);
    if (x) r[x]++;
  }
  return r;
}

export interface StrandCost {
  pkg: string;
  pkgName: string;
  role: SynergyRole;
  /** assembly odds by your own turn ODDS_ROUND before and after cutting one copy */
  before: number;
  after: number;
  /** added to the card's score: (before − after) × STRAND_VALUE × bond weight */
  penalty: number;
}

/** One package as a list holds it, with its assembly odds memoised by the copies of one role added or cut. */
interface PkgContext {
  synergy: Synergy;
  roles: Map<string, SynergyRole>;
  main: RoleCounts;
  legends: RoleCounts;
  /** the list holds its needed pieces (synergiesIn lists it) */
  held: boolean;
  builtAround: boolean;
  /** not held, but one side is at its built-around count: a piece of the other side completes it */
  halfAtMinimum: boolean;
  odds: (role: SynergyRole | null, delta: number) => number;
}

let ctxCache: { key: string; ctx: PkgContext[] } | null = null;
/** The active packages with a copy in the list (main deck or Legends), computed once per list. */
function contexts(deck: Pick<DeckList, 'legends' | 'main'>): PkgContext[] {
  const key = `${deck.legends.join(',')}|${deck.main.join(',')}`;
  if (ctxCache?.key === key) return ctxCache.ctx;
  const held = new Map(synergiesIn(deck).map((ls) => [ls.synergy.id, ls]));
  const size = deck.main.length;
  const ctx = PACKAGE_ROLES.filter(({ synergy, roles }) => !synergy.dormant && (deck.main.some((id) => roles.has(id)) || deck.legends.some((id) => roles.has(id)))).map(({ synergy, roles }): PkgContext => {
    const main = roleCounts(roles, deck.main);
    const legends = roleCounts(roles, deck.legends);
    const ls = held.get(synergy.id);
    const c = { enabler: main.enabler + legends.enabler, payoff: main.payoff + legends.payoff, both: main.both + legends.both, piece: main.piece + legends.piece };
    const ba = synergy.builtAround;
    const half = !ls && (((ba.enabler ?? 0) > 0 && c.enabler + c.both >= (ba.enabler ?? 0)) || ((ba.payoff ?? 0) > 0 && c.payoff + c.both >= (ba.payoff ?? 0)));
    const memo = new Map<string, number>();
    const odds = (role: SynergyRole | null, delta: number) => {
      const k = `${role}:${delta}`;
      let v = memo.get(k);
      if (v === undefined) {
        const m = role ? { ...main, [role]: Math.max(0, main[role] + delta) } : main;
        memo.set(k, (v = oddsOf(synergy, m, legends, size)));
      }
      return v;
    };
    return { synergy, roles, main, legends, held: !!ls, builtAround: !!ls?.builtAround, halfAtMinimum: half, odds };
  });
  ctxCache = { key, ctx };
  return ctx;
}

/** What cutting one copy of `id` costs each (active) package the list holds. Empty for a card in none. */
export function strandCosts(deck: Pick<DeckList, 'legends' | 'main'>, id: string): StrandCost[] {
  if (!deck.main.includes(id)) return [];
  return contexts(deck).flatMap((p) => {
    const role = p.roles.get(id);
    if (!p.held || !role) return [];
    const b = p.odds(null, 0);
    const a = p.odds(role, -1);
    return [{ pkg: p.synergy.id, pkgName: p.synergy.name, role, before: b, after: a, penalty: Math.max(0, b - a) * STRAND_VALUE * bondWeight(p.synergy) }];
  });
}

export interface AddCredit {
  pkg: string;
  pkgName: string;
  role: SynergyRole;
  before: number;
  after: number;
  /** (after − before) × STRAND_VALUE × bond weight */
  credit: number;
  /** 'deepens' a package the list is built around, or 'completes' one it holds one side of */
  kind: 'deepens' | 'completes';
}

/**
 * What adding one copy of `id` (in place of a card outside the package) adds to the assembly odds of the (active)
 * packages the list is built around, or holds one side of at that side's built-around count. Empty otherwise.
 */
export function addCredits(deck: Pick<DeckList, 'legends' | 'main'>, id: string): AddCredit[] {
  return contexts(deck).flatMap((p) => {
    const role = p.roles.get(id);
    const kind: AddCredit['kind'] | null = p.builtAround ? 'deepens' : p.halfAtMinimum ? 'completes' : null;
    if (!role || !kind) return [];
    const b = p.odds(null, 0);
    const a = p.odds(role, 1);
    if (a - b <= 0) return [];
    return [{ pkg: p.synergy.id, pkgName: p.synergy.name, role, before: b, after: a, credit: (a - b) * STRAND_VALUE * bondWeight(p.synergy), kind }];
  });
}

// ---------------------------------------------------------------- the ranking

export interface PartnerScore {
  pkg: string;
  pkgName: string;
  role: SynergyRole;
  withGames: number;
  withWr: number | null;
  withoutGames: number;
  withoutWr: number | null;
  notSeenGames: number;
  notSeenWr: number | null;
  /** wr(with a partner) − wr(not drawn); null when either side has fewer than MIN_SPLIT_GAMES games */
  raw: number | null;
  /** raw shrunk toward the plain score: (n·raw + K·plain) / (n + K), K = PARTNER_SHRINK_GAMES */
  shrunk: number;
}

export interface CutRow {
  id: string;
  name: string;
  copies: number;
  /** the plain score the tuner used before (its "Δ when drawn", else format-wide impact, else 0) */
  plain: number;
  /** the package the card is judged by (its best partner-aware score), when it is in one the list holds and telemetry is given */
  partner?: PartnerScore;
  strand: StrandCost[];
  /** the partner-aware score (partner.shrunk, else plain) plus every stranding penalty: lower is cut first */
  score: number;
  /** why the plan forbids cutting it (keep or lock), when it does */
  locked?: string;
}

export interface RankInput {
  /** the plain per-card score (higher is better) */
  plain: (id: string) => number;
  /** the tuner's own baseline summaries; without them no partner split is made (stranding still applies) */
  sums?: readonly PlayerSummary[];
  /** the plan's verdict on cutting one copy: '' or undefined when allowed, else the reason */
  lockedWhy?: (id: string) => string | undefined;
}

/**
 * Every main-deck card with its plain and partner-aware scores, lowest partner-aware score (the first cut) first. A card
 * in several packages is judged with the partner of the one that depends on it most (the largest stranding drop).
 */
export function rankCuts(deck: Pick<DeckList, 'name' | 'legends' | 'main'>, o: RankInput): CutRow[] {
  const splits = o.sums ? partnerSplits(deck, o.sums) : new Map<string, PartnerSplit[]>();
  const rows: CutRow[] = [];
  for (const [id, copies] of counts(deck.main)) {
    const plain = o.plain(id);
    const strand = strandCosts(deck, id);
    // a card in several packages is judged with the partner of the package that depends on it most (the largest drop
    // in assembly odds when one copy is cut); when it is surplus everywhere, by its best partner-aware score
    const drop = (pkg: string) => {
      const x = strand.find((c) => c.pkg === pkg);
      return x && x.before - x.after >= SURPLUS_ODDS ? x.before - x.after : 0;
    };
    let partner: PartnerScore | undefined;
    for (const sp of splits.get(id) ?? []) {
      const ps = partnerScore(sp, plain);
      if (!partner || drop(ps.pkg) > drop(partner.pkg) || (drop(ps.pkg) === drop(partner.pkg) && ps.shrunk > partner.shrunk)) partner = ps;
    }
    const score = (partner ? partner.shrunk : plain) + strand.reduce((a, x) => a + x.penalty, 0);
    const locked = o.lockedWhy?.(id) || undefined;
    rows.push({ id, name: label(id), copies, plain, ...(partner ? { partner } : {}), strand, score, ...(locked ? { locked } : {}) });
  }
  return rows.sort((a, b) => a.score - b.score || a.plain - b.plain || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function partnerScore(sp: PartnerSplit, plain: number): PartnerScore {
  const w = wr(sp.with);
  const ns = wr(sp.notSeen);
  const raw = w !== null && ns !== null && sp.with.games >= MIN_SPLIT_GAMES && sp.notSeen.games >= MIN_SPLIT_GAMES ? w - ns : null;
  const n = raw === null ? 0 : sp.with.games;
  const shrunk = raw === null ? plain : (n * raw + PARTNER_SHRINK_GAMES * plain) / (n + PARTNER_SHRINK_GAMES);
  const s = PACKAGE_ROLES.find((x) => x.synergy.id === sp.pkg)?.synergy;
  return {
    pkg: sp.pkg,
    pkgName: s?.name ?? sp.pkg,
    role: sp.role,
    withGames: sp.with.games,
    withWr: w,
    withoutGames: sp.without.games,
    withoutWr: wr(sp.without),
    notSeenGames: sp.notSeen.games,
    notSeenWr: ns,
    raw,
    shrunk,
  };
}

/** The add side: the plain score plus every package's add credit. */
export function addScore(deck: Pick<DeckList, 'legends' | 'main'>, id: string, plain: number): { v: number; credits: AddCredit[] } {
  const credits = addCredits(deck, id);
  return { v: plain + credits.reduce((a, c) => a + c.credit, 0), credits };
}

// ---------------------------------------------------------------- one-card swaps (forge and Deck Lab)

export interface SwapPicks {
  /** the cuts offered, lowest partner-aware score first (at most `cuts`) */
  cuts: { id: string; v: number }[];
  adds: { id: string; v: number; credits: AddCredit[] }[];
  /** every main-deck card ranked, with whether it was offered as a cut */
  rows: (CutRow & { offered: boolean })[];
}

/**
 * The forge's and the Lab's cuts and adds, partner-aware: the `nCuts` lowest partner-aware scores the plan allows, and
 * adds as before (+1 of the list's own best cards, `nOwn` of them, and the `nOutside` best legal cards format-wide) with
 * each candidate's add credit included; a package card with no format-wide impact is still a candidate when it earns
 * credit. `outside` is the caller's legal pool (Legends excluded, RAM and copy limits applied).
 */
export function partnerAwarePicks(
  deck: Pick<DeckList, 'name' | 'legends' | 'main'>,
  o: RankInput & { own: (id: string) => number; globalImpact: Record<string, number>; outside: readonly string[]; nCuts?: number; nOwn?: number; nOutside?: number },
): SwapPicks {
  const ranked = rankCuts(deck, o);
  const cuts = ranked.filter((r) => !r.locked).slice(0, o.nCuts ?? 3);
  const cs = counts(deck.main);
  const own = [...cs.entries()]
    .filter(([, k]) => k < 3)
    .map(([id]) => ({ id, ...addScore(deck, id, o.own(id)) }))
    .sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1))
    .slice(0, o.nOwn ?? 2);
  const outside = o.outside
    .flatMap((id) => {
      const g = o.globalImpact[id];
      const a = addScore(deck, id, g ?? 0);
      return g === undefined && !a.credits.length ? [] : [{ id, ...a }];
    })
    .sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1))
    .slice(0, o.nOutside ?? 4);
  const adds = [...own, ...outside.filter((x) => !own.some((y) => y.id === x.id))];
  const offered = new Set(cuts.map((c) => c.id));
  return { cuts: cuts.map((c) => ({ id: c.id, v: c.score })), adds, rows: ranked.map((r) => ({ ...r, offered: offered.has(r.id) })) };
}

// ---------------------------------------------------------------- explanations

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;

/** "payoff for Low Gigs: 58% with partner (40 games), 41% without (12)" */
export function partnerText(p: PartnerScore): string {
  const without = p.withoutGames ? `${pct(p.withoutWr)} without (${p.withoutGames})` : 'never drawn without one';
  return `${p.role} for ${p.pkgName}: ${pct(p.withWr)} with a partner (${p.withGames} games), ${without}`;
}

/** "cutting one drops Low Gigs' assembly odds by turn 4 78% → 61%" or "surplus: … only 78% → 77%" */
export function strandText(s: StrandCost): string {
  const surplus = s.before - s.after < SURPLUS_ODDS;
  return `${surplus ? 'surplus piece: cutting one moves' : 'cutting one drops'} ${s.pkgName} assembly odds by turn ${ODDS_ROUND} ${surplus ? 'only ' : ''}${pct(s.before)} → ${pct(s.after)}`;
}

/** Why a card was or was not offered as a cut, in one line (both numbers, the package and the odds). */
export function cutReason(r: CutRow & { offered: boolean }, plainOffered?: boolean): string {
  const parts: string[] = [`Δ when drawn ${pts(r.plain)} pts`];
  if (r.partner) parts.push(`${partnerText(r.partner)}; partner-aware ${pts(r.partner.shrunk)} pts`);
  // the packages a cut really costs; a piece that is surplus everywhere says so once (the package it is surplus in most)
  const costly = r.strand.filter((s) => s.before - s.after >= SURPLUS_ODDS).sort((a, b) => b.before - b.after - (a.before - a.after));
  if (costly.length) parts.push(...costly.map(strandText));
  else if (r.strand.length) parts.push(strandText(r.strand[0]!));
  const penalty = r.strand.reduce((a, x) => a + x.penalty, 0);
  if (penalty >= 0.0005) parts.push(`score with the stranding cost ${pts(r.score)} pts`);
  const verdict = r.locked
    ? `not offered: ${r.locked}`
    : r.offered
      ? plainOffered === false
        ? 'offered as a cut (the package view moved it down)'
        : 'offered as a cut'
      : plainOffered
        ? 'not offered: the package view moved it up'
        : 'not offered';
  return `${verdict} — ${parts.join('; ')}`;
}

/** Add credit in words: "deepens Low Gigs: assembly odds 61% → 78%". */
export function addText(c: AddCredit): string {
  return `${c.kind} ${c.pkgName}: assembly odds by turn ${ODDS_ROUND} ${pct(c.before)} → ${pct(c.after)}`;
}

/**
 * The rows a report shows: every card offered as a cut by either ranking, plus the package cards among the lowest
 * `max` plain scores (the ones the package view is most likely to move), lowest plain score first.
 */
export function cutTableRows<R extends Pick<CutRow, 'plain' | 'partner' | 'strand' | 'locked'> & { offered: boolean; plainOffered: boolean }>(rows: readonly R[], max = 8): R[] {
  const byPlain = [...rows].sort((a, b) => a.plain - b.plain);
  const low = new Set(byPlain.slice(0, max));
  return byPlain.filter((r) => r.offered || r.plainOffered || (low.has(r) && (r.partner || r.strand.length) && !r.locked));
}
