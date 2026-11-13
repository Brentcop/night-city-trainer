// The tutorial's lessons (src/lib/tutorial.ts runs them; tests/tutorial.test.ts plays every one headlessly on the
// engine). Each is a prepared position, a scripted rival and a few steps. Facts and rule numbers come from the
// Comprehensive Rules (CR) and the engine; the words are ours.
import type { Game } from '../../engine/engine';
import { anyOf, attack, block, cardAction, chooseUnit, endTurn, noReaction, passiveRival, rivalAttacks, type Lesson } from '../../lib/tutorial';
import { C, QUIET_LEGENDS } from './cards';
import { cardsOf, cred, dieText, gigs, has } from './helpers';

const quiet = (o: { faceUp?: boolean; spent?: boolean } = {}) => QUIET_LEGENDS.map((id) => ({ id, ...o }));
const attacked = (g: Game) => g.s.stats.attacks[0] > 0;
const lastGig = (g: Game) => g.P(0).gigs[g.P(0).gigs.length - 1];

// ---------------------------------------------------------------- 1

const table: Lesson = {
  id: 'table',
  title: 'The table and how to win',
  teaches: 'What is where on the table, what the numbers mean, and how a game is won.',
  goal: 'Hold 7 Gigs at the start of your turn.',
  minutes: '1 min',
  position: {
    seed: 101,
    turn: 9,
    active: 0,
    you: {
      legends: quiet({ spent: true }),
      hand: [C.psycho, C.atlus],
      field: [{ id: C.rocker }],
      spentEddies: 4,
      gigs: [
        [4, 3],
        [6, 5],
        [8, 2],
        [10, 7],
        [12, 9],
        [20, 14],
      ],
    },
    rival: {
      legends: quiet({ spent: true }),
      hand: [C.psycho, C.psycho, C.psycho],
      gigs: [
        [4, 1],
        [6, 4],
        [8, 6],
      ],
    },
  },
  rival: passiveRival,
  steps: [
    {
      read: [
        'Welcome to the table. Your side is the bottom half, the rival’s is the top half. Each side has a field for Units, three Legends, a Gig area with dice, and piles: €$ (your money), Deck and Trash.',
        'Gigs are the dice. You win when you hold 7 or more Gigs at the start of one of your turns (CR 1.10). Under your dice it says Gigs 6/7: one more to go.',
        'Next to it, ☆ is your Street Cred: the sum of your dice. Some cards check it; winning doesn’t.',
      ],
      do: 'Take a Gig from the rival. Pick Rockn’ Rockerboy and choose Attack the Gig area, or drag it onto the rival’s dice.',
      expect: attack(C.rocker, 'gigs'),
      check: attacked,
      hint: 'Attack the rival’s Gig area with Rockn’ Rockerboy, the card marked Tutor.',
    },
    {
      do: 'Rockn’ Rockerboy steals 1 Gig. Pick one of the rival’s dice: any one will do.',
      expect: anyOf('gig', 'steal'),
      check: (g) => gigs(g, 0) >= 7,
      after: '7 Gigs. The win is checked at the start of your turn, so the rival gets one turn to take a Gig back.',
      hint: 'Pick one of the rival’s dice to steal.',
    },
    {
      do: 'Press End turn.',
      expect: endTurn,
      check: (g) => g.s.active === 1 || g.s.winner !== null,
      after: 'The rival has no Units, so it can’t attack. Watch it pass.',
      hint: 'Press End turn to hand the turn to the rival.',
    },
  ],
  goalMet: (g) => g.s.winner === 0,
  done: 'You began your turn with 7 Gigs and won. That is the whole game: put Units on the table, steal Gigs with them, and hold 7 at the start of your turn. The next lessons show each part.',
};

// ---------------------------------------------------------------- 2

