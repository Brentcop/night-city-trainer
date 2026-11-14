// "Your tournaments" outside the deck pages: the runner's line beside the saved runs (what counts toward your deck stats,
// and Clear with a confirmation), and the Power ratings page's separate table "Your decks" (the provisional ratings of
// your lists with no recorded rating). Both follow the ledger through useYourStats and show nothing when the owner has
// turned the feature off. The record and ratings are src/lib/runLedger.ts and src/lib/yourStats.ts.
import { useId, useState } from 'react';
import { RATINGS } from '../../data/index';
import { allDecks } from '../../lib/browserLibrary';
import { listOf, isSavedHere } from '../../lib/listTwin';
import { ordinal, SMALL_SAMPLE } from '../../lib/playedRecord';
import { clearLedger } from '../../lib/runLedger';
import type { Provisional } from '../../lib/yourStats';
import { useLibraryVersion } from '../useLibrary';
import { useYourStats } from '../useYourStats';
import { profileHref } from './DeckStats';
import { Modal } from './Modal';
import { Wr } from './Num';
import { YourTierBadge } from './TierBadges';

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;

/** The words of the runner's line (exported for tests). */
export function yourStatsLineText(s: { runs: number; games: number; hardRuns: number; older: number }): string {
  const counted = s.runs
    ? `Your deck stats count ${plural(s.runs, 'of your tournaments', 'of your tournaments')} (${plural(s.games, 'game')}), in this browser only.`
    : 'Tournaments you finish here count toward your deck stats, in this browser only.';
  const hard = ` Only All Hard runs give a provisional rating comparable with the recorded ones${s.runs ? ` (${s.hardRuns} of yours)` : ''}.`;
  const older = s.older ? ` ${plural(s.older, 'older tournament')} ran on an earlier simulator and ${s.older === 1 ? 'is' : 'are'} left out.` : '';
  return counted + hard + older;
}

/** The confirm dialog's words for clearing your tournament stats (exported for tests). */
export function clearWords(runs: number): { title: string; body: string } {
  return {
    title: 'Clear your tournament stats?',
    body: `The record and provisional ratings from ${plural(runs, 'tournament')} you ran in this browser are removed from your deck tiles and pages. Your saved runs stay, and are not counted again. This cannot be undone.`,
  };
}

/**
 * The runner's one line about your deck stats. `refused`: the last finished run could not be added (storage full or
 * blocked); the run itself is still saved with the runs.
 */
