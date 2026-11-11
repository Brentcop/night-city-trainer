// Recording a game for the visual replay, without React: the game is re-simulated once with its seeds and the board
// state is captured after every log line. Used on the page (ReplayBoard) and in the game worker ("Watch").
import { Game } from '../engine/engine';
import type { Agent, DeckList, GameState, LogEntry, PlayerId } from '../engine/types';

/** The board right after one log line. */
export interface ReplayFrame {
  /** board state (log omitted to keep memory small) */
  state: GameState;
  /** the log line this frame follows */
  line: LogEntry;
  /** that line's position among every line the game logged, counting lines the engine has since trimmed from its log */
  at: number;
}
export interface ReplayData {
  final: GameState;
  frames: ReplayFrame[];
}

/**
 * Capture a frame after every log line `g` writes from now on. The engine drops its oldest lines once the log grows
 * long, so each frame keeps its own line and absolute position instead of relying on frame i = log line i.
 */
export function captureFrames(g: Game): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  let total = g.s.log.length;
  g.onLog = () => {
    const { log, trace: _trace, ...rest } = g.s;
    const line = log[log.length - 1]; // the line just written (Game.log calls this after pushing it)
    if (!line) return;
    frames.push({ state: structuredClone({ ...rest, log: [] }) as GameState, line: { ...line }, at: total++ });
  };
  return frames;
}

/** Where a frame's line sits in the final (possibly trimmed) log, or -1 if it was trimmed away. */
export function lineInFinalLog(data: ReplayData, frame: ReplayFrame): number {
  const last = data.frames[data.frames.length - 1];
  const totalLines = last ? last.at + 1 : data.final.log.length;
  const i = frame.at - (totalLines - data.final.log.length);
  return i >= 0 && i < data.final.log.length ? i : -1;
}

/** Re-simulate a game and capture a board frame after every log line. */
export async function recordReplay(decks: [DeckList, DeckList], agents: [Agent, Agent], seed: number, first?: PlayerId): Promise<ReplayData> {
  const g = Game.create(decks, agents, { seed, first });
  const frames = captureFrames(g);
  const final = await g.run();
  return { final, frames };
}
