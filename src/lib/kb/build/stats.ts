// Knowledge pack builders: measured evidence cells (docs/RAG_PLAN.md step 2.4, rules M3 to M5). One `cardstat` record
// per card on a library list and one per card pooled over the lists of the report, from the decision report
// (public/data/decisions.json) and the per-deck analysis (src/data/analysis.json, with the coach's pooled impact figure
// from src/data/impact.json); one `pkgstat` record per synergy package on a list and one pooled, from the synergy report
// (public/data/synergies.json). Every number comes from src/lib/cardFacts.ts and every sentence from a template here:
// the first says what the record is and names the bot and the sim version; every count has its denominator, every rate
// its games and 95% interval, and a slice under the report's minimum says "too few games" and gives no rate. They say
// what the bot did and that the win rates are associations, never the value of a card and never advice. A list that
// matches no current library deck by fingerprint is skipped and counted in the build report.
import {
  cardAnalysis,
  cardAnalysisLists,
  cardUse,
  cardUseLists,
  packageFact,
  packageLists,
  pooledImpact,
  reportBasis,
  STAGE_KEYS,
  STANDING_KEYS,
  type AnalysisInput,
  type CardAnalysisFact,
  type CardUseFact,
  type Gap,
  type PackageFact,
  type PooledImpactFact,
  type Share,
  type StatBasis,
  type UseModeFact,
  type WinRate,
} from '../../cardFacts';
import type { DecisionReport, UseMode } from '../../../analysis/decisions';
import type { ImpactData } from '../../../analysis/impactData';
import type { SynergyReport } from '../../../analysis/synergies';
import type { KbFieldValue, KbLink, KbRecord } from '../types';
import { day, pc1, playedBy } from './events';
import { deckRecordId, deckStem } from './decks';
import { finishRecord } from './record';

/** The four measured reports the cells are built from (each null when its file is missing). */
export interface StatsSources {
  decisions: { file: string; data: DecisionReport } | null;
  synergies: { file: string; data: SynergyReport } | null;
  analysis: { file: string; data: AnalysisInput } | null;
  impact: { file: string; data: ImpactData } | null;
  /** the current package catalogue's version (CATALOGUE_VERSION in src/content/synergies) */
  catalogueVersion: string;
}

/** A library deck as the cells need it: its file and its name. */
export interface StatDeck {
  file: string;
  name: string;
}

export const cardStatId = (cardId: string, deckFile?: string): string => (deckFile ? `cardstat:${deckStem(deckFile)}/${cardId}` : `cardstat:${cardId}`);
export const pkgStatId = (pkgId: string, deckFile?: string): string => (deckFile ? `pkgstat:${deckStem(deckFile)}/${pkgId}` : `pkgstat:${pkgId}`);

// ---------------------------------------------------------------- wording (no locale, no clock)

/** Fields keep 4 decimals, as the synergy report stores its rates (the text shows one decimal of a percentage). */
const r4 = <T extends number | null | undefined>(x: T): T => (typeof x === 'number' ? (Math.round(x * 1e4) / 1e4) as T : x);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "+4.2 points" / "-3.0 points" (a difference of two rates, in percentage points) */
export const points = (x: number): string => `${x < 0 && Math.abs(x) >= 0.0005 ? '-' : '+'}${(Math.abs(x) * 100).toFixed(1)} points`;
/** A win rate: "53.0% of 1015 games (95% interval 49.9%–56.1%)", or "12 games, too few games for a rate" */
export function rateText(w: WinRate): string {
  if (w.thin || w.rate === null || w.low95 === null || w.high95 === null) return `${plural(w.games, 'game')}, too few games for a rate`;
  return `${pc1(w.rate)} of ${plural(w.games, 'game')} (95% interval ${pc1(w.low95)}–${pc1(w.high95)})`;
}
/** "212 of 276 games (76.8%, 95% interval 71.5%–81.4%)", or the count alone with "too few games" */
export function shareText(s: Share): string {
  const base = `${s.n} of ${plural(s.of, 'game')}`;
  if (s.thin || s.rate === null || s.low95 === null || s.high95 === null) return `${base} (too few games for a rate)`;
  return `${base} (${pc1(s.rate)}, 95% interval ${pc1(s.low95)}–${pc1(s.high95)})`;
}
/** The short form inside a list of slices, where the record has said once that intervals are 95%: "51.9% of 555 games (47.7%–56.0%)" */
export function rateShort(w: WinRate): string {
  if (w.thin || w.rate === null || w.low95 === null || w.high95 === null) return `${plural(w.games, 'game')}, too few games`;
  return `${pc1(w.rate)} of ${plural(w.games, 'game')} (${pc1(w.low95)}–${pc1(w.high95)})`;
}
const gapText = (g: Gap) => `${points(g.gap)} (95% interval ${points(g.low95)} to ${points(g.high95)})`;

