// Confirming with another bot than the one that screens (docs/SYNERGIES.md "Confirming with another bot"; the forge's
// --confirm-bot, the Deck Lab's TuneOptions.confirmBot): the words and defaults it brings (the rule line, the
// detectability line with Hard's measured spread, the estimate's sentence), the change ledger across two bots (a deal
// that screened a change with one bot is never held-out evidence for it with the other; priors come from the confirming
// bot's entry only), and the Deck Lab's games by bot, its ledger entries, its shortlist and its saved record.
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { adoptionProvenance, adoptionRule, describeRule } from '../src/lib/evidence';
import { confirmedWith, confirmGamesWords, DEFAULT_SD, detect, detectWords, HARD_SD, perGameSd } from '../src/lib/deckSearch';
import { fieldFingerprint } from '../src/lib/changeLedger';
import { blockSlots, ChangeLedgerRun, scored } from '../src/lib/changeLedgerRun';
import { BrowserLedgerStore, memoryLedgerStorage } from '../src/lib/changeLedgerStore';
import { pooledTuneRecord, tuneDeck, tunePlan, type TuneOptions } from '../src/lib/deckLab';
import { SIM_VERSION, type GameJob, type PlayGame } from '../src/lib/tournament';
import { runBotWords } from '../src/lib/findingWords';
import { confirmBotArgs, confirmBotProblem } from '../scripts/evidence-flags';

const RULE = adoptionRule();

