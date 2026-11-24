// One deck's evidence (#/evidence/<listId>; docs/EVIDENCE.md "The page"): a header, an at-a-glance strip of facts from
// its own findings, then five blocks in order (how good it is; where it wins and loses; cards and packages; what changed
// it and whether it held; open questions), its recorded runs and what is not measured for this list. Every number is a
// finding row (FindingRow, two lines) or a number with its range and games. Long lists open short with "Show all".
// Rendered from plain data, so tests render it directly.
import { useEffect, useState } from 'react';
import { formatValue, plain95, type DeckEvidence, type EvidenceIndex, type Finding } from '../../../lib/findings';
import {
  BLOCK_WORDS,
  botsWords,
  changeStatusWords,
  changeVerdictWords,
  DECK_PAGE_WORDS,
  driftWords,
  EVIDENCE_PROBLEMS,
  familyWords,
  GAP_WORDS,
  gapText,
  GLANCE_WORDS,
  MISLEAD,
  measuredByWords,
  openWords,
  ratesWords,
  runBotWords,
  runTitleWords,
  screenCurseWords,
  screenWords,
  seatDetailWords,
  shortlistWords,
  soldSourceWords,
  soldWords,
  splitWords,
  thirdWords,
  TITLE_WORDS,
} from '../../../lib/findingWords';
import {
  associationOrder,
  assocShown,
  cardNamesIn,
  changeGroupsOf,
  clearestPairings,
  decksById,
  endingPair,
  findingHref,
  focusPlanOf,
  glanceOf,
  openOrder,
  oppName,
  overviewHref,
  pairingsOf,
  runHref,
  scaleOf,
  screenCurseRows,
  settledChange,
  SHOWN_PAIRINGS,
  type ChangeGroup,
  type GlanceFact,
} from '../../../lib/evidenceView';
import { CURRENT_SIM_VERSION } from '../../../lib/playedRecord';
import { pageOn } from '../../../lib/siteConfig';
import { useSiteConfig } from '../../useSiteConfig';
import { useDeckRuns } from '../../evidenceData';
import { CardMention } from '../CardMention';
import { PageHead } from '../PageHead';
import { SimTierBadge, simTierFor } from '../TierBadges';
import { FindingRow } from './FindingRow';
import { MatchupStrip } from './MatchupStrip';
import { ChangeLabel, NatureChip, RangeBar, StrengthChip } from './parts';

const deckHref = (file: string) => `#/deck?d=${encodeURIComponent(file)}`;

/** A deck's name, linked to its deck page while that page is on. */
export function DeckName({ name, file }: { name: string; file: string | null | undefined }) {
  const on = pageOn(useSiteConfig(), 'deck');
  return file && on ? <a href={deckHref(file)}>{name}</a> : <>{name}</>;
}

function Block({ id, title, nature, intro, children }: { id: string; title: string; nature?: Finding['nature']; intro: string; children: React.ReactNode }) {
  return (
    <section className="panel ev-block" aria-labelledby={`${id}-h`} id={id}>
      <h2 className="ev-h2 rule-head" id={`${id}-h`} tabIndex={-1}>
        {title}
      </h2>
      <p className="ev-intro">
        {nature && (
          <>
            <NatureChip n={nature} />{' '}
          </>
        )}
        {intro}
      </p>
      {children}
    </section>
  );
}

/** A button for the rest of a list that opens short. */
function ShowAll({ open, total, shown, what, fewer, onToggle, controls }: { open: boolean; total: number; shown: number; what: string; fewer: string; onToggle: () => void; controls: string }) {
  if (total <= shown) return null;
  return (
    <button type="button" className="ghost small ev-more" aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      {open ? fewer : DECK_PAGE_WORDS.showAll(total, what)}
    </button>
  );
}

