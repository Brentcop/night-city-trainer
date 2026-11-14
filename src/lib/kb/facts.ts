// Knowledge pack: `npm run kb -- fact …` (docs/RAG_PLAN.md rule M3, step 2.1). Exact numbers from the recorded data through
// src/lib/eventFacts.ts, each answer with its source file and the bot and sim version it was played with. Pure: the script
// reads the files and resolves deck names; this module only computes and prints. Text, or JSON with the facts' own data.
// `fact card` and `fact package` (step 2.4) read the decision, synergy and deck-analysis reports through
// src/lib/cardFacts.ts and print the same sentences as the cardstat and pkgstat records.
import {
  deckCompetitive,
  eventSummary,
  fileBasis,
  matchupFact,
  ratingsTable,
  roundSummary,
  standingsAfter,
  type Basis,
  type RecordedEvent,
} from '../eventFacts';
import { cardAnalysis, cardAnalysisLists, cardUse, cardUseLists, packageFact, packageLists, pooledImpact, type StatBasis } from '../cardFacts';
import { liftLabel } from '../../ai/packageLift';
import { day, pc1, playedBy, ratingsTableText, ratingText, roundText, share, type CompetitiveSources } from './build/events';
import { cardPooledText, cardStatText, packageStatText, type StatDeck, type StatsSources } from './build/stats';
import { FACT_NEEDS, type DeckResolver, type FactRequest, type StatResolver } from './factNames';

export { FACT_NEEDS, FACTS, type DeckResolver, type FactName, type FactRequest, type StatResolver } from './factNames';

/** What `fact card` and `fact package` read: the reports, the names, and the library deck of a list fingerprint. */
export interface StatFactSources {
  sources: StatsSources;
  names: StatResolver;
  deckOf: (listId: string) => StatDeck | undefined;
}

const statSource = (b: StatBasis) => `source: ${b.file} (${playedBy(b)}, recorded ${b.asOf ?? 'no date'}${b.games === null ? '' : `, ${b.games} games in the run`})`;
const nearestText = (what: string, typed: string, nearest: readonly string[]) => `no ${what} named "${typed}"${nearest.length ? `; nearest:
${nearest.map((n) => `  ${n}`).join('\n')}` : ''}`;

