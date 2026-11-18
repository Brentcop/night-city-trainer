// The outside picture on screen (ROADMAP2 §13 goal 4): what other sites say about the decks people really play, always
// with the site's name, a link to its page and the day it was collected, and never in the same column or order as our
// own numbers. Two views: a deck page's block "What other sites say" (the rows for the deck's Legend trio) and Power
// ratings' section "The outside picture" (each source's decks beside the library decks that share their Legends). The
// data and the words are src/lib/outsideMeta.ts; the cyberpunk-tcg-sim.online figures come from
// src/data/outsideMetaData.ts (absent: those rows are not shown), choom.gg's hand ratings from src/data/meta.json.
// Lazy pages only (deck profile, Power ratings): the entry chunk never imports this file.
import { useId } from 'react';
import meta from '../../data/meta.json';
import { RATINGS } from '../../data/index';
import { OUTSIDE_META } from '../../data/outsideMetaData';
import type { LibraryDeck } from '../../lib/library';
import { distinctLists } from '../../lib/distinctLists';
import {
  CHOOM_META,
  choomArchetypes,
  choomForLegends,
  decksWithTrio,
  OUTSIDE_WORDS,
  outsideFieldShares,
  outsideForLegends,
  placeWords,
  sourceTitle,
  sourceWhen,
  trioWords,
  winRateWords,
  type ChoomRow,
  type OutsideMetaFile,
  type OutsideSource,
  type OutsideTrio,
} from '../../lib/outsideMeta';
import { simTier } from '../../lib/simTier';
import { useFeature } from '../useSiteConfig';
import { ChoomTierBadge, SimTierBadge } from './TierBadges';

/** The sim site's figures, or null while the owner has `features.outsideMeta` off (the same as no data file in the build). */
export function useOutsideMeta(data: OutsideMetaFile | null): OutsideMetaFile | null {
  const on = useFeature('outsideMeta');
  return on ? data : null;
}

const RATED = new Map(RATINGS.decks.map((r) => [r.name, r]));
const pct1 = (x: number) => `${x.toFixed(1)}%`;

/** Where a figure comes from: the site, its page (a link) and the day it was collected. Every outside row ends with one. */
export function SourceCite({ site, title, link, collected, when }: { site: string; title: string; link: string; collected: string; when?: string }) {
  return (
    <span className="outside-cite">
      {site} ·{' '}
      <a href={link} target="_blank" rel="noreferrer">
        {title}
      </a>
      {when ? ` (${when})` : ''}
      {collected ? ` · collected ${collected}` : ''}
    </span>
  );
}

const citeFor = (s: OutsideSource) => <SourceCite site={s.site} title={s.title} link={s.link} collected={s.collected} when={sourceWhen(s)} />;
const choomCite = (r: ChoomRow) => <SourceCite site={CHOOM_META.site} title={`${CHOOM_META.title}: ${r.title}`} link={r.link} collected={r.collected} />;

/** choom.gg's archetypes with their library decks (meta.json is small and ships with these pages anyway). */
export const choomRows = (lib: readonly LibraryDeck[]) => choomArchetypes(meta, lib);

// ---------------------------------------------------------------- a deck's page

