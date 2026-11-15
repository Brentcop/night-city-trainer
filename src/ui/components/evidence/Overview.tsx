// The evidence overview (#/evidence; docs/EVIDENCE.md "The page"): what the page is with its key, "Open a finding",
// the three lists apart (measured effects, results that stand out, patterns worth testing), the tuning tools' record,
// every deck with its counts by strength and its Sim tier, what is not measured yet, and how to read it all.
import { useId, useState } from 'react';
import { shortIdDeck, type EvidenceIndex, type FindingRef, type TopList } from '../../../lib/findings';
import {
  countsWords,
  EVIDENCE_PROBLEMS,
  FAMILY_HELP,
  FLAG_WORDS,
  familyWords,
  healthWords,
  MISLEAD,
  NATURE_HELP,
  OVERVIEW_WORDS,
  PAGE_INTRO,
  rangeWords,
  spreadWords,
  STRENGTH_RULE,
  TOP_LIST_TITLES,
  toolWords,
  valueOf,
} from '../../../lib/findingWords';
import { deckEvidenceHref, findingHref, parseCite, scaleOf, shortTitleOf, SHOWN_SHORT } from '../../../lib/evidenceView';
import { loadEvidenceIds } from '../../evidenceData';
import { MentionText } from '../CardMention';
import { PageHead } from '../PageHead';
import { SimTierBadge, simTierFor } from '../TierBadges';
import { DeckName, GapList } from './DeckView';
import { FindingRow } from './FindingRow';
import { ChipKey, NatureChip, StrengthChip } from './parts';

/** A pasted cite id → its deck and short id, through ids.json (fetched only now), or the sentence saying why not. */
export async function resolveCite(text: string): Promise<{ listId: string; short: string } | { problem: string }> {
  const short = parseCite(text);
  if (!short) return { problem: EVIDENCE_PROBLEMS.badCite };
  const ids = await loadEvidenceIds();
  if (ids.state === 'newer') return { problem: EVIDENCE_PROBLEMS.newer };
  if (ids.state !== 'ready') return { problem: EVIDENCE_PROBLEMS.missingIds };
  const listId = shortIdDeck(ids.data, short);
  return listId ? { listId, short } : { problem: EVIDENCE_PROBLEMS.unknownCite(short) };
}

/** Go to a page of the site (a hash route); `replace` keeps the history entry. */
export function goTo(hash: string, replace = false): void {
  if (replace) window.location.replace(hash);
  else window.location.hash = hash;
}

/** "Open a finding". `problem`: what a ?f= link's id came to, shown until the visitor asks for another. */
export function OpenFinding({ problem }: { problem?: string | null }) {
  const id = useId();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  return (
    <section className="panel ev-block ev-open-finding" aria-labelledby={`${id}-h`}>
      <h2 className="ev-h2 rule-head" id={`${id}-h`}>
        {OVERVIEW_WORDS.openTitle}
      </h2>
      <form
        className="ev-open-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setStatus(OVERVIEW_WORDS.opening);
          const r = await resolveCite(text);
          if ('problem' in r) setStatus(r.problem);
          else {
            setStatus('');
            goTo(findingHref(r.listId, r.short));
          }
        }}
      >
        <label htmlFor={`${id}-q`}>{OVERVIEW_WORDS.openLabel}</label>
        <div className="ev-open-row">
          <input id={`${id}-q`} type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="F:9f3a2c1d" autoComplete="off" spellCheck={false} aria-describedby={`${id}-help ${id}-status`} />
          <button type="submit">{OVERVIEW_WORDS.openButton}</button>
        </div>
        <p id={`${id}-help`} className="small muted">
          {OVERVIEW_WORDS.openHelp}
        </p>
        <p id={`${id}-status`} className="small ev-status" role="status" aria-live="polite">
          {status ?? problem ?? ''}
        </p>
      </form>
    </section>
  );
}

function TopListView({ list, nature }: { list: TopList; nature: FindingRef['nature'] }) {
  const scaleRates = scaleOf(
    list.items.filter((f) => f.kind === 'deck-strength' || f.kind === 'matchup' || f.kind === 'ending'),
    'rate',
  );
  const scalePoints = scaleOf(
    list.items.filter((f) => !(f.kind === 'deck-strength' || f.kind === 'matchup' || f.kind === 'ending')),
    'points',
  );
  const id = `ev-top-${list.key}`;
  const [all, setAll] = useState(false);
  const shown = all ? list.items : list.items.slice(0, SHOWN_SHORT);
  return (
    <section className="panel ev-block" aria-labelledby={`${id}-h`}>
      <h2 className="ev-h2 rule-head" id={`${id}-h`}>
        {TOP_LIST_TITLES[list.key]}
      </h2>
      <p className="ev-intro">
        <NatureChip n={nature} /> {OVERVIEW_WORDS.listIntro[list.key]}
      </p>
      {list.key === 'patterns' && (
        <div className="ev-mislead small">
          <p>{MISLEAD['card-assoc']}</p>
          <p>{MISLEAD['package-assoc']}</p>
        </div>
      )}
      <p className="ev-family small">{capitalFirst(familyWords(list.family.size, 'findings'))}.</p>
      {list.items.length ? (
        <ul className="ev-rows" id={`${id}-rows`}>
          {shown.map((f) => (
            <FindingRow
              key={f.id}
              f={f}
              listId={f.listId}
              nature={list.key === 'patterns'}
              scale={f.kind === 'deck-strength' || f.kind === 'matchup' || f.kind === 'ending' ? scaleRates : scalePoints}
              title={
                <>
                  <MentionText text={shortTitleOf(f)} />
                  <span className="ev-row-deck">
                    {' '}
                    · <a href={deckEvidenceHref(f.listId)}>{f.deck}</a>
                  </span>
                </>
              }
              more={f.others > 0 ? OVERVIEW_WORDS.others(f.others) : null}
            />
          ))}
        </ul>
      ) : (
        <p className="muted">{OVERVIEW_WORDS.emptyList}</p>
      )}
      {list.items.length > SHOWN_SHORT && (
        <button type="button" className="ghost small ev-more" aria-expanded={all} aria-controls={`${id}-rows`} onClick={() => setAll(!all)}>
          {all ? OVERVIEW_WORDS.showFewer : OVERVIEW_WORDS.showAll(list.items.length)}
        </button>
      )}
    </section>
  );
}

