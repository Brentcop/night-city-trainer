// The runner's "Set up the event" flow (#/run): the draft model (src/lib/eventDraft.ts: entrants and copies, quick
// sets, the setup it builds, the plan line, resuming) and the setup parts and pages, server-rendered (no DOM here:
// the interactions are the pure functions tested above them).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILTIN } from '../src/lib/browserLibrary';
import type { LibraryDeck } from '../src/lib/library';
import { HIDDEN_KEY } from '../src/lib/hiddenDecks';
import {
  addEntrant,
  copyCount,
  DEFAULT_DRAFT,
  draftSetup,
  duplicateAll,
  duplicateDecks,
  duplicateEntrant,
  entrantChanges,
  entrantKey,
  handSetNames,
  initialSeed,
  MAX_COPIES,
  MAX_ENTRANTS,
  oneCopyEach,
  randomSeed,
  removeKeys,
  SEED_MAX,
  SEED_MIN,
  seedAfterStart,
  setCopies,
  durationText,
  entrantName,
  entrantsFromList,
  entrantsToList,
  estimateSeconds,
  moveEntrant,
  planText,
  quickSets,
  reachedBefore,
  removeEntrant,
  seasonOf,
  type EventDraft,
} from '../src/lib/eventDraft';
import { BracketBoEditor, BracketSlotsEditor, EntrantPicker, MatchListEditor, PairingEditor, SeedOrderEditor } from '../src/ui/components/EventSetup';
import { RoundList } from '../src/ui/components/TourneyViews';
import { TournamentRunnerPage } from '../src/ui/pages/TournamentRunner';
import { setArtEnabled } from '../src/ui/art';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

const byFile = new Map(BUILTIN.map((d) => [d.file, d]));
const meta = BUILTIN.filter((d) => d.kind === 'meta');
const draft = (o: Partial<EventDraft> = {}): EventDraft => ({ ...DEFAULT_DRAFT, entrants: meta.map((d) => ({ file: d.file, copy: 1 })), ...o });
const nameOf = (d: LibraryDeck) => d.deck.name;

