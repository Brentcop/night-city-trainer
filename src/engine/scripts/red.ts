// Red card scripts.
import type { Game } from '../engine';
import type { CardInst, CardScript, DelayedMod, PlayerId } from '../types';
import { count8Plus, defeatRival, friendlyUnits, has8Plus, millAndTake, noEffect, pick, rival, rivalUnits, untilMyNextTurn } from './helpers';

/** Increase a specific gig by 0..max (capped by its sides). */
async function increaseSpecific(g: Game, p: PlayerId, gid: number, max: number, source?: number) {
  const gig = g.gig(gid);
  const opts = [];
  for (let d = 1; d <= max && gig.value + d <= gig.sides; d++) opts.push({ label: `d${gig.sides}: ${gig.value} → ${gig.value + d}`, gig: gid, n: gig.value + d });
  if (!opts.length) return;
  opts.push({ label: 'No change', key: 'none' } as any);
  const [i] = await g.ask({ player: p, kind: 'gigValue', prompt: `Increase d${gig.sides} by up to ${max}`, options: opts, min: 1, max: 1, source, tag: 'adjust', intent: gig.controller === p ? 'help' : 'harm' });
  const o = opts[i] as any;
  if (o.key === 'none') return;
  g.setGigValue(gid, o.n, p, 'adjust');
}

/** Units that are Legends (on the field via Go Solo or face-up in legends area). */
const isLegendCard = (g: Game, c: CardInst) => g.def(c).type === 'Legend';

/** Opponent of host in the current fight, if host is fighting. */
function fightOpp(g: Game, host: CardInst): CardInst | null {
  const a = g.s.attack;
  if (!a || a.step !== 'fight' || a.targetUnit === null) return null;
  if (a.attacker === host.uid) return g.c(a.targetUnit);
  if (a.targetUnit === host.uid) return g.c(a.attacker);
  return null;
}

/** Remove all delayed mods created by the same source card (sibling triggers of one effect). */
function consumeSiblings(g: Game, mod: DelayedMod) {
  g.s.mods = g.s.mods.filter((m) => !(m.kind === 'delayed' && m.source === mod.source && m.value?.defId === mod.value?.defId && m.turn === mod.turn));
}

