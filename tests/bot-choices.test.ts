// Bot sub-choices (WP-B2): card choices decided by tag (never by prompt text), Gig swaps, yes/no rules, "may attack this
// turn" targets, and reactions that must not depend on which face-down Legend is which.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import type { Agent, CardInst, CardType, Decision, DeckList, Intent, PlayerId, Reaction, Zone } from '../src/engine/types';
import { CARD_TAG_POLICY, HeuristicAgent } from '../src/ai/heuristic';
import { cardValue } from '../src/ai/knowledge';
import { makeTierBot } from '../src/ai/tiers';

const first: Agent = { name: 'first', decide: async () => [0] };
const FILLER = 'animals_wrecker';

function setup(): Game {
  const deck: DeckList = { name: 'T', legends: ['dexter_deshawn_off_the_grid', 'v_streetkid', 'royce_psycho_on_the_edge'], main: Array(30).fill(FILLER), sideboard: [] };
  const g = Game.create([deck, { ...deck }], [first, first], { seed: 1, first: 0, log: false });
  g.s.turn = 3;
  g.s.phase = 'main';
  g.s.active = 0;
  for (const p of [0, 1] as PlayerId[]) {
    for (const u of [...g.P(p).hand]) g.move(u, 'deck');
    for (const u of g.P(p).legends) g.s.cards[u].spent = true;
  }
  return g;
}
function add(g: Game, p: PlayerId, defId: string, zone: Zone, opts: { spent?: boolean; lag?: boolean } = {}): CardInst {
  const uid = g.s.nextUid++;
  const c: CardInst = { uid, defId, owner: p, controller: p, zone, spent: !!opts.spent, faceUp: zone !== 'hand' && zone !== 'deck', lag: !!opts.lag, gear: [], host: null, enteredTurn: 0, goSolo: false };
  g.s.cards[uid] = c;
  g.zoneList(p, zone)!.push(uid);
  return c;
}
function eddies(g: Game, p: PlayerId, n: number) {
  for (let i = 0; i < n; i++) add(g, p, FILLER, 'eddies');
}
function gig(g: Game, p: PlayerId, sides: number, value: number) {
  const ps = g.P(p);
  const id = ps.fixer.find((x) => g.gig(x).sides === sides)!;
  ps.fixer = ps.fixer.filter((x) => x !== id);
  const gg = g.gig(id);
  gg.value = value;
  gg.controller = p;
  ps.gigs.push(id);
  return id;
}
const bot = () => new HeuristicAgent({ seed: 3 });

/** Low, middle and high static-value cards of a type (distinct values). */
function spread(type: CardType): { lo: string; mid: string; hi: string } {
  const xs = CARDS.filter((c) => c.type === type)
    .map((c) => ({ id: c.id, v: cardValue(c.id) }))
    .sort((a, b) => a.v - b.v);
  const mid = xs[Math.floor(xs.length / 2)];
  expect(xs[0].v).toBeLessThan(mid.v);
  expect(mid.v).toBeLessThan(xs[xs.length - 1].v);
  return { lo: xs[0].id, mid: mid.id, hi: xs[xs.length - 1].id };
}