/** What the cells are, said once per record: association, not value, not advice. */
export const ASSOCIATION_NOTE = 'This is what the bot did in its own games: the win rates are associations, not the value of the card and not advice.';
const PKG_ASSOCIATION_NOTE = "This is what happened in the bot's own games: the win rates are associations, not the value of the package and not advice.";

const MODE_TEXT: Record<UseMode, string> = {
  play: 'Played from hand in the main phase',
  sell: 'Sold for an Eddie',
  call: 'Called (a face-down Legend turned face-up in the main phase)',
  solo: 'Gone Solo',
  legend: 'Played as a Legend by paying its cost (rule 4.5)',
  ability: 'Ability used in the main phase',
  attack: 'Attacked with',
  react: 'Used in a reaction window (a Call, a Block, a Quick Program or a quick ability)',
};

const stageWords = (u: CardUseFact) => `early ${u.stages.early}, middle ${u.stages.middle}, late ${u.stages.late}`;
const STAGE_DEF = (u: CardUseFact) =>
  `Stages are the decision report's (stageOf in src/analysis/decisions.ts, by round of the game): ${stageWords(u)}; Gig standing compares the bot's Gigs with the rival's when it chose. Intervals are 95% (Wilson); a slice under ${u.minSliceGames} games says "too few games" and gives no rate.`;

const sliceList = <K extends string>(keys: readonly K[], src: Record<K, { uses: number; won: WinRate }>) =>
  keys.map((k) => (src[k].won.games ? `${k} ${plural(src[k].uses, 'use')}, won ${rateShort(src[k].won)}` : `${k} none`)).join('; ');

function modeLines(m: UseModeFact, deckGames: number | null): string[] {
  const where = m.mode === 'react' ? 'attacks' : 'turns';
  const extra = [m.selfPaid ? `the Legend helped pay for itself in ${m.selfPaid} of them` : null, m.stolen !== null ? `${plural(m.stolen, 'Gig')} stolen by these attacks` : null].filter(Boolean);
  return [
    `${MODE_TEXT[m.mode]}: ${plural(m.uses, 'time')} in ${m.won.games}${deckGames === null ? '' : ` of the list's ${deckGames}`} games${extra.length ? ` (${extra.join('; ')})` : ''}; legal in ${plural(m.windows, where === 'turns' ? 'turn' : 'attack')} and used in ${m.windowsUsed} of them (chosen in ${m.chosen} of the ${plural(m.offered, 'decision')} that offered it). Win rate of those games: ${rateText(m.won)}.`,
    `  By stage: ${sliceList(STAGE_KEYS, m.stage)}.`,
    `  By Gig standing: ${sliceList(STANDING_KEYS, m.standing)}.`,
  ];
}

const sameRun = (a: StatBasis, b: StatBasis) => a.runId !== null && a.runId === b.runId;
const basisText = (b: StatBasis) => `${playedBy(b)} (${day(b.asOf)}${b.games === null ? '' : `, ${b.games} games in the run`})`;

function analysisLines(a: CardAnalysisFact, use: StatBasis | null): string[] {
  const run = use && sameRun(use, a.basis) ? `the same run's game traces` : `the game traces of a run by ${basisText(a.basis)}`;
  const notDrawn = a.deckGames - a.drawnGames;
  return [
    `Per-deck analysis of ${run} (${a.basis.file}): drawn (kept opening hand, drawn, or played from hand) in ${a.drawnGames} of the list's ${a.deckGames} games; win rate when drawn ${rateText(a.wonDrawn)}, without it ${a.wonNotDrawn.thin ? `${plural(notDrawn, 'game')}, too few games for a rate` : rateText(a.wonNotDrawn)}${a.gap ? `: a gap of ${gapText(a.gap)} when drawn` : ''}. ${a.caveat}`,
    `Played any way (any zone or window, Legend plays included) in ${a.playedGames} games, win rate ${rateText(a.wonPlayed)}${a.meanTurnPlayed === null ? '' : `; first played on the list's own turn ${a.meanTurnPlayed.toFixed(2)} on average`}; sold at least once in ${a.soldGames} of the ${a.drawnGames} drawn games; in the kept opening hand in ${a.openingGames} games${a.stealsPerPlayedGame ? `; ${a.stealsPerPlayedGame.toFixed(2)} Gigs stolen by its attacks per game it was played` : ''}.`,
  ];
}

