// The Deck Lab's Breed tab: one bred deck's test against its reference (src/lib/breedGate.ts LAB_TEST; docs/SYNERGIES.md
// "A bred deck's test against its parent"). The view only: the panel (src/ui/pages/DeckLab.tsx BreedPanel) runs the
// games and keeps the reference's scores across presses. Before the test, which reference and why, and what it may play
// and can tell; after it, the verdict ("shown worse than X", "shown better than X", "could not tell: not shown worse
// than X"), the paired difference with its range, both win rates and the games. Every sentence comes from breedGate.ts.
// Nothing here is wider than a phone: the lines wrap, and the card it sits in has min-width 0.
import type { GateOutcome, ReferenceWhy } from '../../lib/breedGate';
import { labBeforeWords, labReferenceWords, labResultWords } from '../../lib/breedGate';
import type { RunManifest } from '../../lib/runManifest';
import { RunDetails } from './RunDetails';

/** One deck's test: running (games played so far in this run), done, stopped by you, or failed with the game's error. */
export type BreedTestState =
  | { kind: 'running'; games: number }
  | { kind: 'done'; outcome: GateOutcome; manifest: RunManifest }
  | { kind: 'stopped' }
  | { kind: 'failed'; error: string };

const TONE = { 'shown-worse': 'var(--red)', 'shown-better': 'var(--green)', 'could-not-tell': undefined } as const;

export function BreedTestView({
  reference,
  why,
  opponents,
  referenceKept,
  state,
  onTest,
  onStop,
}: {
  reference: string;
  why: ReferenceWhy;
  opponents: number;
  referenceKept: boolean;
  state: BreedTestState | undefined;
  onTest: () => void;
  onStop: () => void;
}) {
  const running = state?.kind === 'running';
  const done = state?.kind === 'done' ? state : null;
  const words = done ? labResultWords(done.outcome) : null;
  const stopped = state?.kind === 'stopped';
  return (
    <div className="grid small" style={{ gap: 6, minWidth: 0 }}>
      <div className="muted">{labReferenceWords(reference, why)}</div>
      {!done && <div className="muted">{labBeforeWords({ reference, opponents, referenceKept })}</div>}
      {!done && (
        <div className="row">
          <button onClick={onTest} disabled={running} style={{ whiteSpace: 'normal', textAlign: 'left' }}>
            {running ? 'Testing…' : `▶ Test against ${reference}`}
          </button>
          {running && (
            <>
              <span className="muted" role="status">
                {state.games.toLocaleString('en-US')} games played
              </span>
              <button onClick={onStop} title="Stops every test running here">
                ■ Stop
              </button>
            </>
          )}
        </div>
      )}
      {stopped && <div className="muted">Stopped before it was decided.</div>}
      {state?.kind === 'failed' && <div style={{ color: 'var(--red)' }}>⚠ Test failed: {state.error}</div>}
      {done && words && (
        <div className="grid" style={{ gap: 2, minWidth: 0 }} role="status">
          <b style={{ color: TONE[done.outcome.first.verdict] }}>{words.verdict}</b>
          <span>{words.difference}</span>
          <span>{words.rates}</span>
          <span className="muted">{words.games}</span>
        </div>
      )}
      {done && <RunDetails m={done.manifest} />}
    </div>
  );
}