const turn: Lesson = {
  id: 'turn',
  title: 'Your turn: money and Units',
  teaches: 'Eddies and €$, selling a card, playing a Unit, and Lag.',
  goal: 'Put a Unit on your field and end your turn.',
  minutes: '2 min',
  position: {
    seed: 202,
    turn: 3,
    active: 0,
    you: {
      legends: quiet(),
      hand: [C.surveillance, C.atlus, C.psycho],
      eddies: 2,
      gigs: [
        [4, 3],
        [6, 2],
      ],
    },
    rival: {
      legends: quiet({ spent: true }),
      hand: [C.psycho, C.psycho],
      gigs: [
        [4, 1],
        [6, 4],
      ],
    },
  },
  rival: passiveRival,
  steps: [
    {
      read: [
        'A turn starts on its own: your spent cards ready, you draw 1, and you roll in a Gig (CR 8.6). Then comes your main phase: do what you like, in any order, and press End turn when you are done.',
        'Money is written €$. Each ready Eddie pays 1 €$, and so does each ready Legend in your Legends area (CR 5.7.2, 5.8). The €$ readout under your Legends shows what is ready: 5 of 5.',
      ],
      do: 'Once per turn you may sell a card that has a sell tag: every Program and Gear has one, Units almost never. It becomes an Eddie, face-down and ready (CR 8.11). Sell Corporate Surveillance: pick it and choose Sell for an Eddie, or drag it onto your €$. (With “Confirm before acting” on in ⚙ Settings, a drag asks you to confirm.)',
      expect: cardAction('sell', C.surveillance),
      check: (g) => has(g, 0, C.surveillance, 'eddies'),
      after: 'Sold: your €$ went from 5 to 6.',
      hint: 'Sell Corporate Surveillance, the card marked Tutor.',
    },
    {
      do: 'Now play Psycho Squad for 4 €$: pick it and choose Play, or drag it onto your field.',
      expect: cardAction('play', C.psycho),
      check: (g) => has(g, 0, C.psycho, 'field'),
      after: 'The game paid for it: Eddies first, then a Legend. You have 2 €$ left.',
      hint: 'Play Psycho Squad, the card marked Tutor.',
    },
    {
      read: ['See the lag tag on Psycho Squad? A Unit arrives with Lag: it can’t attack on the turn you play it (CR 4.7, 11.3). Lag wears off at the end of the turn.'],
    },
    {
      do: 'Emergency Atlus costs 3 and you have 2 €$, so you are done. Press End turn.',
      expect: endTurn,
      check: (g) => g.s.active === 1,
      after: 'Your turn is over and the rival plays its turn: its moves show in the middle of the table and in the log.',
      hint: 'Press End turn. (Calling a Legend comes in a later lesson.)',
    },
  ],
  goalMet: (g) => cardsOf(g, 0, C.psycho).some((c) => c.zone === 'field' && !c.lag),
  done: 'At the end of your turn Psycho Squad lost its Lag, so from now on it can attack. Now your new turn has begun: cards ready, draw 1, roll in a Gig (CR 8.6).',
};

// ---------------------------------------------------------------- 3

