// Learn to play (#/tutorial): the lessons (src/content/tutorial/lessons.ts, run by src/lib/tutorial.ts) played on the
// Play board, and "The rules in five minutes" (#/tutorial/rules). A lesson is not a real game: nothing is recorded,
// saved, graded or reviewed, and leaving one halfway loses nothing. Progress (lessons done) is nct.tutorial.v1.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LESSONS, lessonById } from '../../content/tutorial/lessons';
import { LessonRun, type Lesson } from '../../lib/tutorial';
import { clearTutorial, loadTutorial, markDone } from '../../lib/tutorialProgress';
import type { PracticeReplay } from '../../lib/practiceReplays';
import { Board, type BoardRun } from './Play';
import { useGameTick } from '../usePracticeGame';
import { loadBotSpeed, normalizeBotSpeed, saveBotSpeed } from '../components/board/prefs';
import { TutorBox } from '../components/board/TutorBox';
import { useFocusTrap } from '../components/Modal';
import { PageHead } from '../components/PageHead';
import { IfPage } from '../components/SiteChrome';
import { MentionText } from '../components/CardMention';
import { RulesInFive } from './TutorialRules';
import '../tutorial.css';

/** `sub`: '' (the lessons), 'rules' (the reference), or a lesson id (play it). */
export function TutorialPage({ sub = '' }: { sub?: string }) {
  const lesson = sub && sub !== 'rules' ? lessonById(sub) : undefined;
  if (lesson) return <LessonPlayer key={lesson.id} lesson={lesson} />;
  return (
    <div className="grid tut-page">
      <PageHead kicker="Learn" title="How to play">
        New to the game? Play the short lessons on the real board, one rule at a time, or read the rules in five minutes. Lessons are practice only: nothing is recorded, and you can leave one at any point.
      </PageHead>
      <nav className="tut-tabs" aria-label="How to play">
        <a href="#/tutorial" className={sub === 'rules' ? '' : 'active'} aria-current={sub === 'rules' ? undefined : 'page'}>
          Lessons
        </a>
        <a href="#/tutorial/rules" className={sub === 'rules' ? 'active' : ''} aria-current={sub === 'rules' ? 'page' : undefined}>
          The rules in five minutes
        </a>
      </nav>
      {sub === 'rules' ? <RulesInFive /> : <LessonList unknown={sub && !lesson ? sub : null} />}
    </div>
  );
}

