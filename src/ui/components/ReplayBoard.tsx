// Visual replay: the real playmat for any moment of a finished game. The game is re-simulated once with its seeds,
// the board state is captured after every log line, and the log becomes a timeline you can click, step or play.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../../engine/engine';
import { EMPTY_IX } from './board/interaction';
import type { BoardCtx } from './board/BoardCard';
import { PlayerSide } from './board/Zones';
import { BoardCard } from './board/BoardCard';
import { useNarrow } from './board/useNarrow';
import type { ReplayData } from '../../lib/replayFrames';
import type { GameState, LogEntry, PlayerId } from '../../engine/types';
import { redactLine, viewFor, ViewGame } from '../../net/view';
import '../board.css';

// The recording half (frames, recordReplay) lives in lib/replayFrames so the game worker can use it without React.
export { captureFrames, lineInFinalLog, recordReplay, type ReplayData, type ReplayFrame } from '../../lib/replayFrames';

/** Space toggles play unless focus is on something that uses Space itself. */
function ownsSpace(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || !!t.closest('button, a[href], input, textarea, select, summary, [contenteditable]:not([contenteditable="false"]), [role="button"]');
}

const noop = () => undefined;
/**
 * Playback speeds, shifted like the Play page's bot speeds: today's normal is the old slow, fast the old normal, and
 * slow is new and slower. `ms` paces Fast-forward (per action), `turnMs` the turn-by-turn Play (per turn).
 */
export const REPLAY_SPEEDS = [
  { label: 'slow', ms: 1_800, turnMs: 4_800 },
  { label: 'normal', ms: 900, turnMs: 3_600 },
  { label: 'fast', ms: 350, turnMs: 2_400 },
] as const;
export const DEFAULT_REPLAY_SPEED = 'normal';
type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]['label'];
type ReplayMode = 'turn' | 'fast' | 'step';

/**
 * The playmat for one recorded board state (a replay frame): both sides, the line it follows, and the viewer's hand at
 * the bottom. `viewer` (default 0) is the seat the board is drawn for: seat 1 (the guest of an online game) sees the
 * state turned round and masked as that seat could see it (src/net/view.ts viewFor), so its own hand is shown, never
 * the rival's.
 */
