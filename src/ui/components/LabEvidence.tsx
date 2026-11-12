// Deck Lab evidence controls and results (ROADMAP2 §1 step 5; docs/SYNERGIES.md "When a deck change is adopted"):
// the "Search depth" fieldset with the game estimate, the outcome chip (adopted / rejected / could not tell) and the
// held-out paired gain of each nominee. The rule is in src/lib/evidence.ts, the depth and estimate in src/lib/deckSearch.ts.
import { useId, type ReactNode } from 'react';
import { outcomeWord, type AdoptionRule, type NomineeRecord, type Outcome } from '../../lib/evidence';
import { MAX_CARDS_PER_CHANGE, MAX_PACKAGES_PER_CHANGE } from '../../lib/deckSearch';
import { Signed, Wr, type Tone } from './Num';

const toneOf = (o: Outcome): Tone => (o === 'adopt' ? 'pos' : o === 'reject' ? 'neg' : 'neu');

/** adopted / rejected / could not tell, as a verdict chip. */
export function OutcomeChip({ outcome, stopped }: { outcome: Outcome; stopped?: boolean }) {
  return (
    <span className={`verdict ${toneOf(outcome)}`} title={stopped ? 'Stopped before it was decided; not adopted' : outcome === 'inconclusive' ? 'The interval still straddles the bar at the cap: not adopted' : undefined}>
      {outcomeWord(outcome)}
      {stopped ? ' (stopped)' : ''}
    </span>
  );
}

const pt = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;

/**
 * A paired gain with its interval and games: "+4.8 pts [+0.2, +9.4] · 560 games". Samples under `floor` games are
 * dimmed and say so on hover, like small samples elsewhere on the site.
 */
export function PairedGain({ g, floor = 0 }: { g: { mean: number; lower: number; upper: number; games: number }; floor?: number }) {
  const small = g.games < Math.max(20, floor);
  return (
    <span className={`num${small ? ' thin' : ''}`} title={`Paired gain over ${g.games} games${small ? ' (small sample)' : ''}`}>
      <Signed v={g.mean} unit=" pts" />{' '}
      <span className="muted">
        [{pt(g.lower)}, {pt(g.upper)}] · {g.games} games
      </span>
    </span>
  );
}

/** Each nominee of a generation: screening gain (shared games), held-out paired gain (fresh games) and the outcome. */
export function NomineeTable({ nominees, minGames, label }: { nominees: readonly NomineeRecord[]; minGames: number; label?: (text: string) => ReactNode }) {
  if (!nominees.length) return null;
  return (
    <table className="small">
      <thead>
        <tr>
          <th>Nominee</th>
          <th title="On the baseline's own games: it only nominates">Screening</th>
          <th title="Fresh games the screening never used, paired with the current list">Held-out paired gain</th>
          <th>Outcome</th>
        </tr>
      </thead>
      <tbody>
        {nominees.map((n) => (
          <tr key={n.label}>
            <td>{label ? label(n.label) : n.label}</td>
            <td>
              <PairedGain g={n.screen} />
            </td>
            <td>
              {n.heldOut ? (
                <>
                  <PairedGain g={n.heldOut} floor={minGames} />{' '}
                  <span className="muted">
                    (<Wr v={n.heldOut.baseWr} n={n.heldOut.games} /> → <Wr v={n.heldOut.candWr} n={n.heldOut.games} />)
                  </span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </td>
            <td>{n.outcome ? <OutcomeChip outcome={n.outcome} stopped={n.stopped} /> : <span className="muted">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The rule in one plain sentence for the Lab. */
export function ruleSentence(rule: AdoptionRule, firstStage: number): string {
  if (rule.kind === 'any-gain') return `A change is adopted when it scores higher than the list on ${firstStage} fresh games (the old rule).`;
  return `A change is adopted only when, on fresh games paired with the list (${firstStage} at a time, up to ${firstStage * rule.capStages}), its gain is clearly above ${rule.minGainPp} point${rule.minGainPp === 1 ? '' : 's'} with at least ${rule.minGames} games; if it is clearly below, it is rejected; otherwise the lab says it could not tell and keeps the list.`;
}

/** Tune tab: search depth (cards and packages per change) with the run's game estimate. */
export function DepthControls({
  cards,
  onCards,
  packages,
  onPackages,
  packagesOn,
  estimate,
  budget,
  rule,
  firstStage,
  disabled,
}: {
  cards: number;
  onCards: (n: number) => void;
  packages: number;
  onPackages: (n: number) => void;
  /** package moves are on (packages per change only matters then) */
  packagesOn: boolean;
  estimate: { min: number; max: number };
  budget: number;
  rule: AdoptionRule;
  firstStage: number;
  disabled?: boolean;
}) {
  const headId = useId();
  const over = estimate.max > budget;
  return (
    <fieldset className="lab-synergies" aria-describedby={headId} disabled={disabled}>
      <legend>Search depth</legend>
      <p id={headId} className="muted small" style={{ margin: 0 }}>
        {ruleSentence(rule, firstStage)} Deeper searches also try the best screened changes together, which costs more games.
      </p>
      <div className="row small">
        <label className="row muted">
          Cards per change
          <select value={cards} onChange={(e) => onCards(+e.target.value)}>
            {Array.from({ length: MAX_CARDS_PER_CHANGE }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? '1 (one swap)' : `up to ${n}`}
              </option>
            ))}
          </select>
        </label>
        <label className="row muted" title={packagesOn ? undefined : 'Turn package moves on to combine them'}>
          Packages per change
          <select value={packages} onChange={(e) => onPackages(+e.target.value)} disabled={!packagesOn}>
            {Array.from({ length: MAX_PACKAGES_PER_CHANGE }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? '1' : `up to ${n}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="small" role="status" style={{ margin: 0, color: over ? 'var(--red)' : undefined }}>
        This run plays {estimate.min.toLocaleString('en-US')}–{estimate.max.toLocaleString('en-US')} games.
        {over && ` ⚠ That is over the lab's budget of ${budget.toLocaleString('en-US')} games; you'll be asked to confirm.`}
      </p>
    </fieldset>
  );
}