/** `fact card <card> [--deck <deck>]` and `fact package <package> [--deck <deck>]`. */
function runStatFact(req: FactRequest, st: StatFactSources): { out: string; code: number } {
  const out = (text: string, data: unknown) => ({ out: (req.json ? JSON.stringify(data, null, 2) : text) + '\n', code: 0 });
  const typed = req.subject ?? '';
  const subject = req.fact === 'card' ? st.names.card(typed) : st.names.package(typed);
  if ('nearest' in subject) return fail(nearestText(req.fact, typed, subject.nearest));
  let deck: { file: string; name: string; listId: string } | undefined;
  if (req.deck !== undefined) {
    const d = st.names.deck(req.deck);
    if ('nearest' in d) return fail(nearestText('library deck', req.deck, d.nearest));
    deck = d;
  }
  const { decisions: dec, analysis: ana, impact, synergies: syn } = st.sources;
  const listName = (listId: string | null) => (listId ? (st.deckOf(listId)?.name ?? listId) : 'an unnamed list');
  if (req.fact === 'card') {
    const id = subject.id;
    const lists = [...new Set([...(dec ? cardUseLists(dec.data, id) : []), ...(ana ? cardAnalysisLists(ana.data, id) : [])])];
    if (deck) {
      const use = dec ? cardUse(dec.data, dec.file, id, { listId: deck.listId }) : null;
      const analysis = ana ? cardAnalysis(ana.data, ana.file, id, deck.listId) : null;
      if (!use && !analysis) return fail(`no statistics for ${subject.name} on ${deck.name}; lists with statistics for it: ${lists.map(listName).join('; ') || 'none'}`);
      const sources = [use?.basis, analysis?.basis].filter((b): b is StatBasis => !!b);
      return out([cardStatText({ card: subject.name, deck: deck.name, use, analysis }), ...sources.map((b) => `  ${statSource(b)}`)].join('\n'), { fact: 'card', card: id, deck: deck.file, use, analysis });
    }
    const use = dec ? cardUse(dec.data, dec.file, id) : null;
    const analyses = ana ? cardAnalysisLists(ana.data, id).map((l) => cardAnalysis(ana.data, ana.file, id, l)!) : [];
    const pooled = impact ? pooledImpact(impact.data, id) : null;
    if (!use && !analyses.length) return fail(`no statistics for ${subject.name} in ${[dec?.file, ana?.file].filter(Boolean).join(' or ') || 'any report (none found)'}`);
    const text = cardPooledText({ card: subject.name, use, analyses, impact: pooled && impact ? { file: impact.file, fact: pooled } : null, listName, useLists: dec ? cardUseLists(dec.data, id).map(listName) : [] });
    const sources = [use?.basis, analyses[0]?.basis].filter((b): b is StatBasis => !!b);
    return out([text, `  lists with a cell: ${lists.map(listName).join('; ')}`, ...sources.map((b) => `  ${statSource(b)}`), ...(pooled && impact ? [`  source: ${impact.file} (the per-list gaps of ${ana?.file ?? 'the deck analysis'})`] : [])].join('\n'), {
      fact: 'card',
      card: id,
      deck: null,
      lists: lists.map((l) => ({ listId: l, deck: st.deckOf(l)?.file ?? null })),
      use,
      analyses,
      pooledImpact: pooled,
    });
  }
  if (!syn) return fail('no synergy report');
  const id = subject.id;
  const holders = packageLists(syn.data, id);
  const f = packageFact(syn.data, syn.file, id, { listId: deck?.listId, catalogueVersion: st.sources.catalogueVersion });
  if (!f) return fail(deck ? `${deck.name} does not hold ${subject.name} in ${syn.file}; lists that do: ${holders.map(listName).join('; ') || 'none'}` : `no pooled row for ${subject.name} in ${syn.file}`);
  const note = f.gate === 'measured' ? liftLabel({ [id]: { basis: f.scope, online: f.wonOnline.rate!, never: f.wonNever.rate!, onlineGames: f.wonOnline.games, neverGames: f.wonNever.games, lift: f.lift!.gap, low95: f.lift!.low95, high95: f.lift!.high95 } }, [{ id, name: f.package.name }]) : '';
  const lines = [packageStatText(f, { deck: deck?.name, lists: holders.map(listName) }), ...(note && f.lift && f.gateBasis === f.scope ? [`  the coach's note would read: ${note}`] : []), ...(deck ? [] : [`  lists that hold it: ${holders.map(listName).join('; ')}`]), `  ${statSource(f.basis)}`];
  return out(lines.join('\n'), { fact: 'package', file: deck?.file ?? null, ...f });
}

const sourceLine = (file: string, b: Basis) => `source: ${file} (${playedBy(b)}, recorded ${b.asOf ?? 'no date'})`;

const fail = (msg: string) => ({ out: `${msg}\n`, code: 1 });

function findEvent(src: CompetitiveSources, id: number): { file: string; event: RecordedEvent } | null {
  return src.events.find((e) => e.event.id === id || String(e.event.id) === String(id)) ?? null;
}

/**
 * Run one fact. Exit code 1 when an event, round, deck, card or package is not found (the output says what exists).
 * `stats`: the evidence-cell sources, needed by `fact card` and `fact package` only.
 */
export function runFact(req: FactRequest, src: CompetitiveSources, resolve: DeckResolver, stats?: StatFactSources): { out: string; code: number } {
  if (FACT_NEEDS[req.fact].subject) return stats ? runStatFact(req, stats) : fail(`fact ${req.fact} needs the measured reports`);
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
      case 'ratings': {
        if (!src.ratings) return fail('no ratings file');
        const t = ratingsTable(src.ratings.data, req.top === undefined ? {} : { top: req.top });
        return out(`${ratingsTableText(t)}\n  ${sourceLine(src.ratings.file, t)}`, { fact: 'ratings', source: src.ratings.file, ...t });
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
      case 'card':
      case 'package':
        break;
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
