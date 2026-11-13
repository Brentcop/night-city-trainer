// A tutorial lesson's panel on the board (src/ui/pages/Tutorial.tsx): what to do now and why, the last step's result,
// the hint after a refused move, and Next for the explanation pages. The board shows it where the coach box sits.
import { useEffect, useRef } from 'react';
import type { TutorView } from '../../../lib/tutorial';
import { MentionText } from '../CardMention';

export function TutorBox({ view, onNext, actions }: { view: TutorView; onNext: () => void; /** the lesson's end: what to do next */ actions?: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Next keeps the keyboard where it was: on Next while there are pages left, else on the panel itself
  const hadFocus = useRef(false);
  useEffect(() => {
    if (!hadFocus.current) return;
    hadFocus.current = false;
    (nextRef.current ?? ref.current)?.focus();
  });
  // a move that removed the focused control (an option that is gone now) leaves focus nowhere: the next step's words
  // take it, so a keyboard user goes on from the lesson
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const a = document.activeElement;
    if (!a || a === document.body) ref.current?.focus({ preventScroll: true });
  }, [view.step, view.status]);
  const next = () => {
    hadFocus.current = true;
    onNext();
  };
  const running = view.status === 'running';
  return (
    <section ref={ref} className={`pb-tutor ${view.hint ? 'has-hint' : ''} ${running ? '' : `is-${view.status}`}`} aria-label="Lesson" tabIndex={-1}>
      <div className="pb-tutor-head">
        <b>Tutor</b>
        <span>{running ? `Step ${view.step} of ${view.steps}` : view.status === 'complete' ? 'Lesson complete' : 'Lesson over'}</span>
        {/* first, so it is in view in a short dock or panel */}
        {view.canNext && (
          <button ref={nextRef} type="button" className="primary pb-tutor-next" onClick={next}>
            Next ›
          </button>
        )}
      </div>
      {view.feedback && (
        <p className="pb-tutor-done">
          <span aria-hidden="true">✓ </span>
          <MentionText text={view.feedback} />
        </p>
      )}
      {/* a refused move's hint first: it is what to do now */}
      {view.hint && (
        <p className="pb-tutor-hint" role="alert">
          <MentionText text={view.hint} />
        </p>
      )}
      <p className="pb-tutor-text" aria-live="polite">
        <MentionText text={view.end ?? view.text} />
      </p>
      {running && view.waiting && !view.canNext && <p className="pb-tutor-wait small muted">The rival is playing…</p>}
      {!running && actions}
    </section>
  );
}
