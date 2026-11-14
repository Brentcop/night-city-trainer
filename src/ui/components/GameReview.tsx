// The Game review of a finished practice game: a rating for every decision (src/lib/gameReview.ts), a summary per side,
// the turning point and the advantage over the turns, and a move list that shows the board at each decision. The
// review runs in the review worker (src/sim/gameReviewRun.ts) with progress and a Stop button, and an own game's review
// is kept (src/lib/gameReviewStore.ts) so reopening it is instant; one made under older rating rules is run again. A
// game this code no longer replays as it was played is refused in a plain sentence (src/sim/practiceReview.ts). The
// second tab, "Play-out details", is the match reviewer's view of the same game in the same rating names. The dialog is
// rendered at the document body, so the Play board's styles never reach it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CAP_GIGS,
  CLOSE_GIGS,
  GIG,
  isKeyMoment,
  listed,
  MISTAKE_GIGS,
  RATING_INFO,
  RATINGS,
  rivalFollowUps,
  seatSummary,
  turningName,
  turningPoint,
  type CoachRating,
  type GameReviewRecord,
  type ReviewMove,
  type SeatSummary,
} from '../../lib/gameReview';
import { currentRules, keepReview, loadGameReview } from '../../lib/gameReviewStore';
import { mySeat, practiceRequest, practiceSpec, replayVersionProblem, reviewExpect, type PracticeReplay } from '../../lib/practiceReplays';
import { sessionEnding } from '../../lib/practiceVerdict';
import { reviewFrames, type ReviewFrames } from '../../lib/reviewFrames';
import { explain, FOLLOW_TEXT, gapTag, RERATED_TEXT, REVIEW_BASIS, staleText } from '../../lib/reviewWords';
import { shownLabel } from '../../lib/coachWords';
import type { ReviewReply, ReviewRequest } from '../../sim/review.worker';
import { Modal } from './Modal';
import { MentionText } from './CardMention';
import { RatingPill } from './RatingPill';
import { ReviewPanel } from './ReviewPanel';
import { FrameBoard } from './ReplayBoard';
import { useNarrow } from './board/useNarrow';

export { RatingPill };

/** A game to review: its replay record and your moves the coach graded during play. */
export interface GameReviewSource {
  replay: PracticeReplay;
  coach: CoachRating[];
  /** your own recorded game: keep the review, and its counts in the practice log (not for an imported file) */
  persist: boolean;
  /** how many turns the game lasted, when known (the progress bar) */
  turns?: number;
}

type RunState =
  | { status: 'running'; decisions: number; turn: number }
  | { status: 'stopped' }
  | { status: 'error'; error: string }
  /** the game can't be replayed as it was played: `why` is a plain sentence; `stale`, a review kept from older rules */
  | { status: 'refused'; why: string; stale?: GameReviewRecord }
  | { status: 'done'; rec: GameReviewRecord };

/**
 * The stored review of an own game, or a new one run in the review worker (Stop terminates it). A stored review made
 * under older rating rules is rated again from the measurements kept with it when it can be (shown at once, then kept
 * with its counts by the effect below: the load runs during render and only reads); otherwise it is run again, and if
 * the game can't be replayed any more, it is shown as it was, with the refusal.
 */
