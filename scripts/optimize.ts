// Deck optimizer: hill-climb single-card swaps (and legend swaps) against the meta field.
//   npx tsx scripts/optimize.ts <deck> [--screen 70] [--confirm 280] [--candidates 40] [--bot lookahead] [--threads N]
//   npx tsx scripts/optimize.ts <deck> --vs <opponent> --sideboard     (Bo3 plan: only swaps using the deck's 7-card sideboard)
// Stage 1 screens many candidate swaps with a small sample; stage 2 re-tests the best few (and the
// unmodified deck) with a large sample on identical seeds. Writes reports/optimize-<deck>[-vs-<opp>]-latest.md
// and a .json twin (read by scripts/bundle-reports.ts).
import fs from 'node:fs';
import { CARDS, CARD_BY_ID, cardLabel } from '../src/engine/cards';
import { counts, exportOfficial, ramLimits, validateDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { cardValue } from '../src/ai/knowledge';
import { bool, cli, int, loadLibrary, oneOf, resolveDeck, runJobs, runMain, SIM_BOTS, str, threadsOpt } from './lib-node';
import { gameRunManifest, manifestDeck } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob } from './worker';

const { values: V, positionals } = cli(
  import.meta.url,
  { screen: int(70, { min: 1 }), confirm: int(280, { min: 1 }), candidates: int(40, { min: 1 }), bot: oneOf(SIM_BOTS, 'lookahead'), vs: str(''), sideboard: bool(), threads: threadsOpt() },
  { minPositionals: 1, maxPositionals: 1 },
);
const base = resolveDeck(positionals[0]);
const SCREEN = V.screen;
const CONFIRM = V.confirm;
const NCAND = V.candidates;
const BOT = V.bot;
const VS = V.vs;
const SIDEBOARD = V.sideboard;
const THREADS = Math.min(V.threads, 16);
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
  const res = await runJobs(jobs, { threads: THREADS });
  const tot = cands.map(() => ({ w: 0, g: 0 }));
  for (const r of res) {
    const ci = +r.a.slice(4);
    tot[ci].g++;
    tot[ci].w += r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0;
  }
  return tot.map((t) => t.w / Math.max(1, t.g));
}

async function main() {
  const startedAt = new Date().toISOString();
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
  // machine-readable twin of the stage-2 table (percent / points, 1 decimal, as printed)
  const p1 = (x: number) => +(x * 100).toFixed(1);
  const json = {
    deck: base.deck.name,
    file: base.file,
    vs: VS ? field[0].deck.name : 'meta field',
    vsFile: VS ? field[0].file : undefined,
    date: new Date().toISOString().slice(0, 10),
    bot: BOT,
    screen: SCREEN,
    confirm: CONFIRM,
    baseline: p1(baseWr),
    rows: final.filter((f) => f.c !== cands[0]).map((f) => ({ change: f.c.label, s1: p1(f.wr), s2: p1(f.wr2), delta: p1(f.wr2 - baseWr) })),
    // stage 1 plays seeds from 424242, stage 2 from 777777 (the same seeds for every candidate)
    manifest: gameRunManifest({
      purpose: 'optimize',
      decks: [base, ...field],
      fieldMode: VS ? `vs:${field[0].file}${SIDEBOARD ? ':sideboard' : ''}` : 'meta',
      fieldDeckIds: field.map((f) => manifestDeck(f).id),
      bot: BOT,
      seedBase: 424242,
      seatPolicy: 'alternate',
      plannedGames: cands.length * SCREEN + top.length * CONFIRM,
      gamesPerPair: null,
      simVersion: SIM_VERSION,
      createdAt: startedAt,
    }),
  };
  fs.writeFileSync(`reports/optimize-${slug}-latest.json`, JSON.stringify(json, null, 1));
  console.log('\n' + md.split('## Stage 1')[0]);
}
runMain(main);
