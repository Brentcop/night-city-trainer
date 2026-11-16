// "Record the result" of a played event's match with another player in it (#/run, src/lib/playedEvent.ts): who won
// each game, so the game score is right for the tiebreaks, or which side did not play (a forfeit). The form's rules are
// pure (readHandForm); the event takes the result through PlayedGames.record.
import { useId, useState } from 'react';
import { Modal } from '../Modal';
import { EMPTY_HAND_FORM, readHandForm, type HandForm, type HandResult, type WaitingGame } from '../../../lib/playedEvent';

export function RecordResultDialog({
  w,
  bestOf,
  round,
  onSave,
  onClose,
  initial = EMPTY_HAND_FORM,
}: {
  w: Pick<WaitingGame, 'job'>;
  bestOf: number;
  round: string;
  /** the problems the event found (empty: recorded) */
  onSave: (r: HandResult) => string[];
  onClose: () => void;
  initial?: HandForm;
}) {
  const [f, setF] = useState<HandForm>(initial);
  const [refused, setRefused] = useState<string[]>([]);
  const id = useId();
  const a = w.job.a.name;
  const b = w.job.b.name;
  const side = (i: 0 | 1) => (i === 0 ? a : b);
  const read = readHandForm(f, bestOf);
  const pick = (gi: number, who: 0 | 1) => setF((x) => ({ ...x, winners: [...x.winners.slice(0, gi), who] }));
  const save = () => {
    if (!read.result) return;
    const bad = onSave(read.result);
    if (bad.length) setRefused(bad);
    else onClose();
  };
  const winner = read.score[0] > read.score[1] ? a : read.score[1] > read.score[0] ? b : null;
  return (
    <Modal labelledBy={id} onClose={onClose} className="ev-record">
      <h2 id={id} style={{ marginTop: 0 }}>
        Record the result
      </h2>
      <p className="small" style={{ margin: 0 }}>
        {round && `${round}: `}
        <b>{a}</b> vs <b>{b}</b> · {bestOf === 1 ? 'one game' : `best of ${bestOf}`}
      </p>
      <div className="seg" role="group" aria-label="Was the match played?" style={{ marginTop: 8 }}>
        <button type="button" className={f.mode === 'played' ? 'on' : ''} aria-pressed={f.mode === 'played'} onClick={() => setF((x) => ({ ...x, mode: 'played' }))}>
          Played
        </button>
        <button type="button" className={f.mode === 'noShow' ? 'on' : ''} aria-pressed={f.mode === 'noShow'} onClick={() => setF((x) => ({ ...x, mode: 'noShow' }))}>
          Did not play (forfeit)
        </button>
      </div>
      {f.mode === 'played' ? (
        <ol className="ev-record-games">
          {Array.from({ length: read.rows }, (_, gi) => (
            <li key={gi}>
              <span className="muted">Game {gi + 1} won by</span>
              <div className="seg" role="group" aria-label={`Who won game ${gi + 1}`}>
                {([0, 1] as const).map((s) => (
                  <button key={s} type="button" className={f.winners[gi] === s ? 'on' : ''} aria-pressed={f.winners[gi] === s} onClick={() => pick(gi, s)}>
                    {side(s)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <fieldset className="ev-sub" style={{ border: 0, padding: 0, marginTop: 8 }}>
          <legend className="small muted">Who did not play?</legend>
          {([0, 1] as const).map((s) => (
            <label key={s} className="row small">
              <input type="radio" name={`${id}-noshow`} checked={f.noShow === s} onChange={() => setF((x) => ({ ...x, noShow: s }))} /> {side(s)} did not play, so {side((1 - s) as 0 | 1)} wins
            </label>
          ))}
          <p className="small muted" style={{ margin: 0 }}>
            A forfeit counts as a win in straight games ({read.score[0] + read.score[1] || Math.ceil(bestOf / 2)}–0) and has no games to replay.
          </p>
        </fieldset>
      )}
      <p className="small" role="status" aria-live="polite" style={{ margin: '8px 0 0' }}>
        {read.result ? `${winner} wins ${Math.max(...read.score)}–${Math.min(...read.score)}.` : read.problems[0] ? `Still to say: ${read.problems[0]}.` : ''}
      </p>
      {refused.length > 0 && (
        <ul className="ev-problems small">
          {refused.map((p) => (
            <li key={p}>⚠ {p}</li>
          ))}
        </ul>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="primary" onClick={save} disabled={!read.result}>
          Record the result
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>A result recorded by hand is marked as such everywhere the match is shown. Check it before you record it: the event takes it at once, and it can’t be changed afterwards.</p>
    </Modal>
  );
}
