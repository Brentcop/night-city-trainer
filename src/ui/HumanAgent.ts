import type { Agent, Decision } from '../engine/types';
import type { Game } from '../engine/engine';

/** Agent driven by the UI: decide() parks a pending decision until the UI answers it. */
export class HumanAgent implements Agent {
  name = 'You';
  pending: { d: Decision; resolve: (r: number[]) => void; reject?: (e: Error) => void } | null = null;
  onChange: (() => void) | null = null;
  autoMulligan = false;
  /** you choose which Eddies / Legends pay each cost (a 'pay' decision when the choice is real) */
  readonly choosesPayment = true;
  /** you choose the order of your own pending effects (an 'order' decision when 2+ would each do something) */
  readonly choosesOrder = true;

  decide(_g: Game, d: Decision): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.pending = { d, resolve, reject };
      this.onChange?.();
    });
  }

  /** Abandon the game: the pending decision (if any) rejects so the game loop unwinds instead of waiting forever. */
  cancel() {
    const p = this.pending;
    this.pending = null;
    p?.reject?.(new Error('game cancelled'));
  }

  /**
   * Answer decision `d` with option `i`. Ignored (returns false) unless `d` is the decision currently pending and `i`
   * is one of its options, so a stale click from an earlier prompt can never answer the next one.
   */
  answer(d: Decision | null, i: number): boolean {
    const p = this.pending;
    if (!p || !d || p.d !== d) return false;
    if (!Number.isInteger(i) || i < 0 || i >= d.options.length) return false;
    this.pending = null;
    p.resolve([i]);
    this.onChange?.();
    return true;
  }
}