/** The block on a deck's page; nothing when no source has the deck's Legend trio. `data` is for tests. */
export function DeckOutsidePanel({ d, lib, data = OUTSIDE_META }: { d: Pick<LibraryDeck, 'deck'>; lib: readonly LibraryDeck[]; data?: OutsideMetaFile | null }) {
  const head = useId();
  const shown = useOutsideMeta(data);
  const sim = outsideForLegends(d.deck.legends, shown);
  const choom = choomForLegends(d.deck.legends, choomRows(lib));
  if (!sim.length && !choom.length) return null;
  return (
    <section className="panel outside-panel" aria-labelledby={head}>
      <h3 className="dp-section-title rule-head" id={head}>
        What other sites say
      </h3>
      <p className="dp-caption">
        {OUTSIDE_WORDS.sameLegends} {OUTSIDE_WORDS.notOurs}
      </p>
      <ul className="outside-list">
        {choom.map((r) => (
          <li key={`choom:${r.title}`}>
            <div className="outside-what">
              <ChoomTierBadge tier={r.tier} /> <b>{r.title}</b>
              {r.power !== null && <>: power {r.power} of 100</>}
              {r.complexity && <>, complexity {r.complexity}</>}; {OUTSIDE_WORDS.choomRated}.
            </div>
            {choomCite(r)}
          </li>
        ))}
        {sim.map(({ source: s, field, tier, places }) => (
          <li key={s.id}>
            <div className="outside-what">
              {s.kind === 'season' ? (
                <>
                  {tier ? (
                    <>
                      Ranked <b>#{tier.rank}</b> of its top {s.tiers.length}, the site’s <b>tier {tier.tier}</b>;{' '}
                    </>
                  ) : (
                    `Not in its top-${s.tiers.length} ranking; `
                  )}
                  {winRateWords(tier ?? field ?? {}) && <>win rate <b>{winRateWords(tier ?? field ?? {})}</b>; </>}
                  <b>{pct1((field ?? tier)!.share)}</b> of {s.shareOf}.
                </>
              ) : (
                <>
                  {field?.players !== undefined && (
                    <>
                      Brought by <b>{field.players}</b> of {s.totals.players ?? '?'} players ({pct1(field.share)});{' '}
                    </>
                  )}
                  {field && winRateWords(field) && <>win rate {winRateWords(field)}; </>}
                  {places.length ? (
                    <>
                      top cut: <b>{places.map(placeWords).join(', ')}</b>
                      {places.includes(1) ? ' (the champion)' : ''}.
                    </>
                  ) : field?.best ? (
                    <>best finish {placeWords(field.best)}.</>
                  ) : (
                    'no top-cut place.'
                  )}
                </>
              )}
            </div>
            {citeFor(s)}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- Power ratings

/** Our decks with these Legends: each a link with our Sim tier and expected win rate beside it, or a dash. */
function OurDecks({ trio, lib }: { trio: OutsideTrio; lib: readonly LibraryDeck[] }) {
  const ours = decksWithTrio(trio, lib);
  if (!ours.length) return <span className="muted">none in the library</span>;
  return (
    <ul className="outside-ours">
      {ours.map((d) => {
        const r = RATED.get(d.deck.name);
        return (
          <li key={d.file}>
            <a href={`#/deck?d=${encodeURIComponent(d.file)}`}>{d.deck.name}</a> <SimTierBadge tier={simTier(r)} />
            {r && <span className="muted num"> {pct1(r.wrField * 100)} vs our field</span>}
          </li>
        );
      })}
    </ul>
  );
}

const ColHeads = ({ theirs, span }: { theirs: string; span: number }) => (
  <tr>
    <th colSpan={span} scope="colgroup">
      {theirs}
    </th>
    <th scope="colgroup" className="outside-ours-head">
      Our library (same Legends; the list may differ)
    </th>
  </tr>
);

/** The coverage line: how much of a source's field our library's Legend trios cover. */
export function coverageWords(s: OutsideSource, lib: readonly LibraryDeck[]): string {
  const f = outsideFieldShares(distinctLists(lib).kept, s);
  const coveredTrios = s.field.length - f.uncovered.length;
  const missing = f.uncovered.slice(0, 4).map((u) => `${trioWords(u.trio)} (${pct1(u.share)})`);
  return (
    `Our library plays the Legends of ${coveredTrios} of the ${s.field.length} trios this report lists, ${pct1(f.covered)} of its ${s.shareOf}. ` +
    `The report breaks ${pct1(f.listed)} of them down by trio; the other ${pct1(f.unlisted)} are trios it does not list one by one.` +
    (missing.length ? ` Listed but not in our library: ${missing.join(', ')}${f.uncovered.length > missing.length ? `, and ${f.uncovered.length - missing.length} more` : ''}.` : '')
  );
}

function SeasonTable({ s, lib }: { s: Extract<OutsideSource, { kind: 'season' }>; lib: readonly LibraryDeck[] }) {
  return (
    <div className="scroll-x">
      <table className="small outside-table">
        <thead>
          <ColHeads theirs={`${s.site} says`} span={4} />
          <tr>
            <th scope="col">Legend trio (as the site writes it)</th>
            <th scope="col">Its rank and tier</th>
            <th scope="col">Its win rate</th>
            <th scope="col">Share of {s.shareOf}</th>
            <th scope="col">Deck, our Sim tier and our expected win rate</th>
          </tr>
        </thead>
        <tbody>
          {s.field.map((r) => {
            const t = s.tiers.find((x) => trioWords(x.trio) === trioWords(r.trio));
            return (
              <tr key={trioWords(r.trio)}>
                <td>{trioWords(r.trio)}</td>
                <td>{t ? `#${t.rank}, tier ${t.tier}` : '—'}</td>
                <td className="num">{winRateWords(t ?? r) || '—'}</td>
                <td className="num">{pct1(r.share)}</td>
                <td>
                  <OurDecks trio={r.trio} lib={lib} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TournamentTable({ s, lib }: { s: Extract<OutsideSource, { kind: 'tournament' }>; lib: readonly LibraryDeck[] }) {
  return (
    <div className="scroll-x">
      <table className="small outside-table">
        <thead>
          <ColHeads theirs={`${s.site} says`} span={4} />
          <tr>
            <th scope="col">Legend trio (as the site writes it)</th>
            <th scope="col">Players (share of the field)</th>
            <th scope="col">Its win rate</th>
            <th scope="col">Top cut, or best finish</th>
            <th scope="col">Deck, our Sim tier and our expected win rate</th>
          </tr>
        </thead>
        <tbody>
          {s.field.map((r) => {
            const places = s.topCut.filter((x) => trioWords(x.trio) === trioWords(r.trio)).map((x) => x.place);
            return (
              <tr key={trioWords(r.trio)}>
                <td>{trioWords(r.trio)}</td>
                <td className="num">
                  {r.players ?? '—'} ({pct1(r.share)})
                </td>
                <td className="num">{winRateWords(r) || '—'}</td>
                <td>{places.length ? places.map(placeWords).join(', ') : r.best ? `best ${placeWords(r.best)}` : '—'}</td>
                <td>
                  <OurDecks trio={r.trio} lib={lib} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChoomTable({ rows, lib }: { rows: ChoomRow[]; lib: readonly LibraryDeck[] }) {
  return (
    <div className="scroll-x">
      <table className="small outside-table">
        <thead>
          <ColHeads theirs="choom.gg says" span={3} />
          <tr>
            <th scope="col">Archetype</th>
            <th scope="col">Its tier and power</th>
            <th scope="col">Complexity</th>
            <th scope="col">Deck, our Sim tier and our expected win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.title}>
              <td>
                <a href={r.link} target="_blank" rel="noreferrer">
                  {r.title}
                </a>
              </td>
              <td>
                <ChoomTierBadge tier={r.tier} /> {r.power !== null ? `${r.power} of 100` : ''}
              </td>
              <td>{r.complexity || '—'}</td>
              <td>
                <OurDecks trio={{ names: [], ids: [...r.legends] }} lib={lib} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Power ratings' section: each source's decks with ours beside them. `data` is for tests. */
export function OutsidePictureSection({ lib, data = OUTSIDE_META }: { lib: readonly LibraryDeck[]; data?: OutsideMetaFile | null }) {
  const head = useId();
  const choom = choomRows(lib);
  const shown = useOutsideMeta(data);
  const sources = shown?.sources ?? [];
  if (!choom.length && !sources.length) return null;
  const collected = choom.map((r) => r.collected).filter(Boolean).sort()[0] ?? '';
  return (
    <section className="panel outside-section" aria-labelledby={head}>
      <h2 id={head} style={{ marginTop: 0 }}>
        The outside picture
      </h2>
      <p className="small">
        What other sites say about the decks people play, each with its source and the day it was collected. Their rows are per Legend trio: a deck of ours with the same three Legends is shown
        beside a row, but the list may differ. {OUTSIDE_WORDS.notOurs} Their order is theirs; our ratings above are not re-sorted by them.
      </p>
      {sources.map((s) => (
        <div key={s.id} className="outside-source">
          <h3 className="outside-h3">{sourceTitle(s)}</h3>
          <p className="small muted">{citeFor(s)}</p>
          <p className="small">{coverageWords(s, lib)}</p>
          {s.kind === 'season' ? <SeasonTable s={s} lib={lib} /> : <TournamentTable s={s} lib={lib} />}
        </div>
      ))}
      {choom.length > 0 && (
        <div className="outside-source">
          <h3 className="outside-h3">choom.gg’s Night City Meta</h3>
          <p className="small muted">
            <SourceCite site={CHOOM_META.site} title={CHOOM_META.title} link={CHOOM_META.link} collected={collected} />
          </p>
          <p className="small">Archetypes {OUTSIDE_WORDS.choomRated}; choom.gg gives no shares of play for them.</p>
          <ChoomTable rows={choom} lib={lib} />
        </div>
      )}
    </section>
  );
}

/** The Credits page's line for the collected reports, or null when none are in this build. */
export function outsideCreditRow(data: OutsideMetaFile | null = OUTSIDE_META): [string, string, string] | null {
  if (!data?.sources.length) return null;
  return [
    'Season and tournament figures',
    `cyberpunk-tcg-sim.online meta reports (${data.sources.map((s) => s.title).join('; ')}): tiers, win rates and shares of play by Legend trio, shown beside our numbers and never mixed into them; collected ${data.updated}`,
    data.sources[0]!.link,
  ];
}

/** The Credits page's line while the sim site's figures are on (`features.outsideMeta`) and in this build, else null. */
export function useOutsideCreditRow(): [string, string, string] | null {
  return outsideCreditRow(useOutsideMeta(OUTSIDE_META));
}
