// Yellow card scripts.
import { other, type Game } from '../engine';
import type { CardInst, CardScript, Mod, PlayerId } from '../types';
import { costLE, defeatRival, isType, pick, rival, rivalDiscards, rivalHasMoreGigs, searchTop } from './helpers';

// ---------------------------------------------------------------- local helpers

/** All Gear currently equipped to cards controlled by p (or anyone if p undefined). */
function gearInPlay(g: Game, p?: PlayerId): CardInst[] {
  return g.sources(p).filter((s) => s.self.uid !== s.host.uid).map((s) => s.self);
}

const isCyberware = (g: Game) => (c: CardInst) => g.def(c).type === 'Gear' && g.isTag(c, 'Cyberware');

function friendlyGigValue(g: Game, p: PlayerId, v: number | null | undefined): boolean {
  return v !== null && v !== undefined && g.gigsOf(p).some((x) => x.value === v);
}

/** "Defeat a Gear" choice (optional). Returns the defeated gear's printed cost, or null if none. */
async function maybeDefeatGear(g: Game, self: CardInst, gears: CardInst[], prompt: string, intent: 'harm' | 'help' | 'neutral') {
  if (!gears.length) return null;
  const u = await g.chooseCard(self.controller, gears.map((c) => c.uid), prompt, true, 'defeatGear', intent);
  if (u === null) return null;
  const cost = g.def(u).cost ?? 0;
  g.defeatGear(u);
  return cost;
}

function credOf(g: Game, p: PlayerId) {
  return g.streetCred(p) ?? 0;
}

/** Card is controlled by p (or, if it has already left play, owned by p). */
function wasFriendly(g: Game, uid: number, p: PlayerId) {
  const c = g.c(uid);
  if (c.zone === 'field' || c.zone === 'legends') return c.controller === p;
  return c.owner === p;
}

// ---------------------------------------------------------------- scripts

