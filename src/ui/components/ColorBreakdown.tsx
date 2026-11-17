// Colour breakdowns (ROADMAP2 §13 goal 2): a deck's own split (deck page, gallery tiles), a field being set up (the
// runner's entrants) and how the colours did in an event (its results and top cut). The numbers come from
// src/lib/colorSplit.ts and, for recorded results, `eventColors` in src/lib/eventFacts.ts; this file only shows them.
// A colour is always its word beside its dot, and a combination is the deck's colour pill ("RRG").
import { COLOR_NAMES, colorCountText, type ColorKey, type DeckColorSplit, type FieldColorSplit } from '../../lib/colorSplit';
import type { ColorRecord, EventColors } from '../../lib/eventFacts';

export function ColorName({ k }: { k: ColorKey }) {
  return (
    <span className="color-name">
      <span className={`dot ${COLOR_NAMES[k]}`} aria-hidden="true" /> {COLOR_NAMES[k]}
    </span>
  );
}

const share = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : '–');

/** "12–8 (60%)": won-lost with the rate over the decided matches; "–" with none. */
const record = (won: number, lost: number) => (won + lost ? `${won}–${lost} (${share(won, won + lost)})` : '–');

/** A deck's own split: Legends and main-deck cards by colour. */
export function DeckColorLine({ split, label = true }: { split: DeckColorSplit; label?: boolean }) {
  return (
    <div className="small color-line">
      {label && <span className="muted">Colours: </span>}
      Legends {colorCountText(split.legends)} · Main deck {colorCountText(split.cards)}
      {split.unknown > 0 && ` (${split.unknown} unknown)`}
    </div>
  );
}

/** A set of decks: how many play each colour and each colour pill. */
export function FieldColors({ split }: { split: FieldColorSplit }) {
  if (!split.decks) return null;
  return (
    <div className="small color-field" aria-label="Colours of the entrants">
      <span className="muted">Colours: </span>
      {split.byColor
        .filter((c) => c.decks > 0)
        .map((c, i) => (
          <span key={c.color}>
            {i > 0 && ' · '}
            <ColorName k={c.color} /> {c.decks}
          </span>
        ))}
      <span className="muted"> (a deck counts once for each colour it plays) · Combinations: </span>
      {split.byCombo.map((c, i) => (
        <span key={c.combo}>
          {i > 0 && ' '}
          <span className="tag">{c.combo}</span> {c.decks}
        </span>
      ))}
    </div>
  );
}

function Cells({ r, entrants, cut }: { r: ColorRecord & { entrants: number; topCut: number }; entrants: number; cut: number }) {
  return (
    <>
      <td className="num">
        {r.entrants} <span className="muted">({share(r.entrants, entrants)})</span>
      </td>
      {cut > 0 && (
        <td className="num">
          {r.topCut} <span className="muted">({share(r.topCut, cut)})</span>
        </td>
      )}
      <td className="num">{record(r.won, r.lost)}</td>
      <td className="num">{record(r.gamesWon, r.gamesLost)}</td>
      <td className="num">{r.mirrors}</td>
    </>
  );
}

function Head({ first, cut }: { first: string; cut: number }) {
  return (
    <thead>
      <tr>
        <th>{first}</th>
        <th className="num">Entrants</th>
        {cut > 0 && <th className="num">Top {cut}</th>}
        <th className="num" title="Matches won–lost against decks without it (byes and mirrors out)">
          Matches
        </th>
        <th className="num" title="Games won–lost in those matches (ties out)">
          Games
        </th>
        <th className="num" title="Matches between two decks that both have it">
          Mirrors
        </th>
      </tr>
    </thead>
  );
}

/** How the colours did in an event: the field and the top cut side by side, then results against the other colours. */
export function EventColorsPanel({ facts }: { facts: EventColors }) {
  if (!facts.entrants) return null;
  const cut = facts.topCut;
  return (
    <div className="color-panel">
      <h3 style={{ marginTop: 0 }}>Colours</h3>
      <p className="small muted">
        {facts.entrants} entrants{cut > 0 ? `, ${cut} in the top cut` : ''}. A deck plays a colour when one of its Legends is that colour, so a two-colour deck counts under
        both. Matches and games are against decks without that colour (or that combination); mirrors are counted apart.
        {facts.noList.length > 0 && ` Not counted (no list in the event file): ${facts.noList.join(', ')}.`}
      </p>
      <div className="scroll-x">
        <table className="color-table">
          <Head first="Colour" cut={cut} />
          <tbody>
            {facts.byColor.map((r) => (
              <tr key={r.color}>
                <td>
                  <ColorName k={r.color} />
                </td>
                <Cells r={r} entrants={facts.entrants} cut={cut} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="scroll-x">
        <table className="color-table">
          <Head first="Combination" cut={cut} />
          <tbody>
            {facts.byCombo.map((r) => (
              <tr key={r.combo}>
                <td>
                  <span className="tag">{r.combo}</span>
                </td>
                <Cells r={r} entrants={facts.entrants} cut={cut} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