describe('card choices follow the tag, not the prompt', () => {
  // every chooseCard prompt in the engine and card scripts (as of 2026-11-10), with its tag and intent
  type Want = 'best' | 'worst' | 'first' | 'rivalBest';
  const rows: [prompt: string, tag: string, intent: Intent | undefined, type: CardType, owner: 'mine' | 'rival', want: Want][] = [
    ['Discard a card (1/1)', 'discard', undefined, 'Unit', 'mine', 'worst'],
    ['Maman Brigitte: discard a Program', 'discard', undefined, 'Program', 'mine', 'worst'],
    ['Placide: discard a Program to bottom-deck a rival Unit?', 'discard', undefined, 'Program', 'mine', 'worst'],
    ['Alt Cunningham: discard a card with cost 3 to prevent the steal?', 'discard', 'neutral', 'Unit', 'mine', 'worst'],
    ['Alt Cunningham: play a Program from your trash', 'playFromTrash', 'help', 'Program', 'mine', 'best'],
    ['Three Mouths, One Desire: add a card to your hand', 'search', 'help', 'Unit', 'mine', 'best'],
    ['Hacked Corpo: add a Program to your hand', 'search', 'help', 'Program', 'mine', 'best'],
    ['Lizzy Wizzy: play a Program (cost ≤3) from hand or trash for free?', 'freePlay', 'help', 'Program', 'mine', 'best'],
    ['Move which Gear?', 'moveGear', 'help', 'Gear', 'mine', 'best'],
    ['We Gotta Live Together: play a Unit (cost ≤3) from your trash (1/2)', 'playFree', 'help', 'Unit', 'mine', 'best'],
    ['Choose a card to add to your hand (1/1)', 'search', 'help', 'Unit', 'mine', 'best'],
    ['Add a card from among them to your hand', 'search', 'help', 'Unit', 'mine', 'best'],
    ['V: add a BRAINDANCE Program from your trash to hand', 'search', 'help', 'Program', 'mine', 'best'],
    ['Detonate: defeat a rival Gear', 'defeat', 'harm', 'Gear', 'rival', 'rivalBest'],
    ['Meredith Stout: add a card from your trash to your hand?', 'search', 'help', 'Unit', 'mine', 'best'],
    ['Screw: add another Unit from your trash to your hand', 'search', 'help', 'Unit', 'mine', 'best'],
    ['Yorinobu: play a Unit with cost 4 or less for free?', 'playFree', 'help', 'Unit', 'mine', 'best'],
    ['Heywood Ripperdoc: defeat a Gear?', 'defeatGear', 'harm', 'Gear', 'rival', 'rivalBest'],
    ['Dum Dum: defeat a friendly Gear to draw 2 (else draw 1)?', 'defeatGear', 'neutral', 'Gear', 'mine', 'worst'],
    ['Gilded Maton: defeat a friendly Gear to defeat a rival Unit (cost ≤3)?', 'defeatGear', 'neutral', 'Gear', 'mine', 'worst'],
    ['River Ward: play a Gear (cost ≤2) for free', 'playFree', 'help', 'Gear', 'mine', 'best'],
    ['River Ward: trash 1 of the top 2 cards of your deck', 'trash', 'neutral', 'Unit', 'mine', 'worst'],
    ['Kiroshi Optics: look at a face-down Legend', 'look', 'neutral', 'Unit', 'mine', 'first'], // no information: never by value
    ['The Relic: play a Unit (cost ≤9) from your trash for free', 'playFree', 'help', 'Unit', 'mine', 'best'],
    ['The Heist: add a Gear to your hand', 'search', 'help', 'Gear', 'mine', 'best'],
    ['Viktor Vektor: play a Cyberware Gear (cost ≤2) from your trash', 'playFree', 'help', 'Gear', 'mine', 'best'],
    ['Rogue Amendiares: discard 1', 'discard', undefined, 'Unit', 'mine', 'worst'],
  ];
  it.each(rows)('%s', (prompt, tag, intent, type, owner, want) => {
    const g = setup();
    eddies(g, 0, 20); // every own card counts as castable soon, so only the static value orders them
    const { lo, mid, hi } = spread(type);
    const holder: PlayerId = owner === 'mine' ? 0 : 1;
    const cards = [mid, hi, lo].map((id) => add(g, holder, id, 'trash'));
    const d: Decision = { player: 0, kind: 'card', prompt, tag, intent, min: 1, max: 1, options: cards.map((c) => ({ label: c.defId, uid: c.uid })) };
    expect(bot().chooseCardOpt(g, d)).toBe(want === 'worst' ? 2 : want === 'first' ? 0 : 1);
  });

  it('removal with a harm intent targets the rival, and declines when only own cards are offered', () => {
    const g = setup();
    const { lo, hi } = spread('Gear');
    const mine = add(g, 0, hi, 'trash');
    const theirs = add(g, 1, lo, 'trash');
    const opts = [mine, theirs].map((c) => ({ label: c.defId, uid: c.uid }));
    const d: Decision = { player: 0, kind: 'card', prompt: 'Heywood Ripperdoc: defeat a Gear?', tag: 'defeatGear', intent: 'harm', min: 1, max: 1, options: [...opts, { label: 'None', key: 'none' }] };
    expect(bot().chooseCardOpt(g, d)).toBe(1);
    expect(bot().chooseCardOpt(g, { ...d, options: [opts[0], { label: 'None', key: 'none' }] })).toBe(1);
  });

  it('every chooseCard tag in the engine and card scripts has a policy', () => {
    const files = ['src/engine/engine.ts', ...readdirSync('src/engine/scripts').map((f) => `src/engine/scripts/${f}`)];
    const tags = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (let at = src.indexOf('chooseCard('); at >= 0; at = src.indexOf('chooseCard(', at + 1)) {
        const call = src.slice(at, src.indexOf(');', at));
        if (call.startsWith('chooseCard(p: PlayerId')) continue; // the definition
        const m = /'(\w+)'\s*(?:,\s*(?:'\w+'|\w+))?\s*,?\s*$/.exec(call);
        expect(m, `${f}: ${call.slice(0, 80)}`).not.toBeNull();
        tags.add(m![1]);
      }
    }
    expect(tags.size).toBeGreaterThan(5);
    for (const t of tags) expect(CARD_TAG_POLICY[t], `tag '${t}'`).toBeDefined();
  });
});