export function YourStatsLine({ refused }: { refused?: boolean }) {
  const s = useYourStats();
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  if (!s) return null;
  const total = s.summary.runs + s.summary.older;
  return (
    <div className="small muted your-stats-line" role="status" aria-live="polite">
      {yourStatsLineText(s.summary)}{' '}
      {refused && <span style={{ color: 'var(--red)' }}>The last tournament could not be added to your deck stats: this browser refused to store more. </span>}
      {failed && <span style={{ color: 'var(--red)' }}>Nothing was cleared: this browser refused the change. </span>}
      {total > 0 && (
        <button type="button" className="ghost small" onClick={() => setAsking(true)}>
          Clear your tournament stats
        </button>
      )}
      {asking && (
        <Modal labelledBy={id} onClose={() => setAsking(false)} className="confirm-dialog">
          <h3 id={id} style={{ marginTop: 0 }}>
            {clearWords(total).title}
          </h3>
          <p className="muted">{clearWords(total).body}</p>
          <div className="row confirm-actions">
            <button
              className="danger"
              onClick={() => {
                setFailed(!clearLedger());
                setAsking(false);
              }}
            >
              Clear
            </button>
            {/* the safe choice takes focus when the dialog opens */}
            <button onClick={() => setAsking(false)} data-autofocus>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Your unrated lists with a provisional rating, best first, with the name and link of the deck saved here with that list. */
function yourRows(prov: ReadonlyMap<string, Provisional>, names: ReadonlyMap<string, string>) {
  const saved = new Map(allDecks().filter(isSavedHere).map((d) => [listOf(d.deck), d] as const));
  return [...prov.values()]
    .sort((a, b) => b.wr - a.wr || a.list.localeCompare(b.list))
    .map((p) => {
      const d = saved.get(p.list);
      return { p, name: d?.deck.name ?? names.get(p.list) ?? p.list, href: d ? profileHref(d.file) : undefined };
    });
}

/** The Power ratings page's "Your decks": a table of its own, never mixed into the recorded one. */
export function YourDecks() {
  useLibraryVersion();
  const s = useYourStats();
  if (!s || !s.summary.runs) return null;
  const head = (
    <h2 style={{ margin: 0 }} id="your-decks">
      Your decks
    </h2>
  );
  const intro = (
    <p className="small muted" style={{ margin: '4px 0 0' }}>
      Provisional ratings for your lists with no recorded rating, from the tournaments you ran in this browser with All Hard bots ({plural(s.summary.hardGames, 'game')}). Each
      is fitted against the recorded decks above, held as they are, and is kept apart from them: none of it enters the recorded table.
      {s.summary.older > 0 && ` ${plural(s.summary.older, 'older tournament')} of yours ran on an earlier simulator and ${s.summary.older === 1 ? 'is' : 'are'} left out.`}
    </p>
  );
  if (!s.summary.hardRuns)
    return (
      <section className="panel" aria-labelledby="your-decks">
        {head}
        {intro}
        <p className="small muted">None yet: only tournaments run with All Hard bots give a provisional rating.</p>
      </section>
    );
  if (!s.provisional)
    return (
      <section className="panel" aria-labelledby="your-decks">
        {head}
        {intro}
        <p className="small muted">Working out your provisional ratings…</p>
      </section>
    );
  const names = new Map([...s.records.values()].map((r) => [r.list, r.name]));
  const rows = yourRows(s.provisional, names);
  return (
    <section className="panel scroll-x" aria-labelledby="your-decks">
      {head}
      {intro}
      {!rows.length ? (
        <p className="small muted">None yet: only tournaments run with All Hard bots, with a list that has no recorded rating, give one.</p>
      ) : (
        <table className="small ratings your-ratings">
          <thead>
            <tr>
              <th title="Your provisional tier by the Sim tier rule, from your tournaments in this browser">Provisional tier</th>
              <th>Deck</th>
              <th style={{ minWidth: 200 }}>Expected win % vs the recorded field (90% range)</th>
              <th title="Where its expected win rate would place it among the recorded decks">Would place</th>
              <th title="Games with All Hard bots in your tournaments: the ones the rating reads">Games</th>
              <th title="Every game of this list in your tournaments, all bots: wins–losses(–ties)">Your record</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, name, href }) => {
              const rec = s.records.get(p.list);
              return (
                <tr key={p.list}>
                  <td>
                    <YourTierBadge tier={p.tier} showUnrated />
                  </td>
                  <td>
                    {href ? <a href={href}>{name}</a> : name}
                    {!href && <span className="muted"> (not saved in this browser)</span>}
                  </td>
                  <td>
                    <Wr v={p.wr} n={p.games} digits={1} strong /> ({pct1(p.lo)}–{pct1(p.hi)})
                    {!p.connected && <div className="muted">never met a recorded deck: only the prior places it</div>}
                  </td>
                  <td>
                    {ordinal(p.place)} of {p.of}
                  </td>
                  <td>
                    {p.games}
                    {p.games < SMALL_SAMPLE ? <span className="muted"> (small sample)</span> : null}
                  </td>
                  <td>{rec ? `${rec.wins}–${rec.losses}${rec.ties ? `–${rec.ties}` : ''}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        The ranges leave out the recorded decks' own uncertainty. Checked on the recorded events (a recorded deck rated from one event's games, against the rest), they held its
        rating from all its other games about nine times in ten. Places are among the {RATINGS.decks.length} recorded decks.
      </p>
    </section>
  );
}
