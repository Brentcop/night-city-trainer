// Deck optimizer: hill-climb single-card swaps (and legend swaps) against the meta field.
//   npx tsx scripts/optimize.ts <deck> [--screen 70] [--confirm 280] [--candidates 40] [--bot lookahead]
//   npx tsx scripts/optimize.ts <deck> --vs <opponent> --sideboard     (Bo3 plan: only swaps using the deck's 7-card sideboard)
// Stage 1 screens many candidate swaps with a small sample; stage 2 re-tests the best few (and the
// unmodified deck) with a large sample on identical seeds. Writes reports/optimize-<deck>-latest.md.
import fs from 'node:fs';
import { CARDS, CARD_BY_ID, cardLabel } from '../src/engine/cards';
import { counts, exportOfficial, ramLimits, validateDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { cardValue } from '../src/ai/knowledge';
import { loadLibrary, resolveDeck } from './lib-node';
import { runJobs } from './simulate';
import type { MatchJob } from './worker';

const args = process.argv.slice(2);
const flag = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const base = resolveDeck(args[0]);
const SCREEN = +flag('screen', '70');
const CONFIRM = +flag('confirm', '280');
const NCAND = +flag('candidates', '40');
const BOT = flag('bot', 'lookahead');
const VS = flag('vs', '');
const SIDEBOARD = args.includes('--sideboard');
const field = VS ? [resolveDeck(VS)] : loadLibrary().filter((d) => d.kind === 'meta' && d.deck.name !== base.deck.name);

interface Cand {
  label: string;
  deck: DeckList;
}

function candidates(deck: DeckList): Cand[] {
  const out: Cand[] = [];
  const lim = ramLimits(deck);
  const cs = counts(deck.main);
  const sbIds = new Set(deck.sideboard);
  const inPool = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3 && (!SIDEBOARD || sbIds.has(c.id)));
  // weakest cards in deck by static value are the likeliest cuts; strongest legal cards the likeliest adds
  const cuts = [...cs.keys()].sort((a, b) => cardValue(a) - cardValue(b)).slice(0, SIDEBOARD ? 12 : 8);
  const adds = inPool.sort((a, b) => cardValue(b.id) - cardValue(a.id)).slice(0, 14);
  for (const out1 of cuts)
    for (const add of adds) {
      if (add.id === out1) continue;
      const main = [...deck.main];
      main.splice(main.indexOf(out1), 1, add.id);
      out.push({ label: `-1 ${cardLabel(CARD_BY_ID[out1])} / +1 ${cardLabel(add)}`, deck: { ...deck, main, name: deck.name } });
    }
  if (SIDEBOARD) return out.slice(0, NCAND);
  // legend swaps that keep the deck legal
  for (const leg of CARDS.filter((c) => c.type === 'Legend')) {
    for (let k = 0; k < 3; k++) {
      const legends = [...deck.legends];
      if (legends.includes(leg.id)) continue;
      legends[k] = leg.id;
      const d = { ...deck, legends };
      if (validateDeck({ ...d, sideboard: [] }).length) continue;
      out.push({ label: `Legend: ${cardLabel(CARD_BY_ID[deck.legends[k]])} → ${cardLabel(leg)}`, deck: d });
    }
  }
  // shuffle deterministically then take N (keep variety between card & legend swaps)
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return out.sort(() => rnd() - 0.5).slice(0, NCAND);
}

async function measure(cands: Cand[], gamesPerCand: number, seed0: number): Promise<number[]> {
  const jobs: (MatchJob & { ci: number })[] = [];
  cands.forEach((c, ci) => {
    let seed = seed0; // identical seeds for every candidate -> lower variance comparisons
    for (let k = 0; k < gamesPerCand; k++) {
      const opp = field[k % field.length];
      jobs.push({ a: { ...c.deck, name: `cand${ci}` }, b: opp.deck, seed: seed++, first: (Math.floor(k / field.length) % 2) as 0 | 1, bot: BOT, ci });
    }
  });
  const res = await runJobs(jobs);
  const tot = cands.map(() => ({ w: 0, g: 0 }));
  for (const r of res) {
    const ci = +r.a.slice(4);
    tot[ci].g++;
    tot[ci].w += r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0;
  }
  return tot.map((t) => t.w / Math.max(1, t.g));
}

async function main() {
  console.log(`Optimizing ${base.deck.name} vs ${field.length} meta decks (bot=${BOT})`);
  const cands = [{ label: '(unchanged)', deck: base.deck }, ...candidates(base.deck)];
  console.log(`Stage 1: ${cands.length} candidates × ${SCREEN} games`);
  const s1 = await measure(cands, SCREEN, 424242);
  const ranked = cands.map((c, i) => ({ c, wr: s1[i] })).sort((a, b) => b.wr - a.wr);
  const top = [{ c: cands[0], wr: s1[0] }, ...ranked.filter((r) => r.c !== cands[0]).slice(0, 6)];
  console.log(`Stage 2: confirming top ${top.length - 1} + baseline × ${CONFIRM} games`);
  const s2 = await measure(top.map((t) => t.c), CONFIRM, 777777);
  const final = top.map((t, i) => ({ ...t, wr2: s2[i] })).sort((a, b) => b.wr2 - a.wr2);
  const baseWr = final.find((f) => f.c === cands[0])!.wr2;
  const md = [
    `# Optimizer — ${base.deck.name}`,
    '',
    `Field: ${field.map((f) => f.deck.name).join(', ')}. Bot: ${BOT}. Stage 1 ${SCREEN} games/candidate, stage 2 ${CONFIRM} games (same seeds for all candidates).`,
    '',
    `Baseline win rate (stage 2): **${(baseWr * 100).toFixed(1)}%**`,
    '',
    '| Change | Stage 1 | Stage 2 | Δ vs baseline |',
    '|---|---|---|---|',
    ...final.map((f) => `| ${f.c.label} | ${(f.wr * 100).toFixed(1)}% | ${(f.wr2 * 100).toFixed(1)}% | ${f.c === cands[0] ? '—' : ((f.wr2 - baseWr) * 100 >= 0 ? '+' : '') + ((f.wr2 - baseWr) * 100).toFixed(1)} |`),
    '',
    '## Stage 1 (all candidates)',
    '',
    ...ranked.map((r) => `- ${(r.wr * 100).toFixed(1)}% — ${r.c.label}`),
    '',
    'Standard error at 280 games ≈ ±3%; treat gains under ~4 points as noise unless they repeat.',
    '',
    '## Best list',
    '',
    '```',
    exportOfficial({ ...final[0].c.deck, name: `${base.deck.name} (optimized)` }),
    '```',
  ].join('\n');
  fs.mkdirSync('reports', { recursive: true });
  const slug = base.file.replace(/\.txt$/, '') + (VS ? `-vs-${field[0].file.replace(/\.txt$/, '')}` : '');
  fs.writeFileSync(`reports/optimize-${slug}-latest.md`, md);
  console.log('\n' + md.split('## Stage 1')[0]);
}
main();