const attacking: Lesson = {
  id: 'attack',
  title: 'Attacking: fights and steals',
  teaches: 'What you may attack, how a fight is decided, and how many Gigs a hit steals.',
  goal: 'Win a fight and steal 2 Gigs.',
  minutes: '2 min',
  position: {
    seed: 303,
    turn: 5,
    active: 0,
    you: {
      legends: quiet({ spent: true }),
      hand: [C.psycho],
      field: [{ id: C.psycho }, { id: C.wrecker }],
      spentEddies: 3,
      gigs: [
        [4, 2],
        [6, 4],
      ],
    },
    rival: {
      legends: quiet({ spent: true }),
      hand: [C.psycho],
      field: [{ id: C.atlus, spent: true }, { id: C.rocker }],
      gigs: [
        [4, 3],
        [6, 5],
        [8, 2],
      ],
    },
  },
  rival: rivalAttacks([C.rocker, C.psycho]),
  steps: [
    {
      read: [
        'Attack with a ready Unit that has no Lag. Attacking spends it: the card turns sideways (CR 9.3).',
        'You may attack a spent rival Unit, or the rival’s Gig area if it has dice. A ready rival Unit can’t be attacked (CR 9.3.2). Rockn’ Rockerboy is ready, so it is safe; Emergency Atlus is spent.',
      ],
      do: 'Attack Emergency Atlus with Psycho Squad: drag Psycho Squad onto it, or pick Psycho Squad, choose Attack…, then pick Emergency Atlus.',
      expect: attack(C.psycho, C.atlus),
      check: (g) => has(g, 1, C.atlus, 'trash'),
      after: 'A fight: 6 power against 4. The higher power wins and the loser is defeated, to the trash. With equal power both lose (CR 11.4).',
      hint: 'Attack Emergency Atlus (the spent rival Unit) with Psycho Squad.',
    },
    {
      read: ['An attack on the Gig area steals dice instead. Power 1 to 9 steals 1 Gig, 10 to 19 steals 2, 20 or more steals 3 (CR 9.20). Animals Wrecker has 10 power.'],
      do: 'Attack the rival’s Gig area with Animals Wrecker.',
      expect: attack(C.wrecker, 'gigs'),
      check: attacked,
      hint: 'Attack the rival’s Gig area with Animals Wrecker, the card marked Tutor.',
    },
    {
      do: 'Choose the first die to steal. You may take any of them, whatever its value (CR 11.5).',
      expect: anyOf('gig', 'steal'),
      hint: 'Pick one of the rival’s dice.',
    },
    {
      do: 'And the second.',
      expect: anyOf('gig', 'steal'),
      check: (g) => gigs(g, 0) === 4,
      after: 'You have 4 Gigs, the rival has 1.',
      hint: 'Pick one of the rival’s dice.',
    },
    {
      read: ['Both your Units are spent now. Until they ready at the start of your turn, the rival may attack them.'],
    },
    {
      do: 'Press End turn and watch what the rival does.',
      expect: endTurn,
      check: (g) => g.s.active === 1,
      hint: 'Press End turn.',
    },
  ],
  goalMet: (g) => gigs(g, 0) === 4 && has(g, 1, C.atlus, 'trash'),
  done: 'On its turn the rival’s Rockn’ Rockerboy attacked your spent Psycho Squad and won, 8 to 6. Spent Units are open to attack, so think before you attack with everything.',
};

// ---------------------------------------------------------------- 4

const defending: Lesson = {
  id: 'defend',
  title: 'Defending: Blockers and reactions',
  teaches: 'The rival’s attacks, the React Step, Blockers and Quick Programs.',
  goal: 'Lose no Gigs to the rival’s two attacks.',
  minutes: '2 min',
  position: {
    seed: 404,
    turn: 6,
    active: 1,
    you: {
      legends: quiet({ spent: true }),
      hand: [C.takeControl],
      field: [{ id: C.meredith }],
      eddies: 2,
      gigs: [
        [4, 3],
        [6, 4],
        [8, 5],
      ],
    },
    rival: {
      legends: quiet({ spent: true }),
      hand: [C.psycho],
      field: [{ id: C.atlus }, { id: C.rocker }],
      gigs: [
        [6, 2],
        [8, 6],
      ],
    },
  },
  rival: rivalAttacks([C.atlus, 'gigs'], [C.rocker, 'gigs']),
  steps: [
    {
      read: ['It’s the rival’s turn. When a rival Unit attacks, you get a moment to react before the fight or the steal: the React Step (CR 9.7).'],
      do: 'Emergency Atlus attacks your Gig area. Meredith Stout is a Blocker: pick her, or choose Block, to put her in the way. The attack becomes a fight with her (CR 11.28).',
      expect: block(C.meredith),
      check: (g) => cardsOf(g, 0, C.meredith).some((c) => c.spent),
      after: 'Meredith Stout is spent, and the attack is now on her.',
      hint: 'Block with Meredith Stout, the card marked Tutor. (Take Control is for the next attack.)',
    },
    {
      do: 'You may take more than one reaction, but nothing else is needed: choose No reaction and let them fight.',
      expect: noReaction,
      check: (g) => has(g, 1, C.atlus, 'trash'),
      after: 'A fight, 5 power against 4: Meredith Stout won, and Emergency Atlus went to the trash. Your Gigs are safe.',
      hint: 'Choose No reaction.',
    },
    {
      read: ['Next, Rockn’ Rockerboy (8 power) attacks your Gig area. Meredith Stout is spent, and a Blocker has to be ready to block.'],
      do: 'Take Control has Quick: you may play it during the rival’s attack (CR 11.30). Play it now for 2 €$: pick it and choose Run program.',
      expect: cardAction('play', C.takeControl),
      check: (g) => cardsOf(g, 0, C.takeControl).some((c) => c.zone !== 'hand'),
      hint: 'Play Take Control from your hand.',
    },
    {
      do: 'Choose the Unit it works on: Rockn’ Rockerboy.',
      expect: chooseUnit(C.rocker),
      check: (g) => g.s.mods.some((m) => m.kind === 'stealMod'),
      after: 'Rockn’ Rockerboy steals 1 fewer Gig this turn. With 8 power it would steal 1, so now it steals none.',
      hint: 'Choose Rockn’ Rockerboy.',
    },
  ],
  goalMet: (g) => gigs(g, 0) === 3 && has(g, 1, C.atlus, 'trash'),
  done: 'Both attacks failed: your Blocker won its fight, and Take Control stopped the steal. You may also Call a Legend as a reaction on the rival’s turn (CR 9.8).',
};

