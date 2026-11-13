// Deck Lab evidence controls and results (ROADMAP2 §1 step 5; docs/SYNERGIES.md "When a deck change is adopted"):
// the "Search depth" fieldset with the game estimate, the outcome chip (adopted / rejected / could not tell) and the
// held-out paired gain of each nominee. The rule is in src/lib/evidence.ts, the depth and estimate in src/lib/deckSearch.ts.
import { useId, type ReactNode } from 'react';
import { futilityApplies, outcomeWord, stoppedWords, type AdoptionRule, type NomineeRecord, type Outcome, type StopReason } from '../../lib/evidence';
import { MAX_CARDS_PER_CHANGE, MAX_PACKAGES_PER_CHANGE } from '../../lib/deckSearch';
import { finalVsOriginal, trajectoryLine, tuneSummaryText, vsOriginalVerdict, type CutExplained, type TuneLog } from '../../lib/deckLab';
import { cutTableRows } from '../../lib/cutRanking';
import { Signed, Wr, type Tone } from './Num';
import { CardMention, MentionText } from './CardMention';

const toneOf = (o: Outcome): Tone => (o === 'adopt' ? 'pos' : o === 'reject' ? 'neg' : 'neu');

/**
 * adopted / rejected / could not tell, as a verdict chip; a nominee stopped early says why: "(stopped)" by Stop,
 * "(stopped early: no gain after 448 games)" by the futility stop (`games` = its held-out games).
 */
export function OutcomeChip({ outcome, stopped, games = 0, futilityMaxGainPp = 0 }: { outcome: Outcome; stopped?: StopReason | boolean; games?: number; futilityMaxGainPp?: number }) {
  const why = stoppedWords(stopped, games, futilityMaxGainPp);
  const title =
    stopped === 'futility'
      ? `No gain worth testing further after ${games} fresh paired games, so it stopped early instead of running to the cap: not adopted`
      : stopped
        ? 'Stopped before it was decided; not adopted'
        : outcome === 'inconclusive'
          ? 'The interval still straddles the bar at the cap: not adopted'
          : undefined;
  return (
    <span className={`verdict ${toneOf(outcome)}`} title={title}>
      {outcomeWord(outcome)}
      {why ? ` (${why})` : ''}
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
export function NomineeTable({ nominees, minGames, futilityMaxGainPp = 0, label }: { nominees: readonly NomineeRecord[]; minGames: number; futilityMaxGainPp?: number; label?: (text: string) => ReactNode }) {
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
            <td>{n.outcome ? <OutcomeChip outcome={n.outcome} stopped={n.stopped} games={n.heldOut?.games} futilityMaxGainPp={futilityMaxGainPp} /> : <span className="muted">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The rule in one plain sentence for the Lab. */
export function ruleSentence(rule: AdoptionRule, firstStage: number): string {
  if (rule.kind === 'any-gain') return `A change is adopted when it scores higher than the list on ${firstStage} fresh games (the old rule).`;
  return `A change is adopted only when, on fresh games paired with the list (${firstStage} at a time, up to ${firstStage * rule.capStages}), its gain is clearly above ${rule.minGainPp} point${rule.minGainPp === 1 ? '' : 's'} with at least ${rule.minGames} games; if it is clearly below, it is rejected; otherwise the lab says it could not tell and keeps the list.${
    futilityApplies(rule, rule.futilityAfterStages, rule.capStages)
      ? ` A change that shows ${rule.futilityMaxGainPp === 0 ? 'no gain' : `a gain of at most ${rule.futilityMaxGainPp} point${rule.futilityMaxGainPp === 1 ? '' : 's'}`} after ${firstStage * rule.futilityAfterStages} games stops early (could not tell).`
      : ''
  }`;
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
  vsOriginal,
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
  /** games the vs-original comparison may add (included in `estimate.max`) and its block size per list */
  vsOriginal?: { max: number; games: number };
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
        {vsOriginal && vsOriginal.max > 0 && ` That includes up to ${vsOriginal.max.toLocaleString('en-US')} games comparing the tuned list with your original on the same ${vsOriginal.games} held-out games each (only after a change is adopted).`}
        {over && ` ⚠ That is over the lab's budget of ${budget.toLocaleString('en-US')} games; you'll be asked to confirm.`}
      </p>
    </fieldset>
  );
}

/**
 * The headline: the current list against the ORIGINAL list on the same held-out games, after every generation, and the
 * result in one sentence once the run is over. Screening and per-generation numbers stay in the generations below.
 */
export function TuneTrajectory({ logs, minGainPp, games, finished, partial }: { logs: readonly TuneLog[]; minGainPp: number; games: number; finished: boolean; partial?: boolean }) {
  const lines = logs.map((l) => trajectoryLine(l, minGainPp)).filter(Boolean);
  const v = finalVsOriginal(logs);
  const verdict = vsOriginalVerdict(v, minGainPp);
  const tone: Tone = verdict === 'better' ? 'pos' : verdict === 'worse' ? 'neg' : 'neu';
  return (
    <section className="lab-trajectory" aria-label="Tuned list against your original list">
      <div className="zone-label">Your list against the original</div>
      <p className="small muted" style={{ margin: 0 }}>
        After each generation that adopts a change, the current list and your original list play the same {games} held-out games (games no screening or confirmation used), and the paired difference is shown with its 95% interval. This is the
        number to read; the screening win rates below only nominate changes.
      </p>
      {lines.length > 0 ? (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {lines.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          Nothing yet: the first generation is still running.
        </p>
      )}
      {(finished || partial) && logs.length > 0 && (
        <p className="small" role="status" style={{ margin: 0 }}>
          {verdict && verdict !== 'unchanged' && <span className={`verdict ${tone}`}>{verdict === 'better' ? 'better' : verdict === 'worse' ? 'worse' : 'not shown better'}</span>} {tuneSummaryText(logs, { minGainPp, partial })}
        </p>
      )}
    </section>
  );
}

const pts1 = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;

/** Why each card was or was not offered as a cut (partner-aware runs): both scores, the package and the odds. */
export function CutTable({ cuts, label }: { cuts: readonly CutExplained[]; label?: (id: string, name: string) => ReactNode }) {
  const rows = cutTableRows(cuts);
  if (!rows.length) return null;
  return (
    <details className="small">
      <summary>Why these cuts (partner-aware ranking)</summary>
      <table className="small">
        <thead>
          <tr>
            <th>Card</th>
            <th title="Win rate when drawn minus when not drawn, this generation's games">Plain</th>
            <th title="Judged by its games with a partner piece, plus what cutting it costs the package's assembly odds">Partner-aware score</th>
            <th>Cut?</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{label ? label(r.id, r.name) : <CardMention id={r.id}>{r.name}</CardMention>}</td>
              <td className="num">{pts1(r.plain)}</td>
              <td className="num">{pts1(r.score)}</td>
              <td>{r.offered ? 'offered' : 'no'}</td>
              <td className="muted">
                <MentionText text={r.why} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