describe('entrants', () => {
  const [a, b] = meta.map((d) => d.file);
  it('adds once, duplicates explicitly as #2, #3, removes and reorders', () => {
    let list = addEntrant([], a!);
    list = addEntrant(list, a!);
    expect(list).toEqual([{ file: a, copy: 1 }]);
    list = addEntrant(list, b!);
    list = duplicateEntrant(list, a!);
    list = duplicateEntrant(list, a!);
    expect(list).toEqual([
      { file: a, copy: 1 },
      { file: a, copy: 2 },
      { file: a, copy: 3 },
      { file: b, copy: 1 },
    ]);
    expect(entrantName(byFile.get(a!), { file: a!, copy: 3 })).toBe(`${byFile.get(a!)!.deck.name} #3`);
    expect(moveEntrant(list, 3, -1).map((e) => e.copy)).toEqual([1, 2, 1, 3]);
    expect(moveEntrant(list, 0, -1)).toEqual(list);
    expect(removeEntrant(list, 1).map((e) => e.copy)).toEqual([1, 3, 1]);
  });
  it('every deck again: each distinct deck gets its next copy after its last one; one of each undoes it', () => {
    const [, , c] = meta.map((d) => d.file);
    const start = [{ file: a!, copy: 1 }, { file: a!, copy: 2 }, { file: b!, copy: 1 }, { file: c!, copy: 1 }];
    const r = duplicateAll(start);
    expect(r.problem).toBeNull();
    expect(r.list).toEqual([
      { file: a, copy: 1 },
      { file: a, copy: 2 },
      { file: a, copy: 3 },
      { file: b, copy: 1 },
      { file: b, copy: 2 },
      { file: c, copy: 1 },
      { file: c, copy: 2 },
    ]);
    expect(oneCopyEach(r.list)).toEqual([{ file: a, copy: 1 }, { file: b, copy: 1 }, { file: c, copy: 1 }]);
    // the lowest copy left stays where it stands (no renumbering: hand-set names are never rewritten)
    expect(oneCopyEach([{ file: b!, copy: 1 }, { file: a!, copy: 3 }, { file: a!, copy: 2 }])).toEqual([{ file: b, copy: 1 }, { file: a, copy: 2 }]);
    expect(duplicateAll([]).list).toEqual([]);
  });
  it('copies per deck in one step: up adds after the last copy, down drops the highest numbers', () => {
    const start = [{ file: a!, copy: 1 }, { file: b!, copy: 1 }];
    const up = setCopies(start, a!, 4);
    expect(up.list.map((e) => `${e.file === a ? 'a' : 'b'}${e.copy}`)).toEqual(['a1', 'a2', 'a3', 'a4', 'b1']);
    expect(copyCount(up.list, a!)).toBe(4);
    const down = setCopies([{ file: a!, copy: 1 }, { file: b!, copy: 1 }, { file: a!, copy: 3 }, { file: a!, copy: 2 }], a!, 2);
    expect(down.list).toEqual([{ file: a, copy: 1 }, { file: b, copy: 1 }, { file: a, copy: 2 }]);
    expect(setCopies(start, b!, 1).list).toEqual(start);
    expect(setCopies(start, a!, 0)).toEqual({ list: start, problem: expect.stringMatching(/^Nothing changed: a deck is entered at least once/) });
  });
  it('bulk actions past a limit change nothing and say why', () => {
    const full = setCopies([{ file: a!, copy: 1 }, { file: b!, copy: 1 }], a!, MAX_COPIES).list;
    const name = (f: string) => (f === a ? 'Deck A' : 'Deck B');
    const r = duplicateAll(full, name);
    expect(r.list).toEqual(full); // not half done: b did not get its copy either
    expect(r.problem).toBe(`Nothing changed: Deck A would be entered more than ${MAX_COPIES} times (×${MAX_COPIES} is the most).`);
    expect(setCopies(full, a!, MAX_COPIES + 1, name).problem).toMatch(/at most 16 times/);
    const many = Array.from({ length: MAX_ENTRANTS - 1 }, (_, i) => ({ file: `f${i}.txt`, copy: 1 }));
    expect(duplicateAll(many).problem).toBe(`Nothing changed: that would make ${2 * (MAX_ENTRANTS - 1)} entrants; the most is ${MAX_ENTRANTS}.`);
    expect(duplicateDecks(many, ['f0.txt']).list).toHaveLength(MAX_ENTRANTS);
  });
  it('several at once: the selected decks once more each, the selected rows removed', () => {
    const start = [{ file: a!, copy: 1 }, { file: a!, copy: 2 }, { file: b!, copy: 1 }];
    // both copies of a ticked: a is entered once more (by deck, like "every deck again"), not twice
    expect(duplicateDecks(start, [a!, a!, 'not-entered.txt']).list).toEqual([...start.slice(0, 2), { file: a, copy: 3 }, start[2]]);
    const keys = new Set([entrantKey(start[1]!), entrantKey(start[2]!)]);
    expect(removeKeys(start, keys)).toEqual([start[0]]);
    expect(entrantChanges(start, removeKeys(start, keys))).toEqual({ added: [], removed: [start[1], start[2]] });
  });
  it('hand-set names: only the current format’s parts, never rewritten by bulk changes', () => {
    const d = draft({ pairings: [{ a: 'A', b: 'B' }], cutSeeding: 'manual', cutSeeds: ['C'], slots: ['X', null], matches: [{ a: 'M', b: 'N' }] });
    expect(handSetNames(d)).toEqual(['A', 'B', 'C']);
    expect(handSetNames({ ...d, format: 'single-elim' })).toEqual(['X']);
    expect(handSetNames({ ...d, format: 'matches' })).toEqual(['M', 'N']);
    expect(handSetNames({ ...d, format: 'round-robin' })).toEqual([]);
    // removing a copy a pairing names leaves the pairing alone; the setup reports it
    const n = meta.map(nameOf);
    const two = draft({ entrants: [...draft().entrants, { file: meta[0]!.file, copy: 2 }], pairings: [{ a: `${n[0]} #2`, b: n[1]! }] });
    const cut = { ...two, entrants: oneCopyEach(two.entrants) };
    expect(cut.pairings).toEqual(two.pairings);
    expect(draftSetup(cut, byFile).problems.join(' ')).toMatch(new RegExp(`${n[0]} #2 is not an entrant`));
  });
  it('setup links carry copies and read them back', () => {
    const list = [{ file: a!, copy: 1 }, { file: a!, copy: 2 }, { file: b!, copy: 1 }];
    expect(entrantsToList(list)).toEqual([a, `${a}*2`, b]);
    expect(entrantsFromList(entrantsToList(list))).toEqual(list);
  });
  it('quick sets: meta, guides, ladder, originals, each bred season, top rated, everything', () => {
    const sets = quickSets(BUILTIN, BUILTIN.map((d) => ({ name: d.deck.name })));
    const keys = sets.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['meta', 'guide', 'ladder', 'nc', 'top8', 'top16', 'all']));
    expect(sets.find((s) => s.key === 'meta')!.files.sort()).toEqual(meta.map((d) => d.file).sort());
    const seasons = [...new Set(BUILTIN.map(seasonOf).filter((s): s is number => s !== null))];
    for (const s of seasons) expect(sets.find((x) => x.key === `season-${s}`)!.files.length).toBeGreaterThan(0);
    expect(sets.find((s) => s.key === 'top8')!.files).toHaveLength(8);
    expect(quickSets(BUILTIN, []).some((s) => s.key.startsWith('top'))).toBe(false);
    expect(seasonOf({ prov: { origin: 'Night City Trainer bred deck (season 2, mutant)' } })).toBe(2);
    expect(seasonOf({ prov: { origin: 'choom.gg' } })).toBeNull();
  });
});