// ---------------------------------------------------------------- 5

const legends: Lesson = {
  id: 'legends',
  title: 'Legends: Call and Go Solo',
  teaches: 'Face-down and face-up Legends, Calling one, and Go Solo.',
  goal: 'Go Solo with V and steal a Gig with it.',
  minutes: '2 min',
  position: {
    seed: 505,
    turn: 5,
    active: 0,
    you: {
      legends: [{ id: C.saburo }, { id: C.v, faceUp: true }, { id: C.yorinobu }],
      eddies: 4,
      gigs: [
        [4, 2],
        [6, 3],
        [8, 4],
      ],
    },
    rival: {
      legends: quiet({ spent: true }),
      hand: [C.psycho],
      field: [{ id: C.rocker }],
      gigs: [
        [6, 5],
        [8, 6],
        [10, 3],
      ],
    },
  },
  rival: rivalAttacks([C.rocker, C.v]),
  steps: [
    {
      read: ['Every deck has three Legends. They start face-down in the Legends area, hidden even from you (CR 5.7.4.1). Face-down, each one pays 1 €$ like an Eddie.'],
      do: 'Once per turn you may Call a Legend: pay 1 €$ and turn a face-down one face-up (CR 11.14). You can’t tell which is which, so pick either face-down Legend and choose Call this Legend.',
      expect: cardAction('call'),
      check: (g) => g.P(0).legends.filter((u) => g.c(u).faceUp).length === 2,
      after: (g) => {
        const u = g.P(0).legends.find((x) => g.c(x).faceUp && g.c(x).defId !== 'v_corporate_exile');
        return `It is ${u !== undefined ? g.name(u) : 'a Legend'}. A face-up Legend works from the Legends area: point at it to read it. Some Legends do something the moment they are called; this one doesn’t.`;
      },
      hint: 'Call one of your face-down Legends: pick it and choose Call this Legend.',
    },
    {
      read: ['V: Corporate Exile is face-up already, and it has Go Solo: pay its cost (5 €$) to put it on the field as a ready Unit. Unlike a Unit you play, it may attack this turn (CR 11.29). V can even help pay for itself.'],
      do: 'Go Solo with V: pick it and choose Go Solo, or drag it onto your field.',
      expect: cardAction('goSolo', C.v),
      check: (g) => g.P(0).field.some((u) => g.c(u).goSolo),
      after: 'V is on the field, ready, and it can attack this turn.',
      hint: 'Choose Go Solo for V. (“Play to the field” would bring it in with Lag.)',
    },
    {
      do: 'Attack the rival’s Gig area with V.',
      expect: attack(C.v, 'gigs'),
      check: attacked,
      hint: 'Attack the rival’s Gig area with V.',
    },
    {
      do: 'Pick a die to steal.',
      expect: anyOf('gig', 'steal'),
      check: (g) => gigs(g, 0) === 4,
      hint: 'Pick one of the rival’s dice.',
    },
    {
      do: 'Press End turn.',
      expect: endTurn,
      check: (g) => g.s.active === 1,
      after: 'The rival’s turn.',
      hint: 'Press End turn.',
    },
    {
      do: 'Rockn’ Rockerboy attacks V, which is spent from its attack. You could Call your other Legend as a reaction (CR 9.8), but it wouldn’t help here: choose No reaction.',
      expect: noReaction,
      check: (g) => has(g, 0, C.v, 'removed'),
      after: '8 against 8: equal power, so both lost. V went solo, so instead of the trash it is removed from the game (CR 11.29).',
      hint: 'Choose No reaction.',
    },
  ],
  goalMet: (g) => has(g, 0, C.v, 'removed') && gigs(g, 0) === 4,
  done: 'That is Legends: money while face-down, one Call a turn, and Go Solo for the ones that have it. A Legend that went solo and leaves the field is gone for good.',
};

