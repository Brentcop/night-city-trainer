// The match reviewer's view of a game (a tournament game, or the "Play-out details" tab of the Game review): runs the
// reviewer in a worker and shows each seat's moves in the Game review's own rating names (src/lib/gameReview.ts
// rateOracle: the same noise test, never a second grade or "accuracy" of its own), the moves its play-outs liked least,
// decision types and momentum. A recorded game that no longer replays is refused in a plain sentence.
import { useEffect, useRef, useState } from 'react';
import type { DecisionReview, GameReview, SeatReview } from '../../ai/reviewer';
import { DECIDED_EVAL, GIG_SWING } from '../../ai/eval';
import { counts, lossOf, RATINGS, rateOracle, type Rating } from '../../lib/gameReview';
import { behindText, gapFigure, gapSize, shownLabel } from '../../lib/coachWords';
import type { ReviewReply, ReviewRequest } from '../../sim/review.worker';
import { RatingPill } from './RatingPill';
import { Wr } from './Num';
import { MentionText } from './CardMention';

const gigs = (pts: number) => pts / GIG_SWING;

/** Run a review in a background worker. */
function useReview(req: ReviewRequest | null) {
  const [state, setState] = useState<{ progress: number; review?: GameReview; error?: string; refused?: string; busy: boolean }>({ progress: 0, busy: false });
  const w = useRef<Worker | null>(null);
  useEffect(() => {
    if (!req) return;
    setState({ progress: 0, busy: true });
    const worker = new Worker(new URL('../../sim/review.worker.ts', import.meta.url), { type: 'module' });
    w.current = worker;
    worker.onmessage = (e: MessageEvent<ReviewReply>) => {
      const m = e.data;
      if ('progress' in m) setState((s) => ({ ...s, progress: m.progress }));
      else if ('review' in m) setState({ progress: m.review.decisions.length, review: m.review, busy: false }), worker.terminate();
      else if ('refused' in m) setState({ progress: 0, refused: m.refused, busy: false }), worker.terminate();
      else if ('error' in m) setState({ progress: 0, error: m.error, busy: false }), worker.terminate();
    };
    // a worker that fails to load or crashes reports here (not via onmessage), so stop the spinner
    worker.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      setState({ progress: 0, error: e.message || 'the review worker failed to start', busy: false });
      worker.terminate();
    };
    worker.onmessageerror = () => {
      setState({ progress: 0, error: 'the review worker sent an unreadable reply', busy: false });
      worker.terminate();
    };
    worker.postMessage(req);
    return () => worker.terminate();
  }, [req]);
  return state;
}

/** A decision with its Game review rating, from this run's own measurement. */
interface Rated {
  d: DecisionReview;
  r: Rating;
  /** Gigs counted as lost (0 inside the noise, at most the cap) */
  loss: number;
}
const rate = (d: DecisionReview): Rated => {
  const r = rateOracle(d);
  return { d, r, loss: lossOf({ r, gap: gigs(d.regret) }) };
};

/**
 * `checked`: a recorded practice game, whose replay the worker checked move by move (strict); otherwise (a tournament
 * game re-played by its bots) only the result is compared with `expect`.
 */
export function ReviewPanel({ req, title, mySeat, expect, checked }: { req: ReviewRequest; title?: string; mySeat?: 0 | 1; expect?: 0 | 1 | 'tie'; checked?: boolean }) {
  const st = useReview(req);
  if (st.refused)
    return (
      <p className="small gr-refused" role="status">
        {st.refused}
      </p>
    );
  if (st.error) return <p className="small" style={{ color: 'var(--red)' }}>Review failed: {st.error.slice(0, 200)}</p>;
  if (!st.review)
    return (
      <div className="review-busy">
        <span className="spinner" /> Reviewing… {st.progress} decisions scored
        <div className="small muted">Each move is compared with the alternatives by playing them out for about a turn.</div>
      </div>
    );
  const r = st.review;
  const rated = r.decisions.map(rate);
  return (
    <div className="review">
      {title && <h3 style={{ margin: '0 0 6px' }}>{title}</h3>}
      {checked ? (
        <div className="small muted">✓ The replay is the game you played: every recorded move fits, and it ends the same way ({r.turns} turns).</div>
      ) : (
        expect !== undefined &&
        ((r.winner === null ? 'tie' : r.winner) === expect ? (
          <div className="small muted">✓ The replay ends with the recorded result ({r.turns} turns)</div>
        ) : (
          <div className="small" style={{ color: 'var(--red)' }}>
            ⚠ The replay did not reproduce the real result (bot settings changed since), so this review describes a different game.
          </div>
        ))
      )}
      {checked && (
        <p className="small muted">
          Every move measured again by the review's play-outs alone (no coach grades, its own worlds), in the Game review's rating names. A move near a boundary can land
          one step apart from the Game review tab; that tab is the verdict kept with the game.
        </p>
      )}
      <div className="review-seats">
        {r.seats.map((s) => (
          <SeatCard key={s.player} s={s} you={mySeat === s.player} rated={rated.filter((x) => x.d.player === s.player)} />
        ))}
      </div>
      <Momentum r={r} />
      <Categories seats={r.seats} rated={rated} names={r.names} />
      <Costly r={r} rated={rated} />
      <p className="small muted" style={{ marginBottom: 0 }}>
        Main-phase moves and reactions are measured (not targets or modes), judged by the bots' own evaluation about a turn ahead, with the cards the player couldn't see re-dealt.
        Reviewed in {(r.ms / 1000).toFixed(0)} s.
      </p>
    </div>
  );
}