export function EvidenceOverview({ index, problem }: { index: EvidenceIndex; problem?: string | null }) {
  const list = (key: TopList['key']) => index.top.find((t) => t.key === key) ?? { key, family: { size: 0, correction: 'bh' as const }, items: [] };
  const decks = [...index.decks].sort((a, b) => a.deck.localeCompare(b.deck));
  const m = index.rules.matchup;
  return (
    <div className="grid ev-page">
      <PageHead kicker="Decks" title="Evidence">
        {PAGE_INTRO}
      </PageHead>
      <section className="panel ev-block" aria-label="Key">
        <ChipKey natureHelp={NATURE_HELP} />
      </section>
      <OpenFinding problem={problem} />
      <TopListView list={list('effects')} nature="effect" />
      <TopListView list={list('results')} nature="result" />
      <TopListView list={list('patterns')} nature="association" />

      <section className="panel ev-block" aria-labelledby="ev-health-h">
        <h2 className="ev-h2 rule-head" id="ev-health-h">
          {OVERVIEW_WORDS.healthTitle}
        </h2>
        <p className="ev-intro">{OVERVIEW_WORDS.healthIntro}</p>
        <ul className="ev-health">
          {index.health.map((h) => (
            <li key={h.tool}>
              <h3 className="ev-h3">{toolWords(h.tool)}</h3>
              <ul>
                {healthWords(h).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel ev-block" aria-labelledby="ev-decks-h">
        <h2 className="ev-h2 rule-head" id="ev-decks-h">
          {OVERVIEW_WORDS.decksTitle}
        </h2>
        <p className="ev-intro">{OVERVIEW_WORDS.decksIntro}</p>
        <ul className="ev-decks">
          {decks.map((d) => (
            <li key={d.listId} className="ev-deck">
              <span className="ev-deck-name">
                <DeckName name={d.deck} file={d.file} />
              </span>
              <span className="ev-deck-tier">
                <SimTierBadge tier={simTierFor(d.deck)} showUnrated />
              </span>
              <span className="ev-deck-strength">
                {d.strength ? (
                  <>
                    <StrengthChip s={d.strength.strength} /> <b className="ev-deck-val">{valueOf(d.strength)}</b> <span className="small muted">{rangeWords(d.strength)}</span>
                  </>
                ) : (
                  <span className="small muted">{OVERVIEW_WORDS.noStrength}</span>
                )}
              </span>
              <span className="ev-deck-more small muted">
                {countsWords(d.counts, d.findings)}
                {d.stale > 0 && <> · {OVERVIEW_WORDS.staleCount(d.stale)}</>}
                {d.runs > 0 && <> · {OVERVIEW_WORDS.runsCount(d.runs)}</>}{' '}
                <a className="ev-link" href={deckEvidenceHref(d.listId)} aria-label={`${OVERVIEW_WORDS.evidenceLink}: ${d.deck}`}>
                  {OVERVIEW_WORDS.evidenceLink} →
                </a>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel ev-block" aria-labelledby="ev-gaps-h">
        <h2 className="ev-h2 rule-head" id="ev-gaps-h">
          {OVERVIEW_WORDS.gapsTitle}
        </h2>
        <GapList gaps={index.gaps} />
      </section>

      <section className="panel ev-block" aria-labelledby="ev-how-h" id="how">
        <h2 className="ev-h2 rule-head" id="ev-how-h">
          {OVERVIEW_WORDS.howTitle}
        </h2>
        <p>{OVERVIEW_WORDS.strengthRule}</p>
        <dl className="ev-rule">
          {(['strong', 'moderate', 'weak', 'no-difference', 'not-enough'] as const).map((s) => (
            <div key={s}>
              <dt>
                <StrengthChip s={s} />
              </dt>
              <dd>{STRENGTH_RULE[s]}</dd>
            </div>
          ))}
        </dl>
        <p>{FAMILY_HELP}</p>
        <p>
          <b>{OVERVIEW_WORDS.staleHelp}</b> {FLAG_WORDS.stale}
        </p>
        <p>
          <b>{OVERVIEW_WORDS.mediumHelp}</b> {FLAG_WORDS['medium-only']}
        </p>
        <p>{spreadWords(m.spreadSd, m.spreadMeasured)}</p>
      </section>
    </div>
  );
}

const capitalFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