function Glance({ facts, listId, onReveal, onOpen }: { facts: readonly GlanceFact[]; listId: string; onReveal: (short: string) => void; onOpen: () => void }) {
  if (!facts.length) return null;
  return (
    <nav className="ev-glance" aria-label="At a glance">
      <ul>
        {facts.map((x) => {
          if (x.kind === 'open')
            return (
              <li key="open" className="ev-glance-item">
                <button type="button" className="ev-glance-link" onClick={onOpen}>
                  <span className="ev-glance-label">{GLANCE_WORDS.openLabel}</span>
                  <span className="ev-glance-val">{GLANCE_WORDS.open(x.count, x.heldout)}</span>
                </button>
              </li>
            );
          const f = x.finding;
          const what = x.kind === 'strength' ? GLANCE_WORDS.strength : x.kind === 'good' ? GLANCE_WORDS.good : x.kind === 'bad' ? GLANCE_WORDS.bad : GLANCE_WORDS.change;
          const name = x.kind === 'good' || x.kind === 'bad' ? f.subject.opponent?.deck : x.kind === 'change' ? f.subject.change?.label : null;
          return (
            <li key={f.id} className="ev-glance-item">
              <a
                className="ev-glance-link"
                href={findingHref(listId, f.short)}
                onClick={(e) => {
                  e.preventDefault();
                  onReveal(f.short);
                }}
              >
                <span className="ev-glance-label">{what}</span>
                {name && <span className="ev-glance-name">{name}</span>}
                <span className="ev-glance-val">
                  {f.strength !== 'not-enough' && <b>{formatValue(f.estimate, x.kind === 'change' ? 'points' : 'rate')}</b>} <StrengthChip s={f.strength} />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ChangeGroupView({ g, listId, names, scale, target, byId }: { g: ChangeGroup; listId: string; names: ReadonlyMap<string, string>; scale: readonly [number, number]; target: string | null; byId: ReturnType<typeof decksById> }) {
  const cur = CURRENT_SIM_VERSION;
  const pooled = g.items.find((f) => f.method === 'paired-pooled' && f.simVersion === cur);
  const status = changeStatusWords(g.change.relation, settledChange(g, cur), pooled?.detail ? shortlistWords(pooled.detail, pooled.games) : null);
  // measured with more than one bot: what the Hard measurement says about the Medium one
  const bots =
    new Set(g.items.map((f) => f.bot)).size > 1
      ? botsWords(g.items.map((f) => ({ bot: f.bot, estimate: f.estimate, lower: plain95(f)[0], upper: plain95(f)[1], games: f.games, simVersion: f.simVersion, strength: f.strength })))
      : null;
  return (
    <article className="ev-change" aria-labelledby={`q-${g.question}`}>
      <h3 className="ev-h3" id={`q-${g.question}`}>
        <ChangeLabel change={g.change} names={names} />
      </h3>
      <p className="ev-note small">{status}</p>
      {g.items.length > 1 && <p className="ev-drift small">{driftWords(g.items.map((f) => ({ estimate: f.estimate, games: f.games, simVersion: f.simVersion, method: f.method, verdict: f.detail?.verdict, bot: f.bot })))}</p>}
      {bots && <p className="ev-drift small">{bots}</p>}
      <ul className="ev-rows">
        {g.items.map((f) => {
          const d = f.detail;
          const splitOpp = d?.byOpp?.length ? (
            <div className="ev-split small">
              <p className="muted">{DECK_PAGE_WORDS.perOpponent}</p>
              <ul>
                {d.byOpp.map((o) => (
                  <li key={o.opp}>
                    {oppName(o.opp, byId)}: {splitWords(o)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null;
          const splitSeat = d?.bySeat?.length ? (
            <div className="ev-split small">
              <p className="muted">{DECK_PAGE_WORDS.perSeat}</p>
              <ul>
                {d.bySeat.map((s) => (
                  <li key={s.first}>
                    {s.first ? DECK_PAGE_WORDS.second : DECK_PAGE_WORDS.first}: {splitWords(s)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null;
          const dependsOnOpp = f.flags.includes('depends-on-opponent');
          return (
            <FindingRow
              key={f.id}
              f={f}
              listId={listId}
              title={measuredByWords(f)}
              scale={scale}
              target={target === f.short}
              more={changeVerdictWords(f)}
              extra={
                (d?.screen || dependsOnOpp) && (
                  <>
                    {d?.screen && <p className="ev-screen small">{screenWords(d.screen)}</p>}
                    {dependsOnOpp && splitOpp}
                  </>
                )
              }
              details={
                <>
                  {d?.date && <p>{DECK_PAGE_WORDS.measuredOn(d.date, d.runs ?? null, d.looks ?? null)}</p>}
                  {d?.record && <p>{d.record}</p>}
                  {!dependsOnOpp && splitOpp}
                  {splitSeat}
                </>
              }
            />
          );
        })}
      </ul>
    </article>
  );
}

/** The recorded runs of a list, fetched only when opened. */
function RunsSection({ listId, count }: { listId: string; count: number | null }) {
  const [open, setOpen] = useState(false);
  const runs = useDeckRuns(open ? listId : null);
  if (count === 0) return <p className="muted">{DECK_PAGE_WORDS.noRuns}</p>;
  return (
    <details className="ev-runs" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{DECK_PAGE_WORDS.showRuns(count)}</summary>
      {open && runs.state === 'loading' && (
        <p className="muted" role="status">
          {DECK_PAGE_WORDS.loadingRuns}
        </p>
      )}
      {open && runs.state === 'missing' && <p role="status">{count === null ? DECK_PAGE_WORDS.noRuns : EVIDENCE_PROBLEMS.missingRuns}</p>}
      {open && runs.state === 'newer' && <p role="status">{EVIDENCE_PROBLEMS.newer}</p>}
      {open && runs.state === 'ready' && (
        <ul className="ev-run-list">
          {runs.data.runs.map((r) => (
            <li key={r.id} className={r.stale ? 'is-stale' : ''}>
              <a href={runHref(listId, r.id)}>{runTitleWords(r)}</a>{' '}
              <span className="small muted">
                · {runBotWords(r)}, version {r.simVersion}
                {r.stale ? ' (older version)' : ''} · {r.trials.length} trial{r.trials.length === 1 ? '' : 's'}
                {r.games !== null ? ` · ${r.games.toLocaleString('en-US')} games` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export function GapList({ gaps }: { gaps: readonly { code: string; n?: number }[] }) {
  return (
    <ul className="ev-gaps">
      {gaps.map((g) => (
        <li key={g.code}>
          {gapText(g)}
          {GAP_WORDS[g.code] && (
            <details className="ev-details">
              <summary className="small">What would measure it</summary>
              <p className="small ev-measure">{GAP_WORDS[g.code]!.measure}</p>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

/** One association list (cards or packages): the ones whose interval excludes no difference, at least 5, then "Show all". */
function AssocList({
  id,
  list,
  all,
  setAll,
  what,
  listId,
  scale,
  target,
}: {
  id: string;
  list: readonly Finding[];
  all: boolean;
  setAll: (v: boolean) => void;
  what: string;
  listId: string;
  scale: readonly [number, number];
  target: string | null;
}) {
  const n = assocShown(list);
  const shown = all ? list : list.slice(0, n);
  return (
    <>
      <p className="ev-family small">{capitalFirst(familyWords(list[0]!.family.size, what))}.</p>
      <ul className="ev-rows" id={id}>
        {shown.map((f) => (
          <FindingRow
            key={f.id}
            f={f}
            listId={listId}
            nature
            scale={scale}
            target={target === f.short}
            title={f.subject.card ? <CardMention id={f.subject.card.id}>{f.subject.card.name}</CardMention> : (f.subject.package?.name ?? f.claim)}
            more={[f.detail?.rates ? ratesWords(f.detail.rates) : null, f.detail?.sold ? soldWords(f.detail.sold) : null].filter(Boolean).join(' · ') || null}
            details={f.detail?.sold ? <p>{soldSourceWords(f.detail.sold)}</p> : undefined}
          />
        ))}
      </ul>
      <ShowAll open={all} total={list.length} shown={n} what={what} fewer={DECK_PAGE_WORDS.showFirst(n)} controls={id} onToggle={() => setAll(!all)} />
    </>
  );
}

export function DeckEvidenceView({ deck, index, target, onReveal }: { deck: DeckEvidence; index: EvidenceIndex | null; target: string | null; onReveal: (short: string) => void }) {
  const cur = CURRENT_SIM_VERSION;
  const byId = decksById(index);
  const entry = byId.get(deck.listId);
  const plan = focusPlanOf(deck, target);
  const tShort = plan.finding?.short ?? null;
  // a link to a finding in a collapsed list opens that list (on arrival, and on every later reveal)
  const [showAllPairings, setAllPairings] = useState(plan.allPairings);
  const [showAllCards, setAllCards] = useState(plan.allCards);
  const [showAllPackages, setAllPackages] = useState(plan.allPackages);
  const [stripAll, setStripAll] = useState(false);
  useEffect(() => {
    if (plan.allPairings) setAllPairings(true);
    if (plan.allCards) setAllCards(true);
    if (plan.allPackages) setAllPackages(true);
  }, [plan.allPairings, plan.allCards, plan.allPackages, tShort]);

  const fs = deck.findings;
  const strength = fs.find((f) => f.kind === 'deck-strength');
  const pairings = pairingsOf(fs);
  const clearest = clearestPairings(pairings, SHOWN_PAIRINGS);
  const shownPairings = showAllPairings ? pairings : pairings.filter((p) => clearest.has(p.rated.question));
  const matchupScale = scaleOf(pairings.flatMap((p) => (p.direct ? [p.rated, p.direct] : [p.rated])), 'rate');
  const seat = fs.find((f) => f.kind === 'seat');
  const length = fs.find((f) => f.kind === 'length');
  const endings = fs.filter((f) => f.kind === 'ending');
  const pair = endingPair(fs);
  const endingScale = scaleOf(endings, 'rate');
  const cards = associationOrder(fs.filter((f) => f.kind === 'card-assoc'));
  const packages = associationOrder(fs.filter((f) => f.kind === 'package-assoc'));
  const assocScale = scaleOf([...cards, ...packages], 'points');
  const groups = changeGroupsOf(fs, cur);
  const changeScale = scaleOf(
    fs.filter((f) => f.kind === 'change'),
    'points',
  );
  const open = openOrder(deck.open);
  const openScale = scaleOf(
    open.map((o) => ({ estimate: o.pooled.mean, lower: o.pooled.mean - 1.96 * o.pooled.se, upper: o.pooled.mean + 1.96 * o.pooled.se, baseline: 0 })),
    'points',
  );
  const names = cardNamesIn([...fs.flatMap((f) => (f.subject.change ? [f.subject.change.label] : [])), ...deck.open.map((o) => o.change.label)]);
  const noCardData = deck.gaps.find((g) => g.code === 'no-card-data');
  const focusBlock = (id: string) => {
    const h = document.getElementById(`${id}-h`);
    h?.scrollIntoView?.({ block: 'start' });
    h?.focus?.();
  };
  const endingRow = (f: Finding, inner?: Finding) => (
    <FindingRow
      key={f.id}
      f={f}
      listId={deck.listId}
      title={TITLE_WORDS.ending(f.subject.ending ?? '?')}
      scale={endingScale}
      target={tShort === f.short}
      detailsOpen={!!inner && plan.inDetailsOf === f.short}
      details={
        inner && (
          <ul className="ev-rows ev-sub">
            <FindingRow f={inner} listId={deck.listId} title={TITLE_WORDS.ending(inner.subject.ending ?? '?')} scale={endingScale} target={tShort === inner.short} />
          </ul>
        )
      }
    />
  );

  return (
    <div className="grid ev-page">
      <PageHead kicker="Evidence" title={<DeckName name={deck.deck} file={deck.file} />}>
        {DECK_PAGE_WORDS.head(deck.simVersion, entry ? entry.findings : null)} <a href={overviewHref}>{DECK_PAGE_WORDS.allDecks}</a>
      </PageHead>
      {plan.finding === null && target && <p className="ev-problem" role="status">{EVIDENCE_PROBLEMS.unknownFinding(target)}</p>}
      <Glance facts={glanceOf(deck, cur)} listId={deck.listId} onReveal={onReveal} onOpen={() => focusBlock('ev-open')} />

      <Block id="ev-strength" title="How good is it, and how sure are we?" nature="result" intro={BLOCK_WORDS.strength}>
        {strength && (
          <ul className="ev-rows">
            <FindingRow f={strength} listId={deck.listId} title={TITLE_WORDS.strength} scale={scaleOf([strength], 'rate')} target={tShort === strength.short} />
          </ul>
        )}
        <p className="ev-tier small">
          <SimTierBadge tier={simTierFor(deck.deck)} showUnrated="always" />
        </p>
      </Block>

      <Block id="ev-matchups" title="Where does it win and lose?" nature="result" intro={BLOCK_WORDS.matchups}>
        {pairings.length > 0 && <MatchupStrip pairings={pairings} onOpen={onReveal} all={stripAll} onToggle={() => setStripAll(!stripAll)} />}
        <ul className="ev-rows" id="ev-pairings">
          {shownPairings.map((p) => (
            <FindingRow
              key={p.rated.id}
              f={p.rated}
              listId={deck.listId}
              scale={matchupScale}
              target={tShort === p.rated.short}
              title={
                <>
                  against <DeckName name={p.opp.deck} file={byId.get(p.opp.listId)?.file} />
                </>
              }
              extra={
                p.direct && (
                  <ul className="ev-rows ev-sub">
                    <FindingRow f={p.direct} listId={deck.listId} scale={matchupScale} target={tShort === p.direct.short} title={DECK_PAGE_WORDS.directRow(p.direct.games)} />
                  </ul>
                )
              }
            />
          ))}
        </ul>
        <ShowAll
          open={showAllPairings}
          total={pairings.length}
          shown={SHOWN_PAIRINGS}
          what="opponents"
          fewer={DECK_PAGE_WORDS.showFewer(SHOWN_PAIRINGS)}
          controls="ev-pairings"
          onToggle={() => setAllPairings(!showAllPairings)}
        />
        {seat && (
          <>
            <h3 className="ev-h3">{DECK_PAGE_WORDS.seatHead}</h3>
            <ul className="ev-rows">
              <FindingRow
                f={seat}
                listId={deck.listId}
                title={TITLE_WORDS.seat}
                scale={scaleOf([seat], 'points')}
                target={tShort === seat.short}
                details={seatDetailWords(seat.detail ?? {}).map((t) => (
                  <p key={t}>{t}</p>
                ))}
              />
            </ul>
          </>
        )}
        {length && (
          <>
            <h3 className="ev-h3">{DECK_PAGE_WORDS.lengthHead}</h3>
            <ul className="ev-rows">
              <FindingRow
                f={length}
                listId={deck.listId}
                title={TITLE_WORDS.length}
                scale={scaleOf([length], 'points')}
                target={tShort === length.short}
                extra={
                  length.detail?.thirds && (
                    <ul className="ev-thirds small">
                      {length.detail.thirds.map((t) => (
                        <li key={t.label}>
                          <span>{thirdWords(t)}</span>
                          <RangeBar x={{ estimate: t.rate, lower: t.lower, upper: t.upper, baseline: 0.5 }} kind="matchup" scale={[0, 1]} />
                        </li>
                      ))}
                    </ul>
                  )
                }
              />
            </ul>
          </>
        )}
        {endings.length > 0 && (
          <>
            <h3 className="ev-h3">{DECK_PAGE_WORDS.endingsHead}</h3>
            <ul className="ev-rows">{pair ? endingRow(pair.shown, pair.inner) : endings.map((f) => endingRow(f))}</ul>
          </>
        )}
      </Block>

      <Block id="ev-cards" title="Cards and packages" nature="association" intro={BLOCK_WORDS.cards}>
        <div className="ev-mislead small">
          <p>{MISLEAD['card-assoc']}</p>
          <p>{MISLEAD['package-assoc']}</p>
        </div>
        <h3 className="ev-h3">{DECK_PAGE_WORDS.cardsHead}</h3>
        {cards.length > 0 ? (
          <AssocList id="ev-card-rows" list={cards} all={showAllCards} setAll={setAllCards} what="cards" listId={deck.listId} scale={assocScale} target={tShort} />
        ) : (
          <p className="muted">{noCardData ? gapText(noCardData) : GAP_WORDS['no-card-data']!.text}</p>
        )}
        <h3 className="ev-h3">{DECK_PAGE_WORDS.packagesHead}</h3>
        {packages.length > 0 ? (
          <AssocList id="ev-package-rows" list={packages} all={showAllPackages} setAll={setAllPackages} what="packages" listId={deck.listId} scale={assocScale} target={tShort} />
        ) : (
          <p className="muted">{DECK_PAGE_WORDS.noPackages}</p>
        )}
      </Block>

      <Block id="ev-changes" title="What changed it, and did it hold?" nature="effect" intro={BLOCK_WORDS.changes}>
        {groups.length ? (
          <>
            {groups.some((g) => g.items.some((f) => f.detail?.screen)) && <p className="ev-screen small">{screenCurseWords(screenCurseRows(index?.health ?? [], deck.findings))}</p>}
            {groups.map((g) => (
              <ChangeGroupView key={g.question} g={g} listId={deck.listId} names={names} scale={changeScale} target={tShort} byId={byId} />
            ))}
          </>
        ) : (
          <p className="muted">{DECK_PAGE_WORDS.noChanges}</p>
        )}
      </Block>

      <Block id="ev-open" title="Open questions" intro={BLOCK_WORDS.open}>
        {open.length ? (
          <ul className="ev-rows">
            {open.map((o) => {
              const w = openWords(o);
              return (
                <li key={o.change.key} className="ev-row ev-open">
                  <div className="ev-line1">
                    <span className="ev-row-title">
                      <ChangeLabel change={o.change} names={names} />
                    </span>
                    <span className="ev-row-num">
                      <RangeBar x={{ estimate: o.pooled.mean, lower: o.pooled.mean - 1.96 * o.pooled.se, upper: o.pooled.mean + 1.96 * o.pooled.se, baseline: 0 }} kind="change" scale={openScale} />
                    </span>
                  </div>
                  <p className="ev-line2">
                    {w.reads}{' '}
                    {o.finding && (
                      <a
                        className="ev-link"
                        href={findingHref(deck.listId, o.finding.slice(0, 8))}
                        onClick={(e) => {
                          e.preventDefault();
                          onReveal(o.finding!.slice(0, 8));
                        }}
                      >
                        {DECK_PAGE_WORDS.heldOutFinding}
                      </a>
                    )}
                  </p>
                  <p className="ev-settle small">{w.settle}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">{DECK_PAGE_WORDS.noOpen}</p>
        )}
      </Block>

      <section className="panel ev-block" aria-labelledby="ev-runs-h">
        <h2 className="ev-h2 rule-head" id="ev-runs-h">
          Runs
        </h2>
        <RunsSection listId={deck.listId} count={entry ? entry.runs : null} />
      </section>

      <section className="panel ev-block" aria-labelledby="ev-gaps-h">
        <h2 className="ev-h2 rule-head" id="ev-gaps-h">
          Not measured for this list
        </h2>
        {deck.gaps.length ? <GapList gaps={deck.gaps} /> : <p className="muted">{DECK_PAGE_WORDS.nothingListed}</p>}
      </section>
      <p className="small">
        <a href={overviewHref}>{DECK_PAGE_WORDS.howToRead}</a>
      </p>
    </div>
  );
}

const capitalFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
