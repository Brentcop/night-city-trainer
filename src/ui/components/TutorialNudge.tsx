// The Play setup screen's pointer to the tutorial, for a browser with no practice games yet: one line, dismissible
// (remembered in nct.tutorial.v1), and only while the tutorial page is on.
import { useState } from 'react';
import { loadPractice } from '../../lib/practiceLog';
import { hideNudge, LESSON_IDS, loadTutorial } from '../../lib/tutorialProgress';
import { IfPage } from './SiteChrome';

export function TutorialNudge() {
  const [progress, setProgress] = useState(loadTutorial);
  const [fresh] = useState(() => loadPractice().length === 0);
  if (!fresh || progress.nudgeHidden || progress.done.length >= LESSON_IDS.length) return null;
  const started = progress.done.length > 0;
  return (
    <IfPage path="tutorial">
      <div className="panel tut-nudge" role="note">
        <span>
          {started ? 'Part way through the lessons? ' : 'New to the game? '}
          <a href="#/tutorial">{started ? 'Carry on learning to play' : 'Learn to play'}</a> in short lessons on this board, a minute or two each.
        </span>
        <button type="button" className="ghost" aria-label="Hide this tip" title="Hide this tip" onClick={() => setProgress(hideNudge())}>
          ×
        </button>
      </div>
    </IfPage>
  );
}