describe('the setup a draft builds', () => {
  it('a default Swiss draft is plain (no hand-set parts)', () => {
    const r = draftSetup(draft(), byFile);
    expect(r.problems).toEqual([]);
    expect(r.setup).toEqual({ format: 'swiss', entrants: meta.map((d) => ({ name: nameOf(d), file: d.file })), bestOf: 3, rounds: 4, top: 8 });
    expect(r.decks.map((d) => d.name)).toEqual(meta.map(nameOf));
  });
  it('Swiss with round-1 pairings, a fixed top-cut order and Bo5 final', () => {
    const n = meta.map(nameOf);
    const r = draftSetup(draft({ top: 4, pairings: [{ a: n[0]!, b: n[1]! }], cutSeeding: 'manual', cutSeeds: n.slice(0, 4), bracketBo: [3, 5] }), byFile);
    expect(r.problems).toEqual([]);
    expect(r.setup).toMatchObject({ pairings: { 1: [{ a: n[0], b: n[1] }] }, cutSeeds: n.slice(0, 4), bracketBestOf: [3, 5] });
    // round by round: the seeds are set at the pause instead
    expect(draftSetup(draft({ top: 4, cutSeeding: 'manual', cutSeeds: [] }), byFile, { roundByRound: true }).setup.cutSeeds).toBeUndefined();
    expect(draftSetup(draft({ top: 4, cutSeeding: 'manual', cutSeeds: n.slice(0, 3) }), byFile).problems.join(' ')).toMatch(/exactly 4 seeds/);
  });
  it('problems: a deck paired twice, a bracket with two byes, an empty match list', () => {
    const n = meta.map(nameOf);
    expect(draftSetup(draft({ pairings: [{ a: n[0]!, b: n[1]! }, { a: n[0]!, b: n[2]! }] }), byFile).problems.join(' ')).toMatch(/paired twice/);
    expect(draftSetup(draft({ format: 'single-elim', slots: [null, null, ...n.slice(0, 6)] }), byFile).problems.join(' ')).toMatch(/two byes/);
    expect(draftSetup(draft({ format: 'matches' }), byFile).problems).toContain('the match list is empty');
  });
  it('a match list plays only the decks it names; copies play as themselves', () => {
    const [x, y] = meta;
    const r = draftSetup(
      draft({ entrants: [{ file: x!.file, copy: 1 }, { file: x!.file, copy: 2 }, { file: y!.file, copy: 1 }], format: 'matches', matches: [{ a: nameOf(x!), b: `${nameOf(x!)} #2`, bestOf: 5 }] }),
      byFile,
    );
    expect(r.problems).toEqual([]);
    expect(r.unused).toEqual([nameOf(y!)]);
    expect(r.setup.entrants).toEqual([
      { name: nameOf(x!), file: x!.file },
      { name: `${nameOf(x!)} #2`, file: x!.file, copyOf: nameOf(x!) },
    ]);
  });
  it('round robin with groups sets best-of only for the bracket rounds it has', () => {
    const r = draftSetup(draft({ format: 'round-robin', groups: 2, advance: 2, bracketBo: [1, 5, 5, 5] }), byFile);
    expect(r.setup).toMatchObject({ format: 'round-robin', times: 1, groups: 2, advance: 2, bracketBestOf: [1, 5] });
  });
  it('the plan line: matches, games and time', () => {
    const r = draftSetup(draft({ rounds: 3, top: 4 }), byFile);
    expect(planText(r.setup, 'medium', 4)).toMatch(/^This event plays 12 matches: about 30 games \(24–36\), under a minute on 4 threads\.$/);
    expect(planText(r.setup, 'hard', 1, 0.01)).toMatch(/about 50 minutes on 1 thread at the pace of your last run/);
    expect(estimateSeconds(100, 'hard', 2)).toBeCloseTo(110);
    expect(durationText(30)).toBe('under a minute');
    expect(durationText(3600 + 20 * 60)).toBe('about 1 h 20 min');
  });
  it('the seed rule: a new visit and each new event get a fresh seed; a link’s seed is kept on purpose', () => {
    const seq = (...xs: number[]) => {
      let i = 0;
      return () => xs[i++ % xs.length]!;
    };
    // a new visit (no s= in the address): random, six digits, not kept
    const visit = initialSeed(null, seq(0.5));
    expect(visit).toEqual({ seed: 550000, keep: false });
    expect(initialSeed(null, seq(0)).seed).toBe(SEED_MIN);
    expect(initialSeed(null, seq(0.9999999)).seed).toBe(SEED_MAX);
    // after an event starts: a new seed, never the one just used (even if the generator repeats itself)
    expect(seedAfterStart(visit, seq(0.25))).toEqual({ seed: 325000, keep: false });
    expect(seedAfterStart(visit, seq(0.5)).seed).not.toBe(visit.seed);
    expect(randomSeed(seq(0.9999999), SEED_MAX)).toBe(SEED_MIN);
    // kept on purpose: the next event uses it again
    expect(seedAfterStart({ seed: 4242, keep: true }, seq(0.25))).toEqual({ seed: 4242, keep: true });
    // a shared setup link (s=77) reproduces that event: its seed, kept
    expect(initialSeed(77, seq(0.5))).toEqual({ seed: 77, keep: true });
  });
  it('a resumed run passes the points the saved run had reached', () => {
    const saved = { rounds: [{ matches: [{ games: [1] }] }, { matches: [{ games: [] }] }], bracket: [{}], seeds: ['A', 'B'] };
    expect(reachedBefore(saved, { stage: 'swiss', round: 2 })).toBe(true);
    expect(reachedBefore(saved, { stage: 'swiss', round: 3 })).toBe(false);
    expect(reachedBefore(saved, { stage: 'rounds', round: 1 })).toBe(true);
    expect(reachedBefore(saved, { stage: 'rounds', round: 2 })).toBe(false);
    expect(reachedBefore(saved, { stage: 'cut', round: 0 })).toBe(true);
    expect(reachedBefore({ ...saved, seeds: undefined }, { stage: 'cut', round: 0 })).toBe(false);
    expect(reachedBefore(saved, { stage: 'bracket', round: 2 })).toBe(false);
  });
});

