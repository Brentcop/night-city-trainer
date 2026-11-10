// Blue card scripts. Rulings follow data/raw/sim_notes.txt and the Comprehensive Rules (sections 9–11).
import type { Game } from '../engine';
import { shuffleInPlace } from '../rng';
import type { CardInst, CardScript, CardType, PlayerId } from '../types';
import { chooseCardType, countMinGigs, friendlyUnits, hasMinGig, pick, rival, rivalDiscards, rivalUnits, untilMyNextTurn } from './helpers';

// ---------------------------------------------------------------- local helpers

/** Give a chosen rival Unit -n power this turn. */
async function weakenRival(g: Game, self: CardInst, n: number, prompt?: string) {
  const t = await pick(g, self, rivalUnits(g, self), prompt ?? `${g.name(self)}: give a rival Unit -${n} power`, 'harm', false, 'weaken');
  if (t) g.givePower(t.uid, -n, 'endOfTurn', undefined, self.uid);
  return t;
}

/**
 * "A rival Unit must attack next turn if it can." Records a 'mustAttack' mod (read by bots/engine; the engine
 * clears it when the Unit attacks). Lasts until the start of the controller's next turn, i.e. through the
 * rival's whole next turn.
 */
async function forceAttack(g: Game, self: CardInst) {
  const t = await pick(g, self, rivalUnits(g, self), `${g.name(self)}: a rival Unit must attack next turn`, 'harm', false, 'mustAttack');
  if (t) {
    g.addMod({ kind: 'mustAttack', target: t.uid, source: self.uid, ...untilMyNextTurn(self) });
    g.log(self.controller, `${g.name(t)} must attack next turn if it can`);
  }
  return t;
}

/** "A rival Unit can't attack until your next turn." */
async function lockRival(g: Game, self: CardInst, cands?: CardInst[]) {
  const t = await pick(g, self, cands ?? rivalUnits(g, self), `${g.name(self)}: a Unit can't attack until your next turn`, 'harm', false, 'cantAttack');
  if (t) g.addMod({ kind: 'cantAttack', target: t.uid, source: self.uid, ...untilMyNextTurn(self) });
  return t;
}

/** Bottom-deck a chosen rival Unit (filter optional). */
async function bottomDeckRival(g: Game, self: CardInst, filter?: (c: CardInst) => boolean, optional = false) {
  const t = await pick(g, self, rivalUnits(g, self, filter), `${g.name(self)}: bottom-deck a rival Unit`, 'harm', optional, 'bottomdeck');
  if (t) g.bottomDeck(t.uid);
  return t;
}

/** Top card of a deck (revealed); null if empty. */
const topCard = (g: Game, p: PlayerId): number | null => g.P(p).deck[0] ?? null;

const programsPlayedKey = (p: PlayerId) => `bluePrograms:${p}`;

const isProgram = (g: Game) => (c: CardInst) => g.def(c).type === 'Program';

/** Pick and bottom-deck one of rival's lowest-power units. */
async function bottomDeckLowest(g: Game, self: CardInst) {
  const us = rivalUnits(g, self);
  if (!us.length) return null;
  const min = Math.min(...us.map((u) => g.power(u)));
  return bottomDeckRival(g, self, (c) => g.power(c) === min);
}

// ---------------------------------------------------------------- scripts