describe('the words and defaults', () => {
  it('another bot confirms only when the canonical names differ', () => {
    expect(confirmedWith('medium', undefined)).toBeNull();
    expect(confirmedWith('lookahead', 'medium')).toBeNull();
    expect(confirmedWith('medium', 'medium')).toBeNull();
    expect(confirmedWith('lookahead', 'hard')).toEqual({ screen: 'lookahead', confirm: 'hard' });
  });

  it('the rule line and the provenance say so only when the bots differ', () => {
    const plain = describeRule(RULE, { firstStage: 280, nominees: 1 });
    expect(describeRule(RULE, { firstStage: 280, nominees: 1, confirmedWith: { screen: 'lookahead', confirm: 'hard' } })).toBe(`${plain}; screened with the Medium bot, confirmed with the Hard bot`);
    expect(describeRule(adoptionRule({ kind: 'any-gain' }), { confirmedWith: { screen: 'medium', confirm: 'hard' } })).toMatch(/; screened with the Medium bot, confirmed with the Hard bot$/);
    const o = { firstStage: 280, nominees: 1, cardsPerChange: 1, packagesPerChange: 1 };
    expect(adoptionProvenance(RULE, o)).not.toHaveProperty('confirmBot');
    expect(adoptionProvenance(RULE, o, false, undefined, 'hard')).toEqual({ ...adoptionProvenance(RULE, o), confirmBot: 'hard' });
  });

  it('the detectability line uses the confirming bot’s spread and words; without it, today’s line', () => {
    const today = detectWords(detect({ rule: RULE, firstStage: 280, nominees: 1, sd: perGameSd() }));
    expect(perGameSd()).toEqual({ card: DEFAULT_SD.card, package: DEFAULT_SD.package, cardFrom: 0, packageFrom: 0 });
    expect(today).toMatch(/^A first confirmation here adopts a real gain of \+\d+\.\d points 8 times in 10 \(\+\d+\.\d for a package move\)\. It assumes a per-game spread of 0\.30 for a one-card swap and 0\.55 for a package move \(the tuning study's typical values\)\.$/);
    const sd = perGameSd(undefined, 'hard');
    expect(sd).toEqual({ card: HARD_SD.card, package: HARD_SD.package, cardFrom: 0, packageFrom: 0, hard: true });
    const bots = { screen: 'lookahead', confirm: 'hard' };
    const hard = detectWords(detect({ rule: RULE, firstStage: 280, nominees: 1, sd, confirmedWith: bots }));
    expect(hard).toMatch(/^A first confirmation with the Hard bot here adopts a real gain of /);
    expect(hard).toContain('It assumes a per-game spread of 0.34 for a one-card swap and 0.60 for a package move (measured with the Hard bot on 2026-11-15: 11 one-card swaps, 2 package swaps).');
    expect(hard).toMatch(/ A gain measured with Medium showed at about 0\.75 of its size with Hard \(± 0\.19, 13 changes\)\.$/);
    // a larger spread needs a larger gain to be adopted as often
    expect(detect({ rule: RULE, firstStage: 280, nominees: 1, sd }).card).toBeGreaterThan(detect({ rule: RULE, firstStage: 280, nominees: 1, sd: perGameSd() }).card);
    // from this list's own changes when there are enough, and the other kind from Hard's measurement
    const own = perGameSd({ swaps: [0.31, 0.33, 0.35], larger: [] }, 'hard');
    expect(detectWords(detect({ rule: RULE, firstStage: 280, nominees: 1, sd: own, confirmedWith: bots }))).toContain("0.33 for a one-card swap (the median of 3 changes of this list with 200 or more held-out games) and 0.60 for a package move; the other is the Hard bot's value measured on 2026-11-15.");
    // another confirming bot than Hard keeps the study's defaults and has no transfer clause
    const easyMedium = detectWords(detect({ rule: RULE, firstStage: 280, nominees: 1, sd: perGameSd(undefined, 'medium'), confirmedWith: { screen: 'easy', confirm: 'medium' } }));
    expect(easyMedium).toMatch(/^A first confirmation with the Medium bot here/);
    expect(easyMedium).toContain("(the tuning study's typical values).");
    expect(easyMedium).not.toContain('0.75');
  });

  it('the flag: refused with a bot the ledger cannot use; passed on by the season', () => {
    expect(confirmBotProblem({ 'confirm-bot': 'hard', 'pooled-ranking': true, ledger: true }, { bot: 'lookahead' })).toBeNull();
    expect(confirmBotProblem({ 'confirm-bot': 'medium', 'pooled-ranking': true, ledger: true }, { bot: 'lookahead' })).toBeNull();
    expect(confirmBotProblem({ 'confirm-bot': 'hard-v1', ledger: true }, { bot: 'lookahead' })).toMatch(/hard-v1.*; pick another --confirm-bot or leave out --ledger$/);
    expect(confirmBotProblem({ 'confirm-bot': 'hard-v1' }, { bot: 'lookahead' })).toBeNull();
    expect(confirmBotArgs({ 'confirm-bot': 'hard' })).toEqual(['--confirm-bot', 'hard']);
    expect(confirmBotArgs({})).toEqual([]);
  });

  it('a recorded run names both bots on the evidence page', () => {
    expect(runBotWords({ bot: 'medium' })).toBe('Medium bot');
    expect(runBotWords({ bot: 'medium', confirmBot: 'hard' })).toBe('Medium bot screening, Hard bot confirming');
  });

  it('the estimate’s sentence counts the confirming bot’s games and says what a Hard game costs', () => {
    expect(confirmGamesWords({ screen: 'lookahead', confirm: 'hard' }, 4480)).toBe('Up to 4,480 of them are confirmation games, played with the Hard bot. A Hard game took about 20 times as long as a Medium one when measured.');
    expect(confirmGamesWords({ screen: 'easy', confirm: 'medium' }, 100)).toBe('Up to 100 of them are confirmation games, played with the Medium bot.');
    expect(confirmGamesWords({ screen: 'medium', confirm: 'hard' }, 7, true)).toMatch(/^Up to 7 of them are the confirmations and the comparison with your original, played with the Hard bot\./);
  });
});

// ---------------------------------------------------------------- the ledger across two bots

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const start = anyDeck('A', ['Red', 'Yellow']);
const field = [anyDeck('B', ['Blue']), anyDeck('C', ['Green'])];
const OPP = field.map((d) => listFingerprint(d));
const swapped = (() => {
  const main = [...start.main];
  main[0] = CARDS.find((c) => c.type !== 'Legend' && !start.main.includes(c.id) && c.color === 'Red')!.id;
  return { ...start, main };
})();

describe('the change ledger across two bots', () => {
  const run = (store: BrowserLedgerStore, bot: string, totals?: ChangeLedgerRun['totals']) => new ChangeLedgerRun(store, { simVersion: SIM_VERSION, bot, opponents: OPP, run: 'r', date: '2026-11-15', ...(totals ? { totals } : {}) });
  const games = (seed0: number, n: number, cand = 1) => scored(blockSlots(seed0, n, OPP), Array(n).fill(0), Array(n).fill(cand));

  it('a held-out slot that screened the change with the other bot is left out', () => {
    const store = new BrowserLedgerStore(memoryLedgerStorage());
    const medium = run(store, 'medium');
    const hard = run(store, 'hard', medium.totals);
    medium.record('screen', start, swapped, 'x', games(1000, 20));
    // 20 of these 30 slots (seed, opponent, seat) screened the change with Medium
    const r = hard.record('heldout', start, swapped, 'x', games(1000, 30));
    expect(r.screened).toBe(20);
    expect(r.written).toBe(10);
    const e = store.entry(hard.entryId(start, swapped))!;
    expect(e.heldout.map((g) => g.seed)).toEqual(Array.from({ length: 10 }, (_, i) => 1020 + i));
    // the two runs share one total
    expect(medium.totals.heldout.written).toBe(10);
    expect(medium.totals.screen.written).toBe(20);
    // held-out games kept before the other bot screened the same slots are left out of a prior
    hard.record('heldout', start, swapped, 'x', games(2000, 10));
    expect(hard.prior(start, swapped, new Set()).base).toHaveLength(20);
    medium.record('screen', start, swapped, 'x', games(2000, 4));
    expect(hard.prior(start, swapped, new Set()).base).toHaveLength(16);
    expect(hard.priorGames(start, swapped, new Set()).some((g) => g.seed >= 2000 && g.seed < 2004)).toBe(false);
  });

  it('a prior comes from the confirming bot’s entry only', () => {
    const store = new BrowserLedgerStore(memoryLedgerStorage());
    const medium = run(store, 'medium');
    const hard = run(store, 'hard');
    medium.record('heldout', start, swapped, 'x', games(3000, 40));
    expect(medium.prior(start, swapped, new Set()).base).toHaveLength(40);
    expect(hard.prior(start, swapped, new Set()).base).toHaveLength(0);
    hard.record('heldout', start, swapped, 'x', games(4000, 12));
    expect(hard.prior(start, swapped, new Set()).base).toHaveLength(12);
    expect(medium.prior(start, swapped, new Set()).base).toHaveLength(40);
  });
});

// ---------------------------------------------------------------- the Deck Lab

const changes = (d: DeckList) => {
  const left = [...start.main];
  let n = 0;
  for (const id of d.main) {
    const i = left.indexOf(id);
    if (i >= 0) left.splice(i, 1);
    else n++;
  }
  return n;
};
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Paired fake games (the bot changes nothing), every job kept. */
const recorder = (perChange: number) => {
  const jobs: GameJob[] = [];
  const play: PlayGame = async (j) => {
    jobs.push(j);
    const p = 0.5 + perChange * changes(j.a);
    return { seed: j.seed, first: j.first, turns: 5, reason: 'test', winner: unit(`g:${j.seed}:${j.b.name}:${j.first}`) < p ? 0 : 1 };
  };
  return { jobs, play };
};
const OPTS: TuneOptions = { games: 56, gens: 1, cands: 3, bot: 'medium', minGain: 0.02, seedBase: 500_000, vsOriginal: 112 };

describe('the Deck Lab with another bot confirming', () => {
  it('screening and its telemetry play with the run’s bot; the confirmation and the comparison with the original with the confirming bot', async () => {
    const r = recorder(0.15);
    const end = await tuneDeck(start, field, { ...OPTS, confirmBot: 'hard' }, r.play, () => undefined, () => false);
    expect(end.logs[0]!.adopted).not.toBeNull();
    const seed0 = OPTS.seedBase! + 10_000;
    const screening = r.jobs.filter((j) => j.seed >= seed0 && j.seed < seed0 + OPTS.games);
    const rest = r.jobs.filter((j) => !screening.includes(j));
    expect(screening.length).toBe(OPTS.games * (1 + 3));
    expect(screening.every((j) => j.bot === 'medium')).toBe(true);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.every((j) => j.bot === 'hard')).toBe(true);
    // the first adoption derives its vs-original figure from the confirmation (gain 7), so no vs-original seeds
    expect(rest.some((j) => j.seed >= OPTS.seedBase! + 20_000)).toBe(false);
    expect(end.logs[0]!.vsOriginal).toBeDefined();
    expect(end.logs[0]!.vsOriginal!.measured).toBe(true);
    // without the option (or with the screening bot) every job is the run's bot, and the logs are the same games'
    const same = recorder(0.15);
    const plain = recorder(0.15);
    const a = await tuneDeck(start, field, { ...OPTS, confirmBot: 'medium' }, same.play, () => undefined, () => false);
    const b = await tuneDeck(start, field, OPTS, plain.play, () => undefined, () => false);
    expect(same.jobs).toEqual(plain.jobs);
    expect(a.logs).toEqual(b.logs);
    expect(plain.jobs.every((j) => j.bot === 'medium')).toBe(true);
  });

  it('held-out games go to the confirming bot’s entry and are pooled from it; the shortlist is off', async () => {
    const store = new BrowserLedgerStore(memoryLedgerStorage());
    const first = await tuneDeck(start, field, { ...OPTS, confirmBot: 'hard', ledger: { store, run: 'one', date: '2026-11-15' }, shortlist: {} }, recorder(0.15).play, () => undefined, () => false);
    const l = first.logs[0]!;
    expect(l.shortlist).toBeUndefined();
    const nominee = l.nominees![0]!;
    const base = listFingerprint(start);
    await store.load(base);
    const entries = store.entriesOf(base);
    const field2 = fieldFingerprint(OPP);
    expect(entries.every((e) => e.id.field === field2)).toBe(true);
    expect(entries.filter((e) => e.screen.length).every((e) => e.id.bot === 'medium')).toBe(true);
    const held = entries.filter((e) => e.heldout.length);
    expect(held.length).toBe(1);
    expect(held[0]!.id.bot).toBe('hard');
    expect(held[0]!.heldout.length).toBe(nominee.heldOut!.games);
    // a later run with the confirming bot pools those games; one confirmed by the screening bot does not
    const again = await tuneDeck(start, field, { ...OPTS, seedBase: 600_000, confirmBot: 'hard', ledger: { store, run: 'two', date: '2026-11-15' } }, recorder(0.15).play, () => undefined, () => false);
    expect(again.logs[0]!.nominees![0]!.heldOut!.priorGames).toBe(nominee.heldOut!.games);
    const medium = await tuneDeck(start, field, { ...OPTS, seedBase: 700_000, ledger: { store, run: 'three', date: '2026-11-15' } }, recorder(0.15).play, () => undefined, () => false);
    expect(medium.logs[0]!.nominees![0]!.heldOut!.priorGames).toBeUndefined();
  });

  it('the plan says how many games the confirming bot plays; the saved record names it', () => {
    const p = tunePlan({ games: 112, gens: 2, cands: 5, vsOriginal: 448, bot: 'medium', confirmBot: 'hard' });
    expect(p.confirm).toEqual({ with: { screen: 'medium', confirm: 'hard' }, games: 2 * p.estimate.confirm + p.vsMax });
    expect(tunePlan({ games: 112, gens: 2, cands: 5, vsOriginal: 448, bot: 'medium' }).confirm).toBeNull();
    const rule = adoptionProvenance(RULE, { firstStage: 224, nominees: 1, cardsPerChange: 1, packagesPerChange: 1 }, false, undefined, 'hard');
    const o = { original: start, final: start, logs: [], partial: false, gens: 1, rule, manifest: null, bot: 'medium', fieldMode: 'deck-lab-tune:meta', fieldDeckIds: [], partnerAware: true, date: '2026-11-15T00:00:00.000Z' };
    expect(pooledTuneRecord({ ...o, confirmBot: 'hard' })).toEqual({ ...pooledTuneRecord(o), confirmBot: 'hard' });
    expect(pooledTuneRecord(o)).not.toHaveProperty('confirmBot');
    expect(pooledTuneRecord({ ...o, confirmBot: 'hard' }).rule.confirmBot).toBe('hard');
  });
});
