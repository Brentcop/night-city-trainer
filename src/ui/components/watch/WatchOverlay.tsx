// The spectator's view ("Watch"): a match, or one game, shown move by move on the game board as if two players sat at
// the table, with both hands face up and every face-down Legend shown to the spectator (still marked face-down). The
// board is the visual replay's (FrameBoard in ../ReplayBoard.tsx, with `spectator`), the game is played out in the
// watch worker (watchClient.ts), and the playback (playback.ts) reveals nothing before it reaches it: no total length,
// no result and no score for a game whose end has not been shown, until "Skip to the result" is pressed. A match goes
// on to its next game by itself after a short pause. Loaded only when someone presses Watch (WatchEntry.tsx); rendered
// at the document body like the Game review, over whatever opened it. Escape, the ✕ and Close close it, and focus goes
// back to the control that opened it (Modal's focus trap); closing changes nothing in what it shows (a running event
// goes on at its own pace).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { movedCards, type WatchTarget } from '../../../lib/watchMatch';
import { lessMotion } from '../../useBoardSettings';
import { MentionText } from '../CardMention';
import { Modal } from '../Modal';
import { FrameBoard } from '../ReplayBoard';
import { BOT_SPEEDS } from '../board/prefs';
import { useNarrow } from '../board/useNarrow';
import { workerComputer, type WatchComputer } from './watchClient';
import { useWatchPlayback } from './useWatchPlayback';
import { atEnd, matchShown, nextComing, ready, shownScore, type PlaybackAction, type PlaybackState } from './playback';
import '../../watch.css';

const gameNo = (i: number) => `Game ${i + 1}`;

/** Who won, in the words the board's last log line uses ("A wins"), or a draw. */
const winWords = (w: 0 | 1 | 'tie' | null, names: readonly string[]) => (w === 0 || w === 1 ? `${names[w]} wins` : 'Draw');

/** The bots that played, as the events name them ("Hard bots"). */
const botWords = (bot: string) => `${bot.charAt(0).toUpperCase()}${bot.slice(1)} bots`;

export function WatchOverlay({ target, onClose, computer }: { target: WatchTarget; onClose: () => void; computer?: WatchComputer }) {
  // the worker is made by an effect and ended by its cleanup (made again if the effect runs again)
  const [own, setOwn] = useState<WatchComputer | null>(computer ?? null);
  useEffect(() => {
    if (computer) return undefined;
    const c = workerComputer();
    setOwn(c);
    return () => c.dispose();
  }, [computer]);
  // reduced or no motion: the spectator starts the playback (nothing moves until asked)
  const [st, act] = useWatchPlayback(target, own, { startPlaying: !lessMotion() });
  const narrow = useNarrow();
  // keys while focus is in this dialog (on the dialog itself too): → shows the next move, Space plays or pauses
  const root = useRef<HTMLDivElement>(null);
  const playing = st.playing;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const dialogEl = root.current?.closest('.modal');
      const t = e.target as HTMLElement | null;
      if (!dialogEl || !t || !dialogEl.contains(t) || t.closest('select, input, textarea')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        act({ type: 'step' });
      } else if (e.key === ' ' && !t.closest('button, a[href], summary')) {
        e.preventDefault();
        act({ type: playing ? 'pause' : 'play' });
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [act, playing]);
  const dialog = <WatchView target={target} st={st} act={act} onClose={onClose} narrow={narrow} rootRef={root} />;
  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
}