export const BLUE: Record<string, CardScript> = {
  // ===================================================== Legends

  alt_cunningham_soulkiller_architect: {
    // Ability 1 creates a player mod 'altNextProgram'; this legend's costMod reads it (dynamic min-Gig count)
    // and on.cardPlayed consumes it when its controller plays a Program.
    costMod: (g, self, _host, card, p, kind) => {
      if (kind !== 'play' || p !== self.controller) return 0;
      if (g.def(card).type !== 'Program') return 0;
      if (!g.playerMods('altNextProgram', p).length) return 0;
      return -countMinGigs(g, p); // engine clamps reductions to a minimum of 1
    },
    on: {
      cardPlayed: (g, self, _h, ev) => {
        if (ev.player !== self.controller || ev.type !== 'Program') return;
        for (const m of g.playerMods('altNextProgram', self.controller)) g.removeMod(m.id);
      },
    },
    abilities: [
      {
        label: 'Your next Program this turn costs -1 €$ per friendly min Gig',
        spend: true,
        can: (g, self) => !g.playerMods('altNextProgram', self.controller).length,
        run: async (g, self) => {
          g.addMod({ kind: 'altNextProgram', player: self.controller, source: self.uid, until: 'endOfTurn' });
        },
      },
      {
        label: 'Play a Program from your trash (pay its cost), then bottom-deck it',
        eddies: 1,
        spend: true,
        can: (g, self, host) => {
          const p = self.controller;
          const avail = g.payables(p).filter((c) => c.uid !== host.uid).length - 1;
          return g.P(p).trash.some((u) => isProgram(g)(g.c(u)) && g.canPlayCard(p, u, true) && g.playCost(u, p) <= avail);
        },
        run: async (g, self) => {
          const p = self.controller;
          const cands = g.P(p).trash.filter(
            (u) => isProgram(g)(g.c(u)) && g.canPlayCard(p, u, true) && g.playCost(u, p) <= g.available(p),
          );
          const u = await g.chooseCard(p, cands, 'Alt Cunningham: play a Program from your trash', false, 'playFromTrash', 'help');
          if (u === null) return;
          if (!(await g.pay(p, g.playCost(u, p)))) return;
          await g.playFree(p, u, 'trash', { bottomDeckAfter: true });
        },
      },
    ],
  },

  evelyn_parker_beautiful_enigma: {
    on: {
      steal: (g, self, _h, ev) => {
        if (ev.player !== self.controller) return;
        const a = g.c(ev.actor);
        if (!a || a.zone !== 'field' || a.controller !== self.controller) return;
        if (!(g.isTag(a, 'Corpo') || g.isTag(a, 'Ganger'))) return;
        // "steals 1 or more Gigs": once per attack (per steal event when not attacking).
        if (g.s.attack && !g.oncePerTurn(`evelynB:${self.uid}:${g.s.stats.attacks[0] + g.s.stats.attacks[1]}`)) return;
        g.readyEddies(self.controller, 1);
      },
    },
    abilities: [
      {
        label: 'A rival Unit must attack next turn if it can',
        eddies: 1,
        spend: true,
        can: (g, self) => rivalUnits(g, self).length > 0,
        run: async (g, self) => {
          await forceAttack(g, self);
        },
      },
    ],
  },

  jackie_welles_pour_one_out_for_me: {
    on: {
      cardPlayed: async (g, self, _h, ev) => {
        if (ev.player !== self.controller || (ev.type !== 'Unit' && ev.type !== 'Gear')) return;
        if (g.def(ev.uid).color !== 'Blue') return;
        const p = self.controller;
        // the first Blue Unit/Gear this turn, even if Jackie was face-down when it was played
        if (!g.firstThisTurn(ev.seq, 'play', (e) => e.p === p && (e.type === 'Unit' || e.type === 'Gear') && g.def(e.uid).color === 'Blue')) return;
        const gid = await g.adjustGig(self.controller, 2, 'down', 'friendly', { source: self.uid });
        if (gid !== null && g.gig(gid).value === 1) await g.draw(self.controller, 1);
      },
    },
  },

  judy_alvarez_braindance_maestro: {
    on: {
      cardPlayed: async (g, self, _h, ev) => {
        if (ev.player !== self.controller || ev.type !== 'Program' || !g.isTag(ev.uid, 'Braindance')) return;
        const t = await pick(g, self, friendlyUnits(g, self), 'Judy: give a friendly Unit +1 power this turn', 'help', false, 'pump');
        if (t) g.givePower(t.uid, 1, 'endOfTurn', undefined, self.uid);
      },
    },
    abilities: [
      {
        label: 'Trash the top card of your deck; if a Program, may add it to hand',
        spend: true,
        can: (g, self) => g.P(self.controller).deck.length > 0,
        run: async (g, self) => {
          const p = self.controller;
          const [u] = g.mill(p, 1);
          if (u === undefined || g.def(u).type !== 'Program' || g.c(u).zone !== 'trash') return;
          if (await g.yesNo(p, `Add ${g.name(u)} to your hand?`, 'addToHand', self.uid)) {
            g.move(u, 'hand');
            g.log(p, `adds ${g.name(u)} to hand`);
          }
        },
      },
    ],
  },

  wakako_okada_peace_and_harmony: {
    call: async (g, self) => {
      const hasT = rivalUnits(g, self).length > 0;
      const modes = ['Give a rival Unit -2 power this turn', 'Draw 1'];
      const i = hasT ? await g.chooseMode(self.controller, 'Wakako Okada: choose one', modes, self.uid, 'mode') : 1;
      if (i === 0) await weakenRival(g, self, 2);
      else await g.draw(self.controller, 1);
    },
    abilities: [
      {
        label: 'Decrease a Gig by up to 2',
        spend: true,
        can: (g) => g.allGigs().some((x) => x.value > 1),
        run: async (g, self) => {
          await g.adjustGig(self.controller, 2, 'down', 'any', { source: self.uid });
        },
      },
    ],
  },

  sasha_yakovleva_won_t_let_you_down: {
    attack: async (g, self) => {
      const p = self.controller;
      const u = topCard(g, p);
      if (u === null) return;
      g.move(u, 'hand');
      const cost = g.def(u).cost ?? 0;
      g.log(p, `reveals ${g.name(u)} and adds it to hand`);
      if (cost > 0 && self.zone === 'field') g.givePower(self.uid, cost, 'endOfTurn', undefined, self.uid);
    },
    defeated: async (g, self) => {
      await rivalDiscards(g, self, 1);
    },
  },

  // v_corporate_exile: {Go Solo} only — handled by the engine from card data.

  // ===================================================== Programs

  floor_it: {
    play: async (g, self) => {
      await weakenRival(g, self, 1);
      await g.draw(self.controller, 1);
    },
  },

  reboot_optics: {
    // A player-wide 'noDefeatOpp' mod on the rival: the engine uses it up at the next fight of any rival Unit
    // (including Units that enter play later this turn), and that Unit doesn't defeat its opponent.
    play: async (g, self) => {
      g.addMod({ kind: 'noDefeatOpp', player: rival(self), source: self.uid, until: 'endOfTurn' });
    },
  },

  trust_no_one: {
    play: async (g, self) => {
      await g.adjustGig(self.controller, 3, 'down', 'any', { source: self.uid });
      if (hasMinGig(g, self.controller)) await g.draw(self.controller, 1);
    },
  },

  three_mouths_one_desire: {
    play: async (g, self) => {
      const p = self.controller;
      const top = g.P(p).deck.slice(0, 3);
      if (!top.length) return;
      const extra = countMinGigs(g, p);
      const picked: number[] = [];
      for (let i = 0; i < 1 + extra; i++) {
        const cands = top.filter((u) => !picked.includes(u));
        if (!cands.length) break;
        const u = await g.chooseCard(
          p,
          cands,
          i === 0 ? 'Three Mouths, One Desire: add a card to your hand' : `Add another card? (${i}/${extra})`,
          i > 0,
          'search',
          'help',
        );
        if (u === null) break;
        picked.push(u);
      }
      for (const u of picked) {
        g.move(u, 'hand');
        g.log(p, `adds ${g.name(u)} to hand`);
      }
      const rest = top.filter((u) => !picked.includes(u));
      shuffleInPlace(g.s, rest);
      for (const u of rest) g.move(u, 'deck', { position: 'bottom' });
    },
  },

  chrome_reverie: {
    play: async (g, self) => {
      await lockRival(g, self);
      if (hasMinGig(g, self.controller) && g.canCall(self.controller)) {
        await g.callLegend(self.controller, undefined, { free: true });
      }
    },
  },

  nocturne_op55_n1: {
    altCost: (g, _self, p) => (g.P(p).fixer.length === 0 ? 1 : null),
    play: async (g, self) => {
      const p = self.controller;
      const legends = g.P(p).legends.map((u) => g.c(u)).filter((c) => c.faceUp && g.hasKw(c, 'goSolo') && g.def(c).cost !== null);
      const modes = ['Draw 2', "A Unit can't attack until your next turn", 'A friendly Legend may Go Solo for -2 €$ this turn'];
      const i = await g.chooseMode(p, 'Nocturne Op55 N1: choose one', modes, self.uid, 'mode');
      if (i === 0) await g.draw(p, 2);
      else if (i === 1) await lockRival(g, self, g.allUnits());
      else {
        const t = await pick(g, self, legends, 'Nocturne: which Legend may Go Solo for -2 €$?', 'help', false, 'goSoloDiscount');
        if (t) {
          const target = t.uid;
          g.addMod({
            kind: 'costMod',
            player: p,
            amount: -2,
            source: self.uid,
            until: 'endOfTurn',
            value: { kind: 'goSolo', uid: target },
          });
        }
      }
    },
  },

  pyramid_song: {
    play: async (g, self) => {
      const p = self.controller;
      const both = g.gigsOf(p).some((x) => x.sides === 4 && x.value === 1);
      let mode = 0;
      if (!both) {
        const zeros = rivalUnits(g, self, (c) => g.power(c) === 0);
        mode = zeros.length ? await g.chooseMode(p, 'Pyramid Song: choose one', ['Give a rival Unit -4 power', 'Bottom-deck a rival Unit with power 0'], self.uid, 'mode') : 0;
      }
      if (both || mode === 0) await weakenRival(g, self, 4);
      if (both || mode === 1) await bottomDeckRival(g, self, (c) => g.power(c) === 0);
    },
  },

  unlikely_bond: {
    play: async (g, self) => {
      const mine = await pick(g, self, friendlyUnits(g, self, (c) => !c.spent), 'Unlikely Bond: bottom-deck a ready friendly Unit', 'neutral', false, 'bottomdeckOwn');
      if (!mine) return;
      g.bottomDeck(mine.uid);
      await bottomDeckRival(g, self, (c) => c.spent);
    },
  },

  les_elemens: {
    play: async (g, self) => {
      await bottomDeckLowest(g, self);
    },
  },

  towerfall: {
    play: async (g, self) => {
      const p = self.controller;
      const both = g.lessCred(p);
      let mode = 0;
      if (!both) mode = await g.chooseMode(p, 'Towerfall: choose one', ['Give all rival Units -5 power this turn', 'Bottom-deck all rival Units with power 0'], self.uid, 'mode');
      if (both || mode === 0) for (const u of rivalUnits(g, self)) g.givePower(u.uid, -5, 'endOfTurn', undefined, self.uid);
      if (both || mode === 1) {
        const zeros = rivalUnits(g, self, (c) => g.power(c) === 0);
        for (const u of zeros) g.bottomDeck(u.uid);
      }
    },
  },

  // ===================================================== Gear

  tetratronic_rippler: {
    on: {
      spent: async (g, self, host, ev) => {
        if (ev.uid !== host.uid) return;
        const p = self.controller;
        const u = topCard(g, p);
        if (u === null) return;
        if (await g.yesNo(p, `Tetratronic Rippler: trash the top card of your deck (${g.name(u)})?`, 'trashTop', self.uid)) {
          g.mill(p, 1);
        }
      },
    },
  },

  dying_night_v_s_pistol: {
    attack: async (g, self, host) => {
      await g.adjustGig(self.controller, 2, 'down', 'any', { source: self.uid });
      if (g.hasName(host, 'V')) g.addDelayed(self, 'turnEnd', { player: self.controller }, 'endOfTurn');
    },
    delayed: {
      turnEnd: (g, mod, ev) => {
        if (ev.player !== mod.value.data.player) return false;
        g.readyEddies(ev.player, 2);
        return true;
      },
    },
  },

  netwatch_netdriver: {
    on: {
      spent: async (g, self, host, ev) => {
        if (ev.uid !== host.uid) return;
        await g.draw(self.controller, 1);
      },
    },
  },

  // ===================================================== Units

  evelyn_parker_scheming_siren: {
    attack: async (g, self) => {
      await g.draw(self.controller, 1);
      if (g.moreCred(self.controller)) await g.discard(self.controller, 1);
    },
  },

  jacked_in_voodoo_boy: {
    // "This Unit can't attack unless you played a Program this turn." (engine counts Programs per player per turn)
    attackBan: (g, _self, host, attacker) => attacker.uid === host.uid && g.programsPlayedThisTurn(host.controller) === 0,
  },

  delamain_rideshare_ai: {
    play: async (g, self) => {
      await g.draw(self.controller, 2);
    },
  },

  misty_olszewski_mender_of_broken_spirits: {
    attackBan: (_g, _self, host, attacker) => attacker.uid === host.uid,
    on: {
      turnEnd: async (g, self, host, ev) => {
        if (ev.player !== self.controller || host.zone !== 'field') return;
        const p = self.controller;
        const t: CardType = await chooseCardType(g, p, 'Misty: choose a card type');
        const u = topCard(g, p);
        if (u === null) return;
        if (g.def(u).type === t) {
          g.move(u, 'hand');
          g.log(p, `reveals ${g.name(u)} (${t}) and adds it to hand`);
          g.readyEddies(p, 1);
        } else {
          g.log(p, `reveals ${g.name(u)} — not a ${t}`);
          g.mill(p, 1);
        }
      },
    },
  },

  mox_inciters: {
    play: async (g, self) => {
      await forceAttack(g, self);
    },
  },

  delamain_cab: {
    on: {
      steal: (g, self, host, ev) => {
        if (ev.actor === host.uid) g.s.counters[`cabStole:${host.uid}`] = g.s.turn;
      },
      turnEnd: (g, self, host, ev) => {
        if (ev.player !== self.controller) return;
        if (g.s.counters[`cabStole:${host.uid}`] === g.s.turn) g.readyEddies(self.controller, 1);
      },
    },
  },

  hacked_corpo: {
    play: async (g, self) => {
      const p = self.controller;
      const milled = g.mill(p, 3);
      const cands = milled.filter((u) => g.c(u).zone === 'trash' && g.def(u).type === 'Program');
      if (!cands.length) return;
      const u = await g.chooseCard(p, cands, 'Hacked Corpo: add a Program to your hand', false, 'search', 'help');
      if (u !== null) {
        g.move(u, 'hand');
        g.log(p, `adds ${g.name(u)} to hand`);
      }
    },
  },

  rita_wheeler_no_stupid_questions: {
    on: {
      spent: async (g, self, host, ev) => {
        if (ev.uid !== host.uid || self.uid !== host.uid) return;
        if (!g.oncePerTurn(`rita:${host.uid}`)) return;
        await g.draw(self.controller, 1);
        await g.discard(self.controller, 1);
      },
    },
  },

  westbrook_netrunner: {
    // Until your next turn, rival Legends can't steal friendly Gigs with value less than their power (engine-level steal ban).
    play: async (g, self) => {
      g.addMod({ kind: 'stealBan', player: self.controller, value: { cmp: 'lt', legendsOnly: true }, source: self.uid, ...untilMyNextTurn(self) });
    },
  },

  lizzy_wizzy_delicate_weapon: {
    play: async (g, self) => {
      const p = self.controller;
      const ok = (u: number) => g.def(u).type === 'Program' && (g.def(u).cost ?? 0) <= 3 && g.canPlayCard(p, u, true);
      const cands = [...g.P(p).hand.filter(ok), ...g.P(p).trash.filter(ok)];
      const u = await g.chooseCard(p, cands, 'Lizzy Wizzy: play a Program (cost ≤3) from hand or trash for free?', true, 'freePlay', 'help');
      if (u === null) return;
      await g.playFree(p, u, g.c(u).zone, { bottomDeckAfter: true });
    },
  },

  mt0d12_flathead: {
    unblockable: (g, _self, host, attacker) => attacker.uid === host.uid && g.lessCred(host.controller),
  },

  maman_brigitte_spirit_of_death: {
    play: async (g, self) => {
      const p = self.controller;
      const progs = g.P(p).hand.filter((u) => g.def(u).type === 'Program');
      const targets = rivalUnits(g, self, (c) => c.gear.length === 0);
      if (progs.length < 2 || !targets.length) return;
      if (!(await g.yesNo(p, 'Maman Brigitte: discard 2 Programs to bottom-deck a rival unequipped Unit?', 'discardFor', self.uid))) return;
      const d = await g.discard(p, 2, isProgram(g), false, 'Maman Brigitte: discard a Program');
      if (d.length < 2) return;
      await bottomDeckRival(g, self, (c) => c.gear.length === 0);
    },
  },

  modded_muramasa: {
    on: {
      turnEnd: (g, self, host, ev) => {
        if (ev.player !== self.controller || host.zone !== 'field') return;
        if (g.lessCred(self.controller) && g.ready(host.uid)) g.log(self.controller, `readies ${g.name(host)}`);
      },
    },
  },

  rogue_amendiares_queen_of_the_afterlife: {
    on: {
      steal: (g, self, host, ev) => {
        if (ev.player !== self.controller || ev.actor === host.uid) return;
        const a = g.c(ev.actor);
        if (!a || a.zone !== 'field' || a.controller !== self.controller) return;
        if (ev.value >= g.power(a)) return;
        if (!g.oncePerTurn(`rogue:${host.uid}`)) return;
        g.readyEddies(self.controller, 2);
      },
    },
    abilities: [
      {
        label: 'A rival Unit loses power equal to this Unit’s power this turn',
        eddies: 2,
        spend: true,
        quick: true,
        can: (g, self) => rivalUnits(g, self).length > 0,
        run: async (g, self, host) => {
          const n = g.power(host);
          const t = await pick(g, self, rivalUnits(g, self), `Rogue: a rival Unit gets -${n} power`, 'harm', false, 'weaken');
          if (t && n > 0) g.givePower(t.uid, -n, 'endOfTurn', undefined, self.uid);
        },
      },
    ],
  },

  judy_alvarez_nothing_to_doubt: {
    abilities: [
      {
        label: 'Reveal the top card; play it for free or add it to hand',
        eddies: 1,
        spend: true,
        can: (g, self) => g.P(self.controller).deck.length > 0,
        run: async (g, self) => {
          const p = self.controller;
          const u = topCard(g, p);
          if (u === null) return;
          g.log(p, `reveals ${g.name(u)}`);
          if (g.canPlayCard(p, u, true) && (await g.yesNo(p, `Play ${g.name(u)} for free?`, 'freePlay', self.uid))) {
            await g.playFree(p, u, 'deck');
          } else {
            g.move(u, 'hand');
            g.log(p, `adds ${g.name(u)} to hand`);
          }
        },
      },
    ],
  },

  modded_kusanagi: {
    on: {
      turnEnd: (g, self, host, ev) => {
        if (ev.player !== self.controller || host.zone !== 'field') return;
        g.returnToHand(host.uid);
      },
    },
  },

  placide_voodoo_sentinel: {
    play: async (g, self) => placide(g, self),
    attack: async (g, self) => placide(g, self),
  },
};

async function placide(g: Game, self: CardInst) {
  const p = self.controller;
  if (!g.P(p).hand.some((u) => g.def(u).type === 'Program') || !rivalUnits(g, self).length) return;
  const d = await g.discard(p, 1, isProgram(g), true, 'Placide: discard a Program to bottom-deck a rival Unit?');
  if (d.length) await bottomDeckRival(g, self);
}
