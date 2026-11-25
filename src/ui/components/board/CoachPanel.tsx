// The Play board's coach UI: the coach's pick under the prompt (CoachBox, every layout), the notes panel (in the log
// drawer on the full board, the sheet on phones), the verdict toast after each move, and the end-of-game scorecard. The
// advice itself comes from useCoach (src/ui/useCoach.ts); every Gig figure and grade name goes through
// src/lib/coachWords.ts, so the toast, the scorecard and the Game review use one vocabulary and never print more Gigs
// than can exist. A verdict is never sized in Gigs: a costly grade says what moves of its band cost in win chance, as
// measured (src/lib/ratingCost.ts, docs/REVIEW_2026-11-25.md row 6); Gig figures stay only on the options the coach
// weighed (the alternatives), with the note that they are not win chance.
import { memo, useState } from 'react';
import type { Game } from '../../../engine/engine';
import type { Advice, MoveGrade } from '../../../ai/coach';
import { Markdown } from '../Markdown';
import { MentionText } from '../CardMention';
import { coachSummary } from '../../../lib/practiceLog';
import { BEST_GIGS, fixedTerms, RATING_INFO } from '../../../lib/gameReview';
import { COACH_COST_NOTE, coachCostWords, GIG_NOTE, isWideClose, shownLabel, verdictRating } from '../../../lib/coachWords';

export const NO_ALTS: Advice['alternatives'] = [];
type Alt = Advice['alternatives'][number];

/** What the board passes to a CoachBox besides the pick: the reason, the best other option, or that advice is on its way. */
export interface CoachNote {
  why?: string;
  next?: Alt;
  thinking?: boolean;
}

/** An alternative within the noise of the pick reads "as good" (within 0.1 Gigs, or valued higher) or "close call". */
const closeWord = (a: Pick<Alt, 'gapGigs'>) => (a.gapGigs <= BEST_GIGS ? 'as good' : 'close call');

/** An alternative's gap as the panel shows it: "≈ as good", "≈ close call", or its tag from the coach ("−0.4 ± 0.1 Gigs", …). */
export function altText(a: Pick<Alt, 'close' | 'gap' | 'gapGigs'>): string {
  return a.close ? `≈ ${closeWord(a)}` : a.gap;
}

/** The move made and the coach's pick name the same option (both as the board names them). */
const samePick = (gr: MoveGrade) => shownLabel(gr.chose) === shownLabel(gr.coach);

/** The toast's mark (never colour alone: the review's rating marks) and its class (the colour). */
function markOf(gr: MoveGrade): { icon: string; tone: string } {
  const r = verdictRating(gr.verdict, gr.gap);
  if (r) return { icon: RATING_INFO[r].mark, tone: r === 'best' ? 'agree' : r === 'close' ? 'close' : r === 'unclear' ? 'wait' : 'miss' };
  if (gr.verdict === 'pending') return { icon: '…', tone: 'wait' };
  return { icon: samePick(gr) ? '✓' : '·', tone: 'wait' };
}

/** Why a choice is not measured, when there is more to say than "not measured". */
function notMeasuredWhy(gr: MoveGrade): string {
  switch (gr.notMeasured) {
    case 'mulligan':
      return 'mulligans are not graded: the play-outs can’t tell keeping from mulliganing apart';
    case 'gig':
      return 'not measured during play; 🔍 Game review grades Gig choices';
    case 'check':
      return 'not measured: the check on fresh play-outs did not finish';
    default:
      return 'not measured';
  }
}

/** "checked on 16 fresh play-outs" for a confirmed grade, else null. */
const checked = (gr: MoveGrade) => (gr.confirmed ? `checked on ${gr.confirmed} fresh play-outs` : null);

/**
 * The verdict on one move in words, with the Game review's names (src/lib/gameReview.ts RATING_INFO): Best, Close call,
 * Slip, Mistake, Blunder, No clear difference. A wide close call (a gap of CLOSE_GIGS or more that is inside the noise
 * only because the coach's play-outs disagree) says it is too noisy to call, not that the coach "slightly" preferred its
 * pick. Every Slip or worse, and every wide close call, was checked on fresh play-outs first ("Checking your move…").
 * A costly grade says what moves of its band cost in win chance on average (coachCostWords), never its gap in Gigs.
 */
