// The profile's building blocks, shared by the player's own pages (#/profile/...), the share preview and the read-only
// viewer of someone else's shared profile (#/u/<payload>): the picture, its picker, the sub-page tabs, the headline
// numbers, the history and deck-stats tables and the deck lists. Everything a shared profile carries is rendered as
// text only (React escapes it); nothing from it is ever used as a URL, HTML or a style.
import { useId, useMemo, useRef, useState } from 'react';
import { CARDS, CARD_BY_ID } from '../../engine/cards';
import { artEnabled, useArt } from '../art';
import { Modal } from './Modal';
import { Wr } from './Num';
import { formatRecorded } from './RecordedAt';
import { ColorPips } from './DeckIdentity';
import { BOT_TIER_LABEL, DECK_SORT_LABEL, MY_DECK_GROUPS, MY_DECK_LABEL, smallSample, sortDeckStats, winRate, wldText, type DeckSortKey, type WLD } from '../../lib/profileStats';
import type { SharedDeck, SharedDeckStat, SharedHistoryGame, SharedProfile } from '../../lib/profileShare';
import { SMALL_SAMPLE } from '../../lib/playedRecord';

/** Two letters from a card's name ("Alt Cunningham" → "AC"). */
export const initials = (name: string) =>
  name
    .split(/[\s:-]+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/**
 * The profile picture: the card's artwork cropped to a circle (art on and loaded), else a tile in the card's colour with
 * its initials. No card: a plain tile.
 */
export function Avatar({ cardId, size = 72, label }: { cardId: string | null | undefined; size?: number; label?: string }) {
  const def = cardId ? CARD_BY_ID[cardId] : undefined;
  const { url, onError } = useArt(def?.id);
  const [broken, setBroken] = useState(false);
  const showArt = !!def && artEnabled() && !!url && !broken;
  return (
    <span
      className={`avatar ${def ? def.color : 'is-none'}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      role="img"
      aria-label={label ?? (def ? `Profile picture: ${def.displayName}` : 'No profile picture')}
    >
      {showArt ? (
        <img
          src={url}
          alt=""
          draggable={false}
          onError={() => {
            setBroken(true);
            onError();
          }}
        />
      ) : (
        <span aria-hidden="true">{def ? initials(def.name) : '◌'}</span>
      )}
    </span>
  );
}

/** Pick the card whose art is the profile picture (or none). */
export function PicturePicker({ current, onPick, onClose }: { current: string | null; onPick: (id: string | null) => void; onClose: () => void }) {
  const id = useId();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CARDS.filter((c) => !s || c.displayName.toLowerCase().includes(s) || c.color.toLowerCase() === s || c.type.toLowerCase() === s).sort(
      (a, b) => (a.type === 'Legend' ? 0 : 1) - (b.type === 'Legend' ? 0 : 1) || a.displayName.localeCompare(b.displayName),
    );
  }, [q]);
  return (
    <Modal labelledBy={id} onClose={onClose} className="pic-picker">
      <h3 id={id} style={{ marginTop: 0 }}>
        Choose a profile picture
      </h3>
      <p className="small muted">
        Any card's art, cropped to a circle. With card art off (or while it can't load) the picture shows the card's colour and initials instead. Only
        the card's name is saved, never the image.
      </p>
      <input type="search" aria-label="Search cards" placeholder="Search by name, colour or type" value={q} onChange={(e) => setQ(e.target.value)} data-autofocus />
      <div className="pic-grid" role="list">
        <div role="listitem">
          <button type="button" className={`pic-opt ${current === null ? 'is-on' : ''}`} aria-pressed={current === null} onClick={() => onPick(null)}>
            <Avatar cardId={null} size={56} label="" />
            <span className="small">No picture</span>
          </button>
        </div>
        {list.map((c) => (
          <div role="listitem" key={c.id}>
            <button type="button" className={`pic-opt ${current === c.id ? 'is-on' : ''}`} aria-pressed={current === c.id} onClick={() => onPick(c.id)} title={c.displayName}>
              <Avatar cardId={c.id} size={56} label="" />
              <span className="small">{c.displayName}</span>
            </button>
          </div>
        ))}
      </div>
      {!list.length && <p className="muted small">No card matches “{q}”.</p>}
    </Modal>
  );
}

export interface TabDef {
  key: string;
  label: string;
}

/**
 * Sub-page tabs (WAI-ARIA tabs with automatic activation): arrow keys, Home and End move between them; each is also a
 * deep link. `onSelect` changes the route; the panel is the caller's `role="tabpanel"` with id `${idBase}-panel`.
 */
export function Tabs({ tabs, active, onSelect, idBase, label }: { tabs: readonly TabDef[]; active: string; onSelect: (key: string) => void; idBase: string; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = Math.max(0, tabs.findIndex((t) => t.key === active));
  const go = (i: number) => {
    const n = (i + tabs.length) % tabs.length;
    refs.current[n]?.focus();
    onSelect(tabs[n]!.key);
  };
  return (
    <div className="profile-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.key}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`${idBase}-tab-${t.key}`}
          aria-selected={i === at}
          aria-controls={`${idBase}-panel`}
          tabIndex={i === at ? 0 : -1}
          className={i === at ? 'is-on' : ''}
          onClick={() => onSelect(t.key)}
          onKeyDown={(e) => {
            const k = e.key;
            if (k === 'ArrowRight' || k === 'ArrowDown') go(i + 1);
            else if (k === 'ArrowLeft' || k === 'ArrowUp') go(i - 1);
            else if (k === 'Home') go(0);
            else if (k === 'End') go(tabs.length - 1);
            else return;
            e.preventDefault();
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const pctText = (r: WLD) => {
  const v = winRate(r);
  return v === null ? '—' : `${Math.round(v * 100)}%`;
};
const resultText = (r: SharedHistoryGame['result'], conceded: boolean) => (r === 'win' ? 'Win' : r === 'loss' ? (conceded ? 'Loss (conceded)' : 'Loss') : 'Draw');
const streakText = (s: NonNullable<SharedProfile['headline']>['streak']) => (s ? `${s.n} ${s.result === 'win' ? (s.n === 1 ? 'win' : 'wins') : s.result === 'loss' ? (s.n === 1 ? 'loss' : 'losses') : s.n === 1 ? 'draw' : 'draws'}` : '—');
const smallNote = (n: number) => (smallSample(n) ? ` (small sample: under ${SMALL_SAMPLE} games)` : '');

/** Games, win rate, record by bot tier, streaks and the coach average. */
export function HeadlineTiles({ h }: { h: NonNullable<SharedProfile['headline']> }) {
  const r = h.record;
  return (
    <div>
      <div className="profile-tiles">
        <div className="profile-tile">
          <span className="profile-tile-k">Games played</span>
          <span className="profile-tile-v">{r.games}</span>
          <span className="small muted">{h.conceded ? `${h.conceded} conceded` : ' '}</span>
        </div>
        <div className="profile-tile">
          <span className="profile-tile-k">Win rate</span>
          <span className="profile-tile-v">
            <Wr v={winRate(r)} n={r.games} />
          </span>
          <span className="small muted">
            {wldText(r)}
            {smallSample(r.games) && r.games > 0 ? ' · small sample' : ''}
          </span>
        </div>
        <div className="profile-tile">
          <span className="profile-tile-k">Current streak</span>
          <span className="profile-tile-v">{streakText(h.streak)}</span>
          <span className="small muted">best win streak {h.bestWinStreak}</span>
        </div>
        <div className="profile-tile">
          <span className="profile-tile-k">Coach grade</span>
          <span className="profile-tile-v">{h.coach ? h.coach.grade : '—'}</span>
          <span className="small muted">{h.coach ? `${h.coach.avgPct}% fine moves, ${h.coach.games} game${h.coach.games === 1 ? '' : 's'}` : 'not recorded yet'}</span>
        </div>
      </div>
      {h.byTier.length > 0 && (
        <div className="table-scroll">
          <table className="small profile-table">
            <caption className="sr-only">Record by bot tier, and against other players</caption>
            <thead>
              <tr>
                <th scope="col">Opponent</th>
                <th scope="col">Games</th>
                <th scope="col">Record</th>
                <th scope="col">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {h.byTier.map((t) => (
                <tr key={t.tier}>
                  <th scope="row">{BOT_TIER_LABEL[t.tier]}</th>
                  <td>{t.games}</td>
                  <td>{wldText(t)}</td>
                  <td>
                    <Wr v={winRate(t)} n={t.games} />
                    {smallSample(t.games) && <span className="muted"> · small sample</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** A history row with, for the player's own games, the review button. */
export type HistoryRow = SharedHistoryGame & { key: string; review?: () => void; ratings?: string };

export function HistoryTable({ rows, caption }: { rows: readonly HistoryRow[]; caption: string }) {
  const showReview = rows.some((r) => r.review);
  return (
    <div className="table-scroll">
      <table className="small profile-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Deck</th>
            <th scope="col">Rival deck</th>
            <th scope="col">Opponent</th>
            <th scope="col">Result</th>
            <th scope="col">Turns</th>
            <th scope="col">Gigs</th>
            <th scope="col">Coach</th>
            {showReview && <th scope="col">Review</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key}>
              <td className="nowrap">{formatRecorded(g.date, { compact: true }) ?? '—'}</td>
              <td>{g.deck}</td>
              <td>{g.opp || '—'}</td>
              <td>{BOT_TIER_LABEL[g.tier]}</td>
              <td className={g.result === 'win' ? 'pos' : g.result === 'loss' ? 'neg' : ''}>
                <b>{resultText(g.result, g.conceded)}</b>
                <div className="muted">{g.first ? 'went first' : 'went second'}</div>
              </td>
              <td>{g.turns || '—'}</td>
              <td className="nowrap">{g.gigs ? `${g.gigs[0]}–${g.gigs[1]}` : '—'}</td>
              <td>{g.grade ?? '—'}</td>
              {showReview && (
                <td>
                  {g.review ? (
                    <button type="button" className="ghost" onClick={g.review} aria-label={`Review the game ${g.deck} vs ${g.opp}`}>
                      Review
                    </button>
                  ) : (
                    !g.ratings && (
                      <span className="muted" title="Only the last 25 games keep a replay">
                        —
                      </span>
                    )
                  )}
                  {g.ratings && <div className="muted nowrap">{g.ratings}</div>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SORTABLE: readonly DeckSortKey[] = ['deck', 'games', 'winRate', 'avgTurns', 'last'];

/** Per-deck stats, sortable by column, each row with its record by rival deck and by bot tier. */
export function DeckStatsTable({ rows, deckLink }: { rows: readonly SharedDeckStat[]; deckLink?: (name: string) => string | null }) {
  const [sort, setSort] = useState<{ key: DeckSortKey; dir: 'asc' | 'desc' }>({ key: 'games', dir: 'desc' });
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => sortDeckStats(rows, sort.key, sort.dir), [rows, sort]);
  const head = (key: DeckSortKey, extra?: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="th-sort"
        onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'deck' ? 'asc' : 'desc' }))}
      >
        {extra ?? DECK_SORT_LABEL[key]}
        <span aria-hidden="true">{sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
      </button>
    </th>
  );
  return (
    <div className="table-scroll">
      <table className="small profile-table">
        <caption className="sr-only">Stats per deck played. Column headers sort the table.</caption>
        <thead>
          <tr>
            {head(SORTABLE[0]!)}
            {head('games')}
            <th scope="col">Record</th>
            {head('winRate')}
            <th scope="col">First / second</th>
            {head('avgTurns')}
            {head('last')}
            <th scope="col">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const href = deckLink?.(r.deck) ?? null;
            const isOpen = open === r.deck;
            return [
              <tr key={r.deck}>
                <th scope="row">{href ? <a href={href}>{r.deck}</a> : r.deck}</th>
                <td>{r.games}</td>
                <td className="nowrap">{wldText(r)}</td>
                <td>
                  <Wr v={winRate(r)} n={r.games} />
                  {smallSample(r.games) && <div className="muted">small sample</div>}
                </td>
                <td className="nowrap" title={`Went first: ${wldText(r.first)}${smallNote(r.first.games)}. Went second: ${wldText(r.second)}${smallNote(r.second.games)}.`}>
                  {pctText(r.first)} / {pctText(r.second)}
                  <div className="muted">
                    {r.first.games} / {r.second.games} games
                  </div>
                </td>
                <td>{r.avgTurns === null ? '—' : r.avgTurns.toFixed(1)}</td>
                <td className="nowrap">{formatRecorded(r.last, { compact: true }) ?? '—'}</td>
                <td>
                  <button type="button" className="ghost" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.deck)}>
                    {isOpen ? 'Hide' : 'Details'}
                    <span className="sr-only"> for {r.deck}</span>
                  </button>
                </td>
              </tr>,
              isOpen && (
                <tr key={`${r.deck}-details`} className="profile-details">
                  <td colSpan={8}>
                    <div className="profile-details-grid">
                      <div>
                        <b>By rival deck</b>
                        <ul className="plain-list">
                          {r.byOpp.map((o) => (
                            <li key={o.opp}>
                              {o.opp}: {wldText(o)} (<Wr v={winRate(o)} n={o.games} />)
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <b>By opponent</b>
                        <ul className="plain-list">
                          {r.byTier.map((t) => (
                            <li key={t.tier}>
                              {BOT_TIER_LABEL[t.tier]}: {wldText(t)} (<Wr v={winRate(t)} n={t.games} />)
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A shared deck list's cards by name (an id this site doesn't know is shown as plain text). */
function SharedDeckCards({ d }: { d: SharedDeck }) {
  return (
    <ul className="plain-list small profile-cardlist">
      {d.legends.map((id) => (
        <li key={`L-${id}`}>
          <span className="muted">Legend</span> {CARD_BY_ID[id]?.displayName ?? id}
        </li>
      ))}
      {d.cards.map(([id, n]) => (
        <li key={id}>
          {n}× {CARD_BY_ID[id]?.displayName ?? id}
        </li>
      ))}
    </ul>
  );
}

/** The decks in a shared profile, by origin. */
function SharedDecks({ decks }: { decks: readonly SharedDeck[] }) {
  if (!decks.length) return <p className="muted small">No decks saved.</p>;
  return (
    <div>
      {MY_DECK_GROUPS.map((g) => {
        const list = decks.filter((d) => d.group === g);
        if (!list.length) return null;
        return (
          <div key={g}>
            <h4 className="profile-h4">
              {MY_DECK_LABEL[g]} ({list.length})
            </h4>
            <ul className="plain-list">
              {list.map((d, i) => (
                <li key={`${d.name}-${i}`}>
                  <details>
                    <summary>
                      <ColorPips legends={d.legends.filter((id) => CARD_BY_ID[id])} /> {d.name}
                      {d.added && <span className="muted small"> · added {formatRecorded(d.added, { compact: true })}</span>}
                    </summary>
                    <SharedDeckCards d={d} />
                  </details>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A shared profile as a viewer sees it: only the sections it carries. `mode` 'preview' is the player's own preview of
 * their share; 'viewer' is someone else's snapshot.
 */
export function SharedProfileView({ p, mode, deckLink }: { p: SharedProfile; mode: 'preview' | 'viewer'; deckLink?: (name: string) => string | null }) {
  const when = formatRecorded(p.createdAt);
  const empty = !p.identity && !p.favourite && !p.headline && !p.history && !p.deckStats && !p.decks;
  return (
    <div className="shared-profile">
      <p className="shared-banner" role="note">
        {mode === 'viewer' ? (
          <>
            <b>Someone else's shared profile</b>, a read-only snapshot{when ? ` from ${when}` : ''}. It shows only what they chose to share, and it
            does not change when they play more.
          </>
        ) : (
          <>
            <b>Preview:</b> exactly what anyone with your link or file sees.
          </>
        )}
      </p>
      {empty && <p className="muted">{mode === 'viewer' ? 'This profile shares nothing.' : 'Nothing is public yet: switch on the sections you want to share.'}</p>}
      {p.identity && (
        <div className="shared-id">
          <Avatar cardId={p.identity.picture} size={64} />
          <div>
            <div className="shared-name">{p.identity.name || <span className="muted">No name given</span>}</div>
            {p.identity.picture && CARD_BY_ID[p.identity.picture] && <div className="small muted">Picture: {CARD_BY_ID[p.identity.picture]!.displayName}</div>}
          </div>
        </div>
      )}
      {p.favourite && (
        <section className="shared-sec" aria-label="Favourite deck">
          <h3>Favourite deck</h3>
          <p>
            <ColorPips legends={p.favourite.legends.filter((id) => CARD_BY_ID[id])} /> <b>{(deckLink && deckLink(p.favourite.name) && <a href={deckLink(p.favourite.name)!}>{p.favourite.name}</a>) || p.favourite.name}</b>
            <span className="muted small"> · {p.favourite.chosen ? 'chosen' : 'most played'}</span>
          </p>
          {p.favourite.legends.length > 0 && <p className="small muted">Legends: {p.favourite.legends.map((id) => CARD_BY_ID[id]?.displayName ?? id).join(', ')}</p>}
        </section>
      )}
      {p.headline && (
        <section className="shared-sec" aria-label="Headline numbers">
          <h3>Headline numbers</h3>
          <HeadlineTiles h={p.headline} />
        </section>
      )}
      {p.history && (
        <section className="shared-sec" aria-label="Game history">
          <h3>Recent games ({p.history.length})</h3>
          {p.history.length ? <HistoryTable rows={p.history.map((g, i) => ({ ...g, key: String(i) }))} caption="Recent practice games, newest first" /> : <p className="muted small">No games recorded.</p>}
        </section>
      )}
      {p.deckStats && (
        <section className="shared-sec" aria-label="Deck stats">
          <h3>Deck stats</h3>
          {p.deckStats.length ? <DeckStatsTable rows={p.deckStats} deckLink={deckLink} /> : <p className="muted small">No games recorded.</p>}
        </section>
      )}
      {p.decks && (
        <section className="shared-sec" aria-label="Deck lists">
          <h3>Decks ({p.decks.length})</h3>
          <SharedDecks decks={p.decks} />
        </section>
      )}
    </div>
  );
}
