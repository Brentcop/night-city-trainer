import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArgError, bool, eventFiles, int, maxEventId, mergeProvenance, num, oneOf, parseArgs, slugify, str, writeJsonStamped } from '../scripts/lib-node';

const spec = {
  games: int(60, { min: 1 }),
  threads: int(4, { min: 1, max: 64 }),
  seed: int(1, { min: 0 }),
  start: int(undefined, { min: 1 }),
  chaos: num(0.15, { min: 0, max: 1 }),
  bot: oneOf(['easy', 'medium', 'hard'], 'hard'),
  field: str('meta', (v) => (/^(meta|all)$/.test(v) ? undefined : 'must be meta or all')),
  name: str(),
  force: bool(),
};
const parse = (argv: string[], o = {}) => parseArgs(spec, argv, o);

describe('parseArgs (scripts/lib-node.ts)', () => {
  it('applies defaults and leaves optional flags undefined', () => {
    const { values, positionals } = parse([]);
    expect(values).toEqual({ games: 60, threads: 4, seed: 1, start: undefined, chaos: 0.15, bot: 'hard', field: 'meta', name: undefined, force: false });
    expect(positionals).toEqual([]);
  });

  it('parses --flag value, --flag=value and booleans', () => {
    const { values } = parse(['--games', '12', '--bot=easy', '--force', '--chaos', '0.5', '--name', 'x y']);
    expect(values.games).toBe(12);
    expect(values.bot).toBe('easy');
    expect(values.force).toBe(true);
    expect(values.chaos).toBe(0.5);
    expect(values.name).toBe('x y');
  });

  it('rejects unknown flags and names the valid ones', () => {
    expect(() => parse(['--gmaes', '5'])).toThrow(ArgError);
    expect(() => parse(['--gmaes', '5'])).toThrow(/unknown option --gmaes.*--games/);
  });

  it('rejects non-integers, NaN and out-of-range numbers', () => {
    expect(() => parse(['--threads', 'abc'])).toThrow(/--threads must be a whole number, got "abc"/);
    expect(() => parse(['--games', '2.5'])).toThrow(/whole number/);
    expect(() => parse(['--games', '0'])).toThrow(/--games must be at least 1/);
    expect(() => parse(['--threads', '65'])).toThrow(/at most 64/);
    expect(() => parse(['--chaos', '1.5'])).toThrow(/at most 1/);
    expect(() => parse(['--chaos', 'x'])).toThrow(/must be a number/);
  });

  it('rejects values outside an enum and failed custom checks', () => {
    expect(() => parse(['--bot', 'hardd'])).toThrow(/--bot must be one of easy \| medium \| hard, got "hardd"/);
    expect(() => parse(['--field', 'al'])).toThrow(/--field: must be meta or all/);
  });

  it('rejects a flag with no value', () => {
    expect(() => parse(['--games'])).toThrow(ArgError);
    expect(() => parse(['--games'])).toThrow(/--games needs a value/);
  });

  it('rejects a boolean given a value', () => {
    expect(() => parse(['--force=yes'])).toThrow(ArgError);
  });

  it('checks the number of positional arguments', () => {
    expect(() => parse(['deck'])).toThrow(/unexpected argument "deck"/);
    expect(parse(['a', 'b'], { minPositionals: 2, maxPositionals: 2 }).positionals).toEqual(['a', 'b']);
    expect(() => parse(['a'], { minPositionals: 2, maxPositionals: 2 })).toThrow(/expected 2 arguments, got 1/);
    expect(() => parse(['a', 'b', 'c'], { maxPositionals: 2 })).toThrow(/too many arguments/);
    expect(parse(['a', '--games', '3', 'b'], { maxPositionals: Infinity }).positionals).toEqual(['a', 'b']);
  });
});

describe('slugify', () => {
  it('matches the file names scripts already write', () => {
    expect(slugify('S2-08 Explorer (RRG)')).toBe('s2-08-explorer-rrg');
    expect(slugify('  RRY Smasher Aggro!  ')).toBe('rry-smasher-aggro');
    expect(slugify('a'.repeat(30) + ' b', 31)).toBe('a'.repeat(30));
    expect(slugify('***')).toBe('');
  });
});

describe('recorded events', () => {
  it('lists event files in numeric order and finds the highest id', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-events-'));
    for (const n of [1, 10, 2, 20, 3]) fs.writeFileSync(path.join(dir, `event-${n}.json`), '{}');
    fs.writeFileSync(path.join(dir, 'notes.txt'), '');
    expect(eventFiles(dir)).toEqual(['event-1.json', 'event-2.json', 'event-3.json', 'event-10.json', 'event-20.json']);
    expect(maxEventId(dir)).toBe(20);
    expect(maxEventId(path.join(dir, 'missing'))).toBe(0);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('writeJsonStamped', () => {
  it('rewrites only when the content (not the stamp) changes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-json-'));
    const f = path.join(dir, 'x.json');
    expect(writeJsonStamped(f, { updated: '', a: 1 })).toBe(true);
    const first = fs.readFileSync(f, 'utf8');
    expect(JSON.parse(first).updated).toMatch(/^\d{4}-/);
    expect(writeJsonStamped(f, { updated: '', a: 1 })).toBe(false);
    expect(fs.readFileSync(f, 'utf8')).toBe(first);
    expect(writeJsonStamped(f, { updated: '', a: 2 })).toBe(true);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('mergeProvenance', () => {
  const old = ['// RRY Smasher Aggro', '// Origin: choom.gg meta archetype', '// Author: Armbarred', '// Source: https://old', '// Tier: A (80/100)', '// Format: Constructed', '', '// Legends', '1 Old Card'].join('\n');
  const fresh = ['// RRY Smasher Aggro', '// Source: https://new', '// Tier: S (91/100)', '// Format: Constructed', '', '// Legends', '1 New Card'].join('\n');
  it('keeps the curated header lines and takes the new list', () => {
    const out = mergeProvenance(fresh, old, ['Tier']);
    expect(out).toBe(['// RRY Smasher Aggro', '// Origin: choom.gg meta archetype', '// Author: Armbarred', '// Source: https://old', '// Tier: S (91/100)', '// Format: Constructed', '', '// Legends', '1 New Card'].join('\n'));
  });
  it('returns the new text when there is no old file', () => {
    expect(mergeProvenance(fresh, null)).toBe(fresh);
  });
});
