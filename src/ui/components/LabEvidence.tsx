// Deck Lab evidence controls and results (ROADMAP2 §1 step 5; docs/SYNERGIES.md "When a deck change is adopted"):
// the "Search depth" fieldset with the game estimate, the outcome chip (adopted / rejected / could not tell) and the
// held-out paired gain of each nominee. The rule is in src/lib/evidence.ts, the depth and estimate in src/lib/deckSearch.ts.
// With earlier held-out games (the change ledger), a pooled nominee's gain keeps its usual figure and gets a note under
// it (pooledNoteWords: how many games came from earlier runs, and the stricter z), and a change its earlier games already
// reject gets its own line (NotNominatedList, worded by pooledGainWords). With the shortlist (src/lib/shortlist.ts, on
// with earlier held-out games) a generation also says which changes were tested again and which were skipped
// (ShortlistNotes), and a change its earlier held-out games put out of reach gets its own "Not nominated" line.
// "Until settled" (TuneOptions.untilSettled): SettleCheckbox in the setup, what it may add beside the game estimate and
// what the run can detect (DepthControls), and a wrapping note under a nominee's held-out gain (SettleNote) saying how
// many further stages it played and why it stopped.
import { useId, type ReactNode } from 'react';
import { formatGain, futilityApplies, outcomeWord, pooledGainWords, pooledNoteWords, settleWords, stoppedWords, type AdoptionRule, type NomineeRecord, type Outcome, type SettleRecord, type StopReason } from '../../lib/evidence';
import { MAX_CARDS_PER_CHANGE, MAX_PACKAGES_PER_CHANGE } from '../../lib/deckSearch';
import { finalVsOriginal, trajectoryLine, tuneSummaryText, vsOriginalVerdict, type CutExplained, type NotNominated, type TuneLog } from '../../lib/deckLab';
import { cutTableRows } from '../../lib/cutRanking';
import { pooledWords, SHORTLIST_DEFAULTS, skippedWords, type ShortlistNote } from '../../lib/shortlist';
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
              {n.heldOut?.priorGames ? (
                <>
                  <PairedGain g={n.heldOut} floor={minGames} />{' '}
                  <span className="muted">
                    (<Wr v={n.heldOut.baseWr} n={n.heldOut.games} /> → <Wr v={n.heldOut.candWr} n={n.heldOut.games} />)
                  </span>
                  {/* the note wraps: a figure and a sentence in one unbreakable span made the table wider than the page */}
                  <div className="small muted" title="Held-out games kept in this browser from earlier runs, pooled with this run's">
                    {pooledNoteWords({ heldOut: n.heldOut, looks: n.heldOut.looks, priorGames: n.heldOut.priorGames })}
                  </div>
                </>
              ) : n.heldOut ? (
                <>
                  <PairedGain g={n.heldOut} floor={minGames} />{' '}
                  <span className="muted">
                    (<Wr v={n.heldOut.baseWr} n={n.heldOut.games} /> → <Wr v={n.heldOut.candWr} n={n.heldOut.games} />)
                  </span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
              {n.settle && <SettleNote settle={n.settle} games={n.heldOut?.games ?? 0} />}
            </td>
            <td>{n.outcome ? <OutcomeChip outcome={n.outcome} stopped={n.stopped} games={n.heldOut?.games} futilityMaxGainPp={futilityMaxGainPp} /> : <span className="muted">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** What "until settled" did, as a sentence: "Confirmed until settled: 6 more stages." */
export function settleNoteText(settle: Pick<SettleRecord, 'stages' | 'ended' | 'toSettle' | 'reach'>, games: number): string {
  const w = settleWords(settle, games);
  return `${w.charAt(0).toUpperCase()}${w.slice(1)}.`;
}

/** The "until settled" note under a held-out gain; it wraps, like the pooled note (a long unbreakable span widened the table). */
export function SettleNote({ settle, games }: { settle: Pick<SettleRecord, 'stages' | 'ended' | 'toSettle' | 'reach'>; games: number }) {
  return (
    <div className="small muted" title="Keep confirming until settled: after the usual stages a still undecided change was tested on more fresh games, all its held-out games judged together">
      {settleNoteText(settle, games)}
    </div>
  );
}

/** The sentence beside the "Keep confirming until settled" checkbox. */
export function settleSentence(reach: number): string {
  return `a change still undecided after the usual stages is tested on more fresh games, a stage at a time, until all its held-out games together adopt or reject it, until it would need more than ${reach.toLocaleString('en-US')} of them, or until this generation's games for it run out (the rest can be settled in a later run).`;
}

/** The tuner's "Keep confirming until settled" checkbox, with its one sentence (independent of "Use earlier held-out games"). */
export function SettleCheckbox({ checked, onChange, disabled, reach }: { checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; reach: number }) {
  return (
    <label className="row small">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span>
        <b>Keep confirming until settled</b> (on by default): {settleSentence(reach)}
      </span>
    </label>
  );
}

/** "Not nominated: X (screening …): its earlier held-out games already reject it, …" (the forge's log line, in the Lab). */
export function notNominatedText(x: NotNominated): string {
  if (x.why === 'out-of-reach') {
    const need = x.toSettle !== undefined ? `it would need about ${x.toSettle.toLocaleString('en-US')} held-out games in all to be adopted` : 'its held-out gain is not above the bar';
    return `Not nominated: ${x.label} (screening ${formatGain(x.screen)}): its ${x.priorGames.toLocaleString('en-US')} earlier held-out games show ${pooledWords(x.heldOut.mean, x.priorGames)}, and at that gain ${need}${x.reach !== undefined ? `, more than the ${x.reach.toLocaleString('en-US')} a change is given` : ''}.`;
  }
  return `Not nominated: ${x.label} (screening ${formatGain(x.screen)}): its earlier held-out games already reject it, ${pooledGainWords({ heldOut: x.heldOut, looks: 0, priorGames: x.priorGames })}.`;
}

/**
 * The shortlist of a generation in plain words: the changes tested again because earlier runs found them promising, and
 * the generator's picks skipped because earlier games say they are not worth it (src/lib/shortlist.ts).
 */
export function shortlistLines(note: ShortlistNote, o: { nominateBar: number; dropSe?: number; reach?: number; cands?: number }): string[] {
  const w = { nominateBar: o.nominateBar, dropSe: o.dropSe ?? SHORTLIST_DEFAULTS.dropSe, reach: o.reach ?? SHORTLIST_DEFAULTS.reach };
  return [
    ...note.carried.map((c) => `Tested again from earlier runs: ${c.label}, ${pooledWords(c.gain, c.games, c.heldout)} so far.`),
    ...note.skipped.map((s) => (s.why === 'carried' ? `${s.label} was already being tested again.` : `Skipped ${s.label}: ${skippedWords(s, w)}.`)),
    ...(note.short ? [`The list offered fewer new changes than asked for, so ${note.short} fewer ${note.short === 1 ? 'was' : 'were'} tested${o.cands ? ` (${o.cands - note.short} of ${o.cands})` : ''}.`] : []),
  ];
}

/** The generation's shortlist lines (nothing when nothing was carried or skipped). */
export function ShortlistNotes({ note, nominateBar, cands }: { note: ShortlistNote | undefined; nominateBar: number; cands?: number }) {
  const lines = note ? shortlistLines(note, { nominateBar, cands }) : [];
  if (!lines.length) return null;
  return (
    <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }} aria-label="Changes tested again or skipped because of earlier runs">
      {lines.map((t) => (
        <li key={t}>
          <MentionText text={t} />
        </li>
      ))}
    </ul>
  );
}

/** The changes a generation did not nominate because their earlier held-out games already reject them. */
export function NotNominatedList({ items }: { items: readonly NotNominated[] | undefined }) {
  if (!items?.length) return null;
  return (
    <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }} aria-label="Not nominated because of earlier held-out games">
      {items.map((x) => (
        <li key={x.label}>
          <MentionText text={notNominatedText(x)} />
        </li>
      ))}
    </ul>
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
  settle,
  detect,
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
  /** "until settled" is on: what it may add at most (never part of `estimate` or the budget question) */
  settle?: { extra: number; reach: number } | null;
  /** what this run can detect, in one sentence (detectWords) */
  detect?: string;
}) {
  const headId = useId();
  // the budget question counts the usual range only; "until settled" is said apart
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
      {settle && settle.extra > 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          Apart from that, keeping confirmations going until settled may add up to {settle.extra.toLocaleString('en-US')} games (only for a change still undecided after the usual stages).
        </p>
      )}
      {detect && (
        <p className="small muted" style={{ margin: 0 }}>
          {detect}
        </p>
      )}
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
