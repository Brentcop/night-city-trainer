// "Who plays" at the top of the runner's setup (#/run, feature `playedTournaments`): the presets Bots only, Play in it
// and Players only, the entrant you play, who runs each entrant, and "Coach during my matches". The rules are pure in
// src/lib/playedEvent.ts; this is only their controls.
import { useId } from 'react';
import { applyPreset, ONE_DEVICE_NOTE, presetOf, SEAT_LABEL, SEAT_PRESETS, seatFor, setSeat, youKey, type DraftSeats, type EntrantSeat } from '../../../lib/playedEvent';

export interface SeatRow {
  /** entrantKey */
  key: string;
  name: string;
}

const SEATS: readonly EntrantSeat[] = ['bot', 'you', 'player'];

export function SeatPicker({
  rows,
  value,
  onChange,
  coach,
  onCoach,
  coachOffered,
  linkNote,
}: {
  rows: readonly SeatRow[];
  value: DraftSeats;
  onChange: (d: DraftSeats) => void;
  /** "Coach during my matches" */
  coach: boolean;
  onCoach: (on: boolean) => void;
  /** the site's coach is on (else the box is not offered) */
  coachOffered: boolean;
  /** a line about the seats a setup link set, if it set any */
  linkNote?: string;
}) {
  const keys = rows.map((r) => r.key);
  const preset = presetOf(keys, value);
  const you = youKey(value, keys);
  const people = keys.filter((k) => seatFor(value, k) !== 'bot').length;
  const youId = useId();
  const hint = preset === 'mixed' ? 'Set entrant by entrant: bots, you and other players in one event.' : SEAT_PRESETS.find((p) => p.key === preset)?.hint;
  return (
    <fieldset className="ev-step">
      <legend>Who plays</legend>
      <div className="seg" role="group" aria-label="Who plays">
        {SEAT_PRESETS.map((p) => (
          <button key={p.key} type="button" className={preset === p.key ? 'on' : ''} aria-pressed={preset === p.key} title={p.hint} onClick={() => onChange(applyPreset(keys, value, p.key))}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {hint}
      </p>
      {linkNote && <p className="small" style={{ margin: 0 }}>{linkNote}</p>}
      {preset !== 'bots' && (
        <>
          <div className="row small">
            <label className="row muted" htmlFor={youId}>
              You play
            </label>
            <select
              id={youId}
              value={you ?? ''}
              onChange={(e) => {
                const k = e.target.value;
                if (k) onChange(setSeat(keys, value, k, 'you'));
                else if (you) onChange(setSeat(keys, value, you, value.seatDefault));
              }}
            >
              <option value="">no entrant (you only organise)</option>
              {rows.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
            {you && coachOffered && (
              <label className="row muted" title="The coach's advice and move grades in your games of this event. The board's own Coach setting is not changed.">
                <input type="checkbox" checked={coach} onChange={(e) => onCoach(e.target.checked)} /> Coach during my matches
              </label>
            )}
          </div>
          <details className="ev-sub" open={preset !== 'play' || undefined}>
            <summary className="small">
              Who runs each entrant ({people} {people === 1 ? 'person' : 'people'}, {rows.length - people} {rows.length - people === 1 ? 'bot' : 'bots'})
            </summary>
            <ul className="ev-seats small">
              {rows.map((r) => (
                <li key={r.key}>
                  <span className="ev-seat-name">{r.name}</span>
                  <select aria-label={`Who runs ${r.name}`} value={seatFor(value, r.key)} onChange={(e) => onChange(setSeat(keys, value, r.key, e.target.value as EntrantSeat))}>
                    {SEATS.map((s) => (
                      <option key={s} value={s}>
                        {SEAT_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </details>
          <p className="muted small" style={{ margin: 0 }}>
            Your matches against a bot are played on the game board here; a match with another player in it is played wherever you like (Play online works well) and
            its result is recorded here. A played event counts toward no rating or deck record.
          </p>
          <p className="small" style={{ margin: 0 }}>
            {ONE_DEVICE_NOTE}
          </p>
        </>
      )}
    </fieldset>
  );
}
