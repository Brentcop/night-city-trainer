// Power and keyword lookups walk the active sources without building a list (Game.eachSource, used by rawPower and hasKw
// in src/engine/game/mods.ts, and by sources() itself). This pins them to the rule as it was written before: the list of
// sources built the old way (kept below), then each source's power or keyword hook. At every decision of Medium games over
// the whole library (Gear, face-down Legends, spent cards, power and keyword mods), for every card in the game.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import type { Agent, CardInst, Decision, Keyword, PlayerId } from '../src/engine/types';
import { makeTierBot } from '../src/ai/tiers';
import { loadLibrary } from '../scripts/lib-node';

const KEYWORDS: Keyword[] = ['blocker', 'adrenaline', 'goSolo', 'quick'];

/** sources() as it was written before eachSource. */
function oldSources(g: Game, p?: PlayerId): { self: CardInst; host: CardInst; controller: PlayerId }[] {
  const out: { self: CardInst; host: CardInst; controller: PlayerId }[] = [];
  const ps = p === undefined ? ([0, 1] as PlayerId[]) : [p];
  for (const pl of ps) {
    const P = g.P(pl);
    for (const uid of [...P.field, ...P.legends]) {
      const c = g.s.cards[uid];
      if (c.zone === 'legends' && !c.faceUp) continue;
      out.push({ self: c, host: c, controller: pl });
      for (const gu of c.gear) out.push({ self: g.s.cards[gu], host: c, controller: pl });
    }
  }
  return out;
}

const seen = { power: 0, keywords: 0, checks: 0 };

/** rawPower as it was written before (from the list of sources). */
function oldRawPower(g: Game, c: CardInst): number {
  let p = g.def(c).power ?? 0;
  for (const gu of c.gear) p += g.def(gu).power ?? 0;
  for (const m of g.s.mods) if (m.kind === 'power' && m.target === c.uid) p += m.amount ?? 0;
  if (c.zone === 'field' || c.zone === 'legends') {
    for (const src of oldSources(g)) {
      const fn = g.script(src.self).power;
      if (fn) {
        const v = fn(g, src.self, src.host, c);
        if (v !== 0) seen.power++;
        p += v;
      }
    }
  }
  return p;
}

/** hasKw as it was written before. */
function oldHasKw(g: Game, c: CardInst, kw: Keyword): boolean {
  if (g.def(c).keywords.includes(kw)) return true;
  for (const gu of c.gear) if (g.def(gu).keywords.includes(kw)) return true;
  if (g.s.mods.some((m) => m.kind === 'keyword' && m.target === c.uid && m.value === kw)) return true;
  for (const src of oldSources(g)) {
    const fn = g.script(src.self).keywords;
    if (fn && fn(g, src.self, src.host, c).includes(kw)) {
      seen.keywords++;
      return true;
    }
  }
  return false;
}

const ids = (xs: { self: CardInst; host: CardInst; controller: PlayerId }[]) => xs.map((x) => [x.self.uid, x.host.uid, x.controller]);

function compare(g: Game) {
  for (const p of [undefined, 0, 1] as (PlayerId | undefined)[]) {
    const now = g.sources(p);
    const old = oldSources(g, p);
    expect(ids(now)).toEqual(ids(old));
    now.forEach((x, i) => {
      expect(x.self).toBe(old[i]!.self);
      expect(x.host).toBe(old[i]!.host);
    });
  }
  for (const c of Object.values(g.s.cards)) {
    seen.checks++;
    const want = oldRawPower(g, c);
    if (g.rawPower(c) !== want) throw new Error(`rawPower of ${c.defId} (${c.zone}) on turn ${g.s.turn}: ${g.rawPower(c)}, was ${want}`);
    if (g.rawPower(c.uid) !== want) throw new Error(`rawPower by uid of ${c.defId}`);
    for (const kw of KEYWORDS) if (g.hasKw(c, kw) !== oldHasKw(g, c, kw)) throw new Error(`hasKw ${kw} of ${c.defId} (${c.zone}) on turn ${g.s.turn}`);
  }
}

class Checker implements Agent {
  name: string;
  constructor(
    private bot: Agent,
    private live: () => Game,
  ) {
    this.name = bot.name;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (g === this.live()) compare(g);
    return this.bot.decide(g, d);
  }
}

describe('power and keyword lookups walk the sources in the old order', () => {
  const lib = loadLibrary();
  const half = Math.ceil(lib.length / 2);
  // every library deck, Medium against Medium, both seats first
  const games = Array.from({ length: half }, (_, k) => ({ a: lib[k]!, b: lib[(k + half) % lib.length]!, seed: 880_000 + k, first: (k % 2) as PlayerId }));
  for (let i = 0; i < games.length; i += 9) {
    const chunk = games.slice(i, i + 9);
    it(`games ${i + 1} to ${i + chunk.length}`, async () => {
      for (const x of chunk) {
        let g: Game | null = null;
        const live = () => g!;
        g = Game.create([x.a.deck, x.b.deck], [new Checker(makeTierBot('medium', x.seed), live), new Checker(makeTierBot('medium', x.seed + 7777), live)], { seed: x.seed, first: x.first, log: false });
        await g.run();
        compare(g);
      }
    }, 60_000);
  }
  it('met every kind of hook on the way', () => {
    // the pool's power hooks (Saburo, Saul Bright, Royce, Meredith Stout) and keyword hook (Adrenaline Converter) did count
    expect(seen.checks).toBeGreaterThan(10_000);
    expect(seen.power).toBeGreaterThan(0);
    expect(seen.keywords).toBeGreaterThan(0);
  });
});
