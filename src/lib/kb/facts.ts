// Knowledge pack: `npm run kb -- fact …` (docs/RAG_PLAN.md rule M3, step 2.1). Exact numbers from the recorded data through
// src/lib/eventFacts.ts, each answer with its source file and the bot and sim version it was played with. Pure: the script
// reads the files and resolves deck names; this module only computes and prints. Text, or JSON with the facts' own data.
import {
  deckCompetitive,
  eventSummary,
  fileBasis,
  matchupFact,
  roundSummary,
  standingsAfter,
  type Basis,
  type RecordedEvent,
} from '../eventFacts';
import { day, pc1, playedBy, ratingText, roundText, share, type CompetitiveSources } from './build/events';

export const FACTS = ['champion', 'standings', 'round', 'rating', 'finishes', 'matchup'] as const;
export type FactName = (typeof FACTS)[number];

/** What each fact needs: an event (--event), a round (--round), and how many decks. */
export const FACT_NEEDS: Readonly<Record<FactName, { event: boolean; round: 'no' | 'optional' | 'required'; decks: 0 | 1 | 2 }>> = {
  champion: { event: true, round: 'no', decks: 0 },
  standings: { event: true, round: 'optional', decks: 0 },
  round: { event: true, round: 'required', decks: 0 },
  rating: { event: false, round: 'no', decks: 1 },
  finishes: { event: false, round: 'no', decks: 1 },
  matchup: { event: false, round: 'no', decks: 2 },
};

export interface FactRequest {
  fact: FactName;
  event?: number;
  round?: string;
  /** deck names as typed */
  decks: string[];
  json: boolean;
}

/** A deck as typed → its recorded name, or the nearest names when it is not known. */
export type DeckResolver = (typed: string) => { name: string } | { nearest: string[] };

const sourceLine = (file: string, b: Basis) => `source: ${file} (${playedBy(b)}, recorded ${b.asOf ?? 'no date'})`;

const fail = (msg: string) => ({ out: `${msg}\n`, code: 1 });

function findEvent(src: CompetitiveSources, id: number): { file: string; event: RecordedEvent } | null {
  return src.events.find((e) => e.event.id === id || String(e.event.id) === String(id)) ?? null;
}

