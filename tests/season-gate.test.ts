// The season's gate on real games (scripts/season.ts --gate-only; docs/SYNERGIES.md "A bred deck's test against its
// parent"): the next season is bred and gated with fast bots (Easy, then Random) and tiny stages, two threads, into a
// temporary folder. Nothing in the repository changes; the JSON names every bred deck with its reference and verdict,
// and a deck shown worse is listed as not entered. By default every deck is tested against the middle meta deck (the
// fixed bar) and the record says so; with --gate-reference parent each is tested against its best parent. With --gate off it breeds and names no gate. Bad gate flags exit 2.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { asWritten, gateJobs } from '../scripts/gate-run';
import { closeGamePool, loadLibrary, runJobs } from '../scripts/lib-node';
import { parseDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { scoreOf } from '../src/lib/evidence';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-season-gate-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
afterAll(() => closeGamePool());

const FAST = ['--gate-bot', 'easy', '--gate-confirm-bot', 'random', '--gate-rounds', '1', '--gate-stages', '2', '--gate-confirm-stages', '1', '--threads', '2'];
const season = (args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/season.ts', ...args], { encoding: 'utf8' });

/** Every file the season writes to, with its size and time: the deck folders, the season data, the site file and the reports. */
function snapshot(): string[] {
  const out: string[] = [];
  const walk = (dir: string, deep: boolean) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (deep) walk(p, deep);
      } else out.push(`${p}|${st.size}|${st.mtimeMs}`);
    }
  };
  walk('data/decks', true);
  walk('data/seasons', true);
  walk('reports', false);
  for (const f of ['src/data/seasons.json', 'src/data/ratings.json']) {
    const st = fs.statSync(f);
    out.push(`${f}|${st.size}|${st.mtimeMs}`);
  }
  return out;
}

const GATE_OUT = path.join(tmp, 'gate');
const OFF_OUT = path.join(tmp, 'off');
const PARENT_OUT = path.join(tmp, 'parent');
let gateRun: ReturnType<typeof season> | null = null;
let parentRun: ReturnType<typeof season> | null = null;
let offRun: ReturnType<typeof season> | null = null;
let before: string[] = [];

