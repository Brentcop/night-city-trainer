// SIM-8: the game-result cache (scripts/game-cache.ts) and the kept game pool (scripts/lib-node.ts gamePool).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { cacheable, codeFiles, gameKey, openGameCache, type KeyParts } from '../scripts/game-cache';
import { closeGamePool, gamePool, loadLibrary, runJobsDetailed } from '../scripts/lib-node';
import type { MatchJob } from '../scripts/worker';

const meta = loadLibrary().filter((d) => d.kind === 'meta');
const jobs: MatchJob[] = [0, 1, 2, 3].map((k) => ({
  a: meta[k % meta.length]!.deck,
  b: meta[(k + 1) % meta.length]!.deck,
  seed: 9100 + k,
  first: (k % 2) as 0 | 1,
  bot: 'easy',
  ...(k === 3 ? { agentA: { deep: 0, noise: 0.15 }, agentB: { noise: 0.15 } } : {}),
}));
const parts: KeyParts = { codeHash: 'a'.repeat(64), simVersion: 5, node: '22.12.0' };

afterAll(() => closeGamePool());

describe('game cache key', () => {
  it('hashes the code the worker loads: engine, bots, cards and impact', () => {
    const files = codeFiles();
    for (const f of ['scripts/worker.ts', 'scripts/agent-spec.ts', 'src/engine/engine.ts', 'src/ai/heuristic.ts', 'src/ai/eval.ts', 'src/data/cards.json', 'src/data/impact.json']) expect(files).toContain(f);
    expect(files.some((f) => f.startsWith('src/engine/scripts/'))).toBe(true);
    expect(new Set(files).size).toBe(files.length);
  });

  it('ignores key order but changes with every part of the key', () => {
    const j = jobs[3]!;
    const k = gameKey(j, parts);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    const reordered = { agentB: j.agentB, bot: j.bot, first: j.first, seed: j.seed, b: j.b, a: j.a, agentA: { noise: 0.15, deep: 0 } } as MatchJob;
    expect(gameKey(reordered, parts)).toBe(k);
    const variants: MatchJob[] = [
      { ...j, seed: j.seed + 1 },
      { ...j, first: j.first === 0 ? 1 : 0 },
      { ...j, a: { ...j.a, main: [...j.a.main.slice(1), j.a.main[0]!].reverse() } },
      { ...j, a: { ...j.a, main: [...j.a.main.slice(0, -1), j.b.main[0]!] } },
      { ...j, b: meta[5]!.deck },
      { ...j, a: { ...j.a, name: 'Renamed' } },
      { ...j, bot: 'hard' },
      { ...j, agentA: { deep: 1, noise: 0.15 } },
      { ...j, agentB: { noise: 0.15, weightSet: 'calibrated-2026-11' } },
      { ...j, trace: true },
      { ...j, mulliganA: 'keep' },
    ];
    const keys = variants.map((v) => gameKey(v, parts));
    // a reordered main deck is the same list (listFingerprint) but a different job text: conservative, it misses
    expect(new Set([k, ...keys]).size).toBe(variants.length + 1);
    expect(gameKey(j, { ...parts, simVersion: 6 })).not.toBe(k);
    expect(gameKey(j, { ...parts, codeHash: 'b'.repeat(64) })).not.toBe(k);
    expect(gameKey(j, { ...parts, node: '24.0.0' })).not.toBe(k);
  });

  it('never caches jobs with bulky observations', () => {
    expect(cacheable(jobs[0]!)).toBe(true);
    for (const flag of ['decisions', 'rawDecisions', 'synergies', 'evalLeaves'] as const) {
      expect(cacheable({ ...jobs[0]!, [flag]: true })).toBe(false);
      expect(gameKey({ ...jobs[0]!, [flag]: true }, parts)).toBeNull();
    }
  });
});

describe('cached runs (real game worker)', () => {
  it('give byte-identical results to an uncached run, and a changed key part misses', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-game-cache-'));
    try {
      const plain = await runJobsDetailed(jobs, { threads: 2, quiet: true });
      const pool = gamePool(1);
      const cold = openGameCache({ dir, codeHash: parts.codeHash });
      const first = await runJobsDetailed(jobs, { threads: 2, quiet: true, cache: cold });
      expect(gamePool(1)).toBe(pool); // the second batch reused the kept workers
      expect(cold.stats).toEqual({ hits: 0, misses: jobs.length, stored: jobs.length });
      // a fresh process reading the same directory
      const warm = openGameCache({ dir, codeHash: parts.codeHash });
      const again = await runJobsDetailed(jobs, { threads: 2, quiet: true, cache: warm });
      expect(warm.stats).toEqual({ hits: jobs.length, misses: 0, stored: 0 });
      expect(JSON.stringify(first)).toBe(JSON.stringify(plain));
      expect(JSON.stringify(again)).toBe(JSON.stringify(plain));

      const j = jobs[0]!;
      expect(warm.get(j)).toBeDefined();
      for (const changed of [{ ...j, seed: j.seed + 1000 }, { ...j, first: 1 as const }, { ...j, bot: 'medium' }, { ...j, agentA: { noise: 0.1 } }, { ...j, b: meta[4]!.deck }]) expect(warm.get(changed)).toBeUndefined();
      expect(openGameCache({ dir, codeHash: 'c'.repeat(64) }).get(j)).toBeUndefined();
      expect(openGameCache({ dir, codeHash: parts.codeHash, simVersion: 99 }).get(j)).toBeUndefined();
      expect(openGameCache({ dir, codeHash: parts.codeHash, node: '0.0.1' }).get(j)).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