function SeatCard({ s, you, rated }: { s: SeatReview; you?: boolean; rated: Rated[] }) {
  const n = Object.fromEntries([...RATINGS, 'unclear', 'forced'].map((k) => [k, 0])) as Record<Rating, number>;
  for (const x of rated) n[x.r]++;
  const counted = rated.filter((x) => counts(x.r));
  const avg = counted.length ? counted.reduce((a, x) => a + x.loss, 0) / counted.length : 0;
  return (
    <div className="review-seat">
      <div>
        <div className="small muted">{you ? 'YOU' : s.agent.toUpperCase()}</div>
        <b>{s.name}</b>
        <div className="small">
          {rated.length} move{rated.length === 1 ? '' : 's'} measured, {counted.length} counted · {avg.toFixed(2)} Gigs lost per counted move
          {n.unclear ? ` · ${n.unclear} with no clear difference` : ''}
          {s.gameLosing ? ` · ${s.gameLosing} that also lost more play-outs` : ''}
        </div>
        <div className="gr-counts">
          {RATINGS.filter((k) => n[k] > 0).map((k) => (
            <RatingPill key={k} r={k} n={n[k]} />
          ))}
        </div>
        {s.coachAgree !== undefined && (
          <div className="small muted">
            The coach's pick was within 0.1 Gigs of the best move found on <Wr v={s.coachAgree} /> of these decisions
          </div>
        )}
      </div>
    </div>
  );
}

/** A swing in the evaluation: "+0.6 Gigs", or "down more than 3 Gigs" past the cap. */
function swingText(delta: number): string {
  const g = gigs(Math.abs(delta));
  return gapSize(g) === 'figure' ? `${delta > 0 ? '+' : '−'}${gapFigure(g)}` : `${delta > 0 ? 'up' : 'down'} ${gapFigure(g)}`;
}

/** Evaluation from the first deck's side, turn by turn; the biggest swings are marked. */
function Momentum({ r }: { r: GameReview }) {
  const pts = r.timeline.filter((t) => Math.abs(t.v) < DECIDED_EVAL);
  if (pts.length < 3) return null;
  const W = 600;
  const H = 90;
  const max = Math.max(60, ...pts.map((p) => Math.abs(p.v)));
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => H / 2 - (v / max) * (H / 2 - 6);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const swingTurns = new Set(r.swings.map((s) => s.turn));
  return (
    <div className="momentum">
      <div className="small muted">
        Momentum (up = <b>{r.names[0]}</b> ahead, down = <b>{r.names[1]}</b> ahead) · dots mark the biggest swings
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Evaluation over the game">
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="mz" />
        <path d={`${path} L${W},${H / 2} L0,${H / 2} Z`} className="mfill" />
        <path d={path} className="mline" />
        {pts.map((p, i) => (swingTurns.has(p.turn) ? <circle key={i} cx={x(i)} cy={y(p.v)} r="4" className="mdot" /> : null))}
      </svg>
      <div className="small muted">{r.swings.map((s) => `T${s.turn}: ${swingText(s.delta)}`).join(' · ')}</div>
    </div>
  );
}

function Categories({ seats, rated, names }: { seats: SeatReview[]; rated: Rated[]; names: [string, string] }) {
  const groups = new Map<string, { who: string; k: string; n: number; costly: number; loss: number }>();
  for (const x of rated) {
    if (!seats.some((s) => s.player === x.d.player)) continue;
    const key = `${x.d.player}:${x.d.category}`;
    const g = groups.get(key) ?? { who: names[x.d.player], k: x.d.category, n: 0, costly: 0, loss: 0 };
    g.n++;
    if (x.r === 'slip' || x.r === 'mistake' || x.r === 'blunder') g.costly++;
    g.loss += x.loss;
    groups.set(key, g);
  }
  const rows = [...groups.values()].filter((g) => g.n >= 2).sort((a, b) => b.loss / b.n - a.loss / a.n);
  if (!rows.length) return null;
  return (
    <details>
      <summary className="small">By decision type</summary>
      <table className="small">
        <thead>
          <tr>
            {seats.length > 1 && <th>Deck</th>}
            <th>Decision type</th>
            <th>n</th>
            <th>Slip or worse</th>
            <th>Gigs lost / decision</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.who + g.k}>
              {seats.length > 1 && <td>{g.who}</td>}
              <td>{g.k}</td>
              <td>{g.n}</td>
              <td>
                <Wr v={g.costly / g.n} n={g.n} />
              </td>
              <td className={g.loss / g.n > 0.2 ? 'num neg' : ''}>{(g.loss / g.n).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** The moves these play-outs liked least: rated Slip or worse (outside the noise), biggest loss first. */
function Costly({ r, rated }: { r: GameReview; rated: Rated[] }) {
  const worst = rated.filter((x) => x.r === 'slip' || x.r === 'mistake' || x.r === 'blunder').sort((a, b) => b.loss - a.loss || (b.d.raw ?? b.d.regret) - (a.d.raw ?? a.d.regret)).slice(0, 6);
  if (!worst.length) return <p className="small">No move came out clearly behind the best one found (nothing rated Slip or worse).</p>;
  return (
    <div>
      <div className="pb-label">The moves these play-outs liked least</div>
      <ol className="costly">
        {worst.map(({ d, r: rating }) => (
          <li key={d.turn + d.chosen + d.i}>
            <span className="muted">T{d.turn}</span> {r.seats.length > 1 && <span className="muted">{r.names[d.player]}: </span>}
            <MentionText text={shownLabel(d.chosen)} skip={r.names} /> <RatingPill r={rating} /> <span className="muted">→ better: </span>
            <b>
              <MentionText text={shownLabel(d.best)} skip={r.names} />
            </b>{' '}
            <span className="num neg">{behindText(gigs(d.raw ?? d.regret), d.se !== undefined ? gigs(d.se) : undefined)}</span>
            {d.gameLosing && <span className="verdict neg">lost more play-outs</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
