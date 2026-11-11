// Green card scripts.
import type { CardInst, CardScript, Mod, Opt, PlayerId } from '../types';
import type { Game } from '../engine';
import { friendlyUnits, pick, rival, rivalHasMoreGigs, rivalUnits, untilMyNextTurn } from './helpers';

const printedCost = (g: Game, c: CardInst) => g.def(c).cost ?? 0;

/** Pairs (gig A to change, value taken from gig B). crossPlayer: B must be controlled by a different player than A. */
function setGigOptions(g: Game, p: PlayerId, crossPlayer: boolean): Opt[] {
  const gigs = g.allGigs();
  const out: Opt[] = [];
  const seen = new Set<string>();
  for (const a of gigs) {
    for (const b of gigs) {
      if (a.id === b.id) continue;
      if (crossPlayer && a.controller === b.controller) continue;
      if (b.value === a.value || b.value > a.sides) continue;
      const key = `${a.id}:${b.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: `${a.controller === p ? 'Friendly' : 'Rival'} d${a.sides}: ${a.value} → ${b.value} (copy d${b.sides})`, gig: a.id, n: b.value });
    }
  }
  return out;
}

async function setGigToOther(g: Game, self: CardInst, crossPlayer: boolean, optional: boolean): Promise<boolean> {
  const p = self.controller;
  const options = setGigOptions(g, p, crossPlayer);
  if (!options.length) return false;
  if (optional) options.push({ label: 'No change', key: 'none' });
  const [i] = await g.ask({ player: p, kind: 'gigValue', prompt: `${g.name(self)}: set a Gig to another Gig's value`, options, min: 1, max: 1, source: self.uid, tag: 'setGig' });
  const o = options[i];
  if (o.key === 'none') return false;
  return g.setGigValue(o.gig!, o.n!, p, 'set');
}

async function swapFriendlyRival(g: Game, self: CardInst, optional: boolean) {
  const p = self.controller;
  const mine = g.gigsOf(p);
  const theirs = g.gigsOf(rival(self));
  if (!mine.length || !theirs.length) return false;
  const f = await g.chooseGig(p, mine, `${g.name(self)}: choose a friendly Gig to swap`, optional, 'swapGive', 'harm');
  if (f === null) return false;
  const r = await g.chooseGig(p, theirs, `${g.name(self)}: choose a rival Gig to swap`, false, 'swapTake', 'help');
  if (r === null) return false;
  g.swapGigs(f, r, p);
  return true;
}

/**
 * Spend one rival Unit (matching filter). Only ready ones are offered unless `orSpent`: "Spend a rival Unit" may choose
 * one that is already spent (FAQ Corporate Surveillance, Memory Relapse), which matters when the effect does more to it.
 */
async function spendRival(g: Game, self: CardInst, filter: (c: CardInst) => boolean = () => true, optional = false, orSpent = false) {
  const t = await pick(g, self, rivalUnits(g, self, (c) => (orSpent || !c.spent) && filter(c)), `${g.name(self)}: spend a rival Unit`, 'harm', optional, 'spend');
  if (t) g.spend(t.uid, 'effect');
  return t;
}

/** Choose up to n distinct cards from candidates (recomputed each pick). */
async function chooseUpTo(g: Game, self: CardInst, n: number, cands: () => CardInst[], prompt: string, intent: 'help' | 'harm', tag: string) {
  const got: CardInst[] = [];
  for (let i = 0; i < n; i++) {
    const cs = cands().filter((c) => !got.includes(c));
    const c = await pick(g, self, cs, `${prompt} (${i + 1}/${n})`, intent, true, tag);
    if (!c) break;
    got.push(c);
  }
  return got;
}

// ---- Synapse Burnout helpers (power only while fighting rival Units)
function synapseApply(g: Game, mod: Mod, uid: number) {
  const key = mod.value.data.key as string;
  const c = g.c(uid);
  if (!c || c.zone !== 'field') return;
  if (g.s.mods.some((m) => m.kind === 'power' && m.target === uid && m.value === key)) return;
  const n = g.faceUpLegends(c.controller).length;
  if (n > 0) g.addMod({ kind: 'power', target: uid, amount: n, until: 'attackEnd', value: key });
}

export const GREEN: Record<string, CardScript> = {
  // ================================================================ Legends
  goro_takemura_vengeful_bodyguard: {
    abilities: [
      {
        label: 'Give a friendly Unit (cost ≤4) Blocker this turn',
        quick: true,
        eddies: 1,
        spend: true,
        can: (g, self) => friendlyUnits(g, self, (c) => printedCost(g, c) <= 4).length > 0,
        run: async (g, self) => {
          const t = await pick(g, self, friendlyUnits(g, self, (c) => printedCost(g, c) <= 4), 'Give Blocker to', 'help', false, 'blocker');
          if (!t) return;
          g.giveKeyword(t.uid, 'blocker');
          if (g.valuePairs(self.controller) > 0) g.givePower(t.uid, 1, 'endOfTurn', undefined, self.uid);
        },
      },
    ],
    on: {
      blockerUsed: async (g, self, _h, ev) => {
        if (g.c(ev.uid).controller !== self.controller) return;
        if (!g.P(self.controller).hand.length) return;
        const d = await g.discard(self.controller, 1, undefined, true, `${g.name(self)}: discard 1 to draw 1?`);
        if (d.length) await g.draw(self.controller, 1);
      },
    },
  },

  hanako_arasaka_daughter_of_the_emperor: {
    abilities: [
      {
        label: 'Swap a friendly Gig with a rival Gig',
        spend: true,
        can: (g, self) => g.gigsOf(self.controller).length > 0 && g.gigsOf(rival(self)).length > 0,
        run: async (g, self) => {
          await swapFriendlyRival(g, self, false);
        },
      },
    ],
    on: {
      turnStart: async (g, self, _h, ev) => {
        if (ev.player !== self.controller) return;
        const n = g.valuePairs(self.controller);
        if (n > 0) await g.draw(self.controller, n);
      },
    },
  },

  padre_man_of_the_cross: {
    call: async (g, self) => {
      // either mode may be chosen even with no rival Unit to spend (FAQ Padre #1): do as much as you can
      const modes = ['Spend a rival Unit', 'Draw 1'];
      const i = await g.chooseMode(self.controller, `${g.name(self)}: choose one`, modes, self.uid, 'mode');
      if (modes[i] === 'Draw 1') await g.draw(self.controller, 1);
      else await spendRival(g, self);
    },
    abilities: [
      {
        label: "Set a player's Gig to the value of another player's Gig",
        spend: true,
        // may be activated even when no Gig can change, e.g. all Gigs share a value (FAQ Padre #2)
        run: async (g, self) => {
          await setGigToOther(g, self, true, false);
        },
      },
    ],
  },

  panam_palmer_nomad_cavalry: {
    abilities: [
      {
        label: 'Move a Gear from this Legend to an unequipped friendly Unit and ready it',
        eddies: 2,
        spend: true,
        can: (g, self, host) => host.gear.length > 0 && friendlyUnits(g, self, (c) => c.gear.length === 0).length > 0,
        run: async (g, self, host) => {
          const gear = await g.chooseCard(self.controller, [...host.gear], 'Move which Gear?', false, 'moveGear', 'help');
          if (gear === null) return;
          const t = await pick(g, self, friendlyUnits(g, self, (c) => c.gear.length === 0), 'Move the Gear to', 'help', false, 'equip');
          if (!t) return;
          g.equip(gear, t.uid);
          g.log(self.controller, `moves ${g.name(gear)} to ${g.name(t)}`);
          g.ready(t.uid);
        },
      },
    ],
    on: {
      turnEnd: (g, self, _h, ev) => {
        if (ev.player !== self.controller) return;
        const P = g.P(self.controller);
        const equipped = [...P.field, ...P.legends].map((u) => g.c(u)).filter((c) => c.gear.length > 0 && (c.zone === 'field' || c.faceUp));
        if (equipped.length >= 5) for (const c of equipped) g.ready(c.uid);
      },
    },
  },

  saburo_arasaka_stubborn_patriarch: {
    power: (g, self, _host, target) =>
      target.zone === 'field' && target.controller === self.controller && g.s.attack?.attacker === target.uid && g.isTag(target, 'Arasaka') ? 1 : 0,
  },

  // goro_takemura_hands_unclean: Go Solo + Blocker are printed keywords handled by the engine.

  jackie_welles_mama_s_favorite: {
    optionalReplacement: true, // "you may pay 1 €$": applies after mandatory replacements such as Deadman Transmitter (10.28)
    replaceDefeat: async (g, self, host, victim) => {
      if (victim.uid === host.uid || victim.zone !== 'field' || victim.controller !== self.controller) return false;
      if (!(host.zone === 'field' || (host.zone === 'legends' && host.faceUp))) return false;
      if (g.available(self.controller) < 1) return false;
      const ok = await g.yesNo(self.controller, `${g.name(self)}: pay 1 €$ to defeat Jackie instead of ${g.name(victim)}?`, 'replaceDefeat', self.uid);
      if (!ok) return false;
      if (!(await g.pay(self.controller, 1))) return false;
      g.log(self.controller, `${g.name(self)} takes the hit for ${g.name(victim)}`);
      await g.defeat(host.uid);
      return true;
    },
  },

  // ================================================================ Programs
  peace_offering: {
    play: async (g, self) => {
      await setGigToOther(g, self, false, true);
      if (g.valuePairs(self.controller) > 0) await g.draw(self.controller, 1);
    },
  },

  synapse_burnout: {
    partial: 'bonus counts face-up Legends when the fight starts (attack declared/block), not continuously during the fight',
    play: async (g, self) => {
      const t = await pick(g, self, friendlyUnits(g, self), `${g.name(self)}: choose a friendly Unit`, 'help', false, 'pump');
      if (!t) return;
      const key = `synapse:${self.uid}:${g.s.turn}:${g.s.nextModId}`;
      const data = { uid: t.uid, key };
      const m1 = g.addDelayed(self, 'attack', data, 'endOfTurn');
      g.addDelayed(self, 'blockerUsed', data, 'endOfTurn');
      // Played during an attack this Unit is already in.
      const a = g.s.attack;
      if (a && a.targetUnit !== null && (a.attacker === t.uid || a.targetUnit === t.uid)) synapseApply(g, m1, t.uid);
    },
    delayed: {
      attack: (g, mod, ev) => {
        const uid = mod.value.data.uid as number;
        if (ev.targetUnit !== null && (ev.attacker === uid || ev.targetUnit === uid)) synapseApply(g, mod, uid);
      },
      blockerUsed: (g, mod, ev) => {
        const uid = mod.value.data.uid as number;
        if (ev.uid === uid || g.s.attack?.attacker === uid) synapseApply(g, mod, uid);
      },
    },
  },

  corporate_surveillance: {
    play: async (g, self) => {
      await spendRival(g, self, (c) => printedCost(g, c) <= 4, false, true);
    },
  },

  fool_on_the_hill: {
    play: async (g, self) => {
      const p = self.controller;
      const top = g.P(p).deck.slice(0, 2);
      if (!top.length) return;
      g.log(p, `reveals ${top.map((u) => g.name(u)).join(', ')}`);
      const i = await g.chooseMode(rival(self), `${g.name(self)}: rival reveals ${top.map((u) => g.name(u)).join(', ')}`, ['Add them to their hand', 'Trash them (they draw 2)'], self.uid, 'foolOnTheHill');
      if (i === 0) {
        for (const u of top) g.move(u, 'hand');
        g.log(p, 'adds the revealed cards to hand');
      } else {
        for (const u of top) g.move(u, 'trash');
        g.log(p, 'trashes the revealed cards');
        await g.draw(p, 2);
      }
    },
  },

  take_control: {
    play: async (g, self) => {
      const t = await pick(g, self, rivalUnits(g, self), `${g.name(self)}: a rival Unit steals 1 fewer Gig`, 'harm', false, 'stealMod');
      if (!t) return;
      g.addMod({ kind: 'stealMod', target: t.uid, amount: -1, until: 'endOfTurn', source: self.uid });
      if (['AI', 'Drone', 'Vehicle'].some((tag) => g.isTag(t, tag))) await g.draw(self.controller, 1);
    },
  },

  memory_relapse: {
    play: async (g, self) => {
      const t = await spendRival(g, self, undefined, false, true);
      if (t) g.addMod({ kind: 'cantReady', target: t.uid, ...untilMyNextTurn(self), source: self.uid });
      if (g.credEven(self.controller)) await g.draw(self.controller, 1);
    },
  },

  we_gotta_live_together: {
    altCost: (g, _self, p) => (rivalHasMoreGigs(g, p, 2) ? 3 : null),
    play: async (g, self) => {
      const p = self.controller;
      for (let i = 0; i < 2; i++) {
        const cands = g.P(p).trash.filter((u) => g.def(u).type === 'Unit' && (g.def(u).cost ?? 0) <= 3 && g.canPlayCard(p, u, true));
        const u = await g.chooseCard(p, cands, `${g.name(self)}: play a Unit (cost ≤3) from your trash (${i + 1}/2)`, true, 'playFree', 'help');
        if (u === null) break;
        await g.playFree(p, u, 'trash');
        await g.resolvePending();
      }
    },
  },

  wild_in_the_streets: {
    play: async (g, self) => {
      const t = await pick(g, self, g.allUnits().filter((c) => c.spent), `${g.name(self)}: defeat a spent Unit`, 'harm', false, 'defeat');
      if (t) await g.defeat(t.uid, { by: self.uid });
    },
  },

  don_t_fear_the_reaper: {
    play: async (g, self) => {
      for (const c of rivalUnits(g, self, (c) => !c.spent)) g.spend(c.uid, 'effect');
      await g.resolvePending();
      const t = await pick(g, self, g.allUnits().filter((c) => c.spent), `${g.name(self)}: defeat a spent Unit`, 'harm', false, 'defeat');
      if (t) await g.defeat(t.uid, { by: self.uid });
    },
  },

  // ================================================================ Gear
  riot_shield: {
    costMod: (_g, self, _host, _card, p, kind) => (kind === 'goSolo' && p !== self.controller ? 2 : 0),
  },

  sandevistan: {
    on: {
      turnEnd: (g, self, host, ev) => {
        if (ev.player !== self.controller) return;
        if (self.host === host.uid) g.ready(host.uid);
      },
    },
  },

  overwatch_panam_s_gift: {
    abilities: [
      {
        label: 'Discard 1: defeat a spent rival Unit with cost ≤ discarded cost',
        quick: true,
        eddies: 1,
        spend: true,
        // "Discard 1" is part of the effect, not the cost: it can be activated with an empty hand (FAQ Overwatch #1)
        run: async (g, self) => {
          const discarded = await g.discard(self.controller, 1, undefined, false, `${g.name(self)}: discard 1`);
          if (!discarded.length) return;
          const n = g.def(discarded[0]).cost ?? 0;
          const t = await pick(g, self, rivalUnits(g, self, (c) => c.spent && printedCost(g, c) <= n), `${g.name(self)}: defeat a spent rival Unit (cost ≤${n})`, 'harm', false, 'defeat');
          if (t) await g.defeat(t.uid, { by: self.uid });
        },
      },
    ],
  },

  zetatech_berserk: {
    selfCost: (g, _self, p) => -g.faceUpLegends(p).length,
  },

  // ================================================================ Units
  corpo_security: {
    attackBan: (_g, _self, host, attacker) => attacker.uid === host.uid,
  },

  tyger_s_whisper: {
    play: async (g, self) => {
      if (g.canCall(self.controller)) await g.callLegend(self.controller, undefined, { free: true });
    },
  },

  field_operator: {
    play: async (g, self) => {
      if (g.credEven(self.controller)) await g.draw(self.controller, 1);
    },
  },

  maxtac_squadron: {
    on: {
      turnEnd: async (g, self, host, ev) => {
        // "if this Unit is spent" is checked when the end of turn begins, so readying it first (Saul Bright) doesn't stop it
        const wasSpent = ev.spent ? ev.spent.includes(host.uid) : host.spent;
        if (ev.player !== self.controller || !wasSpent || host.zone !== 'field') return;
        const cands = g.faceUpLegends(self.controller).filter((c) => c.spent && !g.hasMod('cantReady', c.uid));
        const t = await pick(g, self, cands, `${g.name(self)}: ready a face-up Legend`, 'help', false, 'ready');
        if (t) g.ready(t.uid);
      },
    },
  },

  valentino_street_racer: {
    play: async (g, self) => {
      const cands = friendlyUnits(g, self, (c) => c.uid !== self.uid && printedCost(g, c) <= 5);
      const t = await pick(g, self, cands, `${g.name(self)}: give Adrenaline`, 'help', false, 'adrenaline');
      if (t) g.giveKeyword(t.uid, 'adrenaline');
    },
  },

  goro_takemura_losing_his_way: {
    attack: async (g, self) => {
      // with no friendly Legends at all, they are not "all face-up" (FAQ Goro Takemura: Losing His Way #4)
      if (g.faceDownLegends(self.controller).length === 0 && g.faceUpLegends(self.controller).length > 0) g.givePower(self.uid, 5, 'endOfTurn', undefined, self.uid);
    },
  },

  maelstrom_zealots: {
    on: {
      fight: async (g, self, host, ev) => {
        if (ev.uid !== host.uid || ev.result !== 'lose') return;
        const opp = g.c(ev.opp);
        if (opp.zone !== 'field' || opp.controller === self.controller) return;
        await g.defeat(opp.uid, { by: self.uid });
      },
    },
  },

  pacifica_netrunner: {
    play: async (g, self) => {
      if (!g.credEven(self.controller)) return;
      const t = await pick(g, self, rivalUnits(g, self), `${g.name(self)}: a rival Unit can't ready until your next turn`, 'harm', false, 'cantReady');
      if (t) g.addMod({ kind: 'cantReady', target: t.uid, ...untilMyNextTurn(self), source: self.uid });
    },
  },

  pepe_najarro_working_doubles: {
    attack: async (g, self) => {
      if (g.valuePairs(self.controller) === 0) return;
      const cands = () =>
        g.P(self.controller).legends.map((u) => g.c(u)).filter((c) => c.faceUp && c.spent && g.isTag(c, 'Merc') && !g.hasMod('cantReady', c.uid));
      const got = await chooseUpTo(g, self, 2, cands, `${g.name(self)}: ready a MERC Legend`, 'help', 'ready');
      for (const c of got) g.ready(c.uid);
    },
  },

  maxtac_av: {
    play: async (g, self) => {
      await swapFriendlyRival(g, self, true);
    },
  },

  wraith_marauders: {
    on: {
      steal: async (g, self, host, ev) => {
        if (ev.actor !== host.uid) return;
        const cands = friendlyUnits(g, self, (c) => c.uid !== host.uid && c.spent && g.power(c) === ev.value && !g.hasMod('cantReady', c.uid));
        const t = await pick(g, self, cands, `${g.name(self)}: ready a Unit with power ${ev.value}`, 'help', false, 'ready');
        if (t) g.ready(t.uid);
      },
    },
  },

  nadia_fighting_through_grief: {
    play: async (g, self) => {
      g.addMod({ kind: 'lagAttack', target: self.uid, value: 'gigs', until: 'endOfTurn', source: self.uid });
    },
    // The lag permission only holds while a Rival controls more Gigs.
    attackBan: (g, self, host, attacker, target) => {
      if (attacker.uid !== host.uid || !host.lag || !target || target.gigs === null) return false;
      if (rivalHasMoreGigs(g, host.controller, 1)) return false;
      if (g.hasKw(host, 'adrenaline') || host.goSolo) return false;
      const others = g.modsFor('lagAttack', host.uid).filter((m) => m.source !== self.uid && (m.value === 'gigs' || m.value === 'any'));
      return others.length === 0;
    },
  },

  panam_palmer_strength_through_family: {
    // "During your turn, you may Call a Legend for free": the normal Call action costs 0 (it is still your one Call).
    callCost: (g, self, host, p) => (host.zone === 'field' && p === self.controller && g.s.active === p ? 0 : null),
    attack: async (g, self) => {
      const d = await g.discard(self.controller, 1, undefined, false, `${g.name(self)}: discard 1`);
      if (d.length) await g.draw(self.controller, g.faceUpLegends(self.controller).length);
    },
  },

  maxtac_heavy: {
    selfCost: (g, _self, p) => -g.units(p === 0 ? 1 : 0).length,
  },

  sandayu_oda_hanako_s_guardian: {
    play: async (g, self) => {
      g.addMod({ kind: 'lagAttack', target: self.uid, value: 'units', until: 'endOfTurn', source: self.uid });
      const n = g.valuePairs(self.controller);
      for (let i = 0; i < n; i++) {
        if (!(await spendRival(g, self))) break;
      }
    },
  },

  saul_bright_stormrider: {
    power: (g, self, host, target) =>
      target.uid !== host.uid && target.zone === 'field' && target.controller === host.controller && g.s.attack?.attacker === target.uid ? 2 : 0,
    on: {
      turnEnd: async (g, self, host, ev) => {
        if (ev.player !== host.controller) return;
        const cands = () => friendlyUnits(g, self, (c) => c.spent && !g.hasMod('cantReady', c.uid));
        const got = await chooseUpTo(g, self, 3, cands, `${g.name(self)}: ready a friendly Unit`, 'help', 'ready');
        for (const c of got) g.ready(c.uid);
      },
    },
  },
};

// Vanilla / keyword-only Green cards: emergency_atlus, riding_nomad, goro_takemura_hands_unclean.