export function verdictText(gr: MoveGrade): string {
  const coach = shownLabel(gr.coach);
  const r = verdictRating(gr.verdict, gr.gap);
  const name = r ? RATING_INFO[r].label : '';
  switch (gr.verdict) {
    case 'unclear':
      return gr.decided
        ? `${name}: the game was already decided in the coach's play-outs, whatever the move`
        : `${name}: every option the coach weighed comes out about the same${samePick(gr) ? '' : ` (it picked ${coach})`}`;
    case 'agree':
      return `${name}: the coach's pick`;
    case 'best':
      return `${name}: as strong as the coach's pick (${coach})`;
    case 'close':
      if (!isWideClose(gr.gap)) return `${name}: the coach slightly preferred ${coach}`;
      // the same difference in every play-out: fixed terms of the evaluation, not a measurement (COACH-14)
      if (fixedTerms(gr.se)) return `${name} (not measured): the coach preferred ${coach}, but only by fixed terms of its evaluation, about the same in every play-out`;
      return `${name} (too noisy to call): the coach preferred ${coach}, but its play-outs disagree${checked(gr) ? ` (${checked(gr)})` : ''}`;
    case 'inaccuracy':
    case 'mistake': {
      const said = [checked(gr), coachCostWords(gr.verdict, gr.gap)].filter(Boolean).join('; ');
      return `${name}: the coach preferred ${coach}${said ? ` (${said})` : ''}`;
    }
    case 'pending':
      return 'Checking your move…';
    case 'unscored':
      return samePick(gr) ? `Same as the coach's pick (${notMeasuredWhy(gr)})` : `Coach picked ${coach} (${notMeasuredWhy(gr)})`;
  }
}

/** A quick verdict on the move just made, compared with the coach by value. */
export function MoveToast({ gr }: { gr: MoveGrade }) {
  const m = markOf(gr);
  return (
    <span className={`move-toast ${m.tone}`} role="status">
      <i aria-hidden="true">{m.icon}</i>
      {/* a passing toast: card names show the card on hover, but take no Tab stop */}
      <MentionText text={verdictText(gr)} passive />
    </span>
  );
}

const isFine = (g: MoveGrade) => g.verdict === 'agree' || g.verdict === 'best' || g.verdict === 'close';
const isCostly = (g: MoveGrade) => g.verdict === 'inaccuracy' || g.verdict === 'mistake';

/** "1 Mistake, 2 Slips": the costly moves by rating name, worst first. */
function costlyNames(costly: readonly MoveGrade[]): string {
  const n = new Map<string, number>();
  for (const m of costly) {
    const r = verdictRating(m.verdict, m.gap);
    if (r) n.set(r, (n.get(r) ?? 0) + 1);
  }
  const order = ['blunder', 'mistake', 'slip'] as const;
  return order.flatMap((r) => (n.get(r) ? [`${n.get(r)} ${RATING_INFO[r].label}${n.get(r) === 1 ? '' : 's'}`] : [])).join(', ');
}

/**
 * End-of-game check against the coach (REVIEW_2026-11-25 C3): first the costly moves (Slip or worse, every one checked on
 * fresh play-outs before it was shown), then the share of the decisions that mattered handled well (the coach's pick, as
 * good, or a close call), with its letter (practiceLog.ts SCORECARD_CUTS: set from bot players of known strength). A
 * decision where every option came out about the same (No clear difference) is left out, as the Game review leaves it
 * out: a uniformly random player used to score 73–75% "fine" mostly on such decisions. It is not the game's rating: the
 * Game review rates every move. Choices the coach decides by rule (targets, Gig picks, the mulligan) are not measured.
 */
