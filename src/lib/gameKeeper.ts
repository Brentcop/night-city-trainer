// Where a practice game is kept while it is played (src/ui/usePracticeGame.ts drives it; no React here, so the rules are
// tested on their own). A quick game is kept in the autosave (src/lib/savedGames.ts), a multi-day game in its own list
// (src/lib/multiDay.ts). Written at each new decision of yours and when the page is hidden or left. When the game ends:
// finished or conceded, it is recorded (practice log and replay) and then its autosave or multi-day entry is removed,
// but only if the record was written; "Exit and discard" removes the autosave; "Save and exit" and leaving the page keep
// it. Every storage write is checked: a refusal (storage full or blocked) is reported once through `onProblem` (the
// board shows it) until a write succeeds again. With saved games turned off (`saves`), no autosave is written.
import type { GameState } from '../engine/types';
import { recordFinished, type Running } from './practiceSession';
import type { PracticeReplay } from './practiceReplays';
import { buildSave, clearAutosave, deleteSlot, writeAutosave, type SavedGame } from './savedGames';
import { botEntry, botMark, removeBotGame, writeBotGame, type BotMultiDayRun } from './multiDay';

/** A save of the running game (null when there is nothing to come back to: no decision yet, over, or failed). */
export function saveOfRun(run: Running | null, coach: boolean, id = 'auto', name?: string): SavedGame | null {
  if (!run || run.cancelled || run.restoring || run.error || run.conceded || run.g.s.winner !== null) return null;
  return buildSave({ replay: run.replay, grades: run.grades, stable: run.stable, log: run.g.s.log }, { id, name, saved: new Date().toISOString(), coach });
}

/** The multi-day game being played (null: a quick game). `replayId` is null until the started game is known. */
export interface MultiDayRun extends BotMultiDayRun {
  replayId: string | null;
}

export const AUTOSAVE_REFUSED = 'This browser refused to save the game (its storage is full or blocked). If you leave now, it can’t be resumed.';
export const MULTIDAY_REFUSED = 'This browser refused to save this multi-day game (its storage is full or blocked). If you leave now, your latest moves may be missing from Ongoing games.';
export const RECORD_REFUSED = 'This browser refused to record the result (its storage is full or blocked), so the game is not in your history yet. Its save is kept: free some space and finish it again from the Play screen.';
export const RECORD_REFUSED_MD = 'This browser refused to record the result (its storage is full or blocked), so the game is not in your history yet. It stays in Ongoing games: free some space and finish it again.';

export interface KeeperOptions {
  /** coach mode is on (kept in the save) */
  coach: () => boolean;
  /** saved games are on (site config): off, no autosave is written (a multi-day game still is: it lives in its own list) */
  saves: () => boolean;
  now: () => number;
  /** a write was refused: say so on the board */
  onProblem: (text: string) => void;
}

/**
 * "Delete" in the can't-resume dialog: removes the save from the list it came from (the autosave, a named slot, or a
 * multi-day game's entry: APP-4).
 */
export function removeUnresumable(from: 'auto' | 'slot' | 'md', id: string): void {
  if (from === 'auto') clearAutosave();
  else if (from === 'md') removeBotGame(id);
  else deleteSlot(id);
}

export class GameKeeper {
  /** the multi-day game being played, if any */
  md: MultiDayRun | null = null;
  private failing = false;
  private recorded: { id: string; ok: boolean } | null = null;

  constructor(private o: KeeperOptions) {}

  /** the multi-day game this run belongs to, if any */
  mdOf(run: Running | null): MultiDayRun | null {
    const m = this.md;
    if (!m || !run) return null;
    if (m.replayId === null) m.replayId = run.replay.id;
    return m.replayId === run.replay.id ? m : null;
  }

  private report(ok: boolean, text: string) {
    if (ok) {
      this.failing = false;
      return;
    }
    if (this.failing) return;
    this.failing = true;
    this.o.onProblem(text);
  }

  /** Write the running game where it belongs. True when it is stored (or there was nothing to store). */
  store(run: Running | null): boolean {
    const m = this.mdOf(run);
    if (!m && !this.o.saves()) return true;
    const s = saveOfRun(run, this.o.coach(), m ? 'md' : 'auto');
    if (!s || !run) return true;
    if (!m) {
      const ok = writeAutosave(s);
      this.report(ok, AUTOSAVE_REFUSED);
      return ok;
    }
    if (m.wentFirst === undefined) m.wentFirst = run.g.s.first === 0;
    const why = writeBotGame(botEntry(m, s, this.o.now()));
    this.report(!why, MULTIDAY_REFUSED);
    return !why;
  }

  /** Record a finished (or conceded) game; false when storage refused it. */
  record(replay: PracticeReplay, st: GameState): boolean {
    const m = this.md && this.md.replayId === replay.id ? this.md : null;
    // a multi-day game finished after its deadline is recorded as usual, marked late
    if (m) replay.multiDay = botMark({ days: m.days, late: m.late || this.o.now() > m.deadline });
    const ok = recordFinished(replay, st);
    this.recorded = { id: replay.id, ok };
    if (!ok) this.o.onProblem(m ? RECORD_REFUSED_MD : RECORD_REFUSED);
    return ok;
  }

  /**
   * The game ended for good. Finished or conceded: its autosave or multi-day entry goes once the record is written (kept
   * otherwise, so the game isn't lost). 'quit' ("Exit and discard"): a quick game's autosave goes; a multi-day game stays.
   */
  closed(run: Running, why: 'finished' | 'conceded' | 'quit') {
    const m = this.md && this.md.replayId === run.replay.id ? this.md : null;
    const recorded = this.recorded?.id === run.replay.id && this.recorded.ok;
    if (!m) {
      if (why === 'quit' || recorded) clearAutosave();
    } else if (why !== 'quit' && recorded) removeBotGame(run.replay.id);
  }
}