describe('the season with --gate-only', () => {
  it('breeds and gates the next season, writes only into --out, and changes nothing in the repository', { timeout: 180_000 }, () => {
    before = snapshot();
    gateRun = season(['--gate-only', ...FAST, '--out', GATE_OUT]);
    offRun = season(['--gate-only', '--gate', 'off', '--out', OFF_OUT]);
    parentRun = season(['--gate-only', ...FAST, '--gate-reference', 'parent', '--out', PARENT_OUT]);
    expect(gateRun.status, gateRun.stderr).toBe(0);
    expect(parentRun.status, parentRun.stderr).toBe(0);
    expect(offRun.status, offRun.stderr).toBe(0);
    expect(snapshot()).toEqual(before);
  });

  it('the JSON names every bred deck with its reference and verdict; a deck shown worse is not entered', () => {
    const files = fs.readdirSync(GATE_OUT);
    const json = files.find((f) => /^season-\d+-gate\.json$/.test(f))!;
    expect(files).toContain(json.replace(/\.json$/, '.md'));
    const doc = JSON.parse(fs.readFileSync(path.join(GATE_OUT, json), 'utf8'));
    expect(doc).toMatchObject({ kind: 'nct-season-gate', schema: 1 });
    const decks = doc.gate.decks as { name: string; entered: boolean; reference: { name: string; why: string }; first: { verdict: string; seed0: number; bot: string }; confirm: { verdict: string } | null; confirmSkipped?: string; list: string; legends: string[]; words: string }[];
    expect(decks).toHaveLength(8);
    expect(doc.gate.bred).toBe(8);
    // the default reference is the fixed bar
    expect(doc.gate.settings).toMatchObject({ bot: 'easy', confirmBot: 'random', rounds: 1, stages: 2, confirmStages: 1, reference: 'middle', seeds: { first: doc.season * 1_000_000 + 700_000, confirm: doc.season * 1_000_000 + 800_000 } });
    for (const d of decks) {
      expect(d.reference.name).toBeTruthy();
      expect(['fixed-bar', 'explorer']).toContain(d.reference.why);
      expect(['shown-worse', 'shown-better', 'could-not-tell']).toContain(d.first.verdict);
      expect(d.first.seed0).toBe(doc.season * 1_000_000 + 700_000);
      expect(d.list).toMatch(new RegExp(`^# ${d.name.replace(/[()]/g, '\\$&')}`));
      expect(d.legends).toHaveLength(3);
      const worse = d.first.verdict === 'shown-worse' || (!d.confirmSkipped && d.confirm?.verdict === 'shown-worse');
      expect(d.entered).toBe(!worse);
      expect(d.words.startsWith(worse ? 'kept out: shown worse than' : 'entered: not shown worse than')).toBe(true);
      // a deck shown worse by the first bot is not played by the confirming bot
      if (d.first.verdict === 'shown-worse') expect(d.confirm).toBeNull();
    }
    // Which decks are shown worse depends on the recorded data the breeder reads (ratings, library) and on a handful
    // of games, so nothing here needs one to be: the loop above ties every verdict to its entry, and the rule itself is
    // tested with planted differences in tests/breed-gate.test.ts.
    const keptOut = decks.filter((d) => !d.entered);
    expect(doc.gate.entered).toBe(decks.filter((d) => d.entered).length);
    expect(doc.bred.map((b: { name: string }) => b.name)).toEqual(decks.filter((d) => d.entered).map((d) => d.name));
    expect(gateRun!.stdout).toContain(`Season ${doc.season}: 8 bred, ${doc.gate.entered} entered`);
    expect(gateRun!.stdout).toContain('What it can detect:');
    expect(gateRun!.stdout).toContain('kept out about 2.5% of the time or less by each bot');
    const md = fs.readFileSync(path.join(GATE_OUT, json.replace(/\.json$/, '.md')), 'utf8');
    expect(md).toContain(`8 bred, ${doc.gate.entered} entered. Nothing was written to the repository.`);
    // every deck is listed with its words; a deck kept out is named so, and only then
    for (const d of decks) expect(md).toContain(`- **${d.name}**: ${d.words}`);
    expect(/kept out: shown worse than/.test(md)).toBe(keptOut.length > 0);
  });

  it('the default is the fixed bar: every bred deck against the middle meta deck; --gate-reference parent tests each against its best parent', () => {
    const read = (dir: string) => JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.json'))!), 'utf8'));
    const middle = read(GATE_OUT);
    const parent = read(PARENT_OUT);
    expect(middle.gate.settings.reference).toBe('middle');
    expect(parent.gate.settings.reference).toBe('parent');
    type D = { name: string; parents: string[]; reference: { name: string; why: string }; field: string[] };
    const decks = middle.gate.decks as D[];
    expect(decks).toHaveLength(8);
    // the same breeding: the same decks in the same order
    expect(decks.map((d) => d.name)).toEqual((parent.gate.decks as D[]).map((d) => d.name));
    const bar = decks[0]!.reference.name;
    for (const d of decks) {
      expect(d.reference.name).toBe(bar);
      expect(d.reference.why).toBe(d.parents.length ? 'fixed-bar' : 'explorer');
      expect(d.field).not.toContain(bar);
      expect(d.field).toHaveLength(6);
    }
    // the parent path: a ranked parent where there is one, else the bar, with the reason that says which
    for (const d of parent.gate.decks as D[]) {
      if (!d.parents.length) expect([d.reference.name, d.reference.why]).toEqual([bar, 'explorer']);
      else if (d.reference.why === 'best-parent') expect(d.parents).toContain(d.reference.name);
      else expect([d.reference.name, d.reference.why]).toEqual([bar, 'no-parent-available']);
      expect(d.field).not.toContain(d.reference.name);
    }
    expect((parent.gate.decks as D[]).some((d) => d.reference.why === 'best-parent')).toBe(true);
    expect(gateRun!.stdout).toContain('each bred deck plays the middle meta deck by strength, the same fixed bar for every bred deck, on the same games against the other meta decks');
    expect(parentRun!.stdout).toContain('each bred deck plays its best parent (an explorer, which has none, plays the middle meta deck by strength) on the same games against the other meta decks');
  });

  it('the gate’s games replay from the recorded list: a bred deck is tested in the order its deck file reads back', { timeout: 120_000 }, async () => {
    const json = fs.readdirSync(GATE_OUT).find((f) => /^season-\d+-gate\.json$/.test(f))!;
    const doc = JSON.parse(fs.readFileSync(path.join(GATE_OUT, json), 'utf8'));
    const lib = loadLibrary();
    const byName = (n: string) => lib.find((x) => x.deck.name === n)!.deck;
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    // the first two bred decks: the first bot's judged games, replayed here from the list the record holds
    for (const d of (doc.gate.decks as { name: string; list: string; field: string[]; reference: { name: string }; first: { seed0: number; bot: string; judged: { games: number; deckWr: number; refWr: number } } }[]).slice(0, 2)) {
      const deck = parseDeck(d.list, d.name).deck;
      // the recorded list is already in the order it reads back (the card order changes the games a seed deals)
      expect(asWritten(deck).main).toEqual(deck.main);
      const field = d.field.map(byName);
      const play = async (list: DeckList) => (await runJobs(gateJobs({ deck: list, field, seed0: d.first.seed0, games: d.first.judged.games, bot: d.first.bot }), { threads: 2, quiet: true })).map((r) => scoreOf(r.winner));
      expect(mean(await play(byName(d.reference.name)))).toBeCloseTo(d.first.judged.refWr, 5);
      expect(mean(await play(deck))).toBeCloseTo(d.first.judged.deckWr, 5);
    }
  });

  it('--gate off names no gate: every bred deck enters', () => {
    const json = fs.readdirSync(OFF_OUT).find((f) => f.endsWith('.json'))!;
    const doc = JSON.parse(fs.readFileSync(path.join(OFF_OUT, json), 'utf8'));
    expect(doc.gate).toBeUndefined();
    expect(doc.bred).toHaveLength(8);
    expect(doc.lists).toHaveLength(8);
    const md = fs.readFileSync(path.join(OFF_OUT, json.replace(/\.json$/, '.md')), 'utf8');
    // (not a bare /gate/: the text holds card and deck names)
    expect(md).not.toMatch(/gate rule|shown worse|kept out|not shown worse|What it can detect/i);
    expect(offRun!.stdout).toMatch(/: 8 bred, 8 entered/);
    expect(offRun!.stdout).not.toMatch(/gate rule|shown worse|What it can detect/i);
  });

  // six processes, each a few seconds to start: its own timeout, as every process-spawning test has
  it('bad gate flags exit 2 before anything is read or played', { timeout: 120_000 }, () => {
    for (const [args, re] of [
      [['--gate', 'maybe'], /--gate must be one of on \| off/],
      [['--out', path.join(tmp, 'x')], /--out writes the --gate-only files/],
      [['--gate-only', '--gate-rounds', '0'], /--gate-rounds must be at least 1/],
      [['--gate-only', '--gate-confirm-bot', 'nobody'], /--gate-confirm-bot must be one of/],
      [['--gate-only', '--gate-reference', 'grandparent'], /--gate-reference must be one of parent \| middle/],
      [['--gate-only', '--gate-rounds', '1000', '--gate-stages', '16'], /seeds/],
    ] as [string[], RegExp][]) {
      const r = season(args);
      expect(r.status, args.join(' ')).toBe(2);
      expect(r.stderr).toMatch(re);
    }
    expect(fs.existsSync(path.join(tmp, 'x'))).toBe(false);
  });
});