describe('Gig swaps', () => {
  it('MaxTac AV gives away the friendly Gig that costs least and takes the best rival Gig', async () => {
    const g = setup();
    g.agents[0] = bot();
    const d20 = gig(g, 0, 20, 17);
    const d4 = gig(g, 0, 4, 1);
    gig(g, 0, 6, 2);
    gig(g, 1, 8, 3);
    const d10 = gig(g, 1, 10, 6);
    eddies(g, 0, 5);
    await g.playFromHand(0, add(g, 0, 'maxtac_av', 'hand').uid);
    await g.resolvePending();
    expect(g.P(0).gigs).toContain(d20);
    expect(g.P(1).gigs).toContain(d4);
    expect(g.P(0).gigs).toContain(d10);
  });

  it('declines an optional swap that gains nothing, and pairs give/take in a forced one', () => {
    const g = setup();
    const mine = gig(g, 0, 6, 3);
    const theirs = gig(g, 1, 6, 3);
    const b = bot();
    const give: Decision = {
      player: 0,
      kind: 'gig',
      prompt: 'swap',
      tag: 'swapGive',
      intent: 'harm',
      min: 1,
      max: 1,
      options: [{ label: 'mine', gig: mine }, { label: 'None', key: 'none' }],
    };
    expect(b.chooseGigOpt(g, give)).toBe(1);
    // forced (Hanako-style): give the low Gig, then take the rival Gig the pair was chosen for
    const g2 = setup();
    const low = gig(g2, 0, 4, 1);
    const high = gig(g2, 0, 20, 18);
    const r1 = gig(g2, 1, 6, 2);
    const r2 = gig(g2, 1, 10, 9);
    const b2 = bot();
    const give2: Decision = { ...give, options: [{ label: 'high', gig: high }, { label: 'low', gig: low }] };
    expect(b2.chooseGigOpt(g2, give2)).toBe(1);
    const take: Decision = { ...give, tag: 'swapTake', intent: 'help', options: [{ label: 'r1', gig: r1 }, { label: 'r2', gig: r2 }] };
    expect(b2.chooseGigOpt(g2, take)).toBe(1);
  });
});

describe('yes/no rules', () => {
  const ask = (tag: string, prompt: string, source?: number): Decision => ({
    player: 0,
    kind: 'yesno',
    prompt,
    tag,
    source,
    min: 1,
    max: 1,
    options: [
      { label: 'Yes', key: 'yes' },
      { label: 'No', key: 'no' },
    ],
  });

  it('Kerry Eurodyne keeps a max roll (it draws) and rerolls a middling one', () => {
    const g = setup();
    const kerry = add(g, 0, 'kerry_eurodyne_axe_attitude_audience', 'legends');
    gig(g, 0, 20, 20);
    expect(bot().yesNo(g, ask('kerryReroll', 'Kerry Eurodyne: reroll your d20 (rolled 20)?', kerry.uid))).toBe(false);
    const g2 = setup();
    gig(g2, 0, 20, 7);
    expect(bot().yesNo(g2, ask('kerryReroll', 'Kerry Eurodyne: reroll your d20 (rolled 7)?', kerry.uid))).toBe(true);
  });

  it('Jackie Welles takes the hit only for a Unit worth more than herself', () => {
    const g = setup();
    eddies(g, 0, 2);
    const jackie = add(g, 0, 'jackie_welles_mama_s_favorite', 'legends');
    const big = add(g, 0, FILLER, 'field'); // 10 power, cost 6
    const small = add(g, 0, 'swordwise_huscle', 'field');
    const rival = add(g, 1, FILLER, 'field');
    const name = (c: CardInst) => g.name(c);
    expect(bot().yesNo(g, ask('replaceDefeat', `${name(jackie)}: pay 1 €$ to defeat Jackie instead of ${name(small)}?`, jackie.uid))).toBe(false);
    g.s.attack = { attacker: rival.uid, attackerPlayer: 1, targetUnit: big.uid, targetGigs: null, step: 'fight', ended: false };
    expect(bot().yesNo(g, ask('replaceDefeat', `${name(jackie)}: pay 1 €$ to defeat Jackie instead of ${name(big)}?`, jackie.uid))).toBe(false);
    // as a Unit on the field (gone solo) she is worth her body only: saving a bigger Unit is right
    const g2 = setup();
    eddies(g2, 0, 2);
    const j2 = add(g2, 0, 'swordwise_huscle', 'field');
    const big2 = add(g2, 0, FILLER, 'field');
    const r2 = add(g2, 1, FILLER, 'field');
    g2.s.attack = { attacker: r2.uid, attackerPlayer: 1, targetUnit: big2.uid, targetGigs: null, step: 'fight', ended: false };
    expect(bot().yesNo(g2, ask('replaceDefeat', `x: pay 1 €$ to defeat Jackie instead of ${g2.name(big2)}?`, j2.uid))).toBe(true);
  });

  it('Tetratronic Rippler trashes only a below-average top card, and never from a short deck', () => {
    const { lo, hi } = spread('Unit');
    const onTop = (id: string, deckSize?: number) => {
      const g = setup();
      const deck = g.P(0).deck;
      if (deckSize !== undefined) deck.splice(deckSize - 1);
      add(g, 0, id, 'deck');
      deck.unshift(deck.pop()!);
      return g;
    };
    const q = ask('trashTop', 'Tetratronic Rippler: trash the top card?');
    expect(bot().yesNo(onTop(lo), q)).toBe(true);
    expect(bot().yesNo(onTop(hi), q)).toBe(false);
    expect(bot().yesNo(onTop(lo, 6), q)).toBe(false);
  });

  it('Shattered Memories: no draw 5 from a deck that would run out', () => {
    const g = setup();
    expect(bot().yesNo(g, ask('draw', 'Shattered Memories: draw 5?'))).toBe(true);
    g.P(0).deck.splice(4);
    expect(bot().yesNo(g, ask('draw', 'Shattered Memories: draw 5?'))).toBe(false);
  });

  it('pure gains are always taken', () => {
    const g = setup();
    for (const tag of ['addToHand', 'freePlay', 'playFree', 'call']) expect(bot().yesNo(g, ask(tag, '?'))).toBe(true);
  });
});

