// #/evidence (Decks → Evidence; docs/EVIDENCE.md "The page", plan P3 of docs/TUNING_STUDY_2026-11-13.md): the findings
// of public/data/evidence/ as an overview, a page per deck and a view per recorded run. Lazy, with its own stylesheet;
// it reads plain JSON through src/ui/evidenceData.ts and words everything through src/lib/findingWords.ts.
//   #/evidence                        the overview (?f=<id>: open a finding; ?d=<deck file>: that deck's page)
//   #/evidence/<listId>               one deck (?f=<short id>: scroll to the finding, open what hides it, focus it)
//   #/evidence/<listId>/run/<token>   one recorded run (token: runToken of the run's id)
import { useCallback, useEffect, useState } from 'react';
import '../evidence.css';
import { DECK_PAGE_WORDS, EVIDENCE_PROBLEMS, LOADING_EVIDENCE, staleBuildWords } from '../../lib/findingWords';
import { deckEvidenceHref, findByShort, findingHref, parseEvidenceRoute, rowId, runToken } from '../../lib/evidenceView';
import type { DeckEvidence, EvidenceIndex } from '../../lib/findings';
import { CURRENT_SIM_VERSION } from '../../lib/playedRecord';
import { useDeckEvidence, useDeckRuns, useEvidenceIndex, type Loaded } from '../evidenceData';
import { AnnounceProvider, revealRow, useAnnouncer } from '../components/evidence/parts';
import { EvidenceOverview, goTo, resolveCite } from '../components/evidence/Overview';
import { DeckEvidenceView } from '../components/evidence/DeckView';
import { RunView } from '../components/evidence/RunView';

/** One plain sentence in place of a view that cannot be shown. */
export function Problem({ text }: { text: string }) {
  return (
    <div className="empty-state ev-problem" role="status">
      <p>{text}</p>
      <p>
        <a href="#/evidence">{DECK_PAGE_WORDS.allDecks}</a>
      </p>
    </div>
  );
}

function Loading() {
  return (
    <p className="muted" role="status">
      {LOADING_EVIDENCE}
    </p>
  );
}

/** The sentence for a file that is not ready (null while it loads). */
export const fileProblem = (l: Loaded<unknown>, missing: string): string | null => (l.state === 'missing' ? missing : l.state === 'newer' ? EVIDENCE_PROBLEMS.newer : null);

/** The banner when the files were built for another simulator version than the site plays. */
function StaleBuild({ built }: { built: number }) {
  if (built === CURRENT_SIM_VERSION) return null;
  return (
    <p className="ev-banner" role="note">
      {staleBuildWords(built, CURRENT_SIM_VERSION)}
    </p>
  );
}

function OverviewPage({ f, d }: { f: string | null; d: string | null }) {
  const ix = useEvidenceIndex();
  const [problem, setProblem] = useState<string | null>(null);
  // ?f=: a cite id resolved through ids.json (fetched only now), then its deck's page
  useEffect(() => {
    if (!f || d) return;
    let live = true;
    void resolveCite(f).then((r) => {
      if (!live) return;
      if ('problem' in r) setProblem(r.problem);
      else goTo(findingHref(r.listId, r.short), true);
    });
    return () => {
      live = false;
    };
  }, [f, d]);
  // ?d=: a deck file resolved through the index
  const deckFor = d && ix.state === 'ready' ? (ix.data.decks.find((x) => x.file === d) ?? null) : undefined;
  useEffect(() => {
    if (deckFor) goTo(`${deckEvidenceHref(deckFor.listId)}${f ? `?f=${encodeURIComponent(f)}` : ''}`, true);
  }, [deckFor, f]);
  const bad = fileProblem(ix, EVIDENCE_PROBLEMS.missingIndex);
  if (bad) return <Problem text={bad} />;
  if (ix.state !== 'ready') return <Loading />;
  if (d && deckFor === null) return <Problem text={EVIDENCE_PROBLEMS.unknownFile(d)} />;
  if (deckFor) return <Loading />;
  return (
    <AnnounceRoot>
      <StaleBuild built={ix.data.simVersion} />
      <EvidenceOverview index={ix.data} problem={problem} />
    </AnnounceRoot>
  );
}

