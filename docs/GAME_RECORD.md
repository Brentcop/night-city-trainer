# Game records

A plain-text record of one game, line by line, that a person can type while watching a video of two people playing and
that the engine can replay. This is ROADMAP2 §2 item 1, "Replay-and-compare first", first half: the notation, export
from any game the engine plays, and an exact replay. Comparing each recorded decision with the coach and the bots, and
replaying records where the camera could not see hands and draws, are the second half (see the end of this file).

Code: `src/lib/gameRecord/` (pure: no Node APIs, so a page can load it): `notation.ts` (model, parser, writer),
`describe.ts` (what each option of an engine decision is, in record terms), `instrument.ts` (hooks on a running game,
from outside the engine), `exporter.ts`, `replay.ts`, `compare.ts` (the round-trip check). Command line:
`scripts/record.ts` (`npm run record`). Tests: `tests/game-record.test.ts`.

## A first look

The setup and first two turns of the worked example at the end of this file (Medium bots, GRY Trauma Team against BBG
Cunningham Econ):

```
nct-record 1
p1: medium bot
p2: medium bot
p1 deck: file meta-gry-trauma-team.txt
p2 deck: file meta-bbg-cunningham-econ.txt
first: p2

p1 legends: V: Streetkid, Padre: Man of the Cross, Muamar Reyes: El Capitán
p2 legends: Hanako Arasaka: Daughter of the Emperor, Alt Cunningham: Soulkiller Architect, Jackie Welles: Pour One Out For Me
p1 hand: Zetatech Faceplate, Detonate, All is Lost, The Heist, Shattered Memories, Meredith Stout: Stone Cold Corpo
p2 hand: Nocturne OP55 N1, Pyramid Song, Les Élémens, Peace Offering, Trust No One, Maman Brigitte: Spirit of Death
p2 mulligans
p2 hand: Peace Offering, Placide: Voodoo Sentinel, Trust No One, Chrome Reverie, Trust No One, Towerfall
p1 keeps

turn 1 p2
p2 draws Pepe Najarro: Working Doubles
p2 rolls in d4: 1
p2 sells Chrome Reverie
p2 calls Hanako Arasaka: Daughter of the Emperor
p2 plays Trust No One
p2 draws Jacked-In Voodoo Boy
p2 ends turn

turn 2 p1
p1 draws Peace Offering
p1 rolls in d12: 6
p1 sells Detonate
p1 plays Meredith Stout: Stone Cold Corpo
p1 ends turn
```

A person typing along with a video may write it looser: `[12:34] p2 plays trust no one  # top-decked it`,
`p1 attacks Meredith > gigs`, `p2 hand: ?, ?, ?, ?, ?, ?`.

## The format

### Lines

A record is text, one statement per line; blank lines are ignored. Every line may start with a video timestamp,
`[12:34]` or `[1:02:03]` (the brackets may be left out), and may end with a comment after `#`; a line may also be a
comment alone. Keywords, `p1` / `p2` and card names are read without regard to case, and runs of spaces don't matter.
No card name contains `#`, so a `#` always starts a comment.

### Header

The first line is the format line, `nct-record 1`. Then, one per line, until the first line of the game:

| Line | Meaning |
|---|---|
| `p1: <name>`, `p2: <name>` | who sat where (optional, free text) |
| `p1 deck: file <file>.txt` | a deck of the library (`data/decks/`, as `npm run sim -- catalog` lists them) |
| `p1 deck: name <deck name>` | a library deck by its name |
| `p1 deck: list <deck name>` | the list itself, on the indented lines below it: `  3 Corpo Security` |
| `p1 deck: ?` | not known |
| `first: p1` / `first: p2` / `first: ?` | who took the first turn |
| `max turns: N` | the turn limit, when it is not the engine's 60 |
| `date: ...`, `source: ...` | free text: when it was played, where it was seen (a video link, an event) |

Both decks and `first` are required (`?` is allowed). A seat is `p1` or `p2` throughout: `p1` is the engine's player 0,
who is not necessarily the player who goes first.

### Cards

A card is written by its full name (`Jackie Welles: Pour One Out For Me`), by the part before the colon when exactly one
card has it and it is at least four letters long (`Satori` for Satori: Sword of Saburo; never `Jackie Welles`, which
three cards share, or `V`), or by its id (`satori_sword_of_saburo`). These are the rules of the card mentions on the site
(`src/lib/cardMentions.ts`); a record also forgives case, spaces and apostrophes. In a list (`p1 hand: A, B, C`) the two
names with a comma in them ("Three Mouths, One Desire", "Kerry Eurodyne: Axe, Attitude, Audience") are read whole.

