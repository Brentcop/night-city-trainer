// A Game review rating (src/lib/gameReview.ts) as a mark and a word: the colour is never the only cue. Shared by the
// Game review and the play-out details tab (ReviewPanel), so both name a move the same way.
import { RATING_INFO, type Rating } from '../../lib/gameReview';

export function RatingPill({ r, n }: { r: Rating; n?: number }) {
  const info = RATING_INFO[r];
  return (
    <span className={`gr-pill gr-${info.tone}`} title={info.means}>
      <span className="gr-mark" aria-hidden="true">
        {info.mark}
      </span>
      {info.label}
      {n !== undefined && <b> {n}</b>}
    </span>
  );
}
