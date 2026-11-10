import type { Agent, Decision } from '../engine/types';
import type { Game } from '../engine/engine';
import { randInt } from '../engine/rng';

/** Picks uniformly at random (uses a private RNG so it doesn't disturb game RNG). */
export class RandomAgent implements Agent {
  name = 'Random';
  private st = { rng: 12345 };
  constructor(seed = 12345) {
    this.st.rng = seed;
  }
  async decide(_g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'action') {
      // avoid passing too eagerly
      const nonPass = d.options.map((_, i) => i).filter((i) => d.options[i].action?.type !== 'pass');
      if (nonPass.length && randInt(this.st, 10) < 8) return [nonPass[randInt(this.st, nonPass.length)]];
    }
    return [randInt(this.st, d.options.length)];
  }
}
