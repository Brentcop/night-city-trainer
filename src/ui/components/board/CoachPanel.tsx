// The Play board's coach UI: the coach's pick under the prompt (CoachBox, every layout), the notes panel (in the log
// drawer on the full board, the sheet on phones), the verdict toast after each move, and the end-of-game scorecard. The
// advice itself comes from useCoach (src/ui/useCoach.ts); every Gig figure and grade name goes through
// src/lib/coachWords.ts, so the toast, the scorecard and the Game review use one vocabulary and never print more Gigs
// than can exist.
import { memo, useState } from 'react';
import type { Game } from '../../../engine/engine';
import type { Advice, MoveGrade } from '../../../ai/coach';
import { Markdown } from '../Markdown';
import { coachSummary } from '../../../lib/practiceLog';
import { RATING_INFO } from '../../../lib/gameReview';
import { behindText, GIG_NOTE, isWideClose, shownLabel, verdictRating } from '../../../lib/coachWords';

export const NO_ALTS: Advice['alternatives'] = [];
type Alt = Advice['alternatives'][number];

/** What the board passes to a CoachBox besides the pick: the reason, the best other option, or that advice is on its way. */
export interface CoachNote {
  why?: string;
  next?: Alt;
  thinking?: boolean;
}

/** An alternative's gap as the panel shows it: "≈ close call", or its tag from the coach ("−0.4 ± 0.1 Gigs", …). */
export function altText(a: Pick<Alt, 'close' | 'gap'>): string {
  return a.close ? '≈ close call' : a.gap;
}

/** The move made and the coach's pick name the same option (both as the board names them). */
const samePick = (gr: MoveGrade) => shownLabel(gr.chose) === shownLabel(gr.coach);

/** The toast's mark (never colour alone: the review's rating marks) and its class (the colour). */
function markOf(gr: MoveGrade): { icon: string; tone: string } {
  const r = verdictRating(gr.verdict, gr.gap);
  if (r) return { icon: RATING_INFO[r].mark, tone: r === 'best' ? 'agree' : r === 'close' ? 'close' : 'miss' };
  if (gr.verdict === 'pending') return { icon: '…', tone: 'wait' };
  return { icon: samePick(gr) ? '✓' : '·', tone: 'wait' };
}

/**
 * The verdict on one move in words, with the Game review's names (src/lib/gameReview.ts RATING_INFO): Best, Close call,
 * Slip, Mistake, Blunder. A wide close call (a gap of CLOSE_GIGS or more that is inside the noise only because the
 * coach's play-outs disagree) says it is too noisy to call, not that the coach "slightly" preferred its pick.
 */
export function verdictText(gr: MoveGrade): string {
  const coach = shownLabel(gr.coach);
  const r = verdictRating(gr.verdict, gr.gap);
  const name = r ? RATING_INFO[r].label : '';
  switch (gr.verdict) {
    case 'agree':
      return `${name}: the coach's pick`;
    case 'best':
      return `${name}: as strong as the coach's pick (${coach})`;
    case 'close':
      return isWideClose(gr.gap)
        ? `${name} (too noisy to call): the coach preferred ${coach}, but its play-outs disagree (${behindText(gr.gap ?? 0, gr.se)})`
        : `${name}: the coach slightly preferred ${coach}`;
    case 'inaccuracy':
    case 'mistake':
      return `${name}: the coach preferred ${coach} (${behindText(gr.gap ?? 0, gr.se)})`;
    case 'pending':
      return 'Checking your move…';
    case 'unscored':
      return samePick(gr) ? "Same as the coach's pick (not measured)" : `Coach picked ${coach} (not measured)`;
  }
}

/** A quick verdict on the move just made, compared with the coach by value. */
export function MoveToast({ gr }: { gr: MoveGrade }) {
  const m = markOf(gr);
  return (
    <span className={`move-toast ${m.tone}`} role="status">
      <i aria-hidden="true">{m.icon}</i>
      {verdictText(gr)}
    </span>
  );
}

const isFine = (g: MoveGrade) => g.verdict === 'agree' || g.verdict === 'best' || g.verdict === 'close';
const isCostly = (g: MoveGrade) => g.verdict === 'inaccuracy' || g.verdict === 'mistake';

/**
 * End-of-game check against the coach: how many of the moves it measured during play (main-phase moves and reactions,
 * against its pick in its play-outs) were Best or a Close call, and the costliest. It is not the game's rating: the Game
 * review rates every move. Choices the coach decides by rule (targets, Gig picks, the mulligan) are not measured, so
 * they count neither way; with nothing measured there is no letter.
 */