// ---------------------------------------------------------------- card cells

/** The text of a card's cell on one list (the record and `kb fact card --deck`). */
export function cardStatText(o: { card: string; deck: string; use: CardUseFact | null; analysis: CardAnalysisFact | null }): string {
  const main = o.use?.basis ?? o.analysis?.basis;
  if (!main) return `${o.card} on ${o.deck}: no measured statistics.`;
  const games = o.use?.deckGames ?? o.analysis?.deckGames ?? null;
  const lines: string[] = [
    `${o.card} on ${o.deck}: statistics of how the bot used one card on one library list, measured by ${basisText(main)}${games === null ? '' : `; the list played ${games} of those games`}. ${ASSOCIATION_NOTE}`,
  ];
  if (o.use) {
    lines.push(`From the decision report (${o.use.basis.file}): ${STAGE_DEF(o.use)}`);
    for (const m of o.use.modes) lines.push(...modeLines(m, o.use.deckGames));
  } else lines.push('The decision report has no row for this card on this list.');
  if (o.analysis) lines.push(...analysisLines(o.analysis, o.use?.basis ?? null));
  return lines.join('\n');
}

/** The text of a card's cell pooled over the lists of the reports (the record and `kb fact card`). */
export function cardPooledText(o: {
  card: string;
  use: CardUseFact | null;
  /** the per-list analysis rows, with the list's name */
  analyses: readonly CardAnalysisFact[];
  impact: { file: string; fact: PooledImpactFact } | null;
  listName: (listId: string | null) => string;
  /** names of the lists in the decision report with a row for this card */
  useLists: readonly string[];
}): string {
  const main = o.use?.basis ?? o.analyses[0]?.basis;
  if (!main) return `${o.card}: no measured statistics.`;
  const lines: string[] = [];
  if (o.use) {
    lines.push(
      `${o.card}: statistics of how the bot used one card, pooled over the ${plural(o.use.lists, 'list')} of the ${o.use.listsInReport} in the decision report that used it (${o.useLists.join('; ')}), measured by ${basisText(main)}. Pooled slices mix different decks and count player-games. ${ASSOCIATION_NOTE}`,
      `From the decision report (${o.use.basis.file}): ${STAGE_DEF(o.use)}`,
    );
    for (const m of o.use.modes) lines.push(...modeLines(m, null));
  } else lines.push(`${o.card}: statistics of how the bot used one card, from the per-deck analysis only, measured by ${basisText(main)}. ${ASSOCIATION_NOTE}`);
  if (o.analyses.length) {
    const a0 = o.analyses[0]!;
    const run = o.use && sameRun(o.use.basis, a0.basis) ? `the same run` : `a run by ${basisText(a0.basis)}`;
    lines.push(
      `Gap when drawn, per list, from the per-deck analysis of ${run} (${a0.basis.file}): ${o.analyses
        .map((a) => `${o.listName(a.listId)} ${a.gap ? gapText(a.gap) : 'too few games for a gap'}, drawn in ${a.drawnGames} of ${a.deckGames} games, sold at least once in ${a.soldGames} of them`)
        .join('; ')}. ${a0.caveat}`,
    );
  }
  if (o.impact && o.impact.fact.gap !== null) {
    const f = o.impact.fact;
    lines.push(
      `The coach's impact table (${o.impact.file}, src/ai/impact.ts) pools these per-list gaps as a mean weighted by drawn games: ${points(f.gap!)} over ${f.drawnGames} drawn games on ${plural(f.lists, 'list')}, a weighted mean of gaps with no interval of its own; the coach reads it only from ${f.minPooledGames} drawn games on (${f.coachUses ? 'reached' : 'not reached'}).`,
    );
  }
  return lines.join('\n');
}

