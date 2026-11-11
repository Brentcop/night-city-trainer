// Post-game review view: runs the reviewer in a worker and shows grades, costly moves, decision types and momentum.
import { useEffect, useRef, useState } from 'react';
import type { GameReview, SeatReview } from '../../ai/reviewer';
import { BLUNDER, NOISE } from '../../ai/reviewer';
import { DECIDED_EVAL, GIG_SWING } from '../../ai/eval';
import type { ReviewReply, ReviewRequest } from '../../sim/review.worker';
import { Wr } from './Num';

const gigs = (pts: number) => (pts / GIG_SWING).toFixed(2);
const gradeOf = (acc: number) => (acc >= 0.85 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : 'D');

/** Run a review in a background worker. */
function useReview(req: ReviewRequest | null) {
  const [state, setState] = useState<{ progress: number; review?: GameReview; error?: string; busy: boolean }>({ progress: 0, busy: false });
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
      else setState({ progress: 0, error: m.error, busy: false }), worker.terminate();
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

export function ReviewPanel({ req, title, mySeat, expect }: { req: ReviewRequest; title?: string; mySeat?: 0 | 1; expect?: 0 | 1 | 'tie' }) {
  const st = useReview(req);
  if (st.error) return <p className="small" style={{ color: 'var(--red)' }}>Review failed: {st.error.slice(0, 200)}</p>;
  if (!st.review)
    return (
      <div className="review-busy">
        <span className="spinner" /> Reviewing… {st.progress} decisions scored
        <div className="small muted">Each move is compared with the alternatives by playing them out to the end of the rival's next turn.</div>
      </div>
    );
  const r = st.review;
  return (
    <div className="review">
      {title && <h3 style={{ margin: '0 0 6px' }}>{title}</h3>}
      {expect !== undefined &&
        ((r.winner === null ? 'tie' : r.winner) === expect ? (
          <div className="small muted">✓ Replay reproduced the real game ({r.turns} turns)</div>
        ) : (
          <div className="small" style={{ color: 'var(--red)' }}>
            ⚠ The replay did not reproduce the real result (bot settings changed since), so this review describes a different game.
          </div>
        ))}
      <div className="review-seats">
        {r.seats.map((s) => (
          <SeatCard key={s.player} s={s} you={mySeat === s.player} />
        ))}
      </div>
      <Momentum r={r} />
      <Categories seats={r.seats} />
      <Costly r={r} />
      <p className="small muted" style={{ marginBottom: 0 }}>
        Accurate = within {gigs(NOISE)} Gigs of the best move found; blunder = more than {gigs(BLUNDER)} Gigs given up. Only main-phase moves are graded (not blocks,
        reactions or targets), and the judge uses the bots' own evaluation: trust the costly-move list and game-losing flags most. Reviewed in {(r.ms / 1000).toFixed(0)} s.
      </p>
    </div>
  );
}

function SeatCard({ s, you }: { s: SeatReview; you?: boolean }) {
  const g = gradeOf(s.accuracy);
  return (
    <div className="review-seat">
      <div className={`scorecard-grade g-${g}`}>{g}</div>
      <div>
        <div className="small muted">{you ? 'YOU' : s.agent.toUpperCase()}</div>
        <b>{s.name}</b>
        <div className="small">
          <Wr v={s.accuracy} n={s.decisions} strong /> accurate · {gigs(s.avgRegret)} Gigs lost per decision · {s.blunders} blunder{s.blunders === 1 ? '' : 's'}
          {s.gameLosing ? ` · ${s.gameLosing} game-losing` : ''}
        </div>
        {s.coachAgree !== undefined && (
          <div className="small muted">
            Coach would have been accurate on <Wr v={s.coachAgree} /> of these decisions
          </div>
        )}
      </div>
    </div>
  );
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
        {pts.map((p, i) =>
          swingTurns.has(p.turn) ? <circle key={i} cx={x(i)} cy={y(p.v)} r="4" className="mdot" /> : null,
        )}
      </svg>
      <div className="small muted">
        {r.swings.map((s) => `T${s.turn}: ${s.delta > 0 ? '+' : '−'}${gigs(Math.abs(s.delta))} Gigs`).join(' · ')}
      </div>
    </div>
  );
}

function Categories({ seats }: { seats: SeatReview[] }) {
  const rows = seats.flatMap((s) =>
    Object.entries(s.byCategory)
      .filter(([, c]) => c!.n >= 2)
      .map(([k, c]) => ({ who: s.name, k, ...c! })),
  );
  if (!rows.length) return null;
  rows.sort((a, b) => b.regret - a.regret);
  return (
    <details>
      <summary className="small">By decision type</summary>
      <table className="small">
        <thead>
          <tr>
            {seats.length > 1 && <th>Deck</th>}
            <th>Decision type</th>
            <th>n</th>
            <th>Accuracy</th>
            <th>Gigs lost / decision</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.who + r.k}>
              {seats.length > 1 && <td>{r.who}</td>}
              <td>{r.k}</td>
              <td>{r.n}</td>
              <td>
                <Wr v={r.accuracy} n={r.n} />
              </td>
              <td className={r.regret > BLUNDER / 2 ? 'num neg' : ''}>{gigs(r.regret)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Costly({ r }: { r: GameReview }) {
  const worst = [...r.decisions].filter((d) => d.regret > NOISE).sort((a, b) => b.regret - a.regret).slice(0, 6);
  if (!worst.length) return <p className="small">No costly decisions found. A clean game.</p>;
  return (
    <div>
      <div className="pb-label">Costliest decisions</div>
      <ol className="costly">
        {worst.map((d) => (
          <li key={d.turn + d.chosen + d.i}>
            <span className="muted">T{d.turn}</span> {r.seats.length > 1 && <span className="muted">{r.names[d.player]}: </span>}
            {d.chosen} <span className="muted">→ better: </span>
            <b>{d.best}</b> <span className="num neg">−{gigs(d.regret)} Gigs</span>
            {d.gameLosing && <span className="verdict neg">game-losing</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
