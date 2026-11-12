// The Play board's coach UI: the notes panel (in the log drawer on the full board, the sheet on phones), the verdict
// toast after each move, and the end-of-game scorecard. The advice itself comes from useCoach (src/ui/useCoach.ts).
import { memo } from 'react';
import type { Game } from '../../../engine/engine';
import type { Advice, MoveGrade } from '../../../ai/coach';
import { Markdown } from '../Markdown';

export const NO_ALTS: Advice['alternatives'] = [];

/** "−0.3 Gigs", with "± 0.1" when the gap has a spread. */
export function gapText(gap: number, se?: number): string {
  return `−${Math.max(0, gap).toFixed(1)}${se ? ` ± ${se.toFixed(1)}` : ''} Gigs`;
}

/** The toast's mark (never colour alone) and its class (the colour). */
const MARK: Record<MoveGrade['verdict'], { icon: string; tone: string }> = {
  agree: { icon: '✓', tone: 'agree' },
  best: { icon: '✓', tone: 'agree' },
  close: { icon: '≈', tone: 'close' },
  inaccuracy: { icon: '!', tone: 'miss' },
  mistake: { icon: '!!', tone: 'miss' },
  pending: { icon: '…', tone: 'wait' },
  unscored: { icon: '·', tone: 'wait' },
};

/** The verdict on one move in words. */
export function verdictText(gr: MoveGrade): string {
  switch (gr.verdict) {
    case 'agree':
      return 'Coach agrees';
    case 'best':
      return `Good: as strong as the coach's pick (${gr.coach})`;
    case 'close':
      return `Close call: the coach slightly preferred ${gr.coach}`;
    case 'inaccuracy':
      return `Inaccuracy: the coach preferred ${gr.coach} (${gapText(gr.gap ?? 0, gr.se)})`;
    case 'mistake':
      return `Mistake: the coach preferred ${gr.coach} (${gapText(gr.gap ?? 0, gr.se)})`;
    case 'pending':
      return 'Checking your move…';
    case 'unscored':
      return `Coach picked ${gr.coach} (not measured)`;
  }
}

/** A quick verdict on the move just made, compared with the coach by value. */
export function MoveToast({ gr }: { gr: MoveGrade }) {
  const m = MARK[gr.verdict];
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
 * End-of-game review: how many of your measured moves were fine (the coach's pick, as good, or a close call), and the
 * costliest. Choices the coach can't value (targets, modes) are counted apart, not as misses.
 */
export function Scorecard({ grades }: { grades: MoveGrade[] }) {
  if (!grades.length) return null;
  const measured = grades.filter((x) => isFine(x) || isCostly(x));
  const fine = measured.filter(isFine).length;
  const close = grades.filter((x) => x.verdict === 'close').length;
  const other = grades.length - measured.length;
  const pct = measured.length ? Math.round((100 * fine) / measured.length) : 100;
  const costly = measured
    .filter(isCostly)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
    .slice(0, 3);
  const grade = pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : 'D';
  return (
    <div className="scorecard">
      <div className={`scorecard-grade g-${grade}`} aria-label={`Grade ${grade}`}>
        {grade}
      </div>
      <div>
        <b>
          {fine} of {measured.length} moves were fine ({pct}%)
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
            {costly.map((m, k) => (
              <li key={k}>
                <span className="muted">T{m.turn}</span> {m.chose} <span className="muted">→ coach: </span>
                <b>{m.coach}</b> <span className="neg">{m.verdict === 'mistake' ? 'mistake' : 'inaccuracy'}, {gapText(m.gap ?? 0, m.se)}</span>
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
              <b title={a.close ? 'Within the noise of the coach’s pick: either is fine' : undefined}>{a.close ? '≈ close call' : a.se ? gapText(a.gapGigs, a.se) : a.gap}</b>
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
