// Deck forge: telemetry-guided, multi-generation deck iteration against the meta field.
//
//   npx tsx scripts/forge.ts <deck...> [--gens 2] [--games 140] [--cands 6] [--bot lookahead] [--field meta|all]
//   npx tsx scripts/forge.ts --nc          # all data/decks/custom/nc-*.txt
//
// Each generation:
//   1. Baseline: deck vs field with telemetry → win rate + per-card "Δ when drawn" (IWD).
//   2. Cuts: the deck's lowest-IWD cards. Adds: +1 of its best card, and the format's highest-impact legal cards
//      (from src/data/analysis.json, averaged across decks).
//   3. Test each cut→add swap on the SAME seeds as the baseline (paired comparison).
//   4. Confirm the best swap on fresh seeds; adopt only if it still beats the baseline.
//   5. Save the new version (data/decks/custom/<slug>.txt), archive the old one (history/), log reports/forge/<slug>.md.
import fs from 'node:fs';
import path from 'node:path';
import { CARD_BY_ID, CARDS, cardLabel } from '../src/engine/cards';
import { counts, exportOfficial, ramLimits, validateDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { analyzeDeck, type DeckReport } from '../src/analysis/analyze';
import analysis from '../src/data/analysis.json';
import { loadLibrary, resolveDeck } from './lib-node';
import { runJobs } from './simulate';
import type { MatchJob } from './worker';

const args = process.argv.slice(2);
const flag = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const GENS = +flag('gens', '2');
const GAMES = +flag('games', '140');
const CANDS = +flag('cands', '6');
const BOT = flag('bot', 'lookahead');
const FIELD = flag('field', 'meta');
const lib = loadLibrary();
const field = lib.filter((d) => (FIELD === 'all' ? d.kind !== 'custom' : d.kind === 'meta'));

const targets = args.includes('--nc')
  ? lib.filter((d) => d.kind === 'original')
  : args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))).map((q) => resolveDeck(q, lib));

/** Format-wide card impact: IWD averaged across all analysed decks, weighted by sample size. */
const GLOBAL_IMPACT: Record<string, number> = (() => {
  const acc: Record<string, { s: number; n: number }> = {};
  for (const r of (analysis as any).decks as DeckReport[]) {
    for (const c of r.cards) {
      if (typeof c.iwd !== 'number' || !Number.isFinite(c.iwd)) continue;
      acc[c.id] ??= { s: 0, n: 0 };
      acc[c.id].s += c.iwd * c.seenGames;
      acc[c.id].n += c.seenGames;
    }
  }
  return Object.fromEntries(Object.entries(acc).filter(([, v]) => v.n >= 40).map(([k, v]) => [k, v.s / v.n]));
})();

async function play(deck: DeckList, seed0: number, games: number, trace: boolean) {
  const jobs: MatchJob[] = [];
  let seed = seed0;
  for (let k = 0; k < games; k++) {
    const opp = field[k % field.length];
    jobs.push({ a: deck, b: opp.deck, seed: seed++, first: (Math.floor(k / field.length) % 2) as 0 | 1, bot: BOT, trace });
  }
  const res = await runJobs(jobs);
  const wr = res.reduce((a, r) => a + (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0), 0) / res.length;
  const sums = trace ? res.map((r) => r.summaries![0]) : [];
  return { wr, sums };
}

interface Mutation {
  label: string;
  deck: DeckList;
  prior: number;
}

