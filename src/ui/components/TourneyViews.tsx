// Shared tournament views: bracket (with TBD slots while an event runs), standings, round lists and the match modal with replay playback.
import { useId, useMemo, useState } from 'react';
import { allDecks } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { LegendStrip, OriginBadge } from './DeckIdentity';
import { gameDeck, type GameRec, type StandingRow } from '../../lib/tournament';
import { errorText } from '../../sim/pool';
import { useReplayWorker } from '../useReplayWorker';
import { byName } from '../deckLookup';
import type { ReviewRequest } from '../../sim/review.worker';
import { ReviewPanel } from './ReviewPanel';
import { ReplayBoard, type ReplayData } from './ReplayBoard';
import { Wr } from './Num';
import { Modal } from './Modal';
import { DeckListCompact } from './DeckCards';
import { SimTierBadge, simTierFor } from './TierBadges';
import '../tourney.css';

export type Lib = Map<string, LibraryDeck>;
/** Name → deck for event views; a built-in deck wins over a saved deck with the same name. */
export const useLib = () => useMemo(() => byName(allDecks()), []);
export const short = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
/**
 * A long name shortened in the middle, keeping its start and its end: deck names that share a start ("Ladder: V /
 * Smasher / Padre" and "… / Saburo") differ at the end, so the end must show (UX-16). The full name goes in a title.
 */
export const midShort = (s: string, n = 44) => (s.length > n ? `${s.slice(0, Math.ceil((n - 1) / 2)).trimEnd()}…${s.slice(s.length - Math.floor((n - 1) / 2)).trimStart()}` : s);

/** Minimal match shape: history index entries have no games, live/full ones do. */
export interface MatchView {
  a: string;
  b: string | null;
  score: [number, number];
  winner: string;
  live?: boolean;
  games?: GameRec[];
  /** paired by hand ("set by you") */
  set?: boolean;
  /** best-of when it differs from the event's */
  bestOf?: number;
}

/** "set by you" and "Bo5" marks for a match. */
function MatchMarks({ m }: { m: MatchView }) {
  return (
    <>
      {m.set && (
        <span className="tag ev-set" title="Paired by hand">
          set by you
        </span>
      )}
      {m.bestOf && <span className="tag">Bo{m.bestOf}</span>}
    </>
  );
}

function DeckName({ name, lib, label }: { name: string; lib: Lib; label?: string }) {
  const d = lib.get(name);
  return d ? (
    <a href={`#/deck?d=${encodeURIComponent(d.file)}`} title={name}>
      {label ?? name}
    </a>
  ) : (
    <span title={label && label !== name ? name : undefined}>{label ?? name}</span>
  );
}

/** The event's champion. `list` is the list it played (from the event file), shown with card images on request. */
export function Champion({ name, lib, note, list }: { name: string; lib: Lib; note?: string; list?: { legends: string[]; main: string[] } }) {
  const d = lib.get(name);
  return (
    <div className="champion">
      {d && (
        <div style={{ width: 240, maxWidth: '100%' }}>
          <LegendStrip legends={d.deck.legends} height={90} />
        </div>
      )}
      <div>
        <div className="muted small">CHAMPION</div>
        <h3 style={{ margin: '2px 0' }}>
          🏆 <DeckName name={name} lib={lib} />
        </h3>
        <div className="row small">
          {d && <OriginBadge deck={d} full />}
          {note && <span className="muted">{note}</span>}
        </div>
        {list && (
          <details className="champion-list">
            <summary className="small">Winning decklist</summary>
            <DeckListCompact deck={list} />
          </details>
        )}
      </div>
    </div>
  );
}

const roundTitle = (alive: number) => (alive === 2 ? 'Final' : alive === 4 ? 'Semifinals' : alive === 8 ? 'Quarterfinals' : `Round of ${alive}`);