function LessonList({ unknown }: { unknown: string | null }) {
  const [progress, setProgress] = useState(loadTutorial);
  const [asking, setAsking] = useState(false);
  const done = new Set(progress.done);
  const next = LESSONS.find((l) => !done.has(l.id));
  return (
    <>
      {unknown && <p className="muted">There is no lesson called “{unknown}”. Here are the lessons.</p>}
      <div className="tut-progress row">
        <span>
          {done.size === 0 ? 'Start with lesson 1: it takes a minute.' : done.size === LESSONS.length ? 'Every lesson done. Replay any of them, or play a real game.' : `${done.size} of ${LESSONS.length} lessons done.`}
        </span>
        {next && (
          <a className="btn primary" href={`#/tutorial/${next.id}`}>
            {done.size ? 'Next lesson' : 'Start lesson 1'} ›
          </a>
        )}
        {done.size === LESSONS.length && (
          <IfPage path="play">
            <a className="btn primary" href="#/play?tier=easy">
              Play the Easy bot ›
            </a>
          </IfPage>
        )}
        {progress.done.length > 0 &&
          (asking ? (
            <span className="row tut-confirm" role="group" aria-label="Start over">
              <span className="small">Forget which lessons you finished?</span>
              <button
                type="button"
                onClick={() => {
                  clearTutorial();
                  setProgress(loadTutorial());
                  setAsking(false);
                }}
              >
                Yes, start over
              </button>
              <button type="button" className="ghost" onClick={() => setAsking(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button type="button" className="ghost" onClick={() => setAsking(true)}>
              Start over
            </button>
          ))}
      </div>
      <ol className="tut-lessons">
        {LESSONS.map((l, k) => (
          <li key={l.id} className={`panel tut-lesson ${done.has(l.id) ? 'is-done' : ''} ${l === next ? 'is-next' : ''}`}>
            <span className="tut-num" aria-hidden="true">
              {done.has(l.id) ? '✓' : k + 1}
            </span>
            <div className="tut-lesson-body">
              <h2>
                <a href={`#/tutorial/${l.id}`}>
                  <span className="sr-only">Lesson {k + 1}: </span>
                  {l.title}
                </a>
              </h2>
              <p className="small">{l.teaches}</p>
              <p className="small muted">
                Goal: {l.goal} · {l.minutes}
                {done.has(l.id) && <span className="tut-done-tag"> · done</span>}
              </p>
            </div>
            <a className={`btn ${l === next ? 'primary' : ''}`} href={`#/tutorial/${l.id}`} aria-label={`${done.has(l.id) ? 'Play again' : 'Start'}: ${l.title}`}>
              {done.has(l.id) ? 'Play again' : 'Start'}
            </a>
          </li>
        ))}
      </ol>
      <p className="small muted">
        After the lessons: <a href="#/tutorial/rules">the rules in five minutes</a> as a recap
        <IfPage path="glossary">
          , the <a href="#/glossary">Glossary</a> for every term
        </IfPage>
        <IfPage path="guides">
          , and <a href="#/guides">Strategy</a> when you want to win more
        </IfPage>
        .
      </p>
    </>
  );
}

const NO_GRADES: never[] = [];
const NO_REPLAY: PracticeReplay = { id: '', date: '', decks: [{ name: '', legends: [], main: [], sideboard: [] }, { name: '', legends: [], main: [], sideboard: [] }], seed: 0, botLevel: 'tutorial', botSeed: 0, choices: [], result: 'draw' };

/** A lesson on the board; Play again starts it afresh. */
function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [attempt, setAttempt] = useState(0);
  return <LessonGame key={attempt} lesson={lesson} attempt={attempt} onReplay={() => setAttempt((a) => a + 1)} />;
}

/** The rival's pace: the board's bot speed (Bot speed in the strip), at most 1.5 s so a lesson keeps moving. */
const MAX_PACE = 1500;

function LessonGame({ lesson, attempt, onReplay }: { lesson: Lesson; attempt: number; onReplay: () => void }) {
  const [speed, setSpeedRaw] = useState(loadBotSpeed);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const setSpeed = (ms: number) => {
    const v = normalizeBotSpeed(ms);
    setSpeedRaw(v);
    saveBotSpeed(v);
  };
  const [run] = useState(() => new LessonRun(lesson, { pace: () => Math.min(speedRef.current, MAX_PACE) }));
  useEffect(() => {
    void run.start();
    return () => run.stop();
  }, [run]);
  // re-render on every change of the lesson (engine updates, steps, hints), as the board does
  useGameTick(run);
  const view = run.view();
  const status = view.status;
  // a finished lesson counts once, the moment it is complete
  useEffect(() => {
    if (status === 'complete') markDone(lesson.id);
  }, [status, lesson.id]);
  const [endHidden, setEndHidden] = useState(false);
  const exit = () => {
    location.hash = '#/tutorial';
  };
  const k = LESSONS.indexOf(lesson);
  const nextLesson = LESSONS[k + 1];
  const endActions = <LessonEndActions status={status} next={nextLesson} onReplay={onReplay} onExit={exit} last={!nextLesson} />;
  const game: BoardRun = useMemo(
    () => ({ match: attempt + 1, g: run.g, human: run.seat, grades: NO_GRADES, replay: NO_REPLAY, error: null, cancelled: false, conceded: false, stable: null }),
    [run, attempt],
  );
  const tutorial = {
    title: `${k + 1}. ${lesson.title}`,
    panel: <TutorBox view={view} onNext={() => run.next()} actions={endActions} />,
    mark: run.marked(),
    hintKey: run.refusals,
  };
  return (
    <>
      <Board
        session={run}
        game={game}
        coach={false}
        speed={speed}
        setSpeed={setSpeed}
        onQuit={exit}
        onConcede={() => undefined}
        onRematch={onReplay}
        onUndo={() => undefined}
        canSave={false}
        canReview={false}
        tutorial={tutorial}
      />
      {status !== 'running' && !endHidden && (
        <LessonEnd lesson={lesson} number={k + 1} status={status} text={view.end ?? ''} onHide={() => setEndHidden(true)}>
          {endActions}
        </LessonEnd>
      )}
    </>
  );
}

function LessonEndActions({ status, next, last, onReplay, onExit }: { status: string; next?: Lesson; last: boolean; onReplay: () => void; onExit: () => void }) {
  const won = status === 'complete';
  return (
    <div className="row tut-end-actions">
      {won && next && (
        <a className="btn primary" href={`#/tutorial/${next.id}`}>
          Next: {next.title} ›
        </a>
      )}
      {won && last && (
        <IfPage path="play">
          <a className="btn primary" href="#/play?tier=easy" title="The Play setup with the Easy bot and the coach on">
            Play a real game ›
          </a>
        </IfPage>
      )}
      <button type="button" className={won ? '' : 'primary'} onClick={onReplay}>
        Play again
      </button>
      <button type="button" className="ghost" onClick={onExit}>
        All lessons
      </button>
    </div>
  );
}

/** The lesson's end, over the board (the board stays readable behind it, and "Look at the board" closes it). */
function LessonEnd({ lesson, number, status, text, onHide, children }: { lesson: Lesson; number: number; status: string; text: string; onHide: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onHide, { initial: 'first' });
  const won = status === 'complete';
  return (
    <div className="pb-modal-wrap pb-over tut-end">
      <div ref={ref} className={`pb-modal pb-over-card ${won ? 'win' : 'draw'}`} role="dialog" aria-modal="true" aria-labelledby="tut-end-title" tabIndex={-1}>
        <div className="pb-over-kicker" aria-hidden="true">
          {`// lesson ${number}`}
        </div>
        <div id="tut-end-title" className="pb-over-title">
          {won ? 'LESSON COMPLETE' : status === 'missed' ? 'NOT THIS TIME' : 'LESSON STOPPED'}
        </div>
        <div className="pb-over-reason">{lesson.title}</div>
        <p className="tut-end-text">
          {/* names show the card on hover; focus starts on the first button, not on a name */}
          <MentionText text={text} passive />
        </p>
        {children}
        <button type="button" className="ghost tut-end-hide" onClick={onHide}>
          Look at the board
        </button>
      </div>
    </div>
  );
}
