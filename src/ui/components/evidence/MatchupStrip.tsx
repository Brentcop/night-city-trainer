// The matchup strip of a deck's evidence page: one cell per opponent, worst first. Each cell is a button named by the
// opponent, the expected win rate and the strength word (matchupCellWords), and opens that pairing's row. Which side of
// even a range sits on is drawn as an edge and written as the number, never by colour alone. On a desktop the strip is
// whole; under 720 px it opens with the 6 worst and the 6 best (stripMiddle) and a "Show all" button (evidence.css).
import { formatValue } from '../../../lib/findings';
import { DECK_PAGE_WORDS, matchupCellWords, STRENGTH_WORDS } from '../../../lib/findingWords';
import { emphasised, stripMiddle, type Pairing } from '../../../lib/evidenceView';
import { CURRENT_SIM_VERSION } from '../../../lib/playedRecord';

export function MatchupStrip({ pairings, onOpen, all, onToggle }: { pairings: readonly Pairing[]; onOpen: (short: string) => void; all: boolean; onToggle: () => void }) {
  const n = pairings.length;
  const cut = pairings.some((_, i) => stripMiddle(i, n));
  return (
    <>
      <ul className={`ev-strip${all ? ' is-all' : ''}`} id="ev-strip" aria-label="Matchups, worst first">
        {pairings.map((p, i) => {
          const f = p.rated;
          const side = f.lower > f.baseline ? 'is-above' : f.upper < f.baseline ? 'is-below' : 'is-even';
          const em = emphasised(f, CURRENT_SIM_VERSION);
          return (
            <li key={f.id} className={stripMiddle(i, n) ? 'ev-cell-mid' : undefined}>
              <button type="button" className={`ev-cell ${side} ev-cs-${f.strength}`} aria-label={matchupCellWords(p.opp.deck, f)} onClick={() => onOpen(f.short)}>
                <span className="ev-cell-name">{p.opp.deck}</span>
                {f.strength === 'not-enough' && <span className="ev-cell-word">{STRENGTH_WORDS[f.strength]}</span>}
                <span className={`ev-cell-val${em ? ' is-em' : ''}`}>{formatValue(f.estimate, 'rate')}</span>
                {f.strength !== 'not-enough' && <span className="ev-cell-word">{STRENGTH_WORDS[f.strength]}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {cut && (
        <button type="button" className="ghost small ev-strip-more" aria-expanded={all} aria-controls="ev-strip" onClick={onToggle}>
          {all ? DECK_PAGE_WORDS.stripFewer : DECK_PAGE_WORDS.showAll(n, 'opponents')}
        </button>
      )}
    </>
  );
}