describe('setup parts (rendered)', () => {
  const n = meta.map(nameOf);
  it('entrant picker: seed order, copies, tier badges and hidden decks marked but pickable', () => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([meta[1]!.file]));
    const html = renderToStaticMarkup(<EntrantPicker pool={BUILTIN} entrants={[{ file: meta[0]!.file, copy: 1 }, { file: meta[0]!.file, copy: 2 }, { file: meta[1]!.file, copy: 1 }]} onChange={() => undefined} />);
    expect(html).toContain('Entrants in seed order (3)');
    expect(html).toContain(`${n[0]} #2`);
    expect(html).toContain(`aria-label="Move ${n[0]} #2 up"`);
    expect(html).toContain(`aria-label="Enter ${n[0]} again"`);
    expect(html).toContain('class="is-hidden"');
    expect(html).toMatch(/tierb tierb-sim/);
    expect(html).toContain('All meta');
    expect(html).toContain('aria-live="polite"');
    // copies in bulk: select all, the selected rows, the whole field, and ×N on each deck's first row only
    expect(html).toContain('aria-label="Several entrants at once"');
    expect(html).toContain('Select all');
    expect(html).toContain(`aria-label="Select ${n[0]} #2"`);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>⧉ Selected again<\/button>/);
    expect(html).toContain('⧉ Every deck again');
    expect(html).toMatch(/<button[^>]*>One of each<\/button>/);
    expect(html).toContain(`aria-label="Times ${n[0]} is entered"`);
    expect(html.split(`aria-label="Times ${n[0]} is entered"`)).toHaveLength(2);
    expect(html).toMatch(/<option value="2" selected="">×2<\/option>/);
    expect(html).toContain(`<option value="${MAX_COPIES}">×${MAX_COPIES}</option>`);
  });
  it('pairing editor: keyboard pairing controls, set-by-you marks, the rematch tick', () => {
    const html = renderToStaticMarkup(<PairingEditor names={n} pairs={[{ a: n[0]!, b: n[1]! }]} met={() => true} onChange={() => undefined} />);
    expect(html).toContain('set by you');
    expect(html).toContain('allow rematch');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('draggable="true"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Pair<\/button>/);
    expect(html).not.toContain(`>${n[0]}</button>`); // paired decks leave the free list
  });
  it('seed order, bracket slots, best-of per round and the match list', () => {
    expect(renderToStaticMarkup(<SeedOrderEditor candidates={n} seeds={n.slice(0, 3)} size={4} onChange={() => undefined} />)).toContain('3 of 4 seats');
    const slots = renderToStaticMarkup(<BracketSlotsEditor names={n.slice(0, 3)} slots={[n[0]!, null, n[1]!, n[2]!]} onChange={() => undefined} />);
    expect(slots).toContain('aria-label="Match 1, second slot"');
    expect(slots).toContain('— bye —');
    expect(renderToStaticMarkup(<BracketBoEditor slots={8} values={[1, 3, 5]} bestOf={3} onChange={() => undefined} />)).toMatch(/Quarterfinals[\s\S]*Semifinals[\s\S]*Final/);
    const ml = renderToStaticMarkup(<MatchListEditor names={n} matches={[{ a: n[0]!, b: n[1]!, bestOf: 5, times: 2, mirror: true, round: 2 }]} bestOf={3} onChange={() => undefined} />);
    expect(ml).toContain('aria-label="Match 1 mirror the seats"');
    expect(ml).toContain('vs every other entrant');
  });
  it('round list marks hand-set matches and planned rounds', () => {
    const html = renderToStaticMarkup(<RoundList rounds={[{ round: 1, matches: [{ a: 'A', b: 'B', score: [0, 0], winner: '', set: true, bestOf: 5 }, { a: 'C', b: null, score: [0, 0], winner: 'C' }] }]} onOpen={() => undefined} openFirst />);
    expect(html).toContain('2 matches planned · 1 set by you');
    expect(html).toContain('set by you');
    expect(html).toContain('Bo5');
    expect(html).toContain('<details open=""');
  });
});