describe('"may attack this turn" goes to a lagging Unit', () => {
  for (const tag of ['adrenaline', 'lagAttack']) {
    it(tag, async () => {
      const g = setup();
      const old = add(g, 0, 'royce_don_t_call_me_simon', 'field'); // ready, not lagging
      const fresh = add(g, 0, 'swordwise_huscle', 'field', { lag: true });
      const d: Decision = { player: 0, kind: 'unit', prompt: 'give', tag, intent: 'help', min: 1, max: 1, options: [old, fresh].map((c) => ({ label: c.defId, uid: c.uid })) };
      await expect(bot().decide(g, d)).resolves.toEqual([1]);
    });
  }

  it('Valentino Street Racer gives Adrenaline to the Unit played this turn', async () => {
    const g = setup();
    g.agents[0] = bot();
    eddies(g, 0, 3);
    add(g, 0, 'royce_don_t_call_me_simon', 'field');
    const fresh = add(g, 0, 'swordwise_huscle', 'field', { lag: true });
    await g.playFromHand(0, add(g, 0, 'valentino_street_racer', 'hand').uid);
    await g.resolvePending();
    expect(g.hasKw(fresh.uid, 'adrenaline')).toBe(true);
  });
});

describe('reactions ignore which face-down Legend is which', () => {
  /** Rival (P0) attacks P1's Gigs; P1 can call any of its three face-down Legends. */
  function attackSpot(order: number[]) {
    const g = setup();
    const att = add(g, 0, FILLER, 'field');
    gig(g, 1, 6, 3);
    gig(g, 1, 8, 4);
    eddies(g, 1, 6);
    const legs = g.P(1).legends;
    const ids = legs.map((u) => g.c(u).defId);
    legs.forEach((u, k) => {
      g.c(u).spent = false;
      g.c(u).defId = ids[order[k]];
    });
    g.s.attack = { attacker: att.uid, attackerPlayer: 0, targetUnit: null, targetGigs: 1, step: 'react', ended: false };
    att.spent = true;
    const rx = g.legalReactions(1);
    const d: Decision = { player: 1, kind: 'reaction', prompt: 'react?', min: 1, max: 1, options: rx.map((x) => ({ label: g.describeAction(x), action: x })) };
    return { g, d, rx };
  }
  const unknownSlot = (rx: Reaction[], i: number) => (rx[i].type === 'call' ? rx.filter((x) => x.type === 'call').indexOf(rx[i]) : -1);

  for (const level of ['medium', 'hard']) {
    it(`${level}: same choice whatever the hidden order, and never a later unknown slot`, async () => {
      const picks: string[] = [];
      for (const order of [
        [0, 1, 2],
        [2, 0, 1],
        [1, 2, 0],
      ]) {
        const { g, d, rx } = attackSpot(order);
        expect(rx.filter((x) => x.type === 'call').length).toBe(3);
        const [i] = await makeTierBot(level, 5).decide(g, d);
        expect(unknownSlot(rx, i)).toBeLessThanOrEqual(0);
        picks.push(rx[i].type);
      }
      expect(new Set(picks).size).toBe(1);
    }, 60_000);
  }
});
