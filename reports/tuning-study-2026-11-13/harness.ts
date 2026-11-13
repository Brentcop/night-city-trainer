// Scratch harness: paired games of several lists on the same seeds vs a field (forge's job layout).
import fs from 'node:fs';
import { loadLibrary, resolveDeck, runJobs } from 'E:/OTHJ/CyberpunkTCG/scripts/lib-node';
import { cliGameCache } from 'E:/OTHJ/CyberpunkTCG/scripts/game-cache';
import { parseDeck } from 'E:/OTHJ/CyberpunkTCG/src/engine/deck';
import type { DeckList } from 'E:/OTHJ/CyberpunkTCG/src/engine/types';
import type { MatchJob } from 'E:/OTHJ/CyberpunkTCG/scripts/worker';
import { scoreOf } from 'E:/OTHJ/CyberpunkTCG/src/lib/evidence';

export const lib = loadLibrary('E:/OTHJ/CyberpunkTCG/data/decks');
export const meta = lib.filter((d) => d.kind === 'meta').map((d) => d.deck);
export const deckFile = (p: string): DeckList => parseDeck(fs.readFileSync(p, 'utf8'), p).deck;
export const deck = (q: string): DeckList => resolveDeck(q, lib).deck;
const cache = cliGameCache(process.env.NOCACHE ? false : true);
export const THREADS = Number(process.env.THREADS ?? 12);

export interface G { score: number; opp: string; first: 0 | 1; turns: number; seed: number }
/** games k = 0..n-1: opponent field[k % F], first = floor(k/F) % 2, seed seed0 + k (the forge's layout) */
export async function playLists(lists: DeckList[], field: DeckList[], seed0: number, n: number, bot: string): Promise<G[][]> {
  const jobs: MatchJob[] = lists.flatMap((d) => Array.from({ length: n }, (_, k) => ({ a: d, b: field[k % field.length]!, seed: seed0 + k, first: (Math.floor(k / field.length) % 2) as 0 | 1, bot })));
  const res = await runJobs(jobs, { threads: THREADS, cache });
  return lists.map((_, i) => res.slice(i * n, (i + 1) * n).map((r, k) => ({ score: scoreOf(r.winner), opp: field[k % field.length]!.name, first: (Math.floor(k / field.length) % 2) as 0 | 1, turns: r.turns, seed: seed0 + k })));
}
export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
export function paired(a: G[], b: G[]) {
  const d = a.map((g, i) => g.score - b[i]!.score);
  const m = mean(d);
  const sd = Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, d.length - 1));
  const same = d.filter((x) => x === 0).length / d.length;
  return { n: d.length, mean: m, sd, se: sd / Math.sqrt(d.length), same };
}
export const pp = (x: number) => (x * 100).toFixed(1);
