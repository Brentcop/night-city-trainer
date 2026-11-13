// When an effect's condition is not met, or it has no legal target, the log says why in one line (log only: play is
// unchanged). The lines name only what both players can see.
import { describe, expect, it } from 'vitest';
import type { Game } from '../src/engine/engine';
import { eddies, gig, play, setup, spawn } from './engine-helpers';

const lines = (g: Game) => g.s.log.map((e) => e.text);
const PEPE = 'Pepe Najarro: Working Doubles';

describe('fizzle lines', () => {
  it('Pepe Najarro with no value-pair of Gigs: says nothing readies', async () => {
    const { g } = setup();
    spawn(g, 0, 'v_corporate_exile', 'legends', { spent: true });
    gig(g, 0, 4, 3);
    gig(g, 0, 6, 4);
    gig(g, 1, 8, 2);
    const pepe = spawn(g, 0, 'pepe_najarro_working_doubles', 'field');
    await g.attack(0, pepe.uid, { unit: null, gigs: 1 });
    expect(lines(g)).toContain(`${PEPE}: no value-pair of Gigs, so nothing readies`);
  });

  it('Pepe Najarro with a value-pair but no spent MERC Legend: says there is none to ready', async () => {
    const { g } = setup();
    // ready the starting Legends (setup spends them) and add a ready, face-up MERC Legend
    for (const u of g.P(0).legends) g.c(u).spent = false;
    spawn(g, 0, 'v_corporate_exile', 'legends', { spent: false });
    gig(g, 0, 4, 3);
    gig(g, 0, 6, 3);
    gig(g, 1, 8, 2);
    const pepe = spawn(g, 0, 'pepe_najarro_working_doubles', 'field');
    await g.attack(0, pepe.uid, { unit: null, gigs: 1 });
    expect(lines(g)).toContain(`${PEPE}: no spent, face-up MERC Legend to ready`);
    expect(lines(g).filter((t) => t.startsWith(`${PEPE}:`))).toHaveLength(1);
  });

  it('Pepe Najarro with only a face-down spent MERC Legend: the same line, naming nothing hidden', async () => {
    const { g } = setup();
    // setup's starting Legends are face-down and spent; one of them (V: Streetkid) is a MERC
    const fd = g.P(0).legends.map((u) => g.c(u)).find((c) => c.defId === 'v_streetkid')!;
    expect([fd.faceUp, fd.spent]).toEqual([false, true]);
    gig(g, 0, 4, 3);
    gig(g, 0, 6, 3);
    gig(g, 1, 8, 2);
    const pepe = spawn(g, 0, 'pepe_najarro_working_doubles', 'field');
    await g.attack(0, pepe.uid, { unit: null, gigs: 1 });
    const mine = lines(g).filter((t) => t.startsWith(`${PEPE}:`));
    expect(mine).toEqual([`${PEPE}: no spent, face-up MERC Legend to ready`]);
    expect(lines(g).join('\n')).not.toMatch(/Streetkid/);
    expect(fd.spent).toBe(true);
  });

  it('Pepe Najarro that readies a Legend logs no fizzle line', async () => {
    const { g } = setup();
    const v = spawn(g, 0, 'v_corporate_exile', 'legends', { spent: true });
    gig(g, 0, 4, 3);
    gig(g, 0, 6, 3);
    gig(g, 1, 8, 2);
    const pepe = spawn(g, 0, 'pepe_najarro_working_doubles', 'field');
    await g.attack(0, pepe.uid, { unit: null, gigs: 1 });
    expect(v.spent).toBe(false);
    expect(lines(g).filter((t) => t.startsWith(`${PEPE}:`))).toEqual([]);
  });

  it('Field Operator with odd Street Cred: says no card is drawn', async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    gig(g, 0, 4, 3);
    await play(g, 0, spawn(g, 0, 'field_operator', 'hand'));
    expect(lines(g)).toContain('Field Operator: Street Cred is not an even number, so no card drawn');
  });

  it('Wild in the Streets with no spent Unit: the generic no-target line', async () => {
    const { g } = setup();
    eddies(g, 0, 5);
    spawn(g, 1, 'psycho_squad', 'field');
    await play(g, 0, spawn(g, 0, 'wild_in_the_streets', 'hand'));
    expect(lines(g)).toContain('Wild in the Streets: no legal target for "defeat a spent Unit"');
  });

  it('Industrial Assembly without an 8+ Gig: says no card is drawn', async () => {
    const { g } = setup();
    eddies(g, 0, 5);
    gig(g, 0, 4, 1);
    await play(g, 0, spawn(g, 0, 'industrial_assembly', 'hand'));
    expect(lines(g)).toContain('Industrial Assembly: no Gig with 8+ value, so no card drawn');
  });

  it('Carnage at the Colosseum with no friendly Unit: says nothing is defeated', async () => {
    const { g } = setup();
    eddies(g, 0, 6);
    spawn(g, 1, 'psycho_squad', 'field');
    const c = spawn(g, 0, 'carnage_at_the_colosseum', 'hand');
    await play(g, 0, c);
    expect(lines(g)).toContain(`${g.name(c)}: no friendly Unit, so nothing is defeated`);
  });

  it('Over the Edge without a d20 Gig: says nothing is defeated', async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    spawn(g, 1, 'psycho_squad', 'field');
    const c = spawn(g, 0, 'over_the_edge', 'hand');
    await play(g, 0, c);
    expect(lines(g)).toContain(`${g.name(c)}: no d20 Gig, so nothing is defeated`);
  });

  it('Hacked Corpo with no Program among the trashed cards: says so', async () => {
    const { g } = setup();
    eddies(g, 0, 4);
    const c = spawn(g, 0, 'hacked_corpo', 'hand');
    await play(g, 0, c);
    expect(lines(g)).toContain(`${g.name(c)}: no Program among the trashed cards`);
  });

  it('Viktor Vektor with no other friendly Unit, or no Cyberware in the trash: says which', async () => {
    const { g } = setup();
    eddies(g, 0, 6);
    const v1 = spawn(g, 0, 'viktor_vektor_you_might_feel_a_little_pinch', 'hand');
    await play(g, 0, v1);
    expect(lines(g)).toContain(`${g.name(v1)}: no other friendly Unit to equip`);
    const v2 = spawn(g, 0, 'viktor_vektor_you_might_feel_a_little_pinch', 'hand');
    await play(g, 0, v2);
    expect(lines(g)).toContain(`${g.name(v2)}: no Cyberware Gear (cost ≤2) in the trash`);
  });

  it('clones and probes never log the lines', async () => {
    const { g } = setup();
    gig(g, 0, 4, 3);
    gig(g, 0, 6, 4);
    gig(g, 1, 8, 2);
    const pepe = spawn(g, 0, 'pepe_najarro_working_doubles', 'field');
    const c = g.clone(g.agents);
    await c.attack(0, pepe.uid, { unit: null, gigs: 1 });
    expect(c.s.log).toEqual([]);
  });
});