/** Single-elimination bracket. Columns that have not been played yet show TBD slots. */
export function Bracket({
  rounds,
  size,
  seeds,
  champion,
  lib,
  onOpen,
}: {
  rounds: { name: string; matches: MatchView[] }[];
  size: number;
  seeds: string[];
  champion: string | null;
  lib: Lib;
  onOpen: (m: MatchView) => void;
}) {
  const seedOf = (name: string) => seeds.indexOf(name) + 1;
  const cols: { name: string; slots: (MatchView | null)[] }[] = [];
  for (let alive = size, i = 0; alive > 1; alive /= 2, i++) cols.push({ name: rounds[i]?.name ?? roundTitle(alive), slots: Array.from({ length: alive / 2 }, (_, k) => rounds[i]?.matches[k] ?? null) });
  return (
    <div className="bracket">
      {cols.map((col) => (
        <div key={col.name} className="bracket-col">
          <div className="bracket-title">{col.name}</div>
          {col.slots.map((m, k) =>
            m ? (
              <button key={k} className={`bracket-match ${m.live ? 'live' : ''}`} onClick={() => onOpen(m)} disabled={!m.b || (!m.games?.length && m.live)}>
                {[m.a, m.b].map((side, si) =>
                  side === null ? (
                    <div key={si} className="bracket-side lose">
                      <span className="seed" />
                      <span className="bname muted">bye</span>
                      <b />
                    </div>
                  ) : (
                    <div key={si} className={`bracket-side ${!m.winner ? '' : m.winner === side ? 'win' : 'lose'}`}>
                      <span className="seed">{seedOf(side) || ''}</span>
                      <span className="bname" title={side}>
                        {midShort(side)}
                      </span>
                      <b>{m.b === null || (!m.games?.length && !m.winner && !m.live) ? '' : m.score[si]}</b>
                    </div>
                  ),
                )}
                {m.bestOf && <span className="bracket-bo muted">Bo{m.bestOf}</span>}
              </button>
            ) : (
              <div key={k} className="bracket-match tbd">
                {[0, 1].map((si) => (
                  <div key={si} className="bracket-side">
                    <span className="seed" />
                    <span className="bname muted">TBD</span>
                    <b />
                  </div>
                ))}
              </div>
            ),
          )}
        </div>
      ))}
      <div className="bracket-col">
        <div className="bracket-title">Champion</div>
        <div className={`bracket-match champ ${champion ? '' : 'tbd'}`}>
          <div className={`bracket-side ${champion ? 'win' : ''}`}>
            <span className="seed">🏆</span>
            <span className="bname" title={champion ?? undefined}>
              {champion ? <DeckName name={champion} lib={lib} label={midShort(champion)} /> : <span className="muted">TBD</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


/**
 * Swiss standings. With `full`, adds game win %, play/draw splits and average game length. With `tiers`, each deck's
 * current Sim tier (from all recorded events, not this one) beside its name.
 */
export function StandingsTable({ rows, cut, lib, full, tiers }: { rows: (StandingRow | { deck: string; mp: number; record: string; games: string; omw: number })[]; cut: number; lib: Lib; full?: boolean; tiers?: boolean }) {
  return (
    <table className="small">
      <thead>
        <tr>
          <th>#</th>
          <th>Deck</th>
          <th>Pts</th>
          <th>Matches</th>
          <th>Games</th>
          <th title="Opponents' match-win % (tiebreak)">OMW</th>
          {full && (
            <>
              <th>Game win%</th>
              <th>On the play</th>
              <th>On the draw</th>
              <th>Avg turns</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const x = s as StandingRow;
          const rec = 'mw' in s ? `${x.mw}-${x.ml}` : s.record;
          const games = 'gw' in s ? `${x.gw}-${x.gl}` : (s as { games: string }).games;
          return (
            <tr key={s.deck} className={i < cut ? 'top-cut' : ''}>
              <td>{i + 1}</td>
              <td>
                <DeckName name={s.deck} lib={lib} />
                {tiers && (
                  <>
                    {' '}
                    <SimTierBadge tier={simTierFor(s.deck)} />
                  </>
                )}
              </td>
              <td>{s.mp}</td>
              <td>{rec}</td>
              <td>{games}</td>
              <td>{Math.round(s.omw * 100)}%</td>
              {full && 'playG' in s && (
                <>
                  <td>
                    <Wr v={x.games ? (x.playW + x.drawW) / x.games : null} n={x.games} strong />
                  </td>
                  <td>
                    <Wr v={x.playG ? x.playW / x.playG : null} n={x.playG} />
                  </td>
                  <td>
                    <Wr v={x.drawG ? x.drawW / x.drawG : null} n={x.drawG} />
                  </td>
                  <td>{x.games ? (x.turns / x.games).toFixed(1) : '—'}</td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const matches = (n: number) => `${n} match${n === 1 ? '' : 'es'}`;

/**
 * Rounds and their matches, newest last. `openLast` opens the latest round, `openFirst` the first (a plan before play);
 * `upcoming` labels rounds with no game played yet as planned. Hand-set pairings are marked "set by you".
 */
export function RoundList({ rounds, onOpen, openLast, openFirst }: { rounds: { round: number; matches: MatchView[] }[]; onOpen: (m: MatchView) => void; openLast?: boolean; openFirst?: boolean }) {
  return (
    <>
      {rounds.map((r, ri) => {
        const done = r.matches.filter((m) => m.winner && (!m.b || m.games?.length)).length;
        const started = r.matches.some((m) => m.games?.length || m.live);
        const set = r.matches.filter((m) => m.set).length;
        return (
          <details key={r.round} open={(openLast && ri === rounds.length - 1) || (openFirst && ri === 0)}>
            <summary className="small">
              Round {r.round} · {!started && done < r.matches.length ? `${matches(r.matches.length)} planned` : done < r.matches.length ? `${done}/${matches(r.matches.length)} done` : matches(r.matches.length)}
              {set > 0 && ` · ${set} set by you`}
            </summary>
            <div className="round-list">
              {r.matches.map((m, k) => (
                <button key={k} className={`match-row ${m.live ? 'live' : ''}`} onClick={() => onOpen(m)} disabled={!m.b || !m.games?.length}>
                  <span className={m.winner && m.b && m.games?.length && m.winner === m.a ? 'win' : ''}>{short(m.a)}</span>
                  <b>{m.b ? (m.games?.length || m.winner ? `${m.score[0]}–${m.score[1]}` : 'vs') : 'bye'}</b>
                  <span className={m.winner && m.winner === m.b ? 'win' : ''}>
                    {m.b ? short(m.b) : ''}
                    {(m.set || m.bestOf) && (
                      <span className="match-marks">
                        <MatchMarks m={m} />
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}

/** One standings table per round-robin group (rows keep the overall order, which ranks within each group too). */
export function GroupTables({ groups, rows, advance, lib }: { groups: { name: string; decks: string[] }[]; rows: Parameters<typeof StandingsTable>[0]['rows']; advance: number; lib: Lib }) {
  return (
    <div className="grid">
      {groups.map((g) => (
        <div key={g.name}>
          <h4 className="dp-section-title" style={{ margin: '4px 0' }}>
            {g.name}
          </h4>
          <StandingsTable rows={rows.filter((r) => g.decks.includes(r.deck))} cut={advance} lib={lib} />
        </div>
      ))}
    </div>
  );
}

/** What an event's standings table is called in its format. */
export function standingsTitle(kind: string | undefined, done: boolean): string {
  if (kind === 'matches') return 'Results';
  if (kind === 'round-robin') return done ? 'Final table' : 'Table';
  if (kind === 'single-elim') return 'Results by deck';
  return done ? 'Final standings' : 'Standings';
}

type EvDecks = Record<string, { legends: string[]; main: string[] }>;

/** Match details: every game, with an exact re-simulation and turn-by-turn playback. */
export function MatchModal({ m, decks, bot, lib, onClose }: { m: MatchView & { games: GameRec[] }; decks: EvDecks; bot: string; lib: Lib; onClose: () => void }) {
  const [replay, setReplay] = useState<{ i: number; data?: ReplayData; busy?: boolean; error?: string } | null>(null);
  const [review, setReview] = useState<{ i: number; req: ReviewRequest } | null>(null);
  const reviewGameAt = (i: number) => {
    const gm = m.games[i];
    replayer.cancel();
    setReplay(null);
    setReview({ i, req: { kind: 'bots', decks: [gameDeck({ name: m.a, ...decks[m.a] }), gameDeck({ name: m.b!, ...decks[m.b!] })], seed: gm.seed, first: gm.first, bot, rollouts: 8, withCoach: false } });
  };
  // The re-simulation runs in a worker: Close/Escape stay responsive, and closing the modal terminates it
  // (a cancelled run resolves to null and is ignored).
  const replayer = useReplayWorker();
  const play = async (i: number) => {
    const gm = m.games[i];
    setReplay({ i, busy: true });
    try {
      const data = await replayer.start({ a: gameDeck({ name: m.a, ...decks[m.a] }), b: gameDeck({ name: m.b!, ...decks[m.b!] }), seed: gm.seed, seedB: gm.seed + 7777, first: gm.first, bot });
      if (data) setReplay({ i, data });
    } catch (e) {
      setReplay({ i, error: errorText(e) });
    }
  };
  const titleId = useId();
  const rec = replay ? m.games[replay.i] : null;
  const fin = replay?.data?.final;
  const same = fin && rec && (fin.winner === rec.winner || (fin.winner === null && rec.winner === 'tie'));
  return (
    <Modal labelledBy={titleId} onClose={onClose} className={replay?.data ? 'modal-wide' : undefined}>
      <h2 id={titleId} style={{ marginTop: 0 }}>
        <DeckName name={m.a} lib={lib} /> <span className="muted">vs</span> <DeckName name={m.b!} lib={lib} />
      </h2>
      <div className="stat" style={{ fontSize: '1.4rem' }}>
        {m.score[0]} – {m.score[1]}
        {m.winner ? ` · ${m.winner} wins` : ' · in progress'}
      </div>
      <table className="small" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Game</th>
            <th>On the play</th>
            <th>Winner</th>
            <th>Turns</th>
            <th>How</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {m.games.map((g, i) => (
            <tr key={g.seed}>
              <td>{i + 1}</td>
              <td>{g.first === 0 ? m.a : m.b}</td>
              <td>
                <b>{g.winner === 'tie' ? 'Draw' : g.winner === 0 ? m.a : m.b}</b>
              </td>
              <td>{g.turns}</td>
              <td className="muted">{g.reason}</td>
              <td>
                <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                  <button onClick={() => (setReview(null), play(i))} disabled={replay?.busy}>
                    ▶ Watch
                  </button>
                  <button className="ghost" onClick={() => reviewGameAt(i)} title="Score every decision both bots made">
                    🔍 Review
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {decks[m.a] && m.b && decks[m.b] && (
        <details className="match-lists">
          <summary className="small">Decklists</summary>
          <div className="grid cols-2">
            {[m.a, m.b].map((n) => (
              <div key={n}>
                <h3 className="dp-section-title rule-head">{n}</h3>
                <DeckListCompact deck={decks[n]} noDialog />
              </div>
            ))}
          </div>
        </details>
      )}
      {review && <ReviewPanel key={review.i} req={review.req} title={`Game ${review.i + 1} review`} expect={m.games[review.i].winner} />}
      {replay?.busy && <p className="muted">Re-simulating game {replay.i + 1} with the same seed and bots…</p>}
      {replay?.error && (
        <p className="small" style={{ color: 'var(--red)' }}>
          ⚠ Game {replay.i + 1} could not be re-simulated: {replay.error}
        </p>
      )}
      {replay?.data && (
        <>
          <h3 style={{ marginBottom: 4 }}>
            Game {replay.i + 1}{' '}
            <span className="muted small">({same ? 'replay matches the recorded result' : 'replay differs from the record: bot settings changed since'}) · click any line of the log to see the board at that moment</span>
          </h3>
          <ReplayBoard data={replay.data} names={[m.a, m.b!]} />
        </>
      )}
    </Modal>
  );
}