export function FrameBoard({ state, line: seatLine, names: seatNames, narrow, at, viewer = 0 }: { state: GameState; line?: LogEntry; names: [string, string]; narrow: boolean; at: number; viewer?: PlayerId }) {
  // a game around the frame's own copy of the state (the board components read a Game); seat 0 is always the viewer
  const g = useMemo(
    () => (viewer === 1 ? new ViewGame(viewFor(state, 1)) : new Game(structuredClone(state), [{ name: 'a', decide: async () => [0] }, { name: 'b', decide: async () => [0] }])),
    [state, viewer],
  );
  const names: [string, string] = viewer === 1 ? [seatNames[1], seatNames[0]] : seatNames;
  const line: LogEntry | undefined =
    viewer === 1 && seatLine
      ? { ...seatLine, player: seatLine.player === null ? null : ((1 - seatLine.player) as PlayerId), text: seatLine.player === 0 ? redactLine(seatLine.text) : seatLine.text }
      : seatLine;
  const ctx: BoardCtx = {
    g,
    pend: null,
    ix: EMPTY_IX,
    coach: null,
    targeting: null,
    narrow,
    menuUid: null,
    answer: noop,
    openMenu: noop,
    startTargeting: noop,
    cancelTargeting: noop,
    openTrash: noop,
    seatLabels: names,
  };
  const s = g.s;
  const handSize = narrow ? 'xs' : 'sm';
  return (
    <div className="pb pb-replay">
      <div className="pb-topbar">
        <div className="pb-turn">
          <span className="pb-turn-no">TURN {s.turn}</span>
          <span className={`pb-turn-who ${s.active === 0 ? 'me' : 'rival'}`}>{names[s.active]}</span>
          {s.overtime && <span className="pb-overtime">OVERTIME</span>}
        </div>
      </div>
      <div className="pb-mat">
        <PlayerSide p={1} ctx={ctx} />
        <div className={`pb-midline ${line?.player === 0 ? 'pb-tone-me' : line?.player === 1 ? 'pb-tone-rival' : ''}`} key={at}>
          <span>{line ? `${line.player === null ? '' : `${names[line.player]}: `}${line.text}` : ''}</span>
        </div>
        <PlayerSide p={0} ctx={ctx} />
        <div className="replay-hand">
          <span className="pb-label">{names[0] === 'you' ? 'Your' : `${names[0]}'s`} hand</span>
          <div className="pb-cards">
            {s.players[0].hand.map((u) => (
              <BoardCard key={u} uid={u} size={handSize} ctx={ctx} />
            ))}
            {!s.players[0].hand.length && <span className="muted small">empty</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReplayBoard({ data, names }: { data: ReplayData; names: [string, string] }) {
  const frames = data.frames;
  const n = frames.length;
  // "Watch" starts at the first move (UX-15)
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Replay opens in a readable turn-by-turn mode. Fast-forward preserves the
  // old frame playback, while Next action is an explicit one-frame step mode.
  const [mode, setMode] = useState<ReplayMode>('turn');
  const [speedLabel, setSpeedLabel] = useState<ReplaySpeed>(DEFAULT_REPLAY_SPEED);
  const speed = REPLAY_SPEEDS.find((x) => x.label === speedLabel) ?? REPLAY_SPEEDS[1];
  const narrow = useNarrow();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCur(0);
    setPlaying(false);
    setMode('turn');
  }, [data, n]);
  useEffect(() => {
    if (!playing) return;
    if (cur >= n - 1) return setPlaying(false);
    if (mode === 'step') return setPlaying(false);
    const t = setTimeout(() => {
      setCur((c) => {
        if (mode === 'fast') return Math.min(n - 1, c + 1);
        const turn = frames[c]?.line.turn ?? 0;
        const next = frames.findIndex((f, i) => i > c && f.line.turn > turn);
        return next < 0 ? n - 1 : next;
      });
    }, mode === 'turn' ? speed.turnMs : speed.ms);
    return () => clearTimeout(t);
  }, [playing, cur, n, speed, mode, frames]);
  // keep the current line in view
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${cur}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cur]);
  // arrow keys step through the game
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.key === 'ArrowRight') (setPlaying(false), setCur((c) => Math.min(n - 1, c + 1)));
      if (e.key === 'ArrowLeft') (setPlaying(false), setCur((c) => Math.max(0, c - 1)));
      if (e.key === ' ' && !ownsSpace(e.target)) {
        e.preventDefault();
        // Space is the keyboard equivalent of the readable turn-by-turn Play
        // mode. It also recovers cleanly after a manual Next action.
        if (playing && mode === 'turn') setPlaying(false);
        else {
          setMode('turn');
          if (cur >= n - 1) setCur(0);
          setPlaying(true);
        }
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [n, cur, playing, mode]);

  if (!n) return <p className="muted">No moves were recorded for this game.</p>;
  const turnOf = (i: number) => frames[i]?.line.turn ?? 0;
  const lastTurn = turnOf(n - 1);
  const turnNow = turnOf(cur);
  const firstLineOfTurn = (t: number) => Math.max(0, frames.findIndex((f) => f.line.turn >= t));
  const end = cur >= n - 1;
  const line = frames[cur]?.line;
  const togglePlayback = (nextMode: Exclude<ReplayMode, 'step'>) => {
    if (playing && mode === nextMode) return setPlaying(false);
    setMode(nextMode);
    if (end) setCur(0);
    setPlaying(true);
  };
  return (
    <div className="replay">
      <div className="replay-controls row small">
        <button className={mode === 'turn' ? 'primary' : ''} onClick={() => togglePlayback('turn')} title="Play one turn at a time, at the selected speed">
          {playing && mode === 'turn' ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button className={mode === 'fast' ? 'primary' : ''} onClick={() => togglePlayback('fast')} title="Play every action at the selected speed">
          {playing && mode === 'fast' ? '❚❚ Pause' : '⏩ Fast-forward'}
        </button>
        <button onClick={() => (setPlaying(false), setMode('step'), setCur((c) => Math.min(n - 1, c + 1)))} disabled={end} title="Advance one action">
          ⏭ Next action
        </button>
        <button onClick={() => (setPlaying(false), setCur(firstLineOfTurn(turnNow - 1)))} disabled={turnNow <= 1} title="Previous turn">
          ⏮
        </button>
        <button onClick={() => (setPlaying(false), setCur((c) => Math.max(0, c - 1)))} disabled={cur <= 0} title="Previous action (←)">
          ◀
        </button>
        <button onClick={() => (setPlaying(false), setCur(Math.min(n - 1, Math.max(cur + 1, firstLineOfTurn(turnNow + 1)))))} disabled={end} title="Next turn">
          ⏭
        </button>
        <select aria-label="Playback speed" value={speedLabel} onChange={(e) => setSpeedLabel(e.target.value as ReplaySpeed)} title="Speed of Play (per turn) and Fast-forward (per action)">
          {REPLAY_SPEEDS.map((x) => (
            <option key={x.label} value={x.label}>
              {x.label}
            </option>
          ))}
        </select>
        <span className="muted">
          Turn {turnNow} / {lastTurn} · move {cur + 1} / {n}
        </span>
      </div>
      <input className="replay-scrub" type="range" min={0} max={n - 1} value={cur} onChange={(e) => (setPlaying(false), setCur(+e.target.value))} aria-label="Scrub through the game" />
      <div className="replay-layout">
        <FrameBoard state={frames[Math.max(0, cur)]!.state} line={line} names={names} narrow={narrow} at={cur} />
        <div className="replay-log log" ref={listRef}>
          {frames.map(({ line: l }, i) => (
            <button
              key={i}
              data-i={i}
              className={`replay-line ${l.player === null ? 'sys' : l.player === 0 ? 'p0' : 'p1'} ${i === cur ? 'on' : ''} ${i > cur ? 'future' : ''}`}
              onClick={() => (setPlaying(false), setCur(i))}
            >
              <span className="muted">T{l.turn}</span> {l.player !== null && !l.text.startsWith('---') && <b>{names[l.player]}: </b>}
              {l.text}
            </button>
          ))}
          {end && <div className="sys replay-result">{data.final.winner === 'tie' ? 'Draw' : `${names[data.final.winner as 0 | 1]} wins`} ({data.final.winReason})</div>}
        </div>
      </div>
    </div>
  );
}