function useGameReview(src: GameReviewSource): { st: RunState; stop: () => void; start: () => void } {
  const stored = useMemo(() => (src.persist ? loadGameReview(src.replay.id, src.replay.choices) : null), [src]);
  // a review rated again from storage: keep it under the current rules, and the practice log's counts with it
  useEffect(() => {
    if (stored?.reratedNow && stored.review) keepReview(stored.review);
  }, [stored]);
  // another simulator version: refused before starting a worker (a current stored review is still shown)
  const versionWhy = useMemo(() => replayVersionProblem(src.replay), [src]);
  const [st, setSt] = useState<RunState>(() =>
    stored?.review
      ? { status: 'done', rec: stored.review }
      : versionWhy
        ? { status: 'refused', why: versionWhy, ...(stored?.stale ? { stale: stored.stale } : {}) }
        : { status: 'running', decisions: 0, turn: 0 },
  );
  const worker = useRef<Worker | null>(null);
  const [runs, setRuns] = useState(stored?.review || versionWhy ? 0 : 1);
  useEffect(() => {
    if (!runs) return;
    const stale = stored?.stale;
    if (versionWhy) {
      setSt({ status: 'refused', why: versionWhy, ...(stale ? { stale } : {}) });
      return;
    }
    // the coach grades given now (the game just played), else the ones kept with the game; a review from older rules
    // whose coach grades are gone keeps its coach-graded moves as they were
    const coach = src.coach.length ? src.coach : (stored?.coach ?? []);
    const keep = !coach.length && stale ? stale.moves.filter((m) => m.src === 'coach' && m.p === stale.me) : [];
    const q: ReviewRequest = { kind: 'game', job: { id: src.replay.id, spec: practiceSpec(src.replay, src.turns), coach, ...(keep.length ? { keep } : {}), made: new Date().toISOString() } };
    setSt({ status: 'running', decisions: 0, turn: 0 });
    let w: Worker;
    try {
      w = new Worker(new URL('../../sim/review.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      setSt({ status: 'error', error: String((e as Error)?.message ?? e) });
      return;
    }
    worker.current = w;
    w.onmessage = (e: MessageEvent<ReviewReply>) => {
      const m = e.data;
      if ('progress' in m) setSt({ status: 'running', decisions: m.progress, turn: m.turn ?? 0 });
      else if ('game' in m) {
        if (src.persist) keepReview(m.game, coach);
        setSt({ status: 'done', rec: m.game });
        w.terminate();
      } else if ('refused' in m) {
        setSt({ status: 'refused', why: m.refused, ...(stale ? { stale } : {}) });
        w.terminate();
      } else if ('error' in m) {
        setSt({ status: 'error', error: m.error });
        w.terminate();
      }
    };
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      setSt({ status: 'error', error: e.message || 'the review worker failed to start' });
      w.terminate();
    };
    w.onmessageerror = () => {
      setSt({ status: 'error', error: 'the review worker sent an unreadable reply' });
      w.terminate();
    };
    w.postMessage(q);
    return () => w.terminate();
  }, [runs, src, stored, versionWhy]);
  const stop = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    setSt({ status: 'stopped' });
  }, []);
  const start = useCallback(() => setRuns((n) => n + 1), []);
  return { st, stop, start };
}

const gigs = (x: number) => x.toFixed(2);