Where a line could mean more than one card, it says which, with as much as is needed and no more:

- whose it is: `p2's Corpo Security` (the controller of a card in play or in the Legends area, the owner of any other);
- where it is: `Corpo Security from trash` (hand, deck, trash, field, legends, eddies, removed);
- which copy: `Corpo Security[2]`, counted from 1 in the order of that zone (a hand in the order its cards arrived, the
  field in the order its Units entered, the trash from the bottom).

The exporter adds these only when without them the replay would take another card: a copy that is not the same (it has
Gear, is spent, is the rival's) or the same card in an earlier place of its zone, which would change that zone's order.
A person usually leaves them out; the replay stops with a plain sentence when a line fits two cards that differ.

A Gig is written by its die and value, `d8=5`, and with its owner when two dice of that size could be meant,
`p1's d8=5`. A choice that changes a Gig's value adds the new value: `d8=5 to 7`.

### Hidden information

Anything the writer could not see is `?`: a card in a hand or a draw (`p2 draws ?`), a Legend (`p1 legends: ?, ?, ?`,
`p2 calls ?`), a die (`p1 rolls in d8: ?`), a deck (`p1 deck: ?`), who went first. The parser accepts every one and
lists the lines that hold one (`unknownLines`). This half's replay needs a full-information record: it refuses a record
with any `?`, naming the first such line.

### The game

Before the first turn: both players' Legends, left to right (`p1 legends: A, B, C`; the first player's two left-most
start spent), both opening hands (`p1 hand: ...`), then each mulligan answer in the order asked (the first player first)
and, after a mulligan, the new hand. Then the turns, each starting with `turn N p1` (the turn number counts both
players' turns, as the engine does).

| Line | What it records |
|---|---|
| `p1 legends: A, B, C` | chance: the Legend layout |
| `p1 hand: A, B, C, D, E, F` | chance: an opening hand, or the hand drawn after a mulligan |
| `p1 keeps` / `p1 mulligans` | decision: the mulligan |
| `turn 5 p1` | the start of a turn (checked: the turn number, and whose turn it is) |
| `p1 draws A, B` | chance: cards drawn, in order |
| `p1 rolls in d8: 5` | decision and chance: the die rolled in from the fixer area (when there is a choice) and its result |
| `p1 rerolls d8: 3` | chance: a die rolled again where it is (Kerry Eurodyne: Axe, Attitude, Audience) |
| `p1 mills A, B` | chance: top cards of the deck put in the trash |
| `p1 reveals A` | chance: the top card of the deck, read by an effect (shown, or taken to where the effect sends it) |
| `p1 looks at A, B, C` | chance: the top cards of the deck looked at together (searches) |
| `p1 sells X` | main phase: sell a card for an Eddie |
| `p1 plays X` | main phase or reaction: play a card from hand (a Quick Program as a reaction); for a face-up Legend, the ordinary Legend play (paying its cost, without Go Solo) |
| `p1 calls X` | main phase or reaction: Call the face-down Legend X (`p1 calls ?` when it wasn't seen) |
| `p1 goes solo X` | main phase: Go Solo with the Legend X |
| `p1 uses X [@ H] [ability K]` | main phase or reaction: an activated ability of X (of Gear X on H), the K-th when X has several |
| `p1 attacks X > gigs` | main phase: X attacks the rival's Gig area |
| `p1 attacks X > Y` | main phase: X attacks the Unit Y |
| `p1 ends turn` | main phase: pass (also written when the turn ended because nothing else could be done) |
| `p2 no reaction` | reaction window: no (more) reactions |
| `p2 blocks Y` | reaction window: Y blocks |
| `p1 chooses ...` | a choice inside an effect: `yes`, `no`, `none`, a card (a target; a card from hand, deck or trash), `mode 2` (counted from 1), a Gig (`d8=5`), a Gig's new value (`d8=5 to 7`), `number N`, `option N` |
| `p1 discards X`, `p1 steals d8=5` | the same, for a discard and for the Gig an attack or an effect steals |
| `p1 pays Eddie` / `p1 pays X` | optional: which source pays one €$ (an Eddie, or the Legend X) |
| `p1 resolves X` / `p1 resolves effect 2` | optional: which of the player's own pending effects resolves next |
| `p1 concedes`, `p1 runs out of time`, `game abandoned` | the game ended off the board |
| `result: p1 wins (7 gigs)` / `result: draw (turn limit)` | the result (optional; checked when present). Reasons: `7 gigs`, `overtime`, `deck out`, `turn limit`, `concession`, `time`, `abandoned` |

**Optional lines.** Payment sources and effect order are left out when they were the automatic ones (Eddies first,
then Legends in the engine's fixed order; a player's own effects first in, first out). A record either has them for a
player throughout (a `pays` line for every payment that player was asked to choose) or not at all; the replay asks a
player about payments only when the record has such lines for them, and answers the automatic pick where a line is
missing. A choice with a single option may be left out. `ends turn` may be left out where the engine ended the turn by
itself.

### Canonical form

`writeRecord` writes the canonical form: the format line, the header in the order above, a blank line, the game, with a
blank line before each turn and before the result, full card names, `p1's`, single spaces, and two spaces before a
comment. Parsing a canonical record and writing it again gives the same text (checked on every exported game); parsing a
loosely typed record and writing it gives its canonical form.

### Errors

The parser reads every line and reports each problem with its line number and what it expected, for example
`line 6: expected a card name (its full name, the part before the colon when only one card has it, or its id), found
"Jacky Wellz"; did you mean "Jackie Welles: Mama's Favorite" or ...?` and `line 7: a Gig is a d4, d6, d8, d10, d12 or
d20, found d7`.

## Export

`exportGame` plays a game with the given agents and writes its full-information record: both Legend layouts and opening
hands, every choice, every card drawn, milled, revealed or looked at, and every die. Nothing in the engine changed for
it: the game runs under hooks (`instrument.ts`) that only watch, and each agent's answer is written as the line that
names it (`describe.ts`). A watched game plays exactly like an unwatched one (same log, result and random-number state;
tested).

- Draws, mills, reveals and looks: every way the engine reads the top of a deck goes through the deck array (`shift()`
  for a draw, `slice(0, n)` to look at n cards, `[0]` for the top card), so each deck array is wrapped in a Proxy that
  sees those reads. A card read that is in the trash at the next event was milled; otherwise it was revealed.
- Dice: `rng` on the state and `value` on each Gig become accessor properties; a Gig value written straight after a
  random number is a die roll (the engine rolls dice only when rolling a Gig in and when rerolling one).
- Ends of turn come from the engine's trace (`GameOptions.trace`), turn starts from the state.
- While an agent decides, and while the engine copies the state (`Game.clone`, `Game.probeCopy`), every hook is taken
  off again, so bots, effect probes and anything else that copies the state see plain data.

## Replay

`replayRecord(record, { seed, resolveDeck })` creates a game from any seed and makes every chance outcome and every
decision the record's:

- Legend layouts and opening hands are set in the state right after `Game.create`, before the game starts (the first
  player's two left-most Legends spent). Who goes first and the turn limit are passed to `Game.create`.
- Draws, mills, reveals, looks: just before the engine reads the top of a deck, the recorded cards are put there (a copy
  from further down the deck changes places with what was on top). The order of the rest of the deck is never seen and
  never matters, since every card that is read is placed before it is read.
- Dice: while the next line is a roll, each random number is drawn from a state picked by walking the generator's own
  sequence until the die shows the recorded result (a few steps). Random numbers drawn for a shuffle meanwhile are drawn
  the same way; it doesn't matter, because every read is placed.
- Decisions: the line is matched to the option it names (`describe.ts`) and that option is the answer.

It is strict. Where the record can't be followed it stops and says in one sentence which line, what it says and what the
engine offers there, for example `Line 20 says “p1 sells Detonate”, but that is not one of the options here (turn 1, p1
to choose a main-phase action): ends turn, sells Bonnie and Clyde, sells Synapse Burnout, ...`. It stops at a move that
is not legal, a die where none is rolled or that isn't an option, a card the deck does not hold (`... but p1's deck holds
no X there (p1's deck list has none).`), a record that ends while the game goes on or goes on after the game ended,
another result, a line that fits two cards that differ, and any `?`. It never guesses and never skips a line: the only
answers it gives by itself are the ones the engine would decide by rule anyway (see Optional lines). At each decision it
can call `onDecision` with the game, the decision and the line, with the hooks off: that is where the second half will
compare the recorded move with the coach's.

## Command line

```
npm run record -- export --decks <deck a>,<deck b> --seed N [--bot easy] [--first p1|p2] [--max-turns N] [--out FILE] [--force]
npm run record -- export --event N (--match "<deck a> vs <deck b>" [--game G] | --index K) [--out FILE] [--force]
npm run record -- export --replay <practice replay .json> [--id ID] [--out FILE] [--force]
npm run record -- check <record file> [--seed N]
npm run record -- roundtrip [--games N] [--bot easy] [--seed N]
```

`export` prints the record (nothing is written without `--out`, and an existing file is replaced only with `--force`).
A deck is named by its library file when a library file holds the same list under the same name; otherwise the list is
written into the header. An event game is checked against the event's recorded result, and a practice replay against its
recorded answers and length (the Game review's checks). `check` parses a record, replays it from `--seed` (default 1) and
says that it replays to the end, with the result, or where it stops and why (exit 1). `roundtrip` plays games of the
library decks and measures the round trip (below); it writes nothing. `--help`; exit 2 on a bad command line.

## The round trip, measured (2026-11-14)

Each game is played, exported, parsed, written again (it must give the same text), replayed from two other seeds and
compared with the original decision by decision (every option offered and the one chosen, written in full) and at the
end: every zone card by card (a deck as a multiset, its order being unseen), each card's orientation, Gear and effects,
Gigs, Eddies, stats, effects in force, once-per-turn marks, the result, and the log line by line. Only the RNG value, the
trace and the sideboard are left out.

**37 games, 37 exact:** the 7 meta decks with Easy bots (14 games); meta and other library decks with Medium (9); Hard
(one game from decks and a seed, and one game from each of events 1, 3 and 6, which still end as recorded); practice
replays through `practiceAgents` with a seat that picks some moves at random and chooses its payments, effect order and
ends of turn (5, two of them conceded); one where that seat orders its own effects; a multi-day game closed as a
timed-out loss; an online game abandoned; a 10-card list that runs out of cards; and a game with an 8-turn limit.
Between them: 7 mulligans, 15 looks (searches, the rest shuffled to the bottom), 20 mill lines, reaction windows (58 no
reaction, 52 blocks, 85 Calls, one quick ability), 399 steals, 16 Go Solo, 6 Kerry rerolls, 95 payment lines, 5
effect-order lines, and every way a game ends except a tie in overtime (7 Gigs at the start of a turn, overtime, deck
out, turn limit, concession, time, abandoned). Beyond the measured set, 2,000 Easy and 150 Medium games of the whole
library (every third with the random-picking seat) all round-trip exactly, and so do the 9 of another 400 Medium games
that have a Quick Program or a quick ability played as a reaction (the bots seldom do; none in the measured set).
`npm run record -- roundtrip --games 30` repeats a smaller run in about two seconds.

A full-information record of a typical game (11 to 14 turns) is 150 to 230 lines and 4 to 6 KB, of which inline deck
lists are about 40 lines and 1 KB when the decks are not named by file.

## What the second half needs

- **Hidden cards.** A camera sees plays, attacks, sells (a sold card goes face down), Calls once flipped, and dice; not
  hands, draws, the top of a deck only its player looks at, or Legends before they are called. A replay with `?` can no
  longer be one game: either sample the unseen cards (deal them from what each deck list has left, consistent with every
  later sighting, as the bots' `hideInfo` deals hidden worlds) and replay each sample, or replay only the public part and
  treat each recorded decision as a question about what its player could know. `beforeRead` in `instrument.ts` is where
  a sampled card would be placed.
- **Comparing with the coach.** `onDecision` stops at each decision with the hooks off and the state plain (the coach
  copies the state with `structuredClone`, which refuses a Proxy). The comparison must use the acting player's view, not
  the full-information state the replay holds.
- **Typed records.** People will leave out copy numbers, `no reaction` lines and forced choices, and may write a draw
  after the play it came from. The replay already answers single-option choices and automatic payments by itself;
  leaving out `no reaction` and reading lines out of order would need a looser matcher, kept apart from this strict one.

## Worked example

A complete game, exported with `npm run record -- export --decks meta-gry-trauma-team,meta-bbg-cunningham-econ --seed 162
--bot medium`: a mulligan, searches (`looks at`), mills, Calls, a block, Go Solo, an ability, discards and steals, won by
p1 with 7 Gigs at the start of turn 12. `npm run record -- check` replays it from any seed.

```
nct-record 1
p1: medium bot
p2: medium bot
p1 deck: file meta-gry-trauma-team.txt
p2 deck: file meta-bbg-cunningham-econ.txt
first: p2
date: 2026-11-14
source: npm run record -- export, bot medium, seed 162

p1 legends: V: Streetkid, Padre: Man of the Cross, Muamar Reyes: El Capitán
p2 legends: Hanako Arasaka: Daughter of the Emperor, Alt Cunningham: Soulkiller Architect, Jackie Welles: Pour One Out For Me
p1 hand: Zetatech Faceplate, Detonate, All is Lost, The Heist, Shattered Memories, Meredith Stout: Stone Cold Corpo
p2 hand: Nocturne OP55 N1, Pyramid Song, Les Élémens, Peace Offering, Trust No One, Maman Brigitte: Spirit of Death
p2 mulligans
p2 hand: Peace Offering, Placide: Voodoo Sentinel, Trust No One, Chrome Reverie, Trust No One, Towerfall
p1 keeps

turn 1 p2
p2 draws Pepe Najarro: Working Doubles
p2 rolls in d4: 1
p2 sells Chrome Reverie
p2 calls Hanako Arasaka: Daughter of the Emperor
p2 plays Trust No One
p2 draws Jacked-In Voodoo Boy
p2 ends turn

turn 2 p1
p1 draws Peace Offering
p1 rolls in d12: 6
p1 sells Detonate
p1 plays Meredith Stout: Stone Cold Corpo
p1 ends turn

turn 3 p2
p2 draws Peace Offering
p2 rolls in d6: 6
p2 sells Peace Offering
p2 plays Pepe Najarro: Working Doubles
p2 calls Alt Cunningham: Soulkiller Architect
p2 ends turn

turn 4 p1
p1 draws Detonate
p1 rolls in d10: 6
p1 sells All is Lost
p1 plays Zetatech Faceplate
p1 chooses Meredith Stout: Stone Cold Corpo
p1 attacks Meredith Stout: Stone Cold Corpo > gigs
p1 chooses d4=1 to 2
p1 steals d6=6
p1 calls V: Streetkid
p1 mills Memory Relapse, The Heist, Mantis Blades
p1 chooses Memory Relapse
p1 plays The Heist
p1 mills Pepe Najarro: Working Doubles, Afterparty at Lizzie's, Pepe Najarro: Working Doubles, Johnny Silverhand: Never Stop Fighting
p1 ends turn

turn 5 p2
p2 draws Pyramid Song
p2 rolls in d8: 1
p2 sells Trust No One
p2 plays Towerfall
p2 attacks Pepe Najarro: Working Doubles > Meredith Stout: Stone Cold Corpo
p2 ends turn

turn 6 p1
p1 draws Augmented Negotiators
p1 rolls in d8: 1
p1 sells Detonate
p1 goes solo V: Streetkid
p1 attacks V: Streetkid > gigs
p1 steals d8=1
p1 calls Padre: Man of the Cross
p1 chooses mode 2
p1 draws Afterparty at Lizzie's
p1 ends turn

turn 7 p2
p2 draws Towerfall
p2 rolls in d10: 6
p2 sells Peace Offering
p2 plays Towerfall
p2 attacks Pepe Najarro: Working Doubles > V: Streetkid
p2 calls Jackie Welles: Pour One Out For Me
p2 ends turn

turn 8 p1
p1 draws Trauma Team Operatives
p1 rolls in d6: 4
p1 sells Peace Offering
p1 plays Trauma Team Operatives
p1 plays Augmented Negotiators
p1 calls Muamar Reyes: El Capitán
p1 chooses mode 1
p1 chooses Trauma Team Operatives
p1 ends turn

turn 9 p2
p2 draws Pepe Najarro: Working Doubles
p2 rolls in d12: 2
p2 sells Pyramid Song
p2 plays Placide: Voodoo Sentinel
p2 chooses d4=2 to 1
p2 draws Three Mouths, One Desire
p2 discards Three Mouths, One Desire
p2 chooses Trauma Team Operatives
p2 attacks Pepe Najarro: Working Doubles > gigs
p1 no reaction
p2 steals p1's d8=1
p2 ends turn

turn 10 p1
p1 draws Mantis Blades
p1 rolls in d4: 1
p1 sells Mantis Blades
p1 plays Memory Relapse
p1 chooses Placide: Voodoo Sentinel
p1 draws Augmented Negotiators
p1 attacks Augmented Negotiators > gigs
p1 steals d4=1
p1 plays Augmented Negotiators
p1 ends turn

turn 11 p2
p2 draws Les Élémens
p2 rolls in d20: 19
p2 sells Les Élémens
p2 plays Pepe Najarro: Working Doubles
p2 attacks Pepe Najarro: Working Doubles > Augmented Negotiators
p1 blocks Augmented Negotiators
p2 discards Jacked-In Voodoo Boy
p2 uses Alt Cunningham: Soulkiller Architect ability 2
p2 chooses Three Mouths, One Desire
p2 looks at Nocturne OP55 N1, Chrome Reverie, Lizzy Wizzy: Delicate Weapon
p2 chooses Lizzy Wizzy: Delicate Weapon
p2 chooses Nocturne OP55 N1
p2 uses Hanako Arasaka: Daughter of the Emperor
p2 chooses d12=2
p2 chooses d8=1
p2 ends turn

turn 12 p1

result: p1 wins (7 gigs)
```