function AnnounceRoot({ children }: { children: React.ReactNode }) {
  const [msg, say] = useAnnouncer();
  return (
    <AnnounceProvider value={say}>
      {children}
      <p className="sr-only" role="status" aria-live="polite">
        {msg}
      </p>
    </AnnounceProvider>
  );
}

/**
 * What a deck's page shows instead of its findings: 'loading', a sentence (a newer file; a list the index has whose file
 * is missing; a list nobody has), or null when the file is ready.
 */
export function deckPageProblem(listId: string, deck: Loaded<DeckEvidence>, ix: Loaded<EvidenceIndex>): string | 'loading' | null {
  if (deck.state === 'ready') return null;
  if (deck.state === 'loading') return 'loading';
  if (deck.state === 'newer') return EVIDENCE_PROBLEMS.newer;
  if (ix.state === 'loading') return 'loading';
  const known = ix.state === 'ready' && ix.data.decks.some((x) => x.listId === listId);
  return known ? EVIDENCE_PROBLEMS.missingDeckFile : EVIDENCE_PROBLEMS.unknownList(listId);
}

function DeckPage({ listId, f }: { listId: string; f: string | null }) {
  const deck = useDeckEvidence(listId);
  const ix = useEvidenceIndex();
  const [target, setTarget] = useState<string | null>(f ? f.toLowerCase() : null);
  const [tick, setTick] = useState(0);
  const reveal = useCallback((short: string) => {
    setTarget(short);
    setTick((t) => t + 1);
  }, []);
  const ready = deck.state === 'ready';
  const short = ready && target ? (findByShort(deck.data, target)?.short ?? null) : null;
  // after the row (and whatever held it) is on the page: scroll to it, focus it
  useEffect(() => {
    if (!short) return;
    // a collapsed list opens in the same pass, so the row may need a frame or two to appear
    let raf = 0;
    let tries = 0;
    const go = () => {
      if (!revealRow(document, rowId(short)) && ++tries < 20) raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, [short, tick]);
  const problem = deckPageProblem(listId, deck, ix);
  if (problem === 'loading') return <Loading />;
  if (problem !== null || deck.state !== 'ready') return <Problem text={problem ?? EVIDENCE_PROBLEMS.missingDeckFile} />;
  return (
    <AnnounceRoot>
      <StaleBuild built={deck.data.simVersion} />
      <DeckEvidenceView deck={deck.data} index={ix.state === 'ready' ? ix.data : null} target={target} onReveal={reveal} />
    </AnnounceRoot>
  );
}

function RunPage({ listId, token }: { listId: string; token: string }) {
  const deck = useDeckEvidence(listId);
  const runs = useDeckRuns(listId);
  if (deck.state === 'loading' || runs.state === 'loading') return <Loading />;
  if (deck.state !== 'ready') return <Problem text={fileProblem(deck, EVIDENCE_PROBLEMS.unknownList(listId)) ?? EVIDENCE_PROBLEMS.unknownList(listId)} />;
  if (runs.state !== 'ready') return <Problem text={fileProblem(runs, EVIDENCE_PROBLEMS.unknownRun) ?? EVIDENCE_PROBLEMS.unknownRun} />;
  const run = runs.data.runs.find((r) => runToken(r.id) === token);
  if (!run) return <Problem text={EVIDENCE_PROBLEMS.unknownRun} />;
  return <RunView deck={deck.data} run={run} />;
}

export function EvidencePage({ sub, q }: { sub: string; q: URLSearchParams }) {
  const route = parseEvidenceRoute(sub, q);
  switch (route.view) {
    case 'overview':
      return <OverviewPage f={route.f} d={route.d} />;
    case 'deck':
      return <DeckPage key={route.listId} listId={route.listId} f={route.f} />;
    case 'run':
      return <RunPage key={`${route.listId}/${route.token}`} listId={route.listId} token={route.token} />;
    case 'unknown':
      return <Problem text={EVIDENCE_PROBLEMS.unknownList(route.listId)} />;
  }
}
