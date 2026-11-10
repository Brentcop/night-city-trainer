import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/engine';
import type { Agent, CardInst, DeckList, PlayerId, Zone } from '../src/engine/types';

/** Picks the first option for everything (Yes, first candidate, first mode). */
const first: Agent = { name: 'first', decide: async () => [0] };

function setup(): Game {
  const deck: DeckList = {
    name: 'G',
    legends: ['hanako_arasaka_daughter_of_the_emperor', 'padre_man_of_the_cross', 'saburo_arasaka_stubborn_patriarch'],
    main: Array(40).fill('emergency_atlus'),
    sideboard: [],
  };
  const g = Game.create([deck, { ...deck }], [first, first], { seed: 1, first: 0, log: false });
  g.s.turn = 3;
  g.s.phase = 'main';
  g.s.active = 0;
  for (const p of [0, 1] as PlayerId[]) {
    const ps = g.P(p);
    for (const u of [...ps.hand]) g.move(u, 'deck');
    for (const u of ps.legends) g.s.cards[u].spent = true; // don't let legends pay unless a test wants it
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
  for (let i = 0; i < n; i++) add(g, p, 'emergency_atlus', 'eddies');
}
function gig(g: Game, p: PlayerId, value: number, sides = 20) {
  const ps = g.P(p);
  const id = ps.fixer.find((x) => g.gig(x).sides === sides) ?? ps.fixer[0];
  ps.fixer = ps.fixer.filter((x) => x !== id);
  const gg = g.gig(id);
  gg.value = Math.min(value, gg.sides);
  gg.controller = p;
  ps.gigs.push(id);
  return id;
}
async function play(g: Game, p: PlayerId, c: CardInst) {
  await g.playFromHand(p, c.uid);
  await g.resolvePending();
}

describe('Green cards', () => {
  it('Corporate Surveillance spends a rival Unit with cost <= 4', async () => {
    const g = setup();
    eddies(g, 0, 2);
    const big = add(g, 1, 'maxtac_heavy', 'field');
    const small = add(g, 1, 'field_operator', 'field');
    await play(g, 0, add(g, 0, 'corporate_surveillance', 'hand'));
    expect(big.spent).toBe(false);
    expect(small.spent).toBe(true);
  });

  it("Memory Relapse spends, locks readying, draws on even cred", async () => {
    const g = setup();
    eddies(g, 0, 4);
    gig(g, 0, 4, 4);
    const t = add(g, 1, 'emergency_atlus', 'field');
    await play(g, 0, add(g, 0, 'memory_relapse', 'hand'));
    expect(t.spent).toBe(true);
    expect(g.ready(t.uid)).toBe(false);
    expect(g.P(0).hand.length).toBe(1);
  });

  it('MaxTac Heavy and Zetatech Berserk cost reductions', () => {
    const g = setup();
    const h = add(g, 0, 'maxtac_heavy', 'hand');
    add(g, 1, 'emergency_atlus', 'field');
    add(g, 1, 'emergency_atlus', 'field');
    expect(g.playCost(h.uid, 0)).toBe(5);
    const z = add(g, 0, 'zetatech_berserk', 'hand');
    for (const u of g.P(0).legends) g.c(u).faceUp = true;
    expect(g.playCost(z.uid, 0)).toBe(3);
  });

  it('Saul Bright gives other attackers +2; Saburo gives Arasaka attackers +1', async () => {
    const g = setup();
    const saul = add(g, 0, 'saul_bright_stormrider', 'field');
    const op = add(g, 0, 'field_operator', 'field'); // Arasaka, 2 power
    g.c(g.P(0).legends.find((u) => g.def(u).id === 'saburo_arasaka_stubborn_patriarch')!).faceUp = true;
    expect(g.power(op)).toBe(2);
    g.s.attack = { attacker: op.uid, attackerPlayer: 0, targetUnit: null, targetGigs: 1, step: 'declare', ended: false };
    expect(g.power(op)).toBe(5);
    g.s.attack.attacker = saul.uid;
    expect(g.power(saul)).toBe(14);
    g.s.attack = null;
  });

  it('Hanako draws 1 per friendly value-pair at start of turn', async () => {
    const g = setup();
    g.c(g.P(0).legends.find((u) => g.def(u).id === 'hanako_arasaka_daughter_of_the_emperor')!).faceUp = true;
    gig(g, 0, 3, 4);
    gig(g, 0, 3, 6);
    gig(g, 0, 5, 8);
    gig(g, 0, 5, 10);
    g.emit('turnStart', { player: 0 });
    await g.resolvePending();
    expect(g.P(0).hand.length).toBe(2);
  });

  it('Jackie Welles is defeated instead of a friendly Unit', async () => {
    const g = setup();
    eddies(g, 0, 1);
    const jackie = add(g, 0, 'jackie_welles_mama_s_favorite', 'legends');
    const u = add(g, 0, 'emergency_atlus', 'field');
    const ok = await g.defeat(u.uid);
    expect(ok).toBe(false);
    expect(u.zone).toBe('field');
    expect(jackie.zone).toBe('removed');
  });

  it('Maelstrom Zealots defeats the Unit that beats it', async () => {
    const g = setup();
    const z = add(g, 0, 'maelstrom_zealots', 'field');
    const r = add(g, 1, 'emergency_atlus', 'field', { spent: true });
    await g.attack(0, z.uid, { unit: r.uid, gigs: null });
    expect(z.zone).toBe('trash');
    expect(r.zone).toBe('trash');
  });

  it('Riot Shield taxes rival Go Solo', () => {
    const g = setup();
    const host = add(g, 0, 'emergency_atlus', 'field');
    const shield = add(g, 0, 'riot_shield', 'hand');
    g.equip(shield.uid, host.uid);
    const jackie = add(g, 1, 'jackie_welles_mama_s_favorite', 'legends');
    expect(g.playCost(jackie.uid, 1, 'goSolo')).toBe(8);
    const myJackie = add(g, 0, 'jackie_welles_mama_s_favorite', 'legends');
    expect(g.playCost(myJackie.uid, 0, 'goSolo')).toBe(6);
  });

  it("(Don't Fear) The Reaper spends all rival Units then defeats one", async () => {
    const g = setup();
    eddies(g, 0, 7);
    const a = add(g, 1, 'emergency_atlus', 'field');
    const b = add(g, 1, 'emergency_atlus', 'field');
    await play(g, 0, add(g, 0, 'don_t_fear_the_reaper', 'hand'));
    expect([a.zone, b.zone].filter((z) => z === 'trash').length).toBe(1);
    expect(g.units(1).every((c) => c.spent)).toBe(true);
  });

  it('We Gotta Live Together: alt cost and replays two cheap Units from trash', async () => {
    const g = setup();
    gig(g, 1, 1, 4);
    gig(g, 1, 1, 6);
    const w = add(g, 0, 'we_gotta_live_together', 'hand');
    expect(g.playCost(w.uid, 0)).toBe(3);
    eddies(g, 0, 3);
    add(g, 0, 'emergency_atlus', 'trash');
    add(g, 0, 'field_operator', 'trash');
    add(g, 0, 'maxtac_heavy', 'trash');
    await play(g, 0, w);
    expect(g.units(0).length).toBe(2);
    expect(g.P(0).trash.map((u) => g.def(u).id).sort()).toEqual(['maxtac_heavy', 'we_gotta_live_together']);
  });

  it('Synapse Burnout pumps a Unit only while fighting', async () => {
    const g = setup();
    eddies(g, 0, 1);
    for (const u of g.P(0).legends) g.c(u).faceUp = true; // 3 face-up legends
    const atk = add(g, 0, 'field_operator', 'field'); // 2 power
    const r = add(g, 1, 'pacifica_netrunner', 'field', { spent: true }); // 1 power
    add(g, 1, 'emergency_atlus', 'field', { spent: true });
    await play(g, 0, add(g, 0, 'synapse_burnout', 'hand'));
    expect(g.power(atk)).toBe(2);
    // attack a 4-power unit: 2+3 = 5 wins
    const big = g.units(1).find((c) => c.defId === 'emergency_atlus')!;
    await g.attack(0, atk.uid, { unit: big.uid, gigs: null });
    expect(big.zone).toBe('trash');
    expect(atk.zone).toBe('field');
    expect(g.power(atk)).toBe(2);
    expect(r.zone).toBe('field');
  });

  it('Fool on the Hill: rival choosing hand gives both cards', async () => {
    const g = setup();
    eddies(g, 0, 2);
    await play(g, 0, add(g, 0, 'fool_on_the_hill', 'hand'));
    expect(g.P(0).hand.length).toBe(2);
  });

  it('Nadia can attack gigs on play only while rival has more Gigs', async () => {
    const g = setup();
    eddies(g, 0, 6);
    gig(g, 1, 3, 4);
    const n = add(g, 0, 'nadia_fighting_through_grief', 'hand');
    await play(g, 0, n);
    expect(g.attackTargets(n).some((t) => t.gigs === 1)).toBe(true);
    gig(g, 0, 3, 4);
    expect(g.attackTargets(n).length).toBe(0);
  });

  it('Peace Offering sets a Gig and draws with a value-pair', async () => {
    const g = setup();
    eddies(g, 0, 1);
    gig(g, 0, 2, 4);
    gig(g, 0, 3, 6);
    await play(g, 0, add(g, 0, 'peace_offering', 'hand'));
    expect(g.valuePairs(0)).toBe(1);
    expect(g.P(0).hand.length).toBe(1);
  });

  it('Sandayu Oda spends a rival Unit per value-pair and can attack Units immediately', async () => {
    const g = setup();
    eddies(g, 0, 7);
    gig(g, 0, 2, 4);
    gig(g, 0, 2, 6);
    const r = add(g, 1, 'emergency_atlus', 'field');
    const s = add(g, 0, 'sandayu_oda_hanako_s_guardian', 'hand');
    await play(g, 0, s);
    expect(r.spent).toBe(true);
    const ts = g.attackTargets(s);
    expect(ts.some((t) => t.unit === r.uid)).toBe(true);
    expect(ts.some((t) => t.gigs !== null)).toBe(false);
  });

  it('Overwatch defeats a spent rival Unit up to the discarded cost', async () => {
    const g = setup();
    eddies(g, 0, 1);
    const host = add(g, 0, 'emergency_atlus', 'field');
    const ow = add(g, 0, 'overwatch_panam_s_gift', 'hand');
    g.equip(ow.uid, host.uid);
    add(g, 0, 'maxtac_heavy', 'hand'); // cost 7
    const r = add(g, 1, 'saul_bright_stormrider', 'field', { spent: true }); // cost 8
    const r2 = add(g, 1, 'maxtac_heavy', 'field', { spent: true }); // cost 7
    await g.activate(0, ow.uid, host.uid, 0);
    await g.resolvePending();
    expect(r.zone).toBe('field');
    expect(r2.zone).toBe('trash');
    expect(host.spent).toBe(true);
  });
});
