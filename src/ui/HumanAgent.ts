import type { Agent, Decision } from '../engine/types';
import type { Game } from '../engine/engine';

/** Agent driven by the UI: decide() parks a pending decision until the UI answers it. */
export class HumanAgent implements Agent {
  name = 'You';
  pending: { d: Decision; resolve: (r: number[]) => void } | null = null;
  onChange: (() => void) | null = null;
  autoMulligan = false;

  decide(_g: Game, d: Decision): Promise<number[]> {
    return new Promise((resolve) => {
      this.pending = { d, resolve };
      this.onChange?.();
    });
  }

  answer(i: number) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    p.resolve([i]);
    this.onChange?.();
  }
}