describe('the runner page', () => {
  it('opens on the setup flow from a link: entrants, format, series, plan', () => {
    const files = meta.slice(0, 4).map((d) => d.file);
    const html = renderToStaticMarkup(<TournamentRunnerPage q={new URLSearchParams(`f=custom&d=${files[0]},${files[0]}*2,${files[1]},${files[2]}&fmt=round-robin&bo=1&s=77`)} />);
    for (const t of ['Set up the event', '1 · Entrants', '2 · Format', '3 · Series and bots', '4 · The plan', 'Round robin', 'Match list', 'Round by round', 'Game 1 on the play']) expect(html).toContain(t);
    expect(html).toContain(`${meta[0]!.deck.name} #2`);
    expect(html).toMatch(/This event plays 6 matches/);
    expect(html).toContain('aria-pressed="true" title="Everyone plays everyone');
    // the link's seed reproduces its event: used and kept
    expect(html).toMatch(/<input type="number" min="1" max="2147483647"[^>]*value="77"/);
    expect(html).toMatch(/<input type="checkbox" checked=""\/> Keep this seed/);
    expect(html).toContain('Seed 77 is kept');
    expect(html).toContain('New seed');
  });
  it('a plain visit starts with a new random seed, not kept, every time', () => {
    const seedIn = (html: string) => Number(html.match(/<input type="number" min="1" max="2147483647"[^>]*value="(\d+)"/)?.[1]);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.7);
    const first = renderToStaticMarkup(<TournamentRunnerPage q={new URLSearchParams()} />);
    const second = renderToStaticMarkup(<TournamentRunnerPage q={new URLSearchParams()} />);
    vi.restoreAllMocks();
    expect(seedIn(first)).toBe(190000);
    expect(seedIn(second)).toBe(730000);
    expect(first).toMatch(/<input type="checkbox"\/> Keep this seed/);
    expect(first).toContain('Every new event gets a new random seed');
  });
  it('a stopped saved run offers Resume and Forget', () => {
    const run = { id: 'r1', name: 'Run 1', date: '2026-11-12T00:00:00Z', bot: 'easy', format: 'Swiss', config: { name: 'x', rounds: 2, top: 0, bestOf: 1, bot: 'easy', seed: 3 }, decks: {}, rounds: [], bracket: [], standings: [], champion: null, phase: 'stopped', custom: true };
    localStorage.setItem('nct.runs.v1', JSON.stringify([run]));
    const html = renderToStaticMarkup(<TournamentRunnerPage q={new URLSearchParams()} />);
    expect(html).toContain('⏸ unfinished');
    expect(html).toContain('▶ Resume');
    expect(html).toContain('aria-label="Forget the run Run 1"');
    expect(html).toContain('· custom');
  });
});