// ---------------------------------------------------------------- 6

const gear: Lesson = {
  id: 'gear',
  title: 'Gear and Programs',
  teaches: 'Equipping Gear for power, and Programs that act once.',
  goal: 'Beat the rival’s Psycho Squad with yours.',
  minutes: '2 min',
  position: {
    seed: 606,
    turn: 5,
    active: 0,
    you: {
      legends: quiet({ spent: true }),
      hand: [C.blades, C.surveillance],
      field: [{ id: C.psycho }],
      eddies: 3,
      gigs: [
        [4, 2],
        [6, 4],
      ],
    },
    rival: {
      legends: quiet({ spent: true }),
      hand: [C.psycho],
      field: [{ id: C.psycho }],
      gigs: [
        [4, 2],
        [6, 5],
      ],
    },
  },
  rival: passiveRival,
  steps: [
    {
      read: ['Gear goes onto one of your Units (or a face-up Legend): the Unit gets the Gear’s power and its text (CR 4.9–4.11). Programs do something once, then go to the trash (CR 4.13–4.14).'],
      do: 'Play Mantis Blades (1 €$): pick it and choose Equip, or drag it onto your field.',
      // the Gear stays in your hand until its Unit is chosen (the next step checks that)
      expect: cardAction('play', C.blades),
      hint: 'Play Mantis Blades, the card marked Tutor.',
    },
    {
      do: 'Choose the Unit that gets it: your Psycho Squad.',
      expect: chooseUnit(C.psycho),
      check: (g) => g.P(0).field.some((u) => g.c(u).gear.length > 0),
      after: 'Psycho Squad has 8 power now: 6 of its own and 2 from the blades.',
      hint: 'Choose your Psycho Squad.',
    },
    {
      read: ['The rival’s Psycho Squad is ready, so you can’t attack it. Corporate Surveillance can fix that: it spends a rival Unit that costs 4 or less.'],
      do: 'Play Corporate Surveillance (2 €$): pick it and choose Run program.',
      expect: cardAction('play', C.surveillance),
      check: (g) => cardsOf(g, 0, C.surveillance).some((c) => c.zone !== 'hand'),
      hint: 'Play Corporate Surveillance, the card marked Tutor.',
    },
    {
      do: 'Choose the rival’s Psycho Squad.',
      expect: chooseUnit(C.psycho),
      check: (g) => g.units(1).every((c) => c.spent),
      after: 'Spent. The Program has done its job and gone to your trash.',
      hint: 'Choose the rival’s Psycho Squad.',
    },
    {
      do: 'Attack the rival’s Psycho Squad with yours.',
      expect: attack(C.psycho, C.psycho),
      check: (g) => has(g, 1, C.psycho, 'trash'),
      after: '8 against 6: the blades won the fight.',
      hint: 'Attack the rival’s Psycho Squad (not the Gig area).',
    },
  ],
  goalMet: (g) => has(g, 1, C.psycho, 'trash') && has(g, 0, C.psycho, 'field'),
  done: 'Without the blades it would have been 6 against 6, and both Units would have lost. Gear stays on its Unit until the Unit leaves play; then the Gear goes with it.',
};

