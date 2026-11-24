// What the bots sell (docs/REVIEW_2026-11-24.md B1 and §10 A.12): per card, the share of the times a copy left the hand
// that were sells, from the decision telemetry (src/analysis/decisions.ts's report, reports/decisions-latest.json; the site reads public/data/sells.json, src/lib/telemetrySlices.ts). No bot
// keeps Eddies ready for the rival's turn, so Quick Programs are sold in most of their uses at every tier: a low card
// impact for such a card says what the bot does with it, not what the card is worth. A share at or above SELLS_SHARE
// reads "the bot sells this".
//
// Pure and light, Node and browser: type imports only (the decision report's types), nothing from the engine, the bots,
// the simulator or the kb, so the evidence builder, the Deck Lab's cut table and the kb's card facts can all call it.
//
// "Uses from hand" are the decision report's main-phase plays ('play') and sells ('sell'), and, for a card cast from
// hand in a reaction window (a Program: `reactFromHand`), its reaction uses ('react'). A Unit's reaction uses are Blocks
// and a Legend's are Calls, which are not uses from hand, so they are left out unless the caller says otherwise;
// attacks, abilities, Calls and Go Solo never count. Under MIN_SELL_USES uses the share is given but never flagged.
import type { RunManifest } from './runManifest';

/** From this share of its uses from hand on, a card reads "the bot sells this" (about 85%: the review's line). */
export const SELLS_SHARE = 0.85;
/** Fewer uses from hand than this and the share is never flagged. */
export const MIN_SELL_USES = 20;

/** One card's sells out of its uses from hand. */
export interface SellShare {
  cardId: string;
  name: string;
  /** sells */
  sold: number;
  /** uses from hand: plays, sells and (when cast from hand in a reaction window) reactions */
  uses: number;
  /** sold / uses, null with no use */
  share: number | null;
  /** at least MIN_SELL_USES uses and a share at or above SELLS_SHARE */
  sells: boolean;
}

/** Where the figures come from: the decision report's run, as its own manifest records it (never assumed). */
export interface SellBasis {
  /** the bot level the run recorded ("deep"), null when the report has no manifest */
  bot: string | null;
  simVersion: number | null;
  runId: string | null;
  /** the run's recorded date (manifest `createdAt`, as stored) */
  asOf: string | null;
  games: number;
}

/** The modes of one card row, as the decision report stores them (only the counts read here). */
export type SellModes = readonly { mode: string; all: { uses: number } }[];

/** A card's sells out of its uses from hand, from one row of the decision report. */
export function sellShareOf(cardId: string, name: string, modes: SellModes, o: { reactFromHand?: boolean; min?: number; threshold?: number } = {}): SellShare {
  let sold = 0;
  let uses = 0;
  for (const m of modes) {
    const n = Number.isFinite(m.all.uses) ? m.all.uses : 0;
    if (m.mode === 'sell') sold += n;
    if (m.mode === 'play' || m.mode === 'sell' || (m.mode === 'react' && o.reactFromHand)) uses += n;
  }
  const share = uses > 0 ? sold / uses : null;
  return { cardId, name, sold, uses, share, sells: share !== null && uses >= (o.min ?? MIN_SELL_USES) && share >= (o.threshold ?? SELLS_SHARE) };
}

/** A card row as read here: a decision report's (CardReport), or the sells slice's (src/lib/telemetrySlices.ts). */
export interface SellRow {
  id: string;
  name: string;
  modes: SellModes;
}
/**
 * The decision report as read here: its lists, its pooled rows and its manifest. A DecisionReport is one; so is the sells
 * slice (public/data/sells.json) read back by `sellReportOf` in src/lib/telemetrySlices.ts.
 */
export interface SellReport {
  games: number;
  decks: readonly { listId: string; cards: readonly SellRow[] }[];
  pooled: readonly SellRow[];
  manifest?: Pick<RunManifest, 'bot' | 'simVersion' | 'runId' | 'createdAt'>;
}

/** The run a decision report's figures come from. */
export function sellBasis(report: SellReport): SellBasis {
  const m = report.manifest;
  return { bot: m?.bot?.level ?? null, simVersion: typeof m?.simVersion === 'number' ? m.simVersion : null, runId: m?.runId ?? null, asOf: m?.createdAt ?? null, games: report.games };
}

/**
 * Every card's sell share in a decision report: on one list (`listId`, a list fingerprint), or pooled over every list
 * (the report's own pooled rows, player-games of different decks mixed). `reactFromHand` says which cards are cast from
 * hand in a reaction window (the Programs). Highest share first, then by name; cards with no use from hand are left out.
 */
export function sellShares(report: SellReport, o: { listId?: string; reactFromHand?: (cardId: string) => boolean; min?: number; threshold?: number } = {}): SellShare[] {
  const rows = o.listId !== undefined ? (report.decks.find((d) => d.listId === o.listId)?.cards ?? []) : report.pooled;
  return rows
    .map((r) => sellShareOf(r.id, r.name, r.modes, { reactFromHand: o.reactFromHand?.(r.id) ?? false, ...(o.min !== undefined ? { min: o.min } : {}), ...(o.threshold !== undefined ? { threshold: o.threshold } : {}) }))
    .filter((s) => s.uses > 0)
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** One card's sell share (on a list, or pooled), or null when the report has no row for it or no use from hand. */
export function cardSellShare(report: SellReport, cardId: string, o: { listId?: string; reactFromHand?: boolean } = {}): SellShare | null {
  const rows = o.listId !== undefined ? (report.decks.find((d) => d.listId === o.listId)?.cards ?? []) : report.pooled;
  const r = rows.find((x) => x.id === cardId);
  if (!r) return null;
  const s = sellShareOf(r.id, r.name, r.modes, { reactFromHand: !!o.reactFromHand });
  return s.uses > 0 ? s : null;
}
