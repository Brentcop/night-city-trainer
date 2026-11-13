// Open a game exported from Play (⤓ Export game, src/lib/coachedReplay.ts) for its Game review: the file carries the
// replay and the coach's grades from play, so the review keeps them exactly as with your own recorded games.
import { useId, useRef, useState } from 'react';
import { parseCoachedReplay, type CoachedReplay } from '../../lib/coachedReplay';
import { coachRatingsFrom } from '../../lib/gameReview';
import type { GameReviewSource } from './GameReview';

/** The review source of an exported game (not kept: it is not one of this browser's recorded games). */
export function coachedReviewSource(c: CoachedReplay): GameReviewSource {
  return { replay: c.replay, coach: coachRatingsFrom(c.decisions, c.replay.choices.length, c.gigSwing), persist: false };
}

/** "Open a game file…": reads an exported game and hands it over, or says why the file is not one. */
export function OpenGameFile({ onOpen }: { onOpen: (c: CoachedReplay, fileName: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [why, setWhy] = useState<string | null>(null);
  return (
    <span className="gr-open">
      <button type="button" className="ghost" onClick={() => input.current?.click()} aria-describedby={why ? `${id}-why` : undefined}>
        Open a game file…
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Game file exported from Play"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          f.text().then(
            (text) => {
              const r = parseCoachedReplay(text);
              if (!r.ok) return setWhy(`${f.name} is not a game file from Play: ${r.why}.`);
              setWhy(null);
              onOpen(r.value, f.name);
            },
            () => setWhy(`${f.name} could not be read.`),
          );
        }}
      />
      {why && (
        <span id={`${id}-why`} className="small" role="alert" style={{ color: 'var(--red)' }}>
          {why}
        </span>
      )}
    </span>
  );
}