export const YELLOW: Record<string, CardScript> = {
  // ===================== Legends

  dum_dum_maelstrom_triggerman: {
    call: async (g, self) => {
      const p = self.controller;
      const cost = await maybeDefeatGear(g, self, gearInPlay(g, p), 'Dum Dum: defeat a friendly Gear to draw 2 (else draw 1)?', 'neutral');
      await g.draw(p, cost !== null ? 2 : 1);
    },
    abilities: [
      {
        label: '+1 power to a friendly Unit per equipped Gear',
        quick: true,
        eddies: 1,
        spend: true,
        // any friendly Unit may be chosen, even one with no Gear (FAQ: Dum Dum #1)
        can: (g, self) => g.units(self.controller).length > 0,
        run: async (g, self) => {
          const cands = g.units(self.controller);
          const t = await pick(g, self, cands, 'Dum Dum: give a friendly Unit +1 power per equipped Gear', 'help', false, 'pump');
          if (t) g.givePower(t.uid, t.gear.length, 'endOfTurn', undefined, self.uid);
        },
      },
    ],
  },

  kerry_eurodyne_axe_attitude_audience: {
    on: {
      gigRolled: async (g, self, _h, ev) => {
        const p = self.controller;
        if (ev.player !== p) return;
        const gig = g.gig(ev.gig);
        if (!gig || gig.controller !== p) return;
        if (ev.fromFixer) {
          const ok = await g.yesNo(p, `Kerry Eurodyne: reroll your d${gig.sides} (rolled ${gig.value})?`, 'kerryReroll', self.uid);
          if (ok) {
            const old = gig.value;
            g.reroll(gig.id);
            g.log(p, `Kerry Eurodyne rerolls d${gig.sides}: ${old} → ${gig.value}`);
          }
        }
        if (g.isMinGig(gig) || g.isMaxGig(gig)) {
          await g.draw(p, gig.sides === 20 ? 3 : 1);
        }
      },
    },
  },

  muamar_reyes_el_capitan: {
    call: async (g, self) => {
      const p = self.controller;
      const m = await g.chooseMode(
        p,
        'Muamar Reyes: choose one',
        ["A friendly Unit can't be defeated in a fight this turn", 'Draw 1'],
        self.uid,
        'muamarCall',
      );
      if (m === 0) {
        const t = await pick(g, self, g.units(p), "Muamar: friendly Unit can't be defeated in a fight this turn", 'help', false, 'protect');
        if (t) g.addMod({ kind: 'noFightDefeat', target: t.uid, until: 'endOfTurn', source: self.uid });
      } else await g.draw(p, 1);
    },
    abilities: [
      {
        label: 'Adjust a Gig by 1',
        spend: true,
        can: (g) => g.allGigs().length > 0,
        run: async (g, self) => {
          await g.adjustGig(self.controller, 1, 'either', 'any', { exact: true, source: self.uid });
        },
      },
    ],
  },

  river_ward_detective_on_the_hunt: {
    abilities: [
      {
        label: 'Play a Gear with cost 2 or less from hand for free',
        quick: true,
        spend: true,
        // may be activated with no Gear to play: it then just spends River Ward (FAQ: River Ward #1)
        run: async (g, self) => {
          const p = self.controller;
          const cands = g.P(p).hand.filter((u) => g.def(u).type === 'Gear' && (g.def(u).cost ?? 0) <= 2 && g.canPlayCard(p, u, true));
          const u = await g.chooseCard(p, cands, 'River Ward: play a Gear (cost ≤2) for free', false, 'playFree', 'help');
          if (u !== null) await g.playFree(p, u, 'hand');
        },
      },
    ],
    on: {
      unitDefeated: async (g, self, _h, ev) => {
        const p = self.controller;
        if (ev.controller !== p || !ev.wasEquipped) return;
        const top = g.P(p).deck.slice(0, 2);
        if (!top.length) return;
        const u = await g.chooseCard(p, top, 'River Ward: trash 1 of the top 2 cards of your deck', false, 'trash', 'neutral');
        if (u !== null) {
          g.move(u, 'trash');
          g.log(p, `trashes ${g.name(u)}`);
        }
      },
    },
  },

  viktor_vektor_sit_down_and_relax: {
    call: async (g, self) => {
      await searchTop(g, self.controller, 5, {
        filter: (c) => g.def(c).type === 'Gear' && (g.def(c).cost ?? 0) <= 2,
        max: 2,
        rest: 'bottom',
        prompt: 'Viktor Vektor: add a Gear with cost 2 or less to your hand',
      });
    },
  },

  rogue_amendiares_preem_solo: {
    // {Go Solo} is handled by the engine.
    on: {
      steal: async (g, self, _h, ev) => {
        const p = self.controller;
        if (ev.player !== p) return;
        const actor = g.c(ev.actor);
        if (!actor || !g.isLegend(actor)) return;
        const gig = g.gig(ev.gig);
        if (gig.controller !== p) return;
        if (gig.value % 2 === 0) await g.draw(p, 1);
        else await g.discard(other(p), 1, undefined, false, 'Rogue Amendiares: discard 1');
      },
    },
  },

  // ===================== Gear

  kiroshi_optics: {
    attack: async (g, self) => {
      const p = self.controller;
      const fd = g.faceDownLegends(p);
      if (!fd.length) return;
      const unknown = fd.filter((c) => !c.known);
      const cands = unknown.length ? unknown : fd;
      const u = await g.chooseCard(p, cands.map((c) => c.uid), 'Kiroshi Optics: look at a face-down Legend', false, 'look', 'neutral');
      if (u !== null) {
        g.c(u).known = true;
        g.log(p, 'looks at a face-down Legend');
      }
    },
  },

  // mandibular_upgrade: printed {Blocker} on the Gear — engine grants it to the host.

  adrenaline_converter: {
    keywords: (g, _self, host, target) =>
      target.uid === host.uid && rivalHasMoreGigs(g, host.controller, 2) ? ['adrenaline'] : [],
  },

  zetatech_faceplate: {
    on: {
      // A trigger that became pending still resolves if the Faceplate was moved to another Unit meanwhile (FAQ Overwatch:
      // Panam's Gift #2): it is resolved for the Unit or Legend that was spent.
      spent: async (g, self, host, ev) => {
        if (ev.uid !== host.uid) return;
        const p = self.controller;
        await g.adjustGig(p, 1, 'either', 'any', { source: self.uid });
        if (g.distinctValues(p) >= 3) await g.draw(p, 1);
      },
    },
  },

  gorilla_arms: {
    on: {
      steal: async (g, self, host, ev) => {
        if (ev.actor !== host.uid || self.host !== host.uid) return;
        // the first steal by this Unit this turn (one trigger for a multi-Gig steal; its own extra steal doesn't retrigger)
        if (!g.firstThisTurn(ev.seq, 'steal', (e) => e.uid === host.uid)) return;
        const p = self.controller;
        const vals = new Set(g.gigsOf(p).map((x) => x.value));
        await g.stealOne(p, host.uid, (x) => !vals.has(x.value));
      },
    },
  },

  the_relic_experimental_biochip: {
    // Bottom text {Defeated}: engine calls this with the host's DefeatInfo (11.23.3).
    defeated: async (g, self, info) => {
      const p = info.controller;
      const cands = g
        .P(p)
        .trash.filter((u) => u !== info.uid && g.def(u).type === 'Unit' && (g.def(u).cost ?? 0) <= 9 && g.canPlayCard(p, u, true));
      const u = await g.chooseCard(p, cands, 'The Relic: play a Unit (cost ≤9) from your trash for free', false, 'playFree', 'help');
      if (u !== null) {
        await g.playFree(p, u, 'trash');
        await g.resolvePending();
      }
      // "Then, bottom-deck this Unit". The Relic itself is no longer equipped in the trash, so it stays there (CR 11.23.3 example).
      if (g.c(info.uid).zone === 'trash') g.bottomDeck(info.uid);
    },
  },

  // ===================== Programs

  afterparty_at_lizzie_s: {
    play: async (g, self) => {
      const p = self.controller;
      await g.adjustGig(p, 1, 'either', 'any', { source: self.uid });
      if (g.distinctValues(p) >= 2) await g.draw(p, 1);
    },
  },

  safety_override: {
    // On resolution you choose a friendly Unit in the field; its next lost fight this turn defeats the opposing rival
    // Unit (FAQ: Safety Override #1). The chosen Unit is still defeated by losing (FAQ #2).
    play: async (g, self) => {
      const t = await pick(g, self, g.units(self.controller), 'Safety Override: choose a friendly Unit', 'help', false, 'protect');
      if (!t) return;
      g.addDelayed(self, 'fight', { target: t.uid }, 'endOfTurn');
      g.log(self.controller, `Safety Override is armed on ${g.name(t)}`);
    },
    delayed: {
      fight: async (g, mod: Mod, ev) => {
        const p = mod.player!;
        if (ev.uid !== mod.value?.data?.target || ev.result !== 'lose' || !wasFriendly(g, ev.uid, p)) return false;
        const opp = g.c(ev.opp);
        if (opp.zone === 'field' && opp.controller !== p) await g.defeat(opp.uid, { by: mod.source ?? null });
        return true;
      },
    },
  },

  the_heist: {
    play: async (g, self) => {
      const p = self.controller;
      const milled = g.mill(p, 4);
      const gears = milled.filter((u) => g.c(u).zone === 'trash' && g.def(u).type === 'Gear');
      const u = await g.chooseCard(p, gears, 'The Heist: add a Gear to your hand', false, 'search', 'help');
      if (u === null) return;
      const cost = g.def(u).cost;
      if (friendlyGigValue(g, p, cost) && g.canPlayCard(p, u, true)) {
        if (await g.yesNo(p, `The Heist: play ${g.name(u)} for free instead?`, 'playFree', self.uid)) {
          await g.playFree(p, u, 'trash');
          return;
        }
      }
      g.move(u, 'hand');
      g.log(p, `adds ${g.name(u)} to hand`);
    },
  },

  cyberpsychosis: {
    canPlay: (g) => g.allUnits().some((u) => u.gear.length > 0),
    play: async (g, self) => {
      const cands = g.allUnits().filter((u) => u.gear.length > 0);
      const t = await pick(g, self, cands, 'Cyberpsychosis: +3 power per equipped Gear', 'help', false, 'pump');
      if (!t) return;
      g.givePower(t.uid, 3 * t.gear.length, 'endOfTurn', undefined, self.uid);
      g.addDelayed(self, 'fight', { target: t.uid }, 'endOfTurn');
      g.addDelayed(self, 'steal', { target: t.uid }, 'endOfTurn');
    },
    delayed: {
      fight: async (g, mod, ev) => cyberpsychoMark(g, mod, ev.uid),
      steal: async (g, mod, ev) => cyberpsychoMark(g, mod, ev.actor),
      turnEnd: async (g, mod) => {
        const t = g.c(mod.value.data.target);
        if (t && t.zone === 'field' && t.enteredTurn <= mod.value.data.since) {
          g.log(t.controller, `${g.name(t)} succumbs to Cyberpsychosis`);
          await g.defeat(t.uid, { by: mod.source ?? null });
        }
        return true;
      },
    },
  },

  live_with_the_aftermath: {
    play: async (g, self) => {
      for (const p of [self.controller, rival(self)]) {
        const units = g.units(p);
        if (!units.length) continue;
        const t = await g.chooseUnit(p, units, 'Live with the Aftermath: defeat one of your Units', { intent: 'harm', tag: 'sacrifice', source: self.uid });
        if (t) await g.defeat(t.uid, { by: self.uid });
      }
    },
  },

  bootleg_black_sapphire_show: {
    play: async (g, self) => {
      const p = self.controller;
      const top = g.P(p).deck[0];
      if (top !== undefined) {
        g.move(top, 'eddies', { controller: p, faceUp: false });
        g.log(p, 'sells the top card of their deck for an Eddie');
      }
      const gigs = g.gigsOf(p);
      if (gigs.some((x) => x.value % 2 === 0) && gigs.some((x) => x.value % 2 === 1)) await g.draw(p, 2);
    },
  },

  // ===================== Units

  // secondhand_bombus: vanilla {Blocker}. rockn_rockerboy: vanilla.

  sketchy_ripper: {
    attack: async (g, self) => {
      await searchTop(g, self.controller, 3, {
        filter: isType(g, 'Gear'),
        max: 1,
        rest: 'bottom',
        prompt: 'Sketchy Ripper: add a Gear to your hand',
      });
    },
  },

  augmented_negotiators: {
    on: {
      blockerUsed: async (g, self, _h, ev) => {
        if (ev.uid !== self.uid) return;
        await rivalDiscards(g, self, 1);
      },
    },
  },

  dexter_deshawn_one_last_chance: {
    play: async (g, self) => {
      await g.adjustGig(self.controller, 1, 'either', 'any', { source: self.uid });
    },
    attack: async (g, self) => {
      await g.adjustGig(self.controller, 1, 'either', 'any', { source: self.uid });
    },
    defeated: async (g, _self, info) => {
      const p = info.controller;
      if (Math.abs(credOf(g, p) - credOf(g, other(p))) >= 10) await g.draw(p, 2);
    },
  },

  maelstrom_goons: {
    on: {
      steal: async (g, self, _h, ev) => {
        if (ev.actor !== self.uid || self.zone !== 'field' || self.gear.length === 0) return;
        await rivalDiscards(g, self, 1);
      },
    },
  },

  viktor_vektor_you_might_feel_a_little_pinch: {
    play: async (g, self) => {
      const p = self.controller;
      const hostOk = (h: CardInst) => h.zone === 'field' && h.uid !== self.uid;
      if (!g.units(p).some(hostOk)) return;
      const cands = g.P(p).trash.filter((u) => isCyberware(g)(g.c(u)) && (g.def(u).cost ?? 0) <= 2);
      const u = await g.chooseCard(p, cands, 'Viktor Vektor: play a Cyberware Gear (cost ≤2) from your trash', false, 'playFree', 'help');
      if (u !== null) await g.playFree(p, u, 'trash', { hostFilter: hostOk });
    },
  },

  gilded_maton: {
    play: async (g, self) => {
      // The friendly Gear may be defeated even with no rival Unit to defeat (FAQ: Gilded Matón #1). Without a target it
      // gains nothing, so the choice is then marked 'harm' (bots decline to pay with their own Gear for nothing).
      const target = g.units(rival(self)).some(costLE(g, 3));
      const cost = await maybeDefeatGear(g, self, gearInPlay(g, self.controller), 'Gilded Maton: defeat a friendly Gear to defeat a rival Unit (cost ≤3)?', target ? 'neutral' : 'harm');
      if (cost === null) return;
      await defeatRival(g, self, costLE(g, 3));
    },
  },

  hanako_arasaka_in_a_gilded_cage: {
    play: async (g, self) => {
      const p = self.controller;
      await searchTop(g, p, 4, {
        filter: (c) => friendlyGigValue(g, p, g.def(c).cost),
        max: 4,
        rest: 'bottom',
        prompt: 'Hanako: add a card with cost equal to a friendly Gig value',
      });
    },
  },

  offduty_malfini: {
    play: async (g, self) => {
      if (self.zone === 'field') g.spend(self.uid);
      const cands = g.units(rival(self)).filter((u) => !u.spent);
      const t = await pick(g, self, cands, 'Off-Duty Malfini: spend a rival Unit', 'harm', false, 'spend');
      if (t) g.spend(t.uid);
    },
  },

  t_bug_amateur_philosopher: {
    defeated: async (g, _self, info) => {
      const p = info.controller;
      for (const c of g.faceDownLegends(p)) c.known = true;
      if (g.faceDownLegends(p).length) g.log(p, 'looks at their face-down Legends');
      if (g.canCall(p)) await g.callLegend(p, undefined, { free: true });
    },
  },

  caliber_totentanz_s_top_dog: {
    play: async (g, self) => {
      await defeatRival(g, self, costLE(g, 2));
    },
    defeated: async (g, _self, info) => {
      const p = info.controller;
      const r = other(p);
      const d = await g.discard(r, 1, undefined, false, 'Caliber: discard 1');
      if (d.length && friendlyGigValue(g, p, g.def(d[0]).cost)) await g.discard(r, 1, undefined, false, 'Caliber: discard 1 more');
    },
  },

  maxtac_suppression_team: {
    attackBan: (g, _self, host, attacker) =>
      host.zone === 'field' && attacker.controller !== host.controller && attacker.enteredTurn === g.s.turn,
  },

  viktor_vektor_drop_your_illusions: {
    costMod: (g, _self, host, card, p, kind) => {
      if (kind !== 'play' || host.zone !== 'field' || p !== host.controller) return 0;
      if (!isCyberware(g)(card)) return 0;
      // only the first CYBERWARE Gear played this turn, counting ones played before Viktor arrived
      if (g.turnCount('play', (e) => e.p === p && e.type === 'Gear' && isCyberware(g)(g.c(e.uid))) > 0) return 0;
      return -3;
    },
  },

  heywood_ripperdoc: {
    play: async (g, self) => {
      const p = self.controller;
      const all = gearInPlay(g);
      // Bot hint: prefer rival gear; intent 'harm' points the bot at rival gear.
      const cost = await maybeDefeatGear(g, self, all, 'Heywood Ripperdoc: defeat a Gear?', 'harm');
      if (cost !== null && friendlyGigValue(g, p, cost)) await g.draw(p, 1);
    },
  },

  jackie_welles_ride_or_die_choom: {
    attack: async (g, self) => {
      const n = g.gigsOf(self.controller).filter((x) => x.value % 2 === 0).length;
      if (n && self.zone === 'field') g.givePower(self.uid, 2 * n, 'endOfTurn', undefined, self.uid);
    },
    defeated: async (g, _self, info) => {
      const n = g.gigsOf(info.controller).filter((x) => x.value % 2 === 1).length;
      if (n) await g.draw(info.controller, n);
    },
  },

  trauma_team_operatives: {
    selfCost: (g, _self, p) => -g.P(p).trash.filter((u) => g.def(u).type === 'Unit').length,
  },

  alt_cunningham_mother_of_daemons: {
    on: {
      spent: async (g, self, _h, ev) => {
        if (self.zone !== 'field') return;
        const c = g.c(ev.uid);
        if (c.controller !== self.controller || c.gear.length === 0) return;
        if (c.zone !== 'field' && c.zone !== 'legends') return;
        await g.draw(self.controller, 1);
      },
    },
    preventSteal: async (g, self, host, _attacker, gig) => {
      if (host.zone !== 'field') return false;
      const p = self.controller;
      const cands = g.P(p).hand.filter((u) => g.def(u).cost === gig.value);
      if (!cands.length) return false;
      const u = await g.chooseCard(p, cands, `Alt Cunningham: discard a card with cost ${gig.value} to prevent the steal?`, true, 'discard', 'neutral');
      if (u === null) return false;
      g.move(u, 'trash');
      g.log(p, `discards ${g.name(u)}: the d${gig.sides} isn't stolen`);
      return true;
    },
  },

  adam_smasher_metal_over_meat: {
    play: async (g, self) => {
      const victims = g.allUnits().filter((u) => u.uid !== self.uid);
      for (const v of victims) await g.defeat(v.uid, { by: self.uid });
    },
  },
};

/** Cyberpsychosis: the target stole or fought — arm the end-of-turn defeat. */
function cyberpsychoMark(g: Game, mod: Mod, uid: number): boolean {
  const target = mod.value.data.target as number;
  if (uid !== target) return false;
  const exists = g.s.mods.some((m) => m.kind === 'delayed' && m.value?.event === 'turnEnd' && m.value?.defId === 'cyberpsychosis' && m.value?.data?.target === target);
  if (!exists) {
    const src = g.c(mod.source!);
    g.addMod({
      kind: 'delayed',
      player: mod.player,
      source: src.uid,
      value: { defId: 'cyberpsychosis', event: 'turnEnd', data: { target, since: g.s.turn } },
      until: 'endOfTurn',
    });
  }
  return true;
}