// ---------------------------------------------------------------- 7

const dice: Lesson = {
  id: 'gigs',
  title: 'Gigs, dice and Street Cred',
  teaches: 'Rolling in a Gig, Street Cred, changing a die, and choosing what to steal.',
  goal: 'Roll in a Gig, raise a die and steal one.',
  minutes: '2 min',
  position: {
    seed: 707,
    turn: 6,
    active: 1,
    you: {
      legends: quiet({ spent: true }),
      hand: [C.assembly],
      field: [{ id: C.psycho }],
      spentEddies: 1,
      gigs: [[10, 6]],
    },
    rival: {
      legends: quiet({ spent: true }),
      hand: [C.psycho],
      gigs: [
        [6, 5],
        [8, 7],
      ],
    },
  },
  rival: passiveRival,
  steps: [
    {
      read: ['The rival is ending its turn. Your turn then starts by itself: your cards ready and you draw 1. Last, you roll in a Gig (CR 8.6.5).'],
      do: 'Pick a die in your fixer area (the dim ones) to roll it in. A bigger die can roll higher, but any die can roll a 1. The d20 waits until it is the last one (CR 8.6.5.1.1).',
      expect: anyOf('gig', 'rollIn'),
      check: (g) => gigs(g, 0) === 2,
      after: (g) => `You rolled ${dieText(g, lastGig(g))}. Your Street Cred (☆) is ${cred(g, 0)} now.`,
      hint: 'Pick one of your dice to roll in.',
    },
    {
      read: ['Street Cred is the sum of your dice (CR 11.2). Gigs win games, but many cards also look at your dice: a high one, a pair, an even ☆.'],
      do: 'Play Industrial Assembly (1 €$): pick it and choose Run program. It raises a die by up to 4.',
      expect: cardAction('play', C.assembly),
      check: (g) => cardsOf(g, 0, C.assembly).some((c) => c.zone !== 'hand'),
      hint: 'Play Industrial Assembly, the card marked Tutor.',
    },
    {
      do: 'Choose a die of yours and how far to raise it. Try your d10 from 6 to 10: then you control a Gig of 8 or more, and Industrial Assembly also draws you a card.',
      expect: (d, g) => (d.kind === 'gigValue' ? d.options.flatMap((o, i) => (o.gig !== undefined && g.s.gigs[o.gig]?.controller === 0 ? [i] : [])) : []),
      mark: (d, g) => d.options.findIndex((o) => o.gig !== undefined && g.s.gigs[o.gig]?.sides === 10 && o.n === 10),
      check: (g) => has(g, 0, C.assembly, 'trash'),
      after: (g) => `Your ☆ is ${cred(g, 0)} now.`,
      hint: 'Raise one of your own dice: raising the rival’s helps them.',
    },
    {
      do: 'Psycho Squad is ready. Attack the rival’s Gig area with it.',
      expect: attack(C.psycho, 'gigs'),
      check: attacked,
      hint: 'Attack the rival’s Gig area with Psycho Squad.',
    },
    {
      do: 'Steal one die, whichever you like. Its value comes with it, so a high one raises your ☆ the most.',
      expect: anyOf('gig', 'steal'),
      check: (g) => gigs(g, 0) === 3,
      after: (g) => `3 Gigs, and your ☆ is ${cred(g, 0)}.`,
      hint: 'Pick one of the rival’s dice.',
    },
  ],
  goalMet: (g) => gigs(g, 0) === 3,
  done: 'That is Gigs: one rolled in each turn, stolen by attacks, changed by cards. Once both players have started a turn with no dice left to roll in, overtime begins: from then on 7 Gigs wins at once (CR 1.11).',
};

// ---------------------------------------------------------------- 8