/** The dialog for a playback state (exported for the render tests: it reads only `st`). */
export function WatchView({
  target,
  st,
  act,
  onClose,
  narrow,
  rootRef,
}: {
  target: WatchTarget;
  st: PlaybackState;
  act: (a: PlaybackAction) => void;
  onClose: () => void;
  narrow: boolean;
  rootRef?: React.RefObject<HTMLDivElement>;
}) {
  const titleId = useId();
  const names = target.names;
  const single = target.kind === 'record' || target.only !== undefined;
  const cur = st.entries[st.shown];
  const frames = cur?.game?.frames ?? [];
  const fi = Math.min(st.fi, Math.max(0, frames.length - 1));
  const frame = frames[fi];
  const title = target.kind === 'record' ? target.title : `${names[0]} vs ${names[1]}`;
  const sub =
    target.kind === 'record'
      ? 'Your game, replayed from its record'
      : `${target.only !== undefined ? `${gameNo(target.only)} of the match` : target.bestOf ? `Best of ${target.bestOf}` : 'Match'} · ${botWords(target.bot)}`;
  return (
    <Modal labelledBy={titleId} onClose={onClose} className="watch-modal" backdropClassName="watch-backdrop">
      <div className="watch" ref={rootRef}>
        <header className="watch-head">
          <h2 id={titleId} className="watch-title">
            <span aria-hidden="true">👁</span> {title}
          </h2>
          <div className="small muted">{sub} · spectator view: both hands face up, face-down Legends shown</div>
        </header>
        <Scoreline st={st} names={names} single={single} turn={frame?.state.turn ?? null} />
        <Controls st={st} act={act} single={single} onClose={onClose} />
        <Status st={st} act={act} names={names} single={single} />
        {frame && (
          <div className="watch-layout">
            <div className="watch-board">
              <LastMove prev={frames[fi - 1]?.state} state={frame.state} />
              <FrameBoard state={frame.state} line={frame.line} names={names} narrow={narrow} at={fi} spectator />
            </div>
            <WatchLog lines={frames.slice(0, fi + 1).map((f) => f.line)} names={names} />
          </div>
        )}
      </div>
    </Modal>
  );
}

/** The match score so far (only games whose end was shown), and which game is on the table. */
function Scoreline({ st, names, single, turn }: { st: PlaybackState; names: readonly string[]; single: boolean; turn: number | null }) {
  const cur = st.entries[st.shown];
  const at = cur?.index ?? st.waiting ?? null;
  const score = shownScore(st);
  return (
    <div className="watch-score">
      {!single && (
        <span className="watch-tally" aria-label={`Match score: ${names[0]} ${score[0]}, ${names[1]} ${score[1]}`}>
          <span className="watch-side">{names[0]}</span>{' '}
          <b className="num">
            {score[0]} – {score[1]}
          </b>{' '}
          <span className="watch-side">{names[1]}</span>
        </span>
      )}
      {at !== null && <span className="tag">{gameNo(at)}</span>}
      {turn !== null && <span className="muted small">Turn {turn}</span>}
    </div>
  );
}

