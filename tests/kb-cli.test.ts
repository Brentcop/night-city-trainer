// The knowledge pack command line (scripts/kb.ts, docs/RAG_PLAN.md step 1.3): argument conventions (exit 2 on a bad
// flag or value, --help prints the header), the query commands on an invented index, and the cache under a temp
// directory (public sources only: nothing from data/raw is written outside .cache/kb).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArgError } from '../scripts/lib-node';
import { ensurePack, parseKbArgs, runQuery, statsText } from '../scripts/kb';
import { finishRecord } from '../src/lib/kb/build/record';
import { buildIndex } from '../src/lib/kb/search';
import { estimateTokens, kindOfId, type KbLink, type KbRecord } from '../src/lib/kb/types';

const ROOT = path.resolve(__dirname, '..');

const rec = (id: string, title: string, text: string, more: { links?: KbLink[]; scope?: 'public' | 'local'; aliases?: string[] } = {}): KbRecord =>
  finishRecord({ id, kind: kindOfId(id)!, title, text, source: { file: 'fixture' }, origin: more.scope === 'local' ? 'official' : 'authored', scope: 'public', ...more });

const IX = buildIndex([
  rec('card:kilo_byte', 'Kilo Byte', 'Kilo Byte is an invented Program that trashes the top card of your deck.'),
  rec('card:nova_a', 'Nova Vex: Glass Saint', 'An invented Legend.', { aliases: ['Nova Vex'] }),
  rec('card:nova_b', 'Nova Vex: Iron Choir', 'An invented Unit.', { aliases: ['Nova Vex'] }),
  rec('ruling:aaaaaaaa', 'Kilo Byte ruling 1', 'Invented ruling on Kilo Byte.', { links: [{ rel: 'card', to: 'card:kilo_byte' }] }),
  rec('faq:aaaaaaaa', 'Invented FAQ item 1', 'Invented official-style text about Kilo Byte.', { scope: 'local', links: [{ rel: 'ruling', to: 'ruling:aaaaaaaa' }] }),
  ...Array.from({ length: 12 }, (_, i) => rec(`doc:d.md#p${i}`, `Kilo notes ${i}`, `Kilo Byte appears here. ${'filler '.repeat(80)}`, { links: [{ rel: 'mentions', to: 'card:kilo_byte' }] })),
]);

describe('parseKbArgs', () => {
  it('reads a command, its words and its flags', () => {
    const a = parseKbArgs(['search', 'which', 'deck', '--k', '3', '--kind', 'card,deck', '--scope', 'public', '--rankers', 'exact,keyword', '--json']);
    expect(a.command).toBe('search');
    expect(a.query).toBe('which deck');
    expect(a.values).toMatchObject({ k: 3, scope: 'public', json: true, 'max-tokens': 2000 });
    expect(a.kinds).toEqual(['card', 'deck']);
    expect(a.rankers).toEqual(['exact', 'keyword']);
    expect(parseKbArgs(['get', 'Kilo Byte']).query).toBe('Kilo Byte');
    expect(parseKbArgs(['stats']).command).toBe('stats');
  });
  it('refuses unknown commands, flags and values with an ArgError', () => {
    const bad: string[][] = [
      [],
      ['find', 'x'],
      ['search', 'x', '--bogus'],
      ['search', 'x', '--scope', 'everything'],
      ['search', 'x', '--kind', 'card,cards'],
      ['search', 'x', '--kind', ''],
      ['search', 'x', '--rankers', 'vector'],
      ['search', 'x', '--k', '0'],
      ['search', 'x', '--k', 'two'],
      ['search', 'x', '--max-tokens', '10'],
      ['search'],
      ['get'],
      ['stats', 'extra'],
      ['stats', '--k', '3'],
      ['get', 'x', '--rankers', 'exact'],
    ];
    for (const argv of bad) expect(() => parseKbArgs(argv), argv.join(' ')).toThrow(ArgError);
    expect(() => parseKbArgs(['stats', '--k', '3'])).toThrow(/--k does not apply to stats/);
    expect(() => parseKbArgs(['find'])).toThrow(/unknown command "find"/);
  });
});