export function Scorecard({ grades }: { grades: MoveGrade[] }) {
  if (!grades.length) return null;
  const measured = grades.filter((x) => isFine(x) || isCostly(x));
  const unclear = grades.filter((x) => x.verdict === 'unclear').length;
  const other = grades.length - measured.length - unclear;
  const footer = (
    <div className="small muted scorecard-note">
      This checks only your moves the coach measured against its pick during play; 🔍 Game review rates every move of the game. {COACH_COST_NOTE}
    </div>
  );
  const asides = (
    <>
      {unclear > 0 && `${unclear} ${unclear === 1 ? 'decision' : 'decisions'} made no clear difference (not counted).`}
      {unclear > 0 && other > 0 && ' '}
      {other > 0 && `${other} other ${other === 1 ? 'choice' : 'choices'} not measured (targets, modes and Gig picks are decided by rule; mulligans are not graded).`}
    </>
  );
  if (!measured.length) {
    return (
      <div className="scorecard">
        <div>
          <b>Against the coach’s pick: no decision that mattered was measured this game.</b>
          {(unclear > 0 || other > 0) && <div className="small muted">{asides}</div>}
          {footer}
        </div>
      </div>
    );
  }
  // the same numbers the practice log keeps for the profile (src/lib/practiceLog.ts coachSummary)
  const { fine, pct, grade } = coachSummary(grades)!;
  const close = grades.filter((x) => x.verdict === 'close').length;
  const costlyAll = measured.filter(isCostly);
  const costly = [...costlyAll].sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)).slice(0, 3);
  return (
    <div className="scorecard">
      <div className={`scorecard-grade g-${grade}`} aria-label={`Grade ${grade} against the coach's pick`} title="The share of decisions that mattered handled well, against bot players: A about as well as Hard, B Medium, C Easy, D a random player">
        {grade}
      </div>
      <div>
        <b>{costlyAll.length ? `Costly moves: ${costlyAll.length} (${costlyNames(costlyAll)}), each checked on fresh play-outs` : 'No costly moves against the coach’s pick'}</b>
        <div>
          Handled well: {fine} of {measured.length} {measured.length === 1 ? 'decision' : 'decisions'} that mattered ({pct}%)
        </div>
        {(close > 0 || unclear > 0 || other > 0) && (
          <div className="small muted">
            {close > 0 && `${close} ${close === 1 ? 'was a close call' : 'were close calls'} (counted as handled well).`}
            {close > 0 && (unclear > 0 || other > 0) && ' '}
            {asides}
          </div>
        )}
        {costly.length > 0 && (
          <ul>
            {costly.map((m, k) => {
              const r = verdictRating(m.verdict, m.gap);
              return (
                <li key={k}>
                  <span className="muted">T{m.turn}</span> <MentionText text={shownLabel(m.chose)} /> <span className="muted">→ coach: </span>
                  <b>
                    <MentionText text={shownLabel(m.coach)} />
                  </b>{' '}
                  <span className="neg">{r ? RATING_INFO[r].label : ''}</span>
                </li>
              );
            })}
          </ul>
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
        <b>Coach:</b> <MentionText text={pick} />
      </div>
      {why && (
        <div className={`muted small pb-coach-why ${compact && !open ? 'is-clamped' : ''}`}>
          <MentionText text={why} />
        </div>
      )}
      {why && compact && (
        <button type="button" className="ghost pb-coach-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Less' : 'Why?'}
        </button>
      )}
      {next && (!compact || open) && (
        <div className="small pb-coach-next">
          <span className="muted">Next best:</span> <MentionText text={next.label} /> <span className="muted">({next.close ? `${closeWord(next)}: either is fine` : altText(next)})</span>
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
export const CoachPanel = memo(function CoachPanel({ alts, tips, warnings, source }: { g: Game; v: number; alts: Advice['alternatives']; tips: string[]; warnings: string[]; /** where the tips' card figures come from (coachTablesWords) */ source?: string | null }) {
  return (
    <div className="coach-panel">
      {alts.length > 0 && (
        <div>
          <div className="pb-label">Coach also considered</div>
          {alts.map((a, i) => (
            // labels are distinct (the coach lists one move per name), but keep the index in the key all the same
            <div key={`${i}:${a.label}`} className="coach-alt">
              <span>
                <MentionText text={shownLabel(a.label)} />
              </span>
              <b title={a.close ? 'Within the noise of the coach’s pick: either is fine' : undefined}>{altText(a)}</b>
            </div>
          ))}
          <div className="small muted coach-gig-note">{GIG_NOTE}</div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="coach-warn">
          {warnings.map((w) => (
            <div key={w}>
              ⚠ <MentionText text={w} />
            </div>
          ))}
        </div>
      )}
      {tips.length > 0 && (
        <details>
          <summary className="small">Matchup plan &amp; deck tips</summary>
          <Markdown text={tips.map((t) => `- ${t}`).join(String.fromCharCode(10))} />
          {source && <div className="small muted coach-source">{source}</div>}
        </details>
      )}
    </div>
  );
});
