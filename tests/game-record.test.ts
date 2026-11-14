// The game record notation, its export and its replay (src/lib/gameRecord/, docs/GAME_RECORD.md): the parser and the
// writer, the canonical form, the round trip (a game written out, read back and replayed from two other seeds is the same
// game), the replay's strict stops, and unknowns. Easy bots and a few pinned seeds, so it stays quick.
import { describe, expect, it } from 'vitest';
import { makeTierBot } from '../src/ai/tiers';
import { Game } from '../src/engine/engine';
import type { Agent, Decision, DeckList, PlayerId } from '../src/engine/types';
import { compareGames } from '../src/lib/gameRecord/compare';
import { exportGame, type ExportResult } from '../src/lib/gameRecord/exporter';
import { cardName, parseRecord, resolveCardName, writeRecord, type DeckRef, type GameRecord } from '../src/lib/gameRecord/notation';
import { replayRecord, type ReplayResult } from '../src/lib/gameRecord/replay';
import { loadLibrary } from '../scripts/lib-node';

const lib = loadLibrary();
const deck = (file: string): DeckList => {
  const d = lib.find((x) => x.file === file)!.deck;
  return { name: d.name, legends: [...d.legends], main: [...d.main], sideboard: [] };
};
const RRG = deck('meta-rrg-dexter-midrange.txt');
const BBG = deck('meta-bbg-cunningham-econ.txt');
const GRY = deck('meta-gry-trauma-team.txt');
const YYB = deck('meta-yyb-rogue-gear.txt');

const resolveDeck = (ref: DeckRef): DeckList | string => {
  if (ref.kind === 'list') return { name: ref.name, legends: ref.legends, main: ref.main, sideboard: [] };
  if (ref.kind === 'file') {
    const d = lib.find((x) => x.file === ref.file);
    return d ? { name: d.deck.name, legends: [...d.deck.legends], main: [...d.deck.main], sideboard: [] } : `no ${ref.file}`;
  }
  return 'no deck';
};

/** A seat that picks some moves at random and chooses its payments, effect order and ends of turn (as a person may). */
class Person implements Agent {
  name = 'person';
  choosesPayment = true;
  choosesOrder = true;
  confirmsEndTurn = true;
  private inner = makeTierBot('easy', 5);
  constructor(private r: number) {}
  private rnd() {
    this.r = (Math.imul(this.r, 1664525) + 1013904223) >>> 0;
    return this.r / 2 ** 32;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'pay' || d.kind === 'order') return [this.rnd() < 0.5 ? 0 : Math.floor(this.rnd() * d.options.length)];
    if (d.options.length > 1 && this.rnd() < 0.3) return [Math.floor(this.rnd() * d.options.length)];
    if (d.kind === 'action' && d.options.length === 1) return [0];
    return this.inner.decide(g, d);
  }
}

const games = new Map<string, Promise<ExportResult>>();
function game(key: 'easy' | 'person' | 'mulligan'): Promise<ExportResult> {
  if (!games.has(key)) {
    const spec: Record<typeof key, () => Promise<ExportResult>> = {
      easy: () => exportGame({ decks: [RRG, BBG], agents: [makeTierBot('easy', 7), makeTierBot('easy', 7784)], seed: 7, first: 0 }),
      person: () => exportGame({ decks: [GRY, YYB], agents: [new Person(11), makeTierBot('easy', 12)], seed: 11, first: 1 }),
      // seed 165: a game with a mulligan, a search, mills, a block, a Go Solo, an ability and steals. It was seed 162 (the
      // worked example in docs/GAME_RECORD.md) until SIM_VERSION 9, whose bots play that deal with no search or block;
      // 165 is the nearest seed whose game has every line kind checked below.
      mulligan: () => exportGame({ decks: [GRY, BBG], agents: [makeTierBot('medium', 165), makeTierBot('medium', 165 + 7777)], seed: 165 }),
    };
    games.set(key, spec[key]());
  }
  return games.get(key)!;
}

