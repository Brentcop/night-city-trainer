// A forced season re-run (scripts/season.ts --force) first takes the season's games back out of the leaderboard
// (uncountSeason, scripts/season-leaderboard.ts): each entry's pooled vs-meta record loses what that season added, its
// round-robin figure for the season and the finals it set go, and the decks the season bred are dropped. A season counted
// before per-season totals were kept is refused, changing nothing. Run on copies: the recorded data/seasons/ is only read.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { uncountSeason, type Entry } from '../scripts/season-leaderboard';

const LB_FILE = 'data/seasons/leaderboard.json';
const text = readFileSync(LB_FILE, 'utf8');
const recorded = () => JSON.parse(text) as Record<string, Entry>;

const entry = (name: string, o: Partial<Entry> = {}): Entry => ({ name, file: `${name}.txt`, kind: 'meta', origin: 'meta', colors: 'RG', arch: 'midrange', firstSeason: 0, metaW: 0, metaG: 0, seasons: {}, ...o });

/** Count season `s` into a leaderboard as the season does (scripts/season.ts credit / addFinals / a new deck's entry). */
function countSeason(lb: Record<string, Entry>, s: number, add: Record<string, { w: number; g: number; rr: number; finals?: number }>, bred: Entry[]) {
  const k = String(s);
  for (const e of bred) lb[e.name] = e;
  for (const [name, a] of Object.entries(add)) {
    const e = lb[name]!;
    e.metaW += a.w;
    e.metaG += a.g;
    e.seasons[k] = a.rr;
    const c = ((e.contrib ??= {})[k] = { w: a.w, g: a.g } as { w: number; g: number; finals?: boolean });
    if (a.finals !== undefined) {
      e.finals = a.finals;
      c.finals = true;
    }
  }
}

describe('uncountSeason: a forced re-run takes the season back out', () => {
  it('a season counted and taken out again leaves the leaderboard as it was', () => {
    const before: Record<string, Entry> = {
      A: entry('A', { metaW: 30.5, metaG: 60, seasons: { '1': 0.5 }, contrib: { '1': { w: 30.5, g: 60 } } }),
      B: entry('B', { metaW: 12, metaG: 40, finals: 0.4 }),
      C: entry('C', { kind: 'bred', firstSeason: 1, metaW: 7, metaG: 14, seasons: { '1': 0.5 }, contrib: { '1': { w: 7, g: 14 } } }),
    };
    const lb = structuredClone(before);
    countSeason(lb, 2, { A: { w: 10, g: 20, rr: 0.55, finals: 0.6 }, B: { w: 4.5, g: 10, rr: 0.45 }, C: { w: 3, g: 6, rr: 0.4 }, N: { w: 8, g: 12, rr: 0.66, finals: 0.7 } }, [entry('N', { kind: 'bred', firstSeason: 2 })]);
    expect(lb.N).toBeDefined();
    expect(lb.A!.metaG).toBe(80);
    expect(uncountSeason(lb, 2)).toBe(true);
    // A's finals came from season 2 and goes with it; B keeps the finals an earlier run set; an entry the season gave its
    // first per-season total keeps an empty one
    expect(lb.B!.contrib).toEqual({});
    delete lb.B!.contrib;
    expect(lb).toEqual(before);
  });

  it('a season counted before per-season totals were kept is refused and nothing changes', () => {
    const lb: Record<string, Entry> = {
      A: entry('A', { metaW: 30, metaG: 60, seasons: { '1': 0.5, '2': 0.6 }, contrib: { '1': { w: 30, g: 60 } } }),
      D: entry('D', { kind: 'bred', firstSeason: 2, metaW: 5, metaG: 10, seasons: { '2': 0.5 } }),
    };
    const copy = structuredClone(lb);
    expect(uncountSeason(lb, 2)).toBe(false);
    expect(lb).toEqual(copy);
  });

  it('on a copy of the recorded leaderboard: the newest season’s totals, figures, finals and bred decks come out', () => {
    const lb = recorded();
    const newest = Math.max(...Object.values(lb).flatMap((e) => Object.keys(e.contrib ?? {}).map(Number)));
    const k = String(newest);
    const old = recorded();
    expect(uncountSeason(lb, newest)).toBe(true);
    for (const [name, e] of Object.entries(old)) {
      if (e.firstSeason === newest) {
        expect(lb[name], name).toBeUndefined();
        continue;
      }
      const now = lb[name]!;
      const c = e.contrib?.[k];
      expect(now.metaG, name).toBeCloseTo(e.metaG - (c?.g ?? 0), 9);
      expect(now.metaW, name).toBeCloseTo(e.metaW - (c?.w ?? 0), 9);
      expect(now.seasons[k], name).toBeUndefined();
      expect(now.contrib?.[k], name).toBeUndefined();
      if (c?.finals) expect(now.finals, name).toBeUndefined();
      else expect(now.finals, name).toBe(e.finals);
      // the other seasons are untouched
      for (const [s, v] of Object.entries(e.seasons)) if (s !== k) expect(now.seasons[s], `${name} season ${s}`).toBe(v);
    }
    expect(Object.values(old).some((e) => e.firstSeason === newest)).toBe(true);
    // the recorded file was only read
    expect(readFileSync(LB_FILE, 'utf8')).toBe(text);
  });

  it('season.ts takes it from the shared module (one definition)', () => {
    const src = readFileSync('scripts/season.ts', 'utf8');
    expect(src).toContain("import { uncountSeason, type Entry } from './season-leaderboard';");
    expect(src).not.toMatch(/function uncountSeason/);
  });
});