const together: Lesson = {
  id: 'together',
  title: 'Put it together',
  teaches: 'One whole turn against the Easy bot: money, a Program, an attack, and the win.',
  goal: 'Steal 2 Gigs this turn and win at the start of your next.',
  minutes: '3 min',
  position: {
    seed: 808,
    turn: 9,
    active: 0,
    you: {
      legends: quiet(),
      hand: [C.surveillance, C.blades, C.psycho],
      field: [{ id: C.wrecker }, { id: C.psycho }],
      gigs: [
        [4, 2],
        [6, 6],
        [8, 3],
        [10, 8],
        [12, 5],
      ],
    },
    rival: {
      legends: quiet({ spent: true }),
      hand: [C.psycho, C.psycho, C.atlus],
      field: [{ id: C.corpoSecurity }],
      spentEddies: 2,
      gigs: [
        [4, 4],
        [6, 3],
        [8, 7],
        [10, 2],
      ],
    },
  },
  // the Easy bot plays the rival from here on
  rival: () => undefined,
  steps: [
    {
      read: [
        'The last lesson is one whole turn, and the rival is the Easy bot: it plays for real. You have 5 Gigs. Steal 2 this turn and you start your next turn with 7.',
        'Animals Wrecker has 10 power, so it steals 2. But the rival’s Corpo Security is a Blocker and would jump in front of it. A Blocker has to be ready to block.',
      ],
      do: 'First, money. Your face-down Legends give you 3 €$. Sell Mantis Blades for one more: a card you won’t play this turn is worth an Eddie every turn from now on.',
      expect: cardAction('sell', C.blades),
      check: (g) => has(g, 0, C.blades, 'eddies'),
      hint: 'Sell Mantis Blades. Keep Corporate Surveillance: you need it this turn.',
    },
    {
      do: 'Play Corporate Surveillance (2 €$, Run program) to spend Corpo Security.',
      expect: cardAction('play', C.surveillance),
      check: (g) => cardsOf(g, 0, C.surveillance).some((c) => c.zone !== 'hand'),
      hint: 'Spend Corpo Security first: play Corporate Surveillance. Attack now and Corpo Security would block.',
    },
    {
      do: 'Choose Corpo Security.',
      expect: chooseUnit(C.corpoSecurity),
      check: (g) => g.units(1).every((c) => c.spent),
      after: 'Corpo Security is spent, so it can’t block this turn.',
      hint: 'Choose Corpo Security.',
    },
    {
      do: 'Now attack the rival’s Gig area with Animals Wrecker.',
      expect: attack(C.wrecker, 'gigs'),
      check: attacked,
      hint: 'Attack the rival’s Gig area with Animals Wrecker.',
    },
    {
      do: 'Steal two dice: the first…',
      expect: anyOf('gig', 'steal'),
      hint: 'Pick one of the rival’s dice.',
    },
    {
      do: '…and the second.',
      expect: anyOf('gig', 'steal'),
      check: (g) => gigs(g, 0) === 7,
      after: '7 Gigs. Now hold them through one rival turn.',
      hint: 'Pick one of the rival’s dice.',
    },
    {
      read: ['The rival can’t take a Gig back on its turn: Corpo Security can never attack, and a Unit it plays now arrives with Lag. (Psycho Squad could still attack the spent Corpo Security, 6 against 2, but you don’t need it.)'],
      do: 'Press End turn.',
      expect: endTurn,
      check: (g) => g.s.active === 1 || g.s.winner !== null,
      after: 'The Easy bot is playing its turn.',
      hint: 'Press End turn.',
    },
  ],
  goalMet: (g) => g.s.winner === 0,
  missed: 'The rival held on this time. Start the lesson again and follow the plan: spend Corpo Security first, then attack the Gig area with Animals Wrecker.',
  done: 'You beat the Easy bot. You have now seen the whole game: money, Units, attacks, Blockers, Legends, Gear, Programs and Gigs. Ready for a real game?',
};

/** The lessons, in order. */
export const LESSONS: readonly Lesson[] = [table, turn, attacking, defending, legends, gear, dice, together];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