export function Scorecard({ grades }: { grades: MoveGrade[] }) {
  if (!grades.length) return null;
  const measured = grades.filter((x) => isFine(x) || isCostly(x));
  const other = grades.length - measured.length;
  const footer = (
    <div className="small muted scorecard-note">
      This checks only your moves the coach measured against its pick during play; 🔍 Game review rates every move of the game. {GIG_NOTE}
    </div>
  );
  if (!measured.length) {
    return (
      <div className="scorecard">
        <div>
          <b>Against the coach’s pick: no moves measured this game.</b>
          {other > 0 && (
            <div className="small muted">
              {other} {other === 1 ? 'choice was' : 'choices were'} not measured (the coach decides targets, Gig picks and the mulligan by rule).
            </div>
          )}
          {footer}
        </div>
      </div>
    );
  }
  // the same numbers the practice log keeps for the profile (src/lib/practiceLog.ts coachSummary)
  const { fine, pct, grade } = coachSummary(grades)!;
  const close = grades.filter((x) => x.verdict === 'close').length;
  const costly = measured
    .filter(isCostly)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
    .slice(0, 3);
  return (
    <div className="scorecard">
      <div className={`scorecard-grade g-${grade}`} aria-label={`Grade ${grade} against the coach's pick`}>
        {grade}
      </div>
      <div>
        <b>
          Against the coach’s pick: {fine} of {measured.length} measured {measured.length === 1 ? 'move was' : 'moves were'} Best or a Close call ({pct}%)
        </b>
        {(close > 0 || other > 0) && (
          <div className="small muted">
            {close > 0 && `${close} ${close === 1 ? 'was a close call' : 'were close calls'} (counted as fine).`}
            {close > 0 && other > 0 && ' '}
            {other > 0 && `${other} other ${other === 1 ? 'choice' : 'choices'} not measured.`}
          </div>
        )}
        {costly.length > 0 ? (
          <ul>
            {costly.map((m, k) => {
              const r = verdictRating(m.verdict, m.gap);
              return (
                <li key={k}>
                  <span className="muted">T{m.turn}</span> {shownLabel(m.chose)} <span className="muted">→ coach: </span>
                  <b>{shownLabel(m.coach)}</b>{' '}
                  <span className="neg">
                    {r ? RATING_INFO[r].label : ''}, {behindText(m.gap ?? 0, m.se)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="small muted">No costly differences from the coach’s pick.</div>
        )}
        {footer}
      </div>
    </div>
  );
}

/**
 * The coach's pick under the prompt (full board, phone panel and the opening hand): its pick, the reason, and the best
 * other option it weighed; "thinking…" while the advice is on its way. On phones (`compact`) the reason is one line
 * with a "Why?" toggle (touch screens never show a title tooltip).
 */
export function CoachBox({
  pick,
  why,
  next,
  thinking,
  compact,
  className = 'pb-coach-box',
}: {
  pick?: string | null;
  why?: string;
  next?: Alt;
  thinking?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!pick) {
    if (!thinking) return null;
    return (
      <div className={`${className} pb-coach-wait`} role="status">
        <b>Coach:</b> <span className="muted">thinking…</span>
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="pb-coach-pick">
        <b>Coach:</b> {pick}
      </div>
      {why && (
        <div className={`muted small pb-coach-why ${compact && !open ? 'is-clamped' : ''}`}>
          {why}
        </div>
      )}
      {why && compact && (
        <button type="button" className="ghost pb-coach-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Less' : 'Why?'}
        </button>
      )}
      {next && (!compact || open) && (
        <div className="small pb-coach-next">
          <span className="muted">Next best:</span> {next.label} <span className="muted">({next.close ? 'close call: either is fine' : altText(next)})</span>
        </div>
      )}
    </div>
  );
}

/**
 * Coach notes (in the log drawer on the full board, under the prompt on phones): other options it weighed, live board
 * warnings, and the matchup plan for your deck. The game state changes in place, so `v` (the game's update counter)
 * tells the memo when to re-render.
 */
export const CoachPanel = memo(function CoachPanel({ alts, tips, warnings }: { g: Game; v: number; alts: Advice['alternatives']; tips: string[]; warnings: string[] }) {
  return (
    <div className="coach-panel">
      {alts.length > 0 && (
        <div>
          <div className="pb-label">Coach also considered</div>
          {alts.map((a, i) => (
            // labels are distinct (the coach lists one move per name), but keep the index in the key all the same
            <div key={`${i}:${a.label}`} className="coach-alt">
              <span>{shownLabel(a.label)}</span>
              <b title={a.close ? 'Within the noise of the coach’s pick: either is fine' : undefined}>{altText(a)}</b>
            </div>
          ))}
          <div className="small muted coach-gig-note">{GIG_NOTE}</div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="coach-warn">
          {warnings.map((w) => (
            <div key={w}>⚠ {w}</div>
          ))}
        </div>
      )}
      {tips.length > 0 && (
        <details>
          <summary className="small">Matchup plan &amp; deck tips</summary>
          <Markdown text={tips.map((t) => `- ${t}`).join(String.fromCharCode(10))} />
        </details>
      )}
    </div>
  );
});
