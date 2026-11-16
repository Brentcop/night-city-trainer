// npm run gate (scripts/gate.ts, logic in scripts/gate-run.ts; docs/SYNERGIES.md "A bred deck's test against its
// parent"): usage, every refusal with exit 2, the forge's job layout, --no-early-stop, --json and --out with a stub game
// runner, then one small run on real games (Easy and Random bots, tiny stages, two threads) into a temporary folder.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { listFingerprint } from '../src/engine/deck';
import { loadLibrary } from '../scripts/lib-node';
import { gateCommand, gateJobs, seedProblem, type GateIO } from '../scripts/gate-run';
import type { MatchJob } from '../scripts/worker';

const LIB = loadLibrary();
const META = LIB.filter((d) => d.kind === 'meta');
const DECK = 's2-08-explorer-ggy';
const REF = META[0]!.file.replace(/\.txt$/, '');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-gate-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Run the command with a stub runner: each list wins a deal when the deal's number is below its own strength. */
async function cmd(args: string[], strength: (fp: string) => number = (fp) => 0.4 + 0.2 * unit(`s:${fp}`)) {
  const out: string[] = [];
  const err: string[] = [];
  const jobs: MatchJob[] = [];
  const io: GateIO = {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    play: async (js) => {
      jobs.push(...js);
      return js.map((j) => ({ winner: unit(`g:${j.seed}:${j.b.name}:${j.first}:${j.bot}`) < strength(listFingerprint(j.a)) ? (0 as const) : (1 as const) }));
    },
    library: () => LIB,
    now: () => new Date('2026-11-15T12:00:00Z'),
  };
  const code = await gateCommand(args, io);
  return { code, out, err, jobs };
}