function mutations(deck: DeckList, rep: DeckReport): Mutation[] {
  const cs = counts(deck.main);
  const lim = ramLimits(deck);
  const iwd = new Map(rep.cards.filter((c) => Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]));
  // cuts: lowest IWD in this deck (cards never/rarely seen fall back to global impact)
  const cuts = [...cs.keys()]
    .map((id) => ({ id, v: iwd.get(id) ?? GLOBAL_IMPACT[id] ?? 0 }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 3);
  // adds: +1 of the deck's own best card, plus the best legal format-wide cards
  const own = [...cs.entries()].filter(([, n]) => n < 3).map(([id]) => ({ id, v: iwd.get(id) ?? 0 })).sort((a, b) => b.v - a.v).slice(0, 2);
  const outside = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (cs.get(c.id) ?? 0) < 3 && GLOBAL_IMPACT[c.id] !== undefined)
    .map((c) => ({ id: c.id, v: GLOBAL_IMPACT[c.id] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 4);
  const adds = [...own, ...outside.filter((o) => !own.some((x) => x.id === o.id))];
  const out: Mutation[] = [];
  for (const c of cuts)
    for (const a of adds) {
      if (a.id === c.id) continue;
      const main = [...deck.main];
      main.splice(main.indexOf(c.id), 1, a.id);
      const d = { ...deck, main };
      if (validateDeck({ ...d, sideboard: [] }).length) continue;
      out.push({ label: `-1 ${cardLabel(CARD_BY_ID[c.id])} → +1 ${cardLabel(CARD_BY_ID[a.id])}`, deck: d, prior: a.v - c.v });
    }
  return out.sort((a, b) => b.prior - a.prior).slice(0, CANDS);
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function forge(target: (typeof lib)[number]) {
  let deck: DeckList = structuredClone(target.deck);
  const slug = target.file.replace(/\.txt$/, '');
  const log: string[] = [`# Forge log — ${deck.name}`, '', `Field: ${field.map((f) => f.deck.name).join(', ')} · bot ${BOT} · ${GAMES} games per test`, ''];
  const history: { gen: number; wr: number; change: string }[] = [];
  for (let gen = 1; gen <= GENS; gen++) {
    const seed0 = 100_000 * gen + Math.floor(Math.random() * 90_000);
    const base = await play(deck, seed0, GAMES, true);
    const rep = analyzeDeck(deck.name, base.sums);
    console.log(`\n[${deck.name}] gen ${gen}: baseline ${pct(base.wr)}`);
    log.push(`## Generation ${gen} — baseline ${pct(base.wr)}`, '', ...rep.insights.slice(0, 4).map((s) => `- ${s}`), '');
    const muts = mutations(deck, rep);
    const results: { m: Mutation; wr: number }[] = [];
    for (const m of muts) {
      const r = await play(m.deck, seed0, GAMES, false);
      results.push({ m, wr: r.wr });
      console.log(`  ${pct(r.wr)} (${((r.wr - base.wr) * 100).toFixed(1)})  ${m.label}`);
    }
    results.sort((a, b) => b.wr - a.wr);
    log.push('| Swap | Win % | Δ vs baseline |', '|---|---|---|', ...results.map((r) => `| ${r.m.label} | ${pct(r.wr)} | ${((r.wr - base.wr) * 100).toFixed(1)} |`), '');
    const best = results[0];
    if (!best || best.wr - base.wr < 0.02) {
      log.push(`No swap beat the baseline by 2+ points — **list kept**.`, '');
      history.push({ gen, wr: base.wr, change: 'kept' });
      continue;
    }
    // confirm on fresh seeds, bigger sample
    const seed1 = seed0 + 50_000;
    const [cb, cm] = [await play(deck, seed1, GAMES * 2, false), await play(best.m.deck, seed1, GAMES * 2, false)];
    const ok = cm.wr > cb.wr;
    log.push(`Confirmation (${GAMES * 2} fresh games): baseline ${pct(cb.wr)} vs swap ${pct(cm.wr)} → **${ok ? 'adopted' : 'rejected'}**`, '');
    console.log(`  confirm: ${pct(cb.wr)} → ${pct(cm.wr)} ${ok ? 'ADOPT' : 'reject'}`);
    if (ok) {
      deck = best.m.deck;
      history.push({ gen, wr: cm.wr, change: best.m.label });
    } else history.push({ gen, wr: cb.wr, change: 'kept (swap failed confirmation)' });
  }
  // save
  const changed = history.some((h) => !h.change.startsWith('kept'));
  if (changed) {
    const hist = path.join('data/decks/custom/history');
    fs.mkdirSync(hist, { recursive: true });
    const inCustom = target.kind === 'custom' || target.kind === 'original';
    const orig = path.join(inCustom ? 'data/decks/custom' : 'data/decks', target.file);
    if (fs.existsSync(orig)) fs.copyFileSync(orig, path.join(hist, `${slug}-${new Date().toISOString().slice(0, 10)}.txt`));
    const outFile = inCustom ? orig : path.join('data/decks/custom', `${slug}-forged.txt`);
    const prev = fs.existsSync(orig) ? fs.readFileSync(orig, 'utf8') : '';
    const idea = prev.match(/^\/\/ Idea: .+$/m)?.[0] ?? '';
    fs.writeFileSync(
      outFile,
      `${exportOfficial(inCustom ? deck : { ...deck, name: `${deck.name} (forged)` })}\n\n${idea}\n// Forged ${new Date().toISOString().slice(0, 10)}: ${history.filter((h) => !h.change.startsWith('kept')).map((h) => h.change).join('; ')}\n`,
    );
    log.push(`Saved ${outFile} (previous version archived in data/decks/custom/history/).`);
  }
  log.push('', '## Summary', '', '| Gen | Win % | Change |', '|---|---|---|', ...history.map((h) => `| ${h.gen} | ${pct(h.wr)} | ${h.change} |`));
  fs.mkdirSync('reports/forge', { recursive: true });
  fs.writeFileSync(`reports/forge/${slug}.md`, log.join('\n'));
  return { name: deck.name, history };
}

async function main() {
  console.log(`Forging ${targets.length} deck(s) × ${GENS} generations vs ${field.length} field decks`);
  const all = [];
  for (const t of targets) all.push(await forge(t));
  const md = [
    '# Forge summary',
    '',
    '| Deck | Start | End | Changes |',
    '|---|---|---|---|',
    ...all.map((a) => `| ${a.name} | ${pct(a.history[0]?.wr ?? 0)} | ${pct(a.history[a.history.length - 1]?.wr ?? 0)} | ${a.history.filter((h) => !h.change.startsWith('kept')).map((h) => h.change).join('; ') || '—'} |`),
  ].join('\n');
  fs.writeFileSync('reports/forge/summary.md', md);
  console.log('\n' + md);
}
main();