export const RED: Record<string, CardScript> = {
  // ---------------------------------------------------------------- Legends
  dexter_deshawn_off_the_grid: {
    call: async (g, self) => {
      const p = self.controller;
      const units = friendlyUnits(g, self);
      // either effect may be chosen, even with no friendly Unit to give +2 (FAQ Dexter DeShawn: Off the Grid #1)
      const modes = ['Give a friendly Unit +2 power this turn', 'Draw 1'];
      const i = await g.chooseMode(p, 'Dexter DeShawn: choose one', modes, self.uid, 'mode');
      if (modes[i] === 'Draw 1') await g.draw(p, 1);
      else {
        const t = await pick(g, self, units, 'Give +2 power this turn', 'help', false, 'pump');
        if (t) g.givePower(t.uid, 2, 'endOfTurn', undefined, self.uid);
      }
    },
    abilities: [
      {
        label: 'Increase a Gig by up to 2',
        spend: true,
        run: async (g, self) => {
          await g.adjustGig(self.controller, 2, 'up', 'any', { source: self.uid });
        },
      },
    ],
  },

  johnny_silverhand_rocking_renegade: {
    abilities: [
      {
        label: 'A friendly Unit can attack spent rival Units the turn it is played (Rocker: +2 power)',
        spend: true,
        // dynamic cost: 2 €$ - 1 per friendly 8+ Gig (paid in run, after the spend)
        can: (g, self, host) => {
          const p = self.controller;
          const cost = Math.max(0, 2 - count8Plus(g, p));
          const avail = g.payables(p).filter((c) => c.uid !== host.uid).length;
          return avail >= cost && g.units(p).length > 0;
        },
        run: async (g, self) => {
          const p = self.controller;
          const cost = Math.max(0, 2 - count8Plus(g, p));
          if (!(await g.pay(p, cost))) return;
          const units = friendlyUnits(g, self);
          const lagging = units.filter((u) => u.lag);
          const t = await pick(g, self, lagging.length ? [...lagging, ...units.filter((u) => !u.lag)] : units, 'Johnny Silverhand: choose a friendly Unit', 'help', false, 'lagAttack');
          if (!t) return;
          g.addMod({ kind: 'lagAttack', target: t.uid, value: 'units', until: 'endOfTurn', source: self.uid });
          if (g.isTag(t, 'Rocker')) g.givePower(t.uid, 2, 'endOfTurn', undefined, self.uid);
        },
      },
    ],
  },

  yorinobu_arasaka_embracing_destruction: {
    on: {
      attack: async (g, self, _host, ev) => {
        const p = self.controller;
        const arasaka = (e: { p: PlayerId; uid: number }) => e.p === p && g.isTag(e.uid, 'Arasaka');
        if (!arasaka({ p: g.c(ev.attacker).controller, uid: ev.attacker })) return;
        // the first such attack this turn, even if this Legend was face-down for an earlier one
        if (!g.firstThisTurn(ev.seq, 'attack', arasaka)) return;
        await g.draw(self.controller, 1);
        if ((g.streetCred(self.controller) ?? 0) < 20) await g.discard(self.controller, 1);
        else noEffect(g, self, '20 or more Street Cred, so no discard');
      },
    },
  },

  v_streetkid: {
    call: async (g, self) => {
      const p = self.controller;
      g.mill(p, 3);
      const cands = g.P(p).trash.filter((u) => g.def(u).type === 'Program' && g.isTag(u, 'Braindance'));
      const u = await g.chooseCard(p, cands, 'V: add a BRAINDANCE Program from your trash to hand', false, 'search', 'help');
      if (u !== null) {
        g.move(u, 'hand');
        g.log(p, `adds ${g.name(u)} to hand`);
      }
    },
  },

  royce_psycho_on_the_edge: {
    power: (g, self, _host, target) => {
      if (target.uid !== self.uid || g.s.active !== self.controller) return 0;
      return 2 * target.gear.length;
    },
  },

  adam_smasher_ender_of_legends: {
    play: async (g, self) => {
      await defeatRival(g, self, () => true);
    },
  },

  // ---------------------------------------------------------------- Programs
  all_is_lost: {
    play: async (g, self) => {
      await millAndTake(g, self.controller, 3, (c) => g.def(c).type === 'Unit');
    },
  },

  detonate: {
    play: async (g, self) => {
      const r = rival(self);
      const gear = g
        .sources(r)
        .filter((s) => s.self.uid !== s.host.uid && (g.def(s.self).power ?? 0) <= 2)
        .map((s) => s.self.uid);
      const u = await g.chooseCard(self.controller, gear, 'Detonate: defeat a rival Gear', false, 'defeat', 'harm');
      if (u !== null) g.defeatGear(u);
    },
  },

  industrial_assembly: {
    play: async (g, self) => {
      await g.adjustGig(self.controller, 4, 'up', 'any', { source: self.uid });
      if (has8Plus(g, self.controller)) await g.draw(self.controller, 1);
      else noEffect(g, self, 'no Gig with 8+ value, so no card drawn');
    },
  },

  appetite_for_destruction: {
    play: async (g, self) => {
      // The friendly Unit is chosen as the Program resolves, among Units on the field now (FAQ #1); only it can benefit.
      const t = await pick(g, self, friendlyUnits(g, self), 'Appetite for Destruction: choose a friendly Unit', 'help', false, 'pump');
      if (!t) return;
      // Two sibling delayed triggers: 'fight' handles losers that stay in play, 'unitDefeated' uses last-known power.
      g.addDelayed(self, 'fight', { uid: t.uid }, 'endOfTurn');
      g.addDelayed(self, 'unitDefeated', { uid: t.uid }, 'endOfTurn');
    },
    delayed: {
      fight: async (g, mod, ev) => {
        const p = mod.player!;
        const w = g.c(ev.uid);
        const o = g.c(ev.opp);
        if (ev.uid !== mod.value?.data?.uid) return false;
        if (ev.result !== 'win' || w.zone !== 'field' || w.controller !== p) return false;
        if (o.zone !== 'field') return false; // opponent defeated: handled by unitDefeated with last-known power
        if (g.power(w) - g.power(o) < 3) return false;
        consumeSiblings(g, mod);
        await g.stealOne(p, w.uid);
        return true;
      },
      unitDefeated: async (g, mod, ev) => {
        const p = mod.player!;
        if (!ev.inFight || ev.by === null || ev.controller === p || ev.by !== mod.value?.data?.uid) return false;
        const w = g.c(ev.by);
        if (w.zone !== 'field' || w.controller !== p) return false;
        if (g.power(w) - ev.power < 3) return false;
        consumeSiblings(g, mod);
        await g.stealOne(p, w.uid);
        return true;
      },
    },
  },

  bonnie_and_clyde: {
    play: async (g, self) => {
      const p = self.controller;
      const ok = (c: CardInst) => g.power(c) <= 4;
      const first = await pick(g, self, rivalUnits(g, self, ok), 'Bonnie & Clyde: defeat a rival Unit (power 4 or less)', 'harm', false, 'defeat');
      if (!first) return;
      const targets = [first];
      if (g.P(rival(self)).gigs.length - g.P(p).gigs.length >= 2) {
        const second = await pick(g, self, rivalUnits(g, self, (c) => ok(c) && c.uid !== first.uid), 'Bonnie & Clyde: defeat a second rival Unit?', 'harm', true, 'defeat');
        if (second) targets.push(second);
      }
      for (const t of targets) await g.defeat(t.uid, { by: self.uid });
    },
  },

  over_the_edge: {
    play: async (g, self) => {
      const d20 = g.gigsOf(self.controller).filter((x) => x.sides === 20);
      if (!d20.length) return;
      const v = Math.max(...d20.map((x) => x.value));
      const cands = [...rivalUnits(g, self), ...friendlyUnits(g, self)].filter((c) => g.power(c) <= v);
      const t = await pick(g, self, cands, `Over the Edge: defeat a Unit with power ${v} or less`, 'harm', false, 'defeat');
      if (t) await g.defeat(t.uid, { by: self.uid });
    },
  },

  gunpoint_diplomacy: {
    play: async (g, self) => {
      const p = self.controller;
      const t = await pick(g, self, friendlyUnits(g, self), 'Gunpoint Diplomacy: choose a friendly Unit', 'help', false, 'pump');
      if (!t) return;
      const modes = ['It may attack ready Units the next time it attacks this turn', 'Give it +3 power this turn'];
      let which = [0, 1];
      if (g.lessCred(p)) which = [await g.chooseMode(rival(self), 'Gunpoint Diplomacy: choose ONE effect for your rival', modes, self.uid, 'rivalChoice')];
      if (which.includes(0)) g.addMod({ kind: 'attackReady', target: t.uid, value: 'once', until: 'endOfTurn', source: self.uid });
      if (which.includes(1)) g.givePower(t.uid, 3, 'endOfTurn', undefined, self.uid);
    },
  },

  shattered_memories: {
    play: async (g, self) => {
      const p = self.controller;
      let total = 0;
      for (const pl of [p, rival(self)]) {
        const hand = [...g.P(pl).hand];
        for (const u of hand) g.move(u, 'trash');
        total += hand.length;
        if (hand.length) g.log(pl, `discards ${hand.length} card(s)`);
      }
      for (const pl of [p, rival(self)]) {
        if (await g.yesNo(pl, 'Shattered Memories: draw 5?', 'draw', self.uid)) await g.draw(pl, 5);
      }
      if (g.gigsOf(p).some((x) => x.value === total)) await g.draw(p, 2);
    },
  },

  carnage_at_the_colosseum: {
    selfCost: (g, _self, p) => -count8Plus(g, p),
    play: async (g, self) => {
      const mine = friendlyUnits(g, self);
      if (!mine.length) return;
      const best = Math.max(...mine.map((c) => g.power(c)));
      await defeatRival(g, self, (c) => g.power(c) < best);
    },
  },

  // ---------------------------------------------------------------- Gear
  mantis_blades: {},

  arasaka_emergency_radioport: {
    on: {
      spent: async (g, self, host, ev) => {
        if (ev.uid !== host.uid) return;
        const p = self.controller;
        if (!g.canCall(p)) return;
        const fd = g.faceDownLegends(p);
        const look = await g.chooseUnit(p, fd, 'Emergency Radioport: look at a face-down Legend?', { optional: true, intent: 'help', tag: 'call', source: self.uid });
        if (!look) return;
        look.known = true;
        if (!(g.isTag(look, 'Arasaka') || g.def(look).keywords.includes('goSolo'))) return;
        if (await g.yesNo(p, `Call ${g.name(look)} for free?`, 'call', self.uid)) await g.callLegend(p, look.uid, { free: true });
      },
    },
  },

  satori_sword_of_saburo: {
    on: {
      fight: async (g, self, host, ev) => {
        if (ev.uid !== host.uid || ev.result !== 'win') return;
        if (g.c(ev.opp).controller === self.controller) return;
        await g.draw(self.controller, 1);
      },
    },
  },

  deadman_transmitter: {
    replaceDefeat: async (g, self, host, victim) => {
      // "If this Unit would be defeated": only while equipped to a Unit on the field, not a Legend in the Legends area
      if (victim.uid !== host.uid || self.host !== host.uid || host.zone !== 'field') return false;
      g.log(self.controller, `${g.name(self)} is defeated instead of ${g.name(host)}`);
      g.defeatGear(self.uid);
      return true;
    },
  },

  // ---------------------------------------------------------------- Units
  japantown_jonin: {
    play: async (g, self) => {
      const t = await pick(g, self, friendlyUnits(g, self), 'Japantown Jonin: give a friendly Unit +2 power', 'help', false, 'pump');
      if (t) g.givePower(t.uid, 2, 'endOfTurn', undefined, self.uid);
    },
  },

  ruthless_lowlife: {
    attackBan: (_g, _self, host, attacker, target) => attacker.uid === host.uid && !!target && target.gigs !== null,
  },

  la_llorona_ghost_of_the_past: {
    on: {
      blockerUsed: async (g, self, host, ev) => {
        if (ev.uid !== host.uid) return;
        await g.adjustGig(self.controller, 3, 'up', 'any', { source: self.uid });
      },
    },
  },

  swordwise_huscle: {
    attack: async (g, self, host) => {
      if (g.power(host) >= 5) await g.draw(self.controller, 1);
    },
  },

  valentino_guerrera: {
    attackAllow: (g, self, host, attacker, target) => {
      if (attacker.uid !== host.uid || target.unit === null) return false;
      const t = g.c(target.unit);
      return !t.spent && g.hasKw(t, 'blocker') && g.moreCred(self.controller);
    },
  },

  '6th_street_recruits': {
    on: {
      steal: async (g, self, _host, ev) => {
        if (ev.player !== self.controller || g.gig(ev.gig).sides !== 6) return;
        await g.adjustGig(self.controller, 6, 'up', 'any', { source: self.uid });
      },
    },
  },

  kerry_eurodyne_the_last_rockerboy: {
    abilities: [
      {
        label: 'Draw 2 (if you control an 8+ Gig)',
        spend: true,
        // activatable without an 8+ Gig; the condition is checked on resolution (FAQ Kerry Eurodyne: The Last Rockerboy #2)
        run: async (g, self) => {
          if (has8Plus(g, self.controller)) await g.draw(self.controller, 2);
          else noEffect(g, self, 'no Gig with 8+ value, so no cards drawn');
        },
      },
    ],
  },

  meredith_stout_stone_cold_corpo: {
    power: (g, _self, host, target) => {
      if (target.uid !== host.uid) return 0;
      const o = fightOpp(g, host);
      return o && isLegendCard(g, o) ? 2 : 0;
    },
    on: {
      gigChanged: async (g, self, _host, ev) => {
        const p = self.controller;
        if (ev.by === p) return;
        const gig = g.gig(ev.gig);
        // swaps emit one event per gig: react once, on the gig that arrived on our side
        if (gig.controller !== p) return;
        const trash = [...g.P(p).trash];
        const u = await g.chooseCard(p, trash, 'Meredith Stout: add a card from your trash to your hand?', true, 'search', 'help');
        if (u !== null) {
          g.move(u, 'hand');
          g.log(p, `adds ${g.name(u)} to hand`);
        }
      },
    },
  },

  chrome_fang: {
    play: async (g, self) => {
      // Until your next turn, rival Units can't steal friendly Gigs with value higher than their power.
      g.addMod({ kind: 'stealBan', player: self.controller, value: { cmp: 'gt' }, source: self.uid, ...untilMyNextTurn(self) });
    },
  },

  el_sombreron_la_venganza_lenta: {
    attack: async (g, self, host) => {
      const p = self.controller;
      const maxGigs = g.gigsOf(p).filter((x) => g.isMaxGig(x));
      if (!maxGigs.length || g.available(p) < 2) return;
      if (!(await g.yesNo(p, 'El Sombrerón: pay 2 €$ to gain power equal to a friendly max Gig?', 'pay', self.uid))) return;
      if (!(await g.pay(p, 2))) return;
      // any friendly max Gig may be chosen (FAQ #1); the power is fixed when this resolves (FAQ #2)
      const byValue = [...maxGigs].sort((a, b) => b.value - a.value);
      const gid = new Set(byValue.map((x) => x.value)).size > 1 ? await g.chooseGig(p, byValue, 'El Sombrerón: gain power equal to which max Gig?', false, 'maxGig', 'help') : byValue[0].id;
      g.givePower(host.uid, g.gig(gid ?? byValue[0].id).value, 'endOfTurn', undefined, self.uid);
    },
  },

  royce_don_t_call_me_simon: {
    play: async (g, self) => {
      const n = g.moreCred(self.controller) ? 3 : 2;
      await defeatRival(g, self, (c) => g.power(c) <= n);
    },
  },

  screw_lovelorn_fool: {
    defeated: async (g, self, info) => {
      const p = info.owner;
      const cands = g.P(p).trash.filter((u) => u !== self.uid && g.def(u).type === 'Unit');
      const u = await g.chooseCard(p, cands, 'Screw: add another Unit from your trash to your hand', false, 'search', 'help');
      if (u !== null) {
        g.move(u, 'hand');
        g.log(p, `adds ${g.name(u)} to hand`);
      }
    },
  },

  v_roamer_of_the_badlands: {
    on: {
      steal: async (g, self, host, ev) => {
        if (ev.actor !== host.uid) return;
        await increaseSpecific(g, self.controller, ev.gig, 5, self.uid);
      },
      turnEnd: async (g, self, _host, ev) => {
        if (ev.player !== self.controller) return;
        if (count8Plus(g, self.controller) >= 2) await g.draw(self.controller, 1);
      },
    },
  },

  animals_wrecker: {},

  johnny_silverhand_never_stop_fighting: {
    fightOverride: (g, _self, _host, opp) => (g.isTag(opp, 'Corpo') ? 'win' : null),
    on: {
      fight: async (g, self, host, ev) => {
        if (ev.uid !== host.uid || ev.result !== 'win' || host.zone !== 'field') return;
        if (!g.oncePerTurn(`johnnyNSF:${host.uid}`)) return;
        if (g.ready(host.uid)) g.log(self.controller, `${g.name(host)} readies`);
      },
    },
  },

  minotaur: {
    play: async (g, self) => {
      if (g.moreCred(self.controller)) await defeatRival(g, self, (c) => g.power(c) <= 5);
      else noEffect(g, self, 'not more Street Cred than the rival, so nothing is defeated');
    },
  },

  octant: {
    selfCost: (g, _self, p) => -count8Plus(g, p),
  },

  yorinobu_arasaka_steel_dragon: {
    play: async (g, self) => {
      const p = self.controller;
      const ok = (u: number) => g.def(u).type === 'Unit' && (g.def(u).cost ?? 0) <= 4 && g.canPlayCard(p, u, true);
      const cands = [...g.P(p).hand.filter(ok), ...g.P(p).trash.filter(ok)];
      const u = await g.chooseCard(p, cands, 'Yorinobu: play a Unit with cost 4 or less for free?', true, 'playFree', 'help');
      if (u === null) return;
      const from = g.c(u).zone;
      if (!(await g.playFree(p, u, from))) return;
      if (g.c(u).zone === 'field') g.addMod({ kind: 'lagAttack', target: u, value: 'units', until: 'endOfTurn', source: self.uid });
    },
    // Its own defeat can be the first ARASAKA defeat of the turn (FAQ #2): it has left play by the time unitDefeated
    // fires, so that case looks back from its defeat instead.
    defeated: async (g, _self, info) => {
      if (!g.firstThisTurn(info.seq, 'defeat', (e) => g.isTag(e.uid, 'Arasaka'))) return;
      await g.draw(info.controller, 1);
    },
    on: {
      unitDefeated: async (g, self, _host, ev) => {
        if (!ev.tags.some((t) => t.toLowerCase() === 'arasaka')) return;
        // the first ARASAKA defeat this turn, including ones before this Unit was played
        if (!g.firstThisTurn(ev.seq, 'defeat', (e) => g.isTag(e.uid, 'Arasaka'))) return;
        await g.draw(self.controller, 1);
      },
    },
  },
};