describe('npm run gate: the command line', () => {
  it('--help prints the usage', async () => {
    const r = await cmd(['--help']);
    expect(r.code).toBe(0);
    expect(r.out.join('\n')).toMatch(/^Gate one library deck against another/);
    expect(r.out.join('\n')).toContain('--no-early-stop');
  });

  it('refuses a bad command line with exit 2, in one sentence', async () => {
    const cases: [string[], RegExp][] = [
      [[DECK], /^error: name the reference deck with --ref <deck>\.$/],
      [[DECK, '--ref', REF, '--bogus'], /^error: unknown option --bogus/],
      [[DECK, '--ref', REF, '--rounds', '0'], /^error: --rounds must be at least 1, got 0\.$/],
      [[DECK, '--ref', REF, '--confirm-bot', 'nobody'], /^error: --confirm-bot must be one of /],
      [['no-such-deck-anywhere', '--ref', REF], /^error: no library deck matches "no-such-deck-anywhere" \(the deck\)/],
      [[DECK, '--ref', DECK], /^error: S2-08 Explorer \(GGY\) and S2-08 Explorer \(GGY\) are the same list/],
      [[DECK, '--ref', REF, '--confirm-seed', '7000500'], /^error: the first bot's seeds \(7000000 to 7001199\) and the confirming bot's \(7000500 to 7000979\) overlap/],
      [[], /^error: expected 1 argument, got 0\.$/],
    ];
    for (const [args, re] of cases) {
      const r = await cmd(args);
      expect(r.code, args.join(' ')).toBe(2);
      expect(r.err).toHaveLength(1);
      expect(r.err[0]).toMatch(re);
      expect(r.jobs).toHaveLength(0);
    }
    expect(seedProblem({ first: 0, confirm: 100, firstGames: 100, confirmGames: 50 })).toBeNull();
    expect(seedProblem({ first: 0, confirm: 100, firstGames: 100, confirmGames: 50, limit: 120 })).toMatch(/would reach 120/);
  });

  it('plays the forge’s layout: opponent k mod n, seed + k, the deck first when floor(k / n) is even', () => {
    const field = META.slice(1).map((d) => d.deck);
    const jobs = gateJobs({ deck: LIB.find((d) => d.file === `${DECK}.txt`)!.deck, field, seed0: 100, games: 24, bot: 'medium' });
    expect(jobs).toHaveLength(24);
    jobs.forEach((j, k) => {
      expect(j.b).toBe(field[k % 6]);
      expect(j.seed).toBe(100 + k);
      expect(j.first).toBe(Math.floor(k / 6) % 2);
      expect(j.bot).toBe('medium');
    });
  });

  it('a run: the rule, the guarantee, what it detects, the verdict, the per-opponent figures and the spread', async () => {
    const r = await cmd([DECK, '--ref', REF, '--rounds', '2']);
    expect(r.code).toBe(0);
    const text = r.out.join('\n');
    expect(text).toContain('Gate rule: each bred deck plays its reference');
    expect(text).toContain('kept out about 2.5% of the time or less by each bot');
    expect(text).toMatch(/What it can detect: with 6 opponents \(stages of 24 games\) the Medium bot shows a deck worse 8 times in 10/);
    expect(text).toMatch(/^(Entered: not shown worse than|Kept out: shown worse than) /m);
    expect(text).toContain('Medium, by opponent');
    expect(text).toMatch(/Spread seen: \d\.\d\d per game with the Medium bot \(one deck\)/);
    // seeds: the first bot's stages from 7,000,000, the confirming bot's from 7,100,000, each block once per list
    const firstSeeds = r.jobs.filter((j) => j.bot === 'medium').map((j) => j.seed);
    expect(Math.min(...firstSeeds)).toBe(7_000_000);
    expect(r.jobs.every((j) => j.bot === 'medium' || j.bot === 'hard')).toBe(true);
    if (r.jobs.some((j) => j.bot === 'hard')) expect(Math.min(...r.jobs.filter((j) => j.bot === 'hard').map((j) => j.seed))).toBe(7_100_000);
    const keys = r.jobs.map((j) => `${listFingerprint(j.a)}|${j.bot}|${j.seed}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('--no-early-stop plays every stage and still says where the rule would have stopped', async () => {
    // the deck much weaker than its reference: the rule stops before the cap; every stage is played anyway
    const target = listFingerprint(LIB.find((d) => d.file === `${DECK}.txt`)!.deck);
    const r = await cmd([DECK, '--ref', REF, '--rounds', '3', '--no-early-stop', '--json'], (fp) => (fp === target ? 0.2 : 0.7));
    expect(r.code).toBe(0);
    const doc = JSON.parse(r.out.join('\n'));
    const d = doc.decks[0];
    expect(doc.settings.fullStages).toBe(true);
    expect(d.first.verdict).toBe('shown-worse');
    expect(d.first.looks).toBeLessThan(5);
    expect(d.first.judged.games).toBe(d.first.looks * 36);
    expect(d.first.played).toMatchObject({ stages: 5, games: 5 * 36 });
    expect(d.confirm).toMatchObject({ bot: 'hard' });
    expect(d.confirmSkipped).toBe('shown-worse');
    expect(d.entered).toBe(false);
    expect(d.first.byOpp).toHaveLength(6);
    // both lists, every stage of both bots
    expect(r.jobs).toHaveLength(2 * 36 * (5 + 2));
  });

  it('--out writes the record and the text; without it nothing is written', async () => {
    const dir = path.join(tmp, 'stub-out');
    const r = await cmd([DECK, '--ref', REF, '--rounds', '1', '--out', dir]);
    expect(r.code).toBe(0);
    const stem = `gate-${DECK}-vs-${REF}`;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, `${stem}.json`), 'utf8'));
    expect(doc).toMatchObject({ kind: 'nct-breed-gate', schema: 1, settings: { bot: 'medium', confirmBot: 'hard', rounds: 1, stages: 5, confirmStages: 2, seeds: { first: 7_000_000, confirm: 7_100_000 } } });
    expect(doc.decks[0]).toMatchObject({ name: 'S2-08 Explorer (GGY)', reference: { why: 'named' }, file: `${DECK}.txt` });
    expect(doc.decks[0].list).toMatch(/^# S2-08 Explorer \(GGY\)/);
    expect(fs.readFileSync(path.join(dir, `${stem}.md`), 'utf8')).toMatch(/^# Gate: S2-08 Explorer \(GGY\) against /);
  });
});

describe('npm run gate on real games', () => {
  it('a small run with every stage played, into a folder', { timeout: 120_000 }, () => {
    const out = path.join(tmp, 'real');
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/gate.ts', DECK, '--ref', REF, '--bot', 'easy', '--confirm-bot', 'random', '--rounds', '1', '--stages', '2', '--confirm-stages', '1', '--threads', '2', '--no-early-stop', '--out', out], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('Every stage is played (--no-early-stop)');
    expect(r.stdout).toContain('Easy, by opponent (all 24 games played');
    expect(r.stdout).toContain('Random, by opponent (all 12 games played');
    const doc = JSON.parse(fs.readFileSync(path.join(out, `gate-${DECK}-vs-${REF}.json`), 'utf8'));
    expect(doc.decks[0].first.played ?? doc.decks[0].first.judged).toMatchObject({ games: 24 });
    expect(['shown-worse', 'shown-better', 'could-not-tell']).toContain(doc.decks[0].first.verdict);
  });
});
