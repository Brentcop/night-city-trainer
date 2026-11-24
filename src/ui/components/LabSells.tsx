// "The bot sells this" beside a cut in the Deck Lab's result tables (REVIEW_2026-11-24 §10 A.12; src/lib/sellShare.ts):
// no bot keeps Eddies ready for the rival's turn, so it sells some cards (Quick Programs above all) in most of their uses,
// and a low impact figure for such a card says how the bot plays it, not how good the card is. The figures are the
// decision telemetry's, read from its sells slice (public/data/sells.json, cut from the report `npm run sim -- analyze
// --decisions` writes, src/lib/telemetrySlices.ts; since 2026-11-24, when the whole report grew to 900 kB gzip): the row of the
// tuned list as it started when the report has it, else the report's rows pooled over its decks. The tag's title names
// the run, its bot and simulator version, and which rows. The slice is fetched once, only when the Lab shows a result
// (useLabSells), never by the entry chunk; without it, or with a report of another telemetry schema, nothing is shown.
import { useEffect, useMemo, useState } from 'react';
import { CARD_BY_ID } from '../../engine/cards';
import { DECISION_TELEMETRY_SCHEMA } from '../../engine/telemetry';
import { botWord } from '../../lib/evidence';
import { sellBasis, sellShareOf, SELLS_SHARE, type SellBasis, type SellReport, type SellShare } from '../../lib/sellShare';
import { readSellSlice, sellReportOf } from '../../lib/telemetrySlices';
import { SIM_VERSION } from '../../lib/tournament';

/** One card flagged "the bot sells this": its share, the run it comes from, and which rows. */
export interface SellNote {
  share: SellShare;
  basis: SellBasis;
  /** the tuned list's own row, or the report's rows pooled over `decks` decks */
  scope: 'list' | 'pooled';
  decks: number;
}

/** Look up a card id: a note when the bot sells it, else null. */
export type SellLookup = (cardId: string) => SellNote | null;

/** The words on the tag. */
export const SELLS_TAG = 'the bot sells this';

/** A fetched decisions.json as the sell share reads it, or null when it is not a report this code reads. */
export function readSellReport(j: unknown): SellReport | null {
  const r = j as (SellReport & { kind?: unknown; telemetrySchema?: unknown }) | null;
  if (!r || typeof r !== 'object' || r.kind !== 'decision-telemetry' || r.telemetrySchema !== DECISION_TELEMETRY_SCHEMA) return null;
  if (!Array.isArray(r.decks) || !Array.isArray(r.pooled)) return null;
  return r;
}

/**
 * The lookup for one tuning run: the list's own row when the report holds `listId` (the tuned list as it started), else
 * the pooled rows. A Program's reactions count as uses from hand (as on the evidence page and in the kb's card facts).
 */
export function labSellLookup(report: SellReport, listId: string | null): SellLookup {
  const own = listId ? report.decks.find((d) => d.listId === listId) : undefined;
  const rows = own ? own.cards : report.pooled;
  const basis = sellBasis(report);
  const scope = own ? ('list' as const) : ('pooled' as const);
  const notes = new Map<string, SellNote>();
  for (const r of rows) {
    const share = sellShareOf(r.id, r.name, r.modes, { reactFromHand: CARD_BY_ID[r.id]?.type === 'Program' });
    if (share.sells) notes.set(r.id, { share, basis, scope, decks: report.decks.length });
  }
  return (id) => notes.get(id) ?? null;
}

/** The tag's title: the share, the run it comes from, which rows, and what it means for the impact figures. */
export function sellNoteTitle(n: SellNote): string {
  const b = n.basis;
  const pct = Math.round((n.share.share ?? 0) * 100);
  const run = `the ${b.bot ? `${botWord(b.bot)} bot’s` : 'recorded'} run${b.asOf ? ` of ${b.asOf.slice(0, 10)}` : ''}${b.simVersion !== null ? ` (simulator version ${b.simVersion}${b.simVersion !== SIM_VERSION ? `, not the current ${SIM_VERSION}` : ''})` : ''}`;
  const rows = n.scope === 'list' ? 'on this list as it started' : `pooled over the ${n.decks} deck${n.decks === 1 ? '' : 's'} it played, not this list`;
  return `Sold in ${pct}% of ${n.share.uses.toLocaleString('en-US')} uses from hand (plays, sells, and a Program’s reactions) in the decision telemetry of ${run}, ${rows}. From ${Math.round(SELLS_SHARE * 100)}% on it reads “${SELLS_TAG}”: no bot keeps Eddies ready for the rival’s turn, so a low impact figure for this card says how the bot plays it, not how good the card is.`;
}

/** The tag beside a cut, after a space; nothing at all (no space either) when the card is not flagged. */
export function SellsTag({ note }: { note: SellNote | null | undefined }) {
  if (!note) return null;
  return (
    <>
      {' '}
      <span className="tag" title={sellNoteTitle(note)}>
        {SELLS_TAG}
        <span className="sr-only">: {sellNoteTitle(note)}</span>
      </span>
    </>
  );
}

let file: Promise<SellReport | null> | null = null;
/** The decision telemetry's sells slice, read as a report the sell share reads, fetched once per page load (null when missing or unreadable). */
function loadSellReport(): Promise<SellReport | null> {
  file ??= (async () => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data/sells.json`);
      const slice = r.ok ? readSellSlice(await r.json(), DECISION_TELEMETRY_SCHEMA) : null;
      return slice ? sellReportOf(slice) : null;
    } catch {
      return null;
    }
  })();
  return file;
}

/** The sells lookup for a run's result: fetched only once `on` (a result is shown), for the list the run started from. */
export function useLabSells(on: boolean, listId: string | null): SellLookup | null {
  const [report, setReport] = useState<SellReport | null>(null);
  useEffect(() => {
    if (!on || report) return;
    let live = true;
    void loadSellReport().then((r) => {
      if (live && r) setReport(r);
    });
    return () => {
      live = false;
    };
  }, [on, report]);
  return useMemo(() => (report ? labSellLookup(report, listId) : null), [report, listId]);
}