function Controls({ st, act, single, onClose }: { st: PlaybackState; act: (a: PlaybackAction) => void; single: boolean; onClose: () => void }) {
  const on = ready(st);
  const end = atEnd(st);
  return (
    <div className="watch-controls row small" role="group" aria-label="Playback">
      <button type="button" className="primary" onClick={() => act({ type: st.playing ? 'pause' : 'play' })} aria-pressed={st.playing}>
        {st.playing ? '❚❚ Pause' : '▶ Play'}
      </button>
      <button type="button" onClick={() => act({ type: 'step' })} disabled={!on || end} title="Show the next move (→)">
        ⏭ Next move
      </button>
      <button type="button" onClick={() => act({ type: 'nextTurn' })} disabled={!on || end} title="Jump to the start of the next turn">
        ⏩ Next turn
      </button>
      <button type="button" onClick={() => act({ type: 'restart' })} disabled={!on} title="Watch this game again from its first move">
        ↺ Restart
      </button>
      <label className="row muted">
        Speed
        <select aria-label="Speed (time per move)" value={st.speed} onChange={(e) => act({ type: 'speed', ms: +e.target.value })}>
          {BOT_SPEEDS.map((s) => (
            <option key={s.ms} value={s.ms}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="ghost" onClick={() => act({ type: 'skip' })} disabled={!on || end} title="Jump to the end of this game and show who won">
        Skip to the result
      </button>
      {!single && !matchShown(st) && (
        <button type="button" className="ghost" onClick={() => act({ type: 'skipMatch' })} title="Go through every remaining game to the end of the match">
          Skip to the match result
        </button>
      )}
      <button type="button" className="ghost watch-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

/** What is happening: setting up a game, waiting for the event, a refusal, the end of a game or of the match. */
function Status({ st, act, names, single }: { st: PlaybackState; act: (a: PlaybackAction) => void; names: readonly string[]; single: boolean }) {
  const cur = st.entries[st.shown];
  let text: React.ReactNode = null;
  let cls = 'watch-status small';
  if (cur?.refused) {
    text = cur.refused;
    cls += ' watch-refused';
  } else if (cur?.error) {
    text = `${gameNo(cur.index)} could not be played out: ${cur.error.slice(0, 200)}`;
    cls += ' watch-refused';
  } else if (!cur) {
    if (st.end?.kind === 'stopped') text = `The event stopped before ${gameNo(st.end.index).toLowerCase()} was played, so there is nothing more to watch.`;
    else if (st.waiting !== null) text = `Waiting for the table to deal ${gameNo(st.waiting).toLowerCase()}…`;
    else if (st.end?.kind !== 'over') text = 'Setting up the table…';
  } else if (!cur.game) {
    text = (
      <>
        <span className="spinner" /> Setting up {gameNo(cur.index).toLowerCase()}…
      </>
    );
  } else if (atEnd(st)) {
    const g = cur.game;
    const res = `${gameNo(cur.index)}: ${winWords(g.winner, names)}${g.reason ? ` (${g.reason})` : ''}, after ${g.turns} turn${g.turns === 1 ? '' : 's'}.`;
    const score = shownScore(st);
    const coming = nextComing(st);
    const match = single
      ? ''
      : matchShown(st)
        ? score[0] === score[1]
          ? ` Match over, level at ${score[0]}–${score[1]} (the event's seed decides a level match).`
          : ` Match over: ${names[score[0] > score[1] ? 0 : 1]} wins ${Math.max(...score)}–${Math.min(...score)}.`
        : !coming && st.end?.kind === 'stopped'
          ? ` The event stopped before ${gameNo(st.end.index).toLowerCase()} was played.`
          : '';
    text = (
      <>
        <b>{res}</b>
        {match}
        {coming && st.left !== null && ` ${gameNo(cur.index + 1)} starts in ${st.left} s.`}
        {coming && (
          <button type="button" className="ghost watch-next" onClick={() => act({ type: 'startNext' })}>
            {st.left !== null ? 'Start it now' : `Watch ${gameNo(cur.index + 1).toLowerCase()}`}
          </button>
        )}
      </>
    );
    cls += ' watch-result';
  } else if (!st.playing && st.fi === 0) text = 'Paused at the first move. Press Play to watch.';
  return text === null ? null : (
    <p className={cls} role="status">
      {text}
    </p>
  );
}

/** The game's log up to the move shown (never past it), newest last. */
function WatchLog({ lines, names }: { lines: { turn: number; player: 0 | 1 | null; text: string }[]; names: readonly string[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <ol className="watch-log log" ref={ref} aria-label="Game log so far">
      {lines.map((l, i) => (
        <li key={i} className={`replay-line ${l.player === null ? 'sys' : l.player === 0 ? 'p0' : 'p1'} ${i === lines.length - 1 ? 'on' : ''}`}>
          <span className="muted">T{l.turn}</span> {l.player !== null && !l.text.startsWith('---') && <b>{names[l.player]}: </b>}
          <MentionText text={l.text} skip={[...names]} passive />
        </li>
      ))}
    </ol>
  );
}

/** The cards the last move touched, outlined on the board (an outline only: no box changes size). */
function LastMove({ prev, state }: { prev: Parameters<typeof movedCards>[0]; state: Parameters<typeof movedCards>[1] }) {
  const uids = useMemo(() => movedCards(prev, state), [prev, state]);
  if (!uids.length) return null;
  const css = `${uids.map((u) => `.pb-watch-board .pb-slot[data-uid="${Math.trunc(u)}"]`).join(',\n')} { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }`;
  return <style>{css}</style>;
}
