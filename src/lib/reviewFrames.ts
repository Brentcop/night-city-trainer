// The board at each decision of a reviewed game: the game is replayed from both seats' recorded answers (no bot
// thinking, so it takes moments), with the visual replay's frames (src/lib/replayFrames.ts), and each answer is tied to
// the frame showing the board when it was given.
import { Game } from '../engine/engine';
import type { Agent, Decision, DeckList, PlayerId } from '../engine/types';
import type { SeatAnswers } from '../ai/reviewer';
import { captureFrames, type ReplayData } from './replayFrames';
import { CONCEDED_REASON, type SessionEnding } from './practiceVerdict';

export interface ReviewFrames {
  data: ReplayData;
  /** per seat, per answer number: the index of the last frame before that answer (-1: before the first log line) */
  at: [number[], number[]];
}

/**
 * Answers one seat from its recorded answers; when they run out, a game the session ended (a concession, a clock, an
 * abandoned online game: src/lib/practiceVerdict.ts sessionEnding) ends there, whichever seat runs out, and any other
 * picks option 0.
 */
class AnswerAgent implements Agent {
  private k = 0;
  marks: number[] = [];
  choosesPayment: boolean;
  choosesOrder: boolean;
  confirmsEndTurn: boolean;
  constructor(
    public name: string,
    private a: SeatAnswers,
    private frameCount: () => number,
    private end: SessionEnding | null,
  ) {
    this.choosesPayment = a.pay;
    this.choosesOrder = a.order;
    this.confirmsEndTurn = !!a.endTurn;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    this.marks.push(this.frameCount() - 1);
    const c = this.a.choices[this.k++];
    if (c) return c;
    if (this.end) g.endGame(this.end.winner, this.end.reason);
    return d.min > 0 ? [0] : [];
  }
}

/**
 * `end`: how the session ended the game (absent: `conceded` means seat 0 conceded, as in records before online games).
 */
export async function reviewFrames(
  game: { decks: [DeckList, DeckList]; seed: number; first?: PlayerId; end?: SessionEnding | null; conceded?: boolean },
  answers: [SeatAnswers, SeatAnswers],
): Promise<ReviewFrames> {
  let captured: ReplayData['frames'] = [];
  const count = () => captured.length;
  const end = game.end !== undefined ? game.end : game.conceded ? { winner: 1 as const, reason: CONCEDED_REASON } : null;
  const agents = [new AnswerAgent('a', answers[0], count, end), new AnswerAgent('b', answers[1], count, end)] as const;
  const g = Game.create(game.decks, [agents[0], agents[1]], { seed: game.seed, first: game.first });
  captured = captureFrames(g);
  const final = await g.run();
  return { data: { final, frames: captured }, at: [agents[0].marks, agents[1].marks] };
}