const parsed = (text: string): GameRecord => {
  const r = parseRecord(text);
  expect(r.errors).toEqual([]);
  return r.record!;
};
const replay = (text: string, seed = 99): Promise<ReplayResult> => replayRecord(parsed(text), { seed, resolveDeck });
/** The record's text with the first line matching `re` changed by `edit` (a line returning null is removed). */
const editLine = (text: string, re: RegExp, edit: (line: string) => string | null, nth = 0): { text: string; line: number } => {
  const lines = text.split('\n');
  let seen = 0;
  const i = lines.findIndex((l) => re.test(l) && seen++ === nth);
  expect(i, `a line matching ${re}`).toBeGreaterThanOrEqual(0);
  const out = edit(lines[i]!);
  if (out === null) lines.splice(i, 1);
  else lines[i] = out;
  return { text: lines.join('\n'), line: i + 1 };
};

describe('notation: parser and writer', () => {
  const text = `nct-record 1
# typed while watching a stream
p1: Alice   # left seat
p2: Bob
p1 deck: file meta-rrg-dexter-midrange.txt
p2 deck: list Bob's deck
  1 Jackie Welles: Pour One Out For Me
  3 corpo security
first: P2
date: 2026-11-14

P2 legends: jackie welles: pour one out for me
p2   hand: Corpo Security, ?, three mouths, one desire
[0:12] p2 keeps   # quick decision
turn 1 p2
p2 draws ?
1:02:03 p2 rolls in d8: 5
p2 sells corpo_security
p2 plays Corpo Security[2] from hand
p2 attacks Corpo Security > p1's Satori from field
p2 uses Mantis Blades @ Corpo Security ability 2
p1 calls ?
p1 chooses p2's d8=5 to 6
p1 steals p2 d8
p1 pays eddie
p1 resolves effect 2
p2 chooses mode 1
p2 ends turn
result: p1 wins (7 gigs)
`;

  it('reads cards as people write them (case, spacing, apostrophes, short forms, ids), timestamps and comments', () => {
    const r = parseRecord(text);
    expect(r.errors).toEqual([]);
    const rec = r.record!;
    expect(rec.header.players).toEqual(['Alice', 'Bob']);
    expect(rec.header.first).toBe(1);
    expect(rec.header.decks[0]).toEqual({ kind: 'file', file: 'meta-rrg-dexter-midrange.txt' });
    expect(rec.header.decks[1]).toMatchObject({ kind: 'list', name: "Bob's deck", legends: ['jackie_welles_pour_one_out_for_me'], main: ['corpo_security', 'corpo_security', 'corpo_security'] });
    expect(rec.header.comments).toEqual({ p1: 'left seat' });
    expect(rec.header.notes).toEqual(['typed while watching a stream']);
    const ev = rec.lines.map((l) => l.ev);
    expect(ev[1]).toEqual({ k: 'hand', p: 1, cards: [{ id: 'corpo_security' }, null, { id: 'three_mouths_one_desire' }] });
    expect(rec.lines[2]).toMatchObject({ time: '0:12', comment: 'quick decision', ev: { k: 'mulligan', p: 1, yes: false } });
    expect(rec.lines.find((l) => l.time === '1:02:03')!.ev).toEqual({ k: 'roll', p: 1, sides: 8, value: 5 });
    expect(ev).toContainEqual({ k: 'play', p: 1, card: { id: 'corpo_security', n: 2, zone: 'hand' } });
    expect(ev).toContainEqual({ k: 'attack', p: 1, card: { id: 'corpo_security' }, target: { id: 'satori_sword_of_saburo', who: 0, zone: 'field' } });
    expect(ev).toContainEqual({ k: 'use', p: 1, card: { id: 'mantis_blades' }, host: { id: 'corpo_security' }, ability: 2 });
    expect(ev).toContainEqual({ k: 'choose', p: 0, verb: 'chooses', what: { c: 'gig', gig: { owner: 1, sides: 8, value: 5 }, to: 6 } });
    expect(ev).toContainEqual({ k: 'choose', p: 0, verb: 'steals', what: { c: 'gig', gig: { owner: 1, sides: 8 } } });
    expect(ev).toContainEqual({ k: 'pay', p: 0, source: 'eddie' });
    expect(ev).toContainEqual({ k: 'order', p: 0, card: undefined, n: 2 });
    expect(ev.at(-1)).toEqual({ k: 'result', winner: 0, reason: '7 gigs' });
    expect(resolveCardName('Satori')).toBe('satori_sword_of_saburo');
    expect(resolveCardName('Goro Takemura')).toBeNull(); // three cards have that name: never resolved by it
  });

  it('writes the canonical form, and parse then write gives the same text for it', () => {
    const canon = writeRecord(parseRecord(text).record!);
    expect(canon).toContain("p2 hand: Corpo Security, ?, Three Mouths, One Desire\n");
    expect(canon).toContain("p2 attacks Corpo Security > p1's Satori: Sword of Saburo from field\n");
    expect(canon).toContain('[0:12] p2 keeps  # quick decision\n');
    expect(canon).toContain("p1 chooses p2's d8=5 to 6\n");
    expect(canon).toContain('p1: Alice  # left seat\n');
    expect(writeRecord(parseRecord(canon).record!)).toBe(canon);
  });

  it('accepts unknowns (?) and says which lines hold them', () => {
    const r = parseRecord(text);
    const n = (s: string) => text.split('\n').findIndex((l) => l.includes(s)) + 1;
    expect(r.unknownLines).toEqual([n('p2   hand:'), n('p2 draws ?'), n('p1 calls ?')]);
  });

  it('names the line and says what was expected', () => {
    const bad = `nct-record 1
p1 deck: ?
p2 deck: ?
first: p1

p1 plays Jacky Wellz
p1 rolls in d7: 3
p1 rolls in d6: 9
p1 frobs the gibson
p1 attacks Corpo Security
`;
    const r = parseRecord(bad);
    expect(r.record).toBeNull();
    expect(r.errors.map((e) => e.line)).toEqual([6, 7, 8, 9, 10]);
    expect(r.errors[0]!.message).toMatch(/expected a card name .* found "Jacky Wellz"; did you mean "Jackie Welles/);
    expect(r.errors[1]!.message).toMatch(/a Gig is a d4, d6, d8, d10, d12 or d20, found d7/);
    expect(r.errors[2]!.message).toMatch(/a d6 rolls 1 to 6, found 9/);
    expect(r.errors[3]!.message).toMatch(/expected one of: hand, legends, keeps/);
    expect(r.errors[4]!.message).toMatch(/expected "attacks <attacker> > gigs"/);
    expect(parseRecord('p1 plays X').errors[0]).toEqual({ line: 1, message: 'expected the format line "nct-record 1" first, found "p1 plays X"' });
  });
});

describe('export and replay', () => {
  it('a watched game plays exactly as an unwatched one (same log, result and random-number state)', async () => {
    const ex = await game('easy');
    const plain = await Game.create([RRG, BBG], [makeTierBot('easy', 7), makeTierBot('easy', 7784)], { seed: 7, first: 0, trace: true }).run();
    expect({ winner: ex.state.winner, turn: ex.state.turn, rng: ex.state.rng, log: ex.state.log }).toEqual({ winner: plain.winner, turn: plain.turn, rng: plain.rng, log: plain.log });
  });

  it.each(['easy', 'person', 'mulligan'] as const)('round trip (%s): canonical text, and the replay from two other seeds is the same game', async (key) => {
    const ex = await game(key);
    expect(writeRecord(parsed(ex.text))).toBe(ex.text);
    for (const seed of [1, 2_000_000_011]) {
      const r = await replay(ex.text, seed);
      expect(r.stop).toBeUndefined();
      const c = compareGames(ex, { state: r.state!, decisions: r.decisions });
      expect(c).toEqual({ same: true, decisions: ex.decisions.length });
    }
    if (key === 'person') expect(ex.text).toMatch(/^p1 pays /m);
    if (key === 'mulligan') for (const s of ['mulligans', 'looks at', ' mills ', ' blocks ', 'goes solo', ' uses ', 'steals', 'discards']) expect(ex.text).toContain(s);
  });

  it('stops at a move that is not legal there', async () => {
    const ex = await game('easy');
    const { text, line } = editLine(ex.text, /^p1 sells /, () => `p1 sells ${cardName('kerry_eurodyne_the_last_rockerboy')}`);
    const r = await replay(text);
    expect(r.ok).toBe(false);
    expect(r.stop!.line).toBe(line);
    expect(r.stop!.message).toMatch(new RegExp(`^Line ${line} says “p1 sells Kerry Eurodyne: The Last Rockerboy”, but that is not one of the options here \\(turn 1, p1 to choose a main-phase action\\): ends turn, sells `));
  });

  it('stops at a wrong die', async () => {
    const ex = await game('easy');
    // turn 1's roll-in: the d20 can't be picked while other dice are left
    const a = editLine(ex.text, /^p1 rolls in /, () => 'p1 rolls in d20: 5');
    const ra = await replay(a.text);
    expect(ra.stop!.line).toBe(a.line);
    expect(ra.stop!.message).toMatch(/says “p1 rolls in d20: 5”, but that is not one of the options here .*: rolls in d4, rolls in d6/);
    // a reroll where none happens
    const b = editLine(ex.text, /^p1 sells /, (l) => `p2 rerolls d8: 3\n${l}`);
    const rb = await replay(b.text);
    expect(rb.stop!.line).toBe(b.line);
    expect(rb.stop!.message).toMatch(/says “p2 rerolls d8: 3”, but here the engine asks p1 to choose a main-phase action/);
  });

  it('stops at a card the deck does not hold', async () => {
    const ex = await game('easy');
    const kerry = cardName('kerry_eurodyne_the_last_rockerboy');
    const a = editLine(ex.text, /^p1 draws /, () => `p1 draws ${kerry}`);
    const ra = await replay(a.text);
    expect(ra.stop).toEqual({ line: a.line, message: `Line ${a.line} says “p1 draws ${kerry}”, but p1's deck holds no ${kerry} there (p1's deck list has none).` });
    const b = editLine(ex.text, /^p1 hand: /, (l) => l.replace(/: [^,]+,/, `: ${kerry},`));
    const rb = await replay(b.text);
    expect(rb.stop!.line).toBe(b.line);
    expect(rb.stop!.message).toMatch(new RegExp(`but p1's deck list has no ${kerry}\\.$`));
  });

  it('stops when the record ends early, and when it goes on after the game ended', async () => {
    const ex = await game('easy');
    const lines = ex.text.split('\n');
    const cut = lines.slice(0, Math.floor(lines.length / 2)).join('\n');
    const ra = await replay(cut);
    expect(ra.ok).toBe(false);
    expect(ra.stop!.message).toMatch(/^The record ends, but the game goes on: at turn \d+ the engine /);
    const w = ex.state.winner === 0 ? 'p1' : 'p2';
    const other = w === 'p1' ? 'p2' : 'p1';
    const more = editLine(ex.text, /^result:/, (l) => `p2 draws ${cardName(BBG.main[0]!)}\n\n${l}`);
    const rb = await replay(more.text);
    expect(rb.stop!.line).toBe(more.line);
    expect(rb.stop!.message).toMatch(new RegExp(`^The record goes on, but the game ended at turn \\d+ with a win for ${w} \\((7 gigs|overtime)\\): line \\d+ says “p2 draws `));
    const wrong = editLine(ex.text, /^result:/, () => `result: ${other} wins`);
    expect((await replay(wrong.text)).stop!.message).toMatch(new RegExp(`says “result: ${other} wins”, but the game ended at turn \\d+ with a win for ${w}`));
  });

  it('refuses a record with unknowns, in a sentence that names the line', async () => {
    const ex = await game('easy');
    const a = editLine(ex.text, /^p2 hand: /, (l) => l.replace(/: .*/, ': ?, ?, ?, ?, ?, ?'));
    const pr = parseRecord(a.text);
    expect(pr.errors).toEqual([]);
    expect(pr.unknownLines).toEqual([a.line]);
    const r = await replayRecord(pr.record!, { seed: 1, resolveDeck });
    expect(r.stop).toEqual({ line: a.line, message: `Line ${a.line} says “p2 hand: ?, ?, ?, ?, ?, ?”, which holds a hidden card or value (?); this replay needs every card and every die, and records with hidden information can't be replayed yet.` });
    const b = parsed(ex.text);
    b.header.decks[1] = { kind: 'unknown' };
    expect((await replayRecord(b, { seed: 1, resolveDeck })).stop!.message).toBe('The header does not say p2\'s deck (“p2 deck: ?”); this replay needs both deck lists.');
  });

  it('the replay leaves a plain game state behind and agrees with the record at each decision', async () => {
    const ex = await game('easy');
    const seen: PlayerId[] = [];
    const r = await replayRecord(parsed(ex.text), {
      seed: 3,
      resolveDeck,
      onDecision: ({ game: g, decision }) => {
        // hooks are off here: the state copies like plain data
        expect(() => structuredClone(g.s)).not.toThrow();
        seen.push(decision.player);
      },
    });
    expect(r.ok).toBe(true);
    expect(seen.length).toBeGreaterThanOrEqual(ex.decisions.length);
    expect(() => structuredClone(r.state)).not.toThrow();
  });
});
