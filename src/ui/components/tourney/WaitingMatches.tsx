// A played event's matches that wait for a person (#/run, src/lib/playedEvent.ts): your matches against a bot ("Play
// your match", or "Continue" for a game in progress) and the matches with another player in them ("Record the result").
// The event goes on by itself once every match of the round has its result.
import type { TourneyEvent } from '../../../lib/tournament';
import { waitingMatch, type WaitingGame } from '../../../lib/playedEvent';

/** One waiting game as the list shows it. */
export function waitingLine(w: WaitingGame, ev: Pick<TourneyEvent, 'rounds' | 'bracket' | 'config'> | null): { round: string; bestOf: number; score: [number, number] } {
  const m = waitingMatch(ev, w);
  return { round: m?.round ?? '', bestOf: m?.bestOf ?? ev?.config?.bestOf ?? 3, score: m ? [m.match.score[0], m.match.score[1]] : [0, 0] };
}

export function WaitingMatches({
  waiting,
  ev,
  inProgress,
  onPlay,
  onRecord,
  canPlay,
}: {
  waiting: readonly WaitingGame[];
  ev: Pick<TourneyEvent, 'rounds' | 'bracket' | 'config'> | null;
  /** the game id of your game in progress (its save is with the event) */
  inProgress?: string | null;
  onPlay: (w: WaitingGame) => void;
  onRecord: (w: WaitingGame) => void;
  /** false while another of your games is open on the board */
  canPlay: boolean;
}) {
  if (!waiting.length) return null;
  return (
    <section className="ev-waiting" aria-label="Matches waiting for a person">
      <div className="pb-label">Waiting for {waiting.length === 1 ? 'a result' : `${waiting.length} results`}</div>
      <ul className="ev-waiting-list">
        {waiting.map((w) => {
          const { round, bestOf, score } = waitingLine(w, ev);
          const a = w.job.a.name;
          const b = w.job.b.name;
          const series = bestOf > 1 ? ` · game ${w.gi + 1}, best of ${bestOf}${w.gi > 0 ? ` · ${score[0]}–${score[1]}` : ''}` : '';
          if (w.kind === 'you') {
            const you = w.you ?? a;
            const opp = you === a ? b : a;
            const going = inProgress === w.id;
            return (
              <li key={w.id} className="ev-waiting-you">
                <span>
                  <b>Your match</b>
                  {round && ` · ${round}`}: {you} (you) vs {opp} (bot){series}
                  {going && <span className="tag">in progress</span>}
                </span>
                <button className="primary" onClick={() => onPlay(w)} disabled={!canPlay}>
                  ▶ {going ? `Continue game ${w.gi + 1}` : 'Play your match'}
                </button>
              </li>
            );
          }
          return (
            <li key={w.id}>
              <span>
                {round && `${round}: `}
                {a} vs {b}
                {bestOf > 1 ? ` · best of ${bestOf}` : ''} <span className="tag">another player</span>
              </span>
              <button onClick={() => onRecord(w)}>Record the result</button>
            </li>
          );
        })}
      </ul>
      <p className="small muted" style={{ margin: 0 }}>
        The next round is paired once every match of this one has its result. Bot matches play on by themselves meanwhile.
      </p>
    </section>
  );
}
