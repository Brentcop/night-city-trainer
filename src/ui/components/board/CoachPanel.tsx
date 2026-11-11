// The Play board's coach UI: the notes panel (in the log drawer on the full board, the sheet on phones), the verdict
// toast after each move, and the end-of-game scorecard. The advice itself comes from useCoach (src/ui/useCoach.ts).
import { memo } from 'react';
import type { Game } from '../../../engine/engine';
import type { Advice, MoveGrade } from '../../../ai/coach';
import { Markdown } from '../Markdown';

export const NO_ALTS: Advice['alternatives'] = [];

/** A quick verdict on the move just made, compared with the coach. */
export function MoveToast({ gr }: { gr: MoveGrade }) {
  const text =
    gr.verdict === 'agree'
      ? 'Coach agrees'
      : gr.verdict === 'close'
        ? `Fine: the coach slightly preferred ${gr.coach}`
        : gr.gap !== null
          ? `Coach preferred ${gr.coach} (−${gr.gap.toFixed(1)} Gigs)`
          : `Coach preferred ${gr.coach}`;
  return (
    <span className={`move-toast ${gr.verdict}`} role="status">
      <i>{gr.verdict === 'agree' ? '✓' : gr.verdict === 'close' ? '≈' : '!'}</i>
      {text}
    </span>
  );
}

/** End-of-game review: how often you matched the coach, and the costliest differences. */
export function Scorecard({ grades }: { grades: MoveGrade[] }) {
  if (!grades.length) return null;
  const agree = grades.filter((x) => x.verdict !== 'miss').length;
  const pctAgree = Math.round((100 * agree) / grades.length);
  const misses = grades
    .filter((x) => x.verdict === 'miss')
    .sort((a, b) => (b.gap ?? 0.5) - (a.gap ?? 0.5))
    .slice(0, 3);
  const grade = pctAgree >= 85 ? 'A' : pctAgree >= 70 ? 'B' : pctAgree >= 55 ? 'C' : 'D';
  return (
    <div className="scorecard">
      <div className={`scorecard-grade g-${grade}`}>{grade}</div>
      <div>
        <b>
          {agree} of {grades.length} decisions matched the coach ({pctAgree}%)
        </b>
        {misses.length > 0 ? (
          <ul>
            {misses.map((m, k) => (
              <li key={k}>
                <span className="muted">T{m.turn}</span> {m.chose} <span className="muted">→ coach: </span>
                <b>{m.coach}</b>
                {m.gap !== null && <span className="neg"> −{m.gap.toFixed(1)} Gigs</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="small muted">No costly differences. Clean game.</div>
        )}
      </div>
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
            // two copies of a card give two alternatives with the same label, so the label alone is not a unique key
            <div key={`${i}:${a.label}`} className="coach-alt">
              <span>{a.label}</span>
              <b>{a.gap}</b>
            </div>
          ))}
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
