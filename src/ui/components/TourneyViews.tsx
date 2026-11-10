// Shared tournament views: bracket (with TBD slots while an event runs), standings, round lists and the match modal with replay playback.
import { useEffect, useMemo, useRef, useState } from 'react';
import { allDecks } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { LegendStrip, OriginBadge } from './DeckIdentity';
import { Game } from '../../engine/engine';
import { gameDeck, makeBot, type GameRec, type MatchRec, type StandingRow } from '../../lib/tournament';
import type { GameState } from '../../engine/types';
import type { ReviewRequest } from '../../sim/review.worker';
import { ReviewPanel } from './ReviewPanel';
import { Wr } from './Num';

export type Lib = Map<string, LibraryDeck>;
export const useLib = () => useMemo(() => new Map(allDecks().map((d) => [d.deck.name, d])), []);
export const short = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Minimal match shape: history index entries have no games, live/full ones do. */
export interface MatchView {
  a: string;
  b: string | null;
  score: [number, number];
  winner: string;
  live?: boolean;
  games?: GameRec[];
}

export function DeckName({ name, lib }: { name: string; lib: Lib }) {
  const d = lib.get(name);
  return d ? (
    <a href={`#/deck?d=${encodeURIComponent(d.file)}`} title={name}>
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
}

export function Champion({ name, lib, note }: { name: string; lib: Lib; note?: string }) {
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
              <button key={k} className={`bracket-match ${m.live ? 'live' : ''}`} onClick={() => onOpen(m)} disabled={!m.games?.length && m.live}>
                {[m.a, m.b ?? ''].map((side, si) => (
                  <div key={si} className={`bracket-side ${!m.winner ? '' : m.winner === side ? 'win' : 'lose'}`}>
                    <span className="seed">{seedOf(side) || ''}</span>
                    <span className="bname" title={side}>
                      {short(side, 24)}
                    </span>
                    <b>{m.score[si]}</b>
                  </div>
                ))}
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
            <span className="bname">{champion ? <DeckName name={champion} lib={lib} /> : <span className="muted">TBD</span>}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


/** Swiss standings. With `full`, adds game win %, play/draw splits and average game length. */
export function StandingsTable({ rows, cut, lib, full }: { rows: (StandingRow | { deck: string; mp: number; record: string; games: string; omw: number })[]; cut: number; lib: Lib; full?: boolean }) {
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

export function RoundList({ rounds, onOpen, openLast }: { rounds: { round: number; matches: MatchView[] }[]; onOpen: (m: MatchView) => void; openLast?: boolean }) {
  return (
    <>
      {rounds.map((r, ri) => {
        const done = r.matches.filter((m) => m.winner).length;
        return (
          <details key={r.round} open={openLast && ri === rounds.length - 1}>
            <summary className="small">
              Round {r.round} · {done < r.matches.length ? `${done}/${r.matches.length} matches done` : `${r.matches.length} matches`}
            </summary>
            <div className="round-list">
              {r.matches.map((m, k) => (
                <button key={k} className={`match-row ${m.live ? 'live' : ''}`} onClick={() => onOpen(m)} disabled={!m.b || !m.games?.length}>
                  <span className={m.winner && m.winner === m.a ? 'win' : ''}>{short(m.a)}</span>
                  <b>{m.b ? `${m.score[0]}–${m.score[1]}` : 'bye'}</b>
                  <span className={m.winner && m.winner === m.b ? 'win' : ''}>{m.b ? short(m.b) : ''}</span>
                </button>
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}

type EvDecks = Record<string, { legends: string[]; main: string[] }>;

/** Match details: every game, with an exact re-simulation and turn-by-turn playback. */
export function MatchModal({ m, decks, bot, lib, onClose }: { m: MatchView & { games: GameRec[] }; decks: EvDecks; bot: string; lib: Lib; onClose: () => void }) {
  const [replay, setReplay] = useState<{ i: number; state?: GameState; busy?: boolean } | null>(null);
  const [review, setReview] = useState<{ i: number; req: ReviewRequest } | null>(null);
  const reviewGameAt = (i: number) => {
    const gm = m.games[i];
    setReplay(null);
    setReview({ i, req: { kind: 'bots', decks: [gameDeck({ name: m.a, ...decks[m.a] }), gameDeck({ name: m.b!, ...decks[m.b!] })], seed: gm.seed, first: gm.first, bot, rollouts: 8, withCoach: false } });
  };
  const play = async (i: number) => {
    const gm = m.games[i];
    setReplay({ i, busy: true });
    await new Promise((r) => setTimeout(r, 30));
    const g = Game.create([gameDeck({ name: m.a, ...decks[m.a] }), gameDeck({ name: m.b!, ...decks[m.b!] })], [makeBot(bot, gm.seed), makeBot(bot, gm.seed + 7777)], {
      seed: gm.seed,
      first: gm.first,
    });
    setReplay({ i, state: await g.run() });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const rec = replay ? m.games[replay.i] : null;
  const same = replay?.state && rec && (replay.state.winner === rec.winner || (replay.state.winner === null && rec.winner === 'tie'));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="ghost modal-close" onClick={onClose}>
          ✕
        </button>
        <h2 style={{ marginTop: 0 }}>
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
        {review && <ReviewPanel key={review.i} req={review.req} title={`Game ${review.i + 1} review`} expect={m.games[review.i].winner} />}
        {replay?.busy && <p className="muted">Re-simulating game {replay.i + 1} with the same seed and bots…</p>}
        {replay?.state && (
          <>
            <h3 style={{ marginBottom: 4 }}>
              Game {replay.i + 1}{' '}
              <span className="muted small">({same ? 'replay matches the recorded result' : 'replay differs from the record: bot settings changed since'})</span>
            </h3>
            <Playback state={replay.state} names={[m.a, m.b!]} />
          </>
        )}
      </div>
    </div>
  );
}

/** Turn-by-turn playback of a game log, with play/pause, speed and a turn scrubber. */
function Playback({ state, names }: { state: GameState; names: [string, string] }) {
  const log = state.log;
  const lastTurn = log.length ? log[log.length - 1].turn : 0;
  const [shown, setShown] = useState(log.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(250);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setShown(log.length);
    setPlaying(false);
  }, [state, log.length]);
  useEffect(() => {
    if (!playing) return;
    if (shown >= log.length) return setPlaying(false);
    const t = setTimeout(() => setShown((s) => s + 1), speed);
    return () => clearTimeout(t);
  }, [playing, shown, speed, log.length]);
  useEffect(() => {
    if (playing && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [shown, playing]);
  const turnNow = shown ? log[Math.min(shown, log.length) - 1].turn : 0;
  /** number of log lines up to the end of turn t */
  const endOf = (t: number) => {
    const i = log.findIndex((l) => l.turn > t);
    return i === -1 ? log.length : i;
  };
  const toTurn = (t: number) => setShown(Math.max(1, endOf(t)));
  const end = shown >= log.length;
  return (
    <div className="playback">
      <div className="row small">
        <button
          className="primary"
          onClick={() => {
            if (end) setShown(1);
            setPlaying((p) => !p || end);
          }}
        >
          {playing ? '❚❚ Pause' : end ? '▶ Play from start' : '▶ Play'}
        </button>
        <button onClick={() => (setPlaying(false), toTurn(turnNow - 1))} disabled={turnNow <= 1}>
          ◀ Turn
        </button>
        <button onClick={() => (setPlaying(false), toTurn(shown < endOf(turnNow) ? turnNow : turnNow + 1))} disabled={end}>
          Turn ▶
        </button>
        <button onClick={() => (setPlaying(false), setShown(log.length))} disabled={end}>
          Skip to end
        </button>
        <label className="row muted">
          Speed
          <select value={speed} onChange={(e) => setSpeed(+e.target.value)}>
            <option value={600}>slow</option>
            <option value={250}>normal</option>
            <option value={80}>fast</option>
          </select>
        </label>
        <span className="muted">
          Turn {turnNow} / {lastTurn}
        </span>
      </div>
      <input type="range" min={1} max={Math.max(1, lastTurn)} value={turnNow || 1} onChange={(e) => (setPlaying(false), toTurn(+e.target.value))} style={{ width: '100%' }} />
      <div className="row small">
        <span className="p0-dot">● {names[0]}</span>
        <span className="p1-dot">● {names[1]}</span>
      </div>
      <div className="log" ref={box} style={{ maxHeight: 420 }}>
        {log.slice(0, shown).map((l, k) => (
          <div key={k} className={l.player === null ? 'sys' : l.player === 0 ? 'p0' : 'p1'}>
            T{l.turn} {l.text}
          </div>
        ))}
        {end && <div className="sys">{state.winner === 'tie' ? 'Draw' : `${names[state.winner as 0 | 1]} wins`} ({state.winReason})</div>}
      </div>
    </div>
  );
}