export function GameReviewModal({ src: given, title, onClose, backdropClassName }: { src: GameReviewSource; title: string; onClose: () => void; backdropClassName?: string }) {
  // the game reviewed is the one the dialog opened with (a parent re-rendering must not restart the review)
  const [src] = useState(given);
  const fullReq = useMemo(() => practiceRequest(src.replay, src.turns), [src]);
  const [tab, setTab] = useState<'game' | 'full'>('game');
  const [fullSeen, setFullSeen] = useState(false);
  const pick = (t: 'game' | 'full') => {
    setTab(t);
    if (t === 'full') setFullSeen(true);
  };
  const tabs = [
    { key: 'game', label: 'Game review' },
    { key: 'full', label: 'Play-out details' },
  ] as const;
  const dialog = (
    <Modal label={title} onClose={onClose} className="gr-modal" backdropClassName={backdropClassName}>
      <h3 className="gr-title">{title}</h3>
      <div className="gr-tabs" role="tablist" aria-label="Review views">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`gr-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`gr-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={tab === t.key ? 'is-on' : ''}
            onClick={() => pick(t.key)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              e.stopPropagation();
              const next = tabs[(i + 1) % tabs.length]!;
              pick(next.key);
              document.getElementById(`gr-tab-${next.key}`)?.focus();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="gr-panel-game" aria-labelledby="gr-tab-game" hidden={tab !== 'game'}>
        <GameReviewView src={src} active={tab === 'game'} />
      </div>
      <div role="tabpanel" id="gr-panel-full" aria-labelledby="gr-tab-full" hidden={tab !== 'full'}>
        {fullSeen && <ReviewPanel req={fullReq} mySeat={mySeat(src.replay)} expect={reviewExpect(src.replay)} checked />}
      </div>
    </Modal>
  );
  // at the document body (like the board's other overlays): opened from the Play result screen, the board's styles and
  // its strip must not reach the dialog (rendered in place where there is no document, as in the render tests)
  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
}

/** The Game review itself: running, stopped, failed, or the summary and move list. */
export function GameReviewView({ src, active = true }: { src: GameReviewSource; active?: boolean }) {
  const { st, stop, start } = useGameReview(src);
  if (st.status === 'error') return <p className="small" style={{ color: 'var(--red)' }}>The review failed: {st.error.slice(0, 200)}</p>;
  if (st.status === 'refused')
    return (
      <div>
        <p className="small gr-refused" role="status">
          {st.why}
        </p>
        {st.stale && (
          <>
            <p className="small muted">{staleText(!currentRules(st.stale))}</p>
            <ReviewResult rec={st.stale} replay={src.replay} active={active} />
          </>
        )}
      </div>
    );
  if (st.status === 'stopped')
    return (
      <div className="review-busy">
        <span>Review stopped.</span>
        <div>
          <button type="button" onClick={start}>
            Start again
          </button>
        </div>
      </div>
    );
  if (st.status === 'running')
    return (
      <div className="review-busy" aria-live="polite">
        <span>
          <span className="spinner" /> Reviewing… {st.decisions} decisions rated{st.turn ? `, turn ${st.turn}${src.turns ? ` of ${src.turns}` : ''}` : ''}
        </span>
        {src.turns ? <progress max={src.turns} value={Math.min(st.turn, src.turns)} aria-label="Review progress by turn" /> : null}
        <div className="small muted">Every move of both sides is compared with the alternatives by playing each out for about a turn. Your moves the coach graded during play keep the coach's grade.</div>
        <div>
          <button type="button" className="ghost" onClick={stop}>
            Stop
          </button>
        </div>
      </div>
    );
  return (
    <>
      {st.rec.rerated !== undefined && <p className="small muted">{RERATED_TEXT}</p>}
      <ReviewResult rec={st.rec} replay={src.replay} active={active} />
    </>
  );
}

type Filter = 'all' | 'mine' | 'key';

/** The finished review: summary, advantage chart and the move list with the board. Exported for the render test. */
export function ReviewResult({ rec, replay, active = true, frames: given }: { rec: GameReviewRecord; replay: PracticeReplay; active?: boolean; frames?: ReviewFrames | null }) {
  const me = rec.me;
  const rival = (1 - me) as 0 | 1;
  const sums = useMemo(() => [seatSummary(rec.moves, me, rec.forced[me]), seatSummary(rec.moves, rival, rec.forced[rival])] as const, [rec, me, rival]);
  const turning = useMemo(() => turningPoint(rec.moves, rec.winner), [rec]);
  const follow = useMemo(() => rivalFollowUps(rec.moves, me), [rec, me]);
  const [filter, setFilter] = useState<Filter>('all');
  const shown = useMemo(
    () => rec.moves.filter((m) => listed(m, me, turning) && (filter === 'all' || (filter === 'mine' ? m.p === me && (m.r === 'slip' || m.r === 'mistake' || m.r === 'blunder') : isKeyMoment(m, me, turning)))),
    [rec, me, filter, turning],
  );
  const [sel, setSel] = useState<number | null>(() => (turning ? turning.seq : (rec.moves.find((m) => listed(m, me, turning))?.seq ?? null)));
  const cur = shown.find((m) => m.seq === sel) ?? shown[0] ?? null;
  const k = cur ? shown.indexOf(cur) : -1;
  const go = useCallback((d: number) => setSel((s) => shown[Math.max(0, Math.min(shown.length - 1, (s === null ? -1 : shown.findIndex((m) => m.seq === s)) + d))]?.seq ?? s), [shown]);
  // arrow keys step through the moves (not while a field or the tabs have focus)
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.getAttribute('role') === 'tab' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') (e.preventDefault(), go(1));
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') (e.preventDefault(), go(-1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, active]);
  // the board at each decision: replayed from the stored answers (no bot thinking)
  const [frames, setFrames] = useState<ReviewFrames | null | 'none'>(given === undefined ? null : (given ?? 'none'));
  useEffect(() => {
    if (given !== undefined || !rec.answers) {
      if (!rec.answers && given === undefined) setFrames('none');
      return;
    }
    let alive = true;
    // the game as the session ended it (a concession or a clock by either seat, an abandoned online game)
    const end = sessionEnding(practiceSpec(replay));
    reviewFrames({ decks: replay.decks, seed: replay.seed, first: replay.first, end }, rec.answers).then(
      (f) => alive && setFrames(f),
      () => alive && setFrames('none'),
    );
    return () => {
      alive = false;
    };
  }, [rec, replay, given]);
  // keep the selected move in view in the list
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // scroll the list only (scrollIntoView would also scroll the dialog away from the summary)
    const list = listRef.current;
    const el = cur ? list?.querySelector<HTMLElement>(`[data-seq="${cur.seq}"]`) : null;
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
  }, [cur]);
  const who = (p: 0 | 1) => (p === me ? 'You' : 'Rival');
  const resultText = rec.winner === 'tie' ? 'Draw' : rec.winner === null ? 'Unfinished' : rec.winner === me ? 'You won' : 'You lost';
  const byCoach = rec.moves.filter((m) => m.p === me && m.src === 'coach').length;
  const decided = rec.winner === 0 || rec.winner === 1;
  const noTurning = !rec.moves.length
    ? 'No moves were rated.'
    : decided
      ? `No turning point: ${rec.winner === me ? 'the rival' : 'you'} made no move that cost more than the noise of the measurement.`
      : 'No move by either side cost more than the noise of the measurement.';
  return (
    <div className="gr">
      <div className="small muted">
        {resultText} in {rec.turns} turn{rec.turns === 1 ? '' : 's'} ({rec.reason}). {rec.names[me]} vs {rec.names[rival]}.
      </div>
      <div className="gr-seats">
        <SeatCard who="You" s={sums[0]} note={byCoach ? `${byCoach} graded by the coach during play${byCoach < rec.moves.filter((m) => m.p === me).length ? ", the rest by the review's play-outs" : ''}` : undefined} />
        <SeatCard who="Rival" s={sums[1]} note="all graded by the review's play-outs" />
      </div>
      <p className="small muted gr-basis">{REVIEW_BASIS}</p>
      {turning ? (
        <p className="gr-turning">
          <b>{turningName(rec.winner)}:</b> turn {turning.turn}, {turning.p === me ? 'you' : 'the rival'} played <MentionText text={shownLabel(turning.chosen)} skip={rec.names} /> <RatingPill r={turning.r} /> ({gapTag(turning)}).{' '}
          <button type="button" className="ghost" onClick={() => (setFilter('all'), setSel(turning.seq))}>
            Show
          </button>
        </p>
      ) : (
        <p className="gr-turning small">{noTurning}</p>
      )}
      <Advantage rec={rec} me={me} turning={turning} at={cur} />
      <details className="small">
        <summary>What the ratings mean</summary>
        <ul className="gr-legend">
          {[...RATINGS, 'unclear' as const].map((r) => (
            <li key={r}>
              <RatingPill r={r} /> {RATING_INFO[r].means}
            </li>
          ))}
        </ul>
        <p className="muted">
          Gaps are in Gigs: the bots' estimate of value in Gig-equivalents (one Gig = {GIG} points of their evaluation), not Gigs on the board, and never shown past {CAP_GIGS}. Each
          option is played out in {rec.rollouts} shared worlds, and the gap comes with its standard error. A close call is under {CLOSE_GIGS} Gigs or within 2 standard errors (a gap
          that is about the same in every play-out comes from fixed terms of the evaluation, not the play-outs, and counts only from 0.5 Gigs); mistakes start at {MISTAKE_GIGS} Gigs. Accuracy =
          100 × e^(−average Gigs lost per counted move), where moves inside the noise lose 0 and a loss counts at most {CAP_GIGS} Gigs. Your moves the coach graded during play keep
          the coach's grade, in these names (a coach Mistake of a whole Gig or more is a Blunder, as the coach shows it), except that a move where every option the coach measured
          was within the noise is No clear difference. The turning point is the losing side's costliest move.
        </p>
      </details>
      <div className="gr-moves">
        <div className="gr-filters" role="group" aria-label="Show">
          {(
            [
              ['all', 'All moves'],
              ['mine', 'Only my mistakes'],
              ['key', 'Key moments'],
            ] as const
          ).map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="small muted">{filter === 'mine' ? 'No slips, mistakes or blunders. A clean game.' : 'No moves to show.'}</p>
        ) : (
          <div className="gr-split">
            <ol className="gr-list" ref={listRef} aria-label="Moves">
              {shown.map((m) => (
                <li key={m.seq}>
                  <button type="button" data-seq={m.seq} className={`gr-row ${m.p === me ? 'me' : 'rival'} ${cur?.seq === m.seq ? 'on' : ''}`} aria-current={cur?.seq === m.seq ? 'true' : undefined} onClick={() => setSel(m.seq)}>
                    <span className="muted">T{m.turn}</span> <span className="gr-who">{who(m.p)}</span> <RatingPill r={m.r} /> <span className="gr-move">
                      <MentionText text={shownLabel(m.chosen)} skip={rec.names} passive />
                    </span>
                    {follow.get(m.seq) === 'missed' && <span className="gr-tag">missed chance</span>}
                  </button>
                </li>
              ))}
            </ol>
            {cur && (
              <div className="gr-detail">
                <div className="row gr-step">
                  <button type="button" onClick={() => go(-1)} disabled={k <= 0} aria-label="Previous move">
                    ◀ Previous
                  </button>
                  <span className="small muted">
                    {k + 1} / {shown.length}
                  </span>
                  <button type="button" onClick={() => go(1)} disabled={k >= shown.length - 1} aria-label="Next move">
                    Next ▶
                  </button>
                </div>
                <MoveDetail m={cur} me={me} follow={follow.get(cur.seq)} names={rec.names} />
                <MoveBoard m={cur} frames={frames} names={rec.names} viewer={me} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SeatCard({ who, s, note }: { who: string; s: SeatSummary; note?: string }) {
  return (
    <div className="gr-seat">
      <div className="gr-acc" aria-label={s.accuracy === null ? `${who}: no counted moves` : `${who}: accuracy ${s.accuracy}`}>
        <span>{s.accuracy ?? '—'}</span>
        <small>accuracy</small>
      </div>
      <div>
        <b>{who}</b>
        <div className="small muted">
          {s.counted} counted move{s.counted === 1 ? '' : 's'}, {gigs(s.avgLoss)} Gigs lost per move
          {s.n.unclear ? `; ${s.n.unclear} with no clear difference` : ''}
          {note ? ` (${note})` : ''}
        </div>
        <div className="gr-counts">
          {RATINGS.filter((r) => s.n[r] > 0).map((r) => (
            <RatingPill key={r} r={r} n={s.n[r]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MoveDetail({ m, me, follow, names }: { m: ReviewMove; me: 0 | 1; follow?: 'missed' | 'followed'; names: readonly string[] }) {
  return (
    <div className="gr-move-detail" aria-live="polite">
      <div>
        <span className="muted">Turn {m.turn} · {m.p === me ? 'You' : 'Rival'}:</span> <b>
          <MentionText text={shownLabel(m.chosen)} skip={names} />
        </b>{' '}
        <RatingPill r={m.r} />
      </div>
      <p className="small">
        <MentionText text={explain(m)} skip={names} />
      </p>
      {m.p !== me && follow && <p className="small gr-note">{FOLLOW_TEXT[follow]}</p>}
      <p className="small muted gr-before">The board below is the position before this move.</p>
    </div>
  );
}

function MoveBoard({ m, frames, names, viewer }: { m: ReviewMove; frames: ReviewFrames | null | 'none'; names: [string, string]; viewer: 0 | 1 }) {
  const narrow = useNarrow();
  if (frames === 'none') return <p className="small muted">The board is not available for this review.</p>;
  if (!frames) return <p className="small muted">Loading the board…</p>;
  const i = frames.at[m.p][m.at] ?? -1;
  const f = frames.data.frames[Math.max(0, i)];
  if (!f) return null;
  return (
    <div className="gr-board">
      <FrameBoard state={f.state} line={i >= 0 ? f.line : undefined} names={names} narrow={narrow} at={i} viewer={viewer} />
    </div>
  );
}

/** Advantage over the turns from your side (the evaluation at the start of each turn, in Gigs), with the turning point and the selected move marked. */
function Advantage({ rec, me, turning, at }: { rec: GameReviewRecord; me: 0 | 1; turning: ReviewMove | null; at: ReviewMove | null }) {
  // an advantage past CAP_GIGS reads as "more than 3 Gigs": the line is clipped there (a decided position is left out)
  const pts = rec.timeline
    .map(([t, v]) => ({ t, g: ((me === 0 ? v : -v) / GIG) as number }))
    .filter((p) => Math.abs(p.g) < 40)
    .map((p) => ({ t: p.t, g: Math.max(-CAP_GIGS, Math.min(CAP_GIGS, p.g)) }));
  if (pts.length < 2) return null;
  const W = 600;
  const H = 100;
  const max = Math.max(1, ...pts.map((p) => Math.abs(p.g)));
  const fig = (g: number) => (Math.abs(g) >= CAP_GIGS ? `${g < 0 ? 'below −' : 'above '}${CAP_GIGS}` : g.toFixed(1));
  const t0 = pts[0]!.t;
  const t1 = pts[pts.length - 1]!.t;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W;
  const y = (g: number) => H / 2 - (g / max) * (H / 2 - 6);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.g).toFixed(1)}`).join(' ');
  const best = pts.reduce((a, p) => (p.g > a.g ? p : a));
  const worst = pts.reduce((a, p) => (p.g < a.g ? p : a));
  const label = `Advantage over the game from your side, in Gigs: from ${fig(pts[0]!.g)} at turn ${t0} to ${fig(pts[pts.length - 1]!.g)} at turn ${t1}; best ${fig(best.g)} (turn ${best.t}), worst ${fig(worst.g)} (turn ${worst.t}).`;
  return (
    <div className="momentum gr-adv">
      <div className="small muted">
        Advantage at the start of each turn (up = you ahead, down = the rival), ±{max.toFixed(1)} Gigs at the edges{max >= CAP_GIGS ? ' (or more)' : ''}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="mz" />
        {turning && turning.turn >= t0 && turning.turn <= t1 && <line x1={x(turning.turn)} x2={x(turning.turn)} y1="0" y2={H} className="gr-tp" />}
        {at && at.turn >= t0 && at.turn <= t1 && <line x1={x(at.turn)} x2={x(at.turn)} y1="0" y2={H} className="gr-at" />}
        <path d={`${path} L${W},${H / 2} L0,${H / 2} Z`} className="mfill" />
        <path d={path} className="mline" />
      </svg>
      <div className="small muted gr-adv-key">
        {turning && <span>┊ dashed: turning point (turn {turning.turn})</span>} {at && <span>│ solid: the move shown (turn {at.turn})</span>}
      </div>
    </div>
  );
}