/** Run one fact. Exit code 1 when an event, round or deck is not found (the output says what exists). */
export function runFact(req: FactRequest, src: CompetitiveSources, resolve: DeckResolver): { out: string; code: number } {
  const out = (text: string, data: unknown) => ({ out: (req.json ? JSON.stringify(data, null, 2) : text) + '\n', code: 0 });
  const need = FACT_NEEDS[req.fact];
  let ev: { file: string; event: RecordedEvent } | null = null;
  if (need.event) {
    ev = findEvent(src, req.event ?? NaN);
    if (!ev) return fail(`no recorded event ${req.event}; recorded: ${src.events.map((e) => e.event.id).join(', ') || 'none'}`);
  }
  const names: string[] = [];
  for (const typed of req.decks) {
    const r = resolve(typed);
    if ('nearest' in r) return fail(`no deck named "${typed}"${r.nearest.length ? `; nearest:\n${r.nearest.map((n) => `  ${n}`).join('\n')}` : ''}`);
    names.push(r.name);
  }
  try {
    switch (req.fact) {
      case 'champion': {
        const s = eventSummary(ev!.event);
        const text = [
          `${s.name} champion: ${s.champion ?? 'none recorded'}`,
          s.final ? `  final: ${s.final.a} ${s.final.score[0]}-${s.final.score[1]} ${s.final.b}` : null,
          s.finalists[1] ? `  runner-up: ${s.finalists[1]}` : null,
          `  format: ${s.format.label}; ${s.entrants} entrants; ${s.games.total} games${s.custom ? '; custom event (not counted for titles)' : ''}`,
          `  ${sourceLine(ev!.file, s)}`,
        ];
        return out(text.filter(Boolean).join('\n'), { fact: 'champion', source: ev!.file, ...s });
      }
      case 'standings': {
        const k = req.round === undefined ? undefined : Number(req.round);
        if (k !== undefined && !Number.isInteger(k)) return fail(`standings take a numbered round, not "${req.round}"`);
        const st = standingsAfter(ev!.event, k);
        const head = `${ev!.event.name ?? `Event #${ev!.event.id}`} standings after round ${st.round} of ${st.of} (ranked by match points, then opponents' match-win share, then game-win share, each floored at a third)`;
        const rows = st.rows.map((r) => `  ${r.place}. ${r.deck}  ${r.mp} pts  matches ${r.matchRecord}  games ${r.gameRecord}  OMW ${pc1(r.omw)}  GW ${pc1(r.gwp)}`);
        const data = { fact: 'standings', source: ev!.file, ...st, rows: st.rows.map(({ opps: _o, ...r }) => r) };
        return out([head, ...rows, `  ${sourceLine(ev!.file, st)}`].join('\n'), data);
      }
      case 'round': {
        const r = roundSummary(ev!.event, req.round!);
        return out(`${roundText(r)}\n  ${sourceLine(ev!.file, r)}`, { fact: 'round', source: ev!.file, ...r });
      }
      case 'rating':
      case 'finishes': {
        if (!src.ratings) return fail('no ratings file');
        const d = deckCompetitive(names[0]!, { ratings: src.ratings.data, index: src.index.data, h2h: src.h2h?.data });
        const files = `${src.ratings.file}, ${src.index.file}`;
        if (req.fact === 'rating') {
          if (!d.rating) return fail(`"${names[0]}" has no row in ${src.ratings.file}`);
          return out(`${ratingText(d, { events: typeof src.ratings.data.events === 'number' ? src.ratings.data.events : null })}\n  ${sourceLine(files, d)}`, { fact: 'rating', source: files, ...d });
        }
        const lines = [
          `${d.deck} finishes in standard events (newest first): ${d.finishes.length}`,
          ...d.finishes.map((f) => `  Event #${f.event} (${day(f.recorded)}): ${f.place} of ${f.of}, Swiss matches ${f.matchRecord}, games ${f.gameRecord}${f.champion ? ', champion' : f.madeTopCut ? ', made the top cut' : ''}`),
          `  titles: ${d.titles}; made the real top cut: ${d.topCutAppearances}; Swiss finishes in the first eight places (the ratings file's "top 8" count): ${d.swissTopEight}`,
          `  ${sourceLine(files, d)}`,
        ];
        return out(lines.join('\n'), { fact: 'finishes', source: files, deck: d.deck, ...fileBasis(src.ratings.data), titles: d.titles, topCutAppearances: d.topCutAppearances, swissTopEight: d.swissTopEight, finishes: d.finishes });
      }
      case 'matchup': {
        if (!src.h2h) return fail('no head-to-head file');
        const [a, b] = [names[0]!, names[1]!];
        const m = matchupFact(a, b, src.h2h.data);
        if (!m.known) return fail(`"${a}" and "${b}" are not a pairing in ${src.h2h.file}`);
        const lines = [
          `${a} vs ${b}: ${m.games} games${m.games ? `, ${a} won ${share(m.winsA, m.games)} (ties count half)` : ' (never met)'}`,
          `  shrunk estimate for ${a}: ${m.estimate === null ? 'none (no model in the file)' : `${pc1(m.estimate)}${m.priorGames === null ? '' : ` (prior weight ${m.priorGames} games)`}`}`,
          `  ${sourceLine(src.h2h.file, m)}`,
        ];
        return out(lines.join('\n'), { fact: 'matchup', source: src.h2h.file, ...m });
      }
    }
  } catch (e) {
    if (e instanceof RangeError) return fail(e.message);
    throw e;
  }
  return fail(`unknown fact ${String(req.fact)}`);
}