function modeFields(u: CardUseFact | null): Record<string, KbFieldValue> {
  const out: Record<string, KbFieldValue> = {};
  for (const m of u?.modes ?? []) {
    out[`${m.mode}Uses`] = m.uses;
    out[`${m.mode}Games`] = m.won.games;
    out[`${m.mode}WinRate`] = r4(m.won.rate) ?? null;
    out[`${m.mode}Low95`] = r4(m.won.low95) ?? null;
    out[`${m.mode}High95`] = r4(m.won.high95) ?? null;
    out[`${m.mode}Legal`] = m.windows;
    out[`${m.mode}Used`] = m.windowsUsed;
  }
  return out;
}

const stampsOf = (b: StatBasis, listId?: string) => ({ simVersion: b.simVersion ?? undefined, bot: b.bot ?? undefined, asOf: b.asOf ?? undefined, listId });

// ---------------------------------------------------------------- package cells

/** The text of a package's cell, on one list or pooled (the record and `kb fact package`). */
export function packageStatText(f: PackageFact, o: { deck?: string; lists?: readonly string[] } = {}): string {
  const head =
    f.scope === 'list'
      ? `${f.package.name} on ${o.deck ?? f.deck}: statistics of one synergy package on one library list, measured by ${basisText(f.basis)}; the list played ${f.games} of those games.`
      : `${f.package.name}: statistics of one synergy package, pooled over the ${plural(o.lists?.length ?? 0, 'list')} in the synergy report that hold it, measured by ${basisText(f.basis)}; ${f.games} player-games, different decks mixed.`;
  const copies = f.copies
    ? Object.entries(f.copies)
        .filter(([, n]) => n)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ')
    : '';
  const gate =
    f.gate === 'unmeasured'
      ? `The coach's lift gate (liftGate in src/ai/packageLift.ts) treats it as unmeasured: the report was made with another package catalogue.`
      : f.gate === 'measured'
        ? `The coach's lift gate (liftGate in src/ai/packageLift.ts) would call it measured, reading the ${f.gateBasis === 'list' ? "list's own" : 'pooled'} figure: the coach may name it, with the association wording.`
        : `The coach's lift gate (liftGate in src/ai/packageLift.ts) would leave it unnamed (hidden): ${f.gateBasis === null ? 'no figure with enough games on both sides' : `the ${f.gateBasis === 'list' ? "list's own" : 'pooled'} lift interval does not lie above 0`}.`;
  const members = f.members.filter((m) => m.withPartner.games + m.withoutPartner.games > 0);
  const lines: (string | null)[] = [
    `${head} ${PKG_ASSOCIATION_NOTE}`,
    f.scope === 'list' ? `${f.builtAround ? 'The list is built around it' : 'The list holds it without being built around it'}${copies ? ` (copies by role: ${copies})` : ''}. Turns below are the list's own turns.` : null,
    `Assembled (the needed pieces held at some point): ${shareText(f.assembled)}; win rate of those games ${rateText(f.wonAssembled)}.`,
    `Came online (its board condition held at some point): ${shareText(f.online)}${f.medianRound === null ? '' : `; first online on own turn ${f.medianRound} (median)`}${f.meanTurnsOnline === null ? '' : `, held ${f.meanTurnsOnline.toFixed(2)} turns per online game`}.`,
    f.byRound.length
      ? `By own turn ${f.byRound.map((b) => b.round).join(' / ')}, of the ${f.byRound.map((b) => b.reached).join(' / ')} games that reached it: pieces held in ${f.byRound.map((b) => b.assembled).join(' / ')}, online in ${f.byRound.map((b) => b.online).join(' / ')}${f.byRound.every((b) => b.odds !== null) ? ` (computed draw odds of holding the pieces, not measured: ${f.byRound.map((b) => pc1(b.odds!)).join(' / ')})` : ''}.`
      : null,
    `Win rate in the games it came online: ${rateText(f.wonOnline)}; in the games it never did: ${rateText(f.wonNever)}.`,
    f.lift ? `Lift (won when online minus won when never): ${gapText(f.lift)}, Newcombe's interval as in src/ai/packageLift.ts: an association, not proof that it wins games.` : 'Lift: too few games on one side to give one.',
    gate,
    members.length ? `Member cards, win rate of the games each was used with a partner piece held and with none (95% intervals): ${members.map((m) => `${m.name} (${m.role}) with a partner ${rateShort(m.withPartner)}, with none ${rateShort(m.withoutPartner)}`).join('; ')}.` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- all of them

/**
 * cardstat and pkgstat records. `deckOf(listId)` gives the library deck with that list fingerprint (undefined: the list
 * is skipped and counted in `skipped`); `hasCard` / `hasPackage` say whether the pack has that record to link to.
 */
export function buildStats(
  src: StatsSources,
  o: {
    deckOf: (listId: string) => StatDeck | undefined;
    cardName: (id: string) => string | undefined;
    hasCard: (id: string) => boolean;
    hasPackage: (id: string) => boolean;
    skipped: Record<string, number>;
  },
): KbRecord[] {
  const skip = (why: string, n = 1) => (o.skipped[why] = (o.skipped[why] ?? 0) + n);
  const out: KbRecord[] = [];
  const cardLink = (id: string): KbLink[] => (o.hasCard(id) ? [{ rel: 'card', to: `card:${id}` }] : []);
  const deckLink = (d: StatDeck): KbLink[] => [{ rel: 'deck', to: deckRecordId(d.file) }];
  for (const [name, f] of [['decision report', src.decisions], ['synergy report', src.synergies], ['deck analysis', src.analysis], ['impact table', src.impact]] as const) if (!f) skip(`stats: ${name} missing`);

  // ---- cards
  const dec = src.decisions;
  const ana = src.analysis;
  const listName = (listId: string | null) => (listId ? (o.deckOf(listId)?.name ?? listId) : 'an unnamed list');
  const lists = new Set<string>();
  for (const d of dec?.data.decks ?? []) lists.add(d.listId);
  for (const d of ana?.data.decks ?? []) if (d.id) lists.add(d.id);
  const cardIds = new Set<string>();
  for (const listId of [...lists].sort()) {
    const deck = o.deckOf(listId);
    const cards = new Set<string>([...(dec?.data.decks.find((d) => d.listId === listId)?.cards.map((c) => c.id) ?? []), ...(ana?.data.decks.find((d) => d.id === listId)?.cards.map((c) => c.id) ?? [])]);
    if (!deck) {
      skip('stats: list not in the library (cards)');
      continue;
    }
    for (const id of [...cards].sort()) {
      cardIds.add(id);
      const use = dec ? cardUse(dec.data, dec.file, id, { listId }) : null;
      const analysis = ana ? cardAnalysis(ana.data, ana.file, id, listId) : null;
      const main = (use?.basis ?? analysis?.basis)!;
      const name = o.cardName(id) ?? use?.card.name ?? analysis?.card.name ?? id;
      const di = dec?.data.decks.findIndex((d) => d.listId === listId) ?? -1;
      const ci = di >= 0 ? dec!.data.decks[di]!.cards.findIndex((c) => c.id === id) : -1;
      out.push(
        finishRecord({
          id: cardStatId(id, deck.file),
          kind: 'cardstat',
          title: `${name} on ${deck.name}: statistics`,
          text: cardStatText({ card: name, deck: deck.name, use, analysis }),
          fields: {
            card: id,
            deck: deck.name,
            file: deck.file,
            listGames: use?.deckGames ?? analysis?.deckGames ?? null,
            ...modeFields(use),
            drawnGames: analysis?.drawnGames,
            wonDrawn: r4(analysis?.wonDrawn.rate),
            gapWhenDrawn: r4(analysis?.gap?.gap),
            gapLow95: r4(analysis?.gap?.low95),
            gapHigh95: r4(analysis?.gap?.high95),
            playedGames: analysis?.playedGames,
            soldGames: analysis?.soldGames,
            meanTurnPlayed: r4(analysis?.meanTurnPlayed),
            analysisFile: analysis ? analysis.basis.file : undefined,
            association: true,
            stale: (use?.basis.stale ?? false) || (analysis?.basis.stale ?? false),
          },
          links: [...cardLink(id), ...deckLink(deck), { rel: 'parent', to: cardStatId(id) }],
          source: use ? { file: use.basis.file, at: `/decks/${di}/cards/${ci}` } : { file: analysis!.basis.file, at: `/decks/${ana!.data.decks.findIndex((d) => d.id === listId)}` },
          origin: 'measured',
          scope: 'public',
          stamps: stampsOf(main, listId),
        }),
      );
    }
  }
  // pooled: every card with a cell on a library list
  for (const id of [...cardIds].sort()) {
    const use = dec ? cardUse(dec.data, dec.file, id) : null;
    const analyses = ana ? cardAnalysisLists(ana.data, id).flatMap((l) => (o.deckOf(l) ? [cardAnalysis(ana.data, ana.file, id, l)!] : [])) : [];
    const impact = src.impact ? pooledImpact(src.impact.data, id) : null;
    const main = use?.basis ?? analyses[0]?.basis ?? reportBasis(src.impact?.file ?? '', null);
    const name = o.cardName(id) ?? use?.card.name ?? id;
    const pi = dec ? dec.data.pooled.findIndex((c) => c.id === id) : -1;
    out.push(
      finishRecord({
        id: cardStatId(id),
        kind: 'cardstat',
        title: `${name}: statistics, lists pooled`,
        text: cardPooledText({ card: name, use, analyses, impact: impact && src.impact ? { file: src.impact.file, fact: impact } : null, listName, useLists: dec ? cardUseLists(dec.data, id).map(listName) : [] }),
        fields: {
          card: id,
          lists: use?.lists ?? analyses.length,
          ...modeFields(use),
          pooledGap: r4(impact?.gap ?? null),
          pooledGapDrawnGames: impact?.drawnGames,
          coachUsesPooledGap: impact?.coachUses,
          association: true,
          stale: main.stale || analyses.some((a) => a.basis.stale),
        },
        links: cardLink(id),
        source: use && pi >= 0 ? { file: use.basis.file, at: `/pooled/${pi}` } : { file: main.file },
        origin: 'measured',
        scope: 'public',
        stamps: stampsOf(main),
      }),
    );
  }

  // ---- packages
  const syn = src.synergies;
  if (syn) {
    const pkgIds = new Set<string>();
    syn.data.decks.forEach((d, di) => {
      const deck = o.deckOf(d.listId);
      if (!deck) {
        skip('stats: list not in the library (packages)');
        return;
      }
      d.synergies.forEach((row, si) => {
        const f = packageFact(syn.data, syn.file, row.id, { listId: d.listId, catalogueVersion: src.catalogueVersion })!;
        pkgIds.add(row.id);
        out.push(
          finishRecord({
            id: pkgStatId(row.id, deck.file),
            kind: 'pkgstat',
            title: `${f.package.name} on ${deck.name}: statistics`,
            text: packageStatText(f, { deck: deck.name }),
            fields: pkgFields(f, { package: row.id, deck: deck.name, file: deck.file }),
            links: [...(o.hasPackage(row.id) ? [{ rel: 'package' as const, to: `pkg:${row.id}` }] : []), ...deckLink(deck), { rel: 'parent', to: pkgStatId(row.id) }],
            source: { file: syn.file, at: `/decks/${di}/synergies/${si}` },
            origin: 'measured',
            scope: 'public',
            stamps: stampsOf(f.basis, d.listId),
          }),
        );
      });
    });
    syn.data.pooled.forEach((row, pi) => {
      if (!pkgIds.has(row.id)) {
        skip('stats: pooled package on no library list');
        return;
      }
      const f = packageFact(syn.data, syn.file, row.id, { catalogueVersion: src.catalogueVersion })!;
      const holders = packageLists(syn.data, row.id).map(listName);
      out.push(
        finishRecord({
          id: pkgStatId(row.id),
          kind: 'pkgstat',
          title: `${f.package.name}: statistics, lists pooled`,
          text: packageStatText(f, { lists: holders }),
          fields: pkgFields(f, { package: row.id, lists: holders.length }),
          links: o.hasPackage(row.id) ? [{ rel: 'package', to: `pkg:${row.id}` }] : [],
          source: { file: syn.file, at: `/pooled/${pi}` },
          origin: 'measured',
          scope: 'public',
          stamps: stampsOf(f.basis),
        }),
      );
    });
  }
  return out;
}

function pkgFields(f: PackageFact, more: Record<string, KbFieldValue>): Record<string, KbFieldValue> {
  return {
    ...more,
    games: f.games,
    builtAround: f.builtAround,
    assembledGames: f.assembled.n,
    onlineGames: f.online.n,
    wonOnline: r4(f.wonOnline.rate),
    wonNever: r4(f.wonNever.rate),
    neverGames: f.wonNever.games,
    lift: r4(f.lift?.gap ?? null),
    liftLow95: r4(f.lift?.low95 ?? null),
    liftHigh95: r4(f.lift?.high95 ?? null),
    medianRound: f.medianRound,
    coachGate: f.gate,
    association: true,
    stale: f.basis.stale,
  };
}