describe('query commands', () => {
  const run = (argv: string[]) => runQuery(parseKbArgs(argv), IX);
  it('search prints ranked records, or "no match" with exit code 1', () => {
    const r = run(['search', 'Kilo Byte']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^1\. card:kilo_byte {2}Kilo Byte/);
    const none = run(['search', 'xyzzy plugh']);
    expect([none.code, none.out.trim()]).toEqual([1, 'no match for "xyzzy plugh"']);
    const json = JSON.parse(run(['search', 'Kilo Byte', '--json', '--k', '2']).out);
    expect(json.hits).toHaveLength(2);
    expect(json.hits[0].id).toBe('card:kilo_byte');
  });
  it('get prints every record with the name, in full; unknown names suggest the nearest', () => {
    const r = run(['get', 'nova vex']);
    expect(r.out).toContain('card:nova_a');
    expect(r.out).toContain('card:nova_b');
    expect(run(['get', 'nova vex', '--kind', 'card', '--scope', 'local']).code).toBe(1);
    const miss = run(['get', 'Kilo']);
    expect(miss.code).toBe(1);
    expect(miss.out).toMatch(/no record named "Kilo"; nearest:\n {2}/);
  });
  it('related groups neighbours by link type and labels local records', () => {
    const r = run(['related', 'Kilo Byte ruling 1']);
    expect(r.out).toMatch(/ {2}card \(1\):\n {4}card:kilo_byte/);
    expect(r.out).toMatch(/ {2}official \(1\):\n {4}faq:aaaaaaaa {2}Invented FAQ item 1 {2}\(local-only\)/);
    const json = JSON.parse(run(['related', 'card:kilo_byte', '--json']).out);
    expect(json[0].groups.map((g: { rel: string }) => g.rel)).toEqual(['ruling', 'mentions']);
  });
  it('labels local records in search output', () => {
    expect(run(['search', 'Kilo Byte', '--scope', 'local']).out).toContain('LOCAL-ONLY');
  });
  it('keeps the output within --max-tokens', () => {
    for (const argv of [
      ['search', 'Kilo Byte appears', '--k', '12', '--max-tokens', '150'],
      ['related', 'card:kilo_byte', '--max-tokens', '80'],
      ['get', 'card:kilo_byte', '--max-tokens', '60'],
    ])
      expect(estimateTokens(run(argv).out), argv.join(' ')).toBeLessThanOrEqual(Number(argv[argv.length - 1]) + 5);
  });
});

describe('the local pack cache', () => {
  it('builds into the cache, reuses it while inputs are unchanged and rebuilds when one changed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-kb-'));
    try {
      const first = await ensurePack({ root: ROOT, cacheDir: dir, raw: false });
      expect(first.rebuilt).toBe(true);
      expect(first.manifest).toMatchObject({ kind: 'nct-kb', schema: 1, local: false });
      expect(first.manifest.scopes.local).toBe(0);
      const lines = fs.readFileSync(path.join(dir, 'records.jsonl'), 'utf8');
      expect(lines.split('\n').length - 1).toBe(first.records.length);
      const second = await ensurePack({ root: ROOT, cacheDir: dir, raw: false });
      expect(second.rebuilt).toBe(false);
      expect(second.records).toEqual(first.records);
      const mf = path.join(dir, 'manifest.json');
      const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
      m.inputs['src/data/cards.json'] = 'stale';
      fs.writeFileSync(mf, JSON.stringify(m));
      const third = await ensurePack({ root: ROOT, cacheDir: dir, raw: false });
      expect(third.rebuilt).toBe(true);
      expect(fs.readFileSync(path.join(dir, 'records.jsonl'), 'utf8')).toBe(lines);
      expect(statsText(third)).toMatch(/^kb pack: \d+ records \(public \d+, local 0, no data\/raw\), records\.jsonl [\d.]+ KB/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the script', () => {
  const tsx = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const kb = (...args: string[]) => spawnSync(process.execPath, [tsx, 'scripts/kb.ts', ...args], { cwd: ROOT, encoding: 'utf8' });
  it('prints its header for --help and exits 2 on a bad command line, before reading anything', () => {
    const help = kb('--help');
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/^Knowledge pack \(docs\/RAG_PLAN\.md\)/);
    expect(help.stdout).toContain('npm run kb -- search');
    const bad = kb('search', 'x', '--bogus');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toMatch(/error: unknown option --bogus/);
    expect(kb('search').status).toBe(2);
  }, 30_000);
});
