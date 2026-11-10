// Generate the tournament plan + home recommendation from the latest data
// (src/data/review.json, src/data/analysis.json, src/data/meta.json, reports/optimize-*-latest.md).
//   npx tsx scripts/plan.ts
import fs from 'node:fs';
import review from '../src/data/review.json';
import analysis from '../src/data/analysis.json';
import meta from '../src/data/meta.json';
import { classify, PLAN_TEXT, type ProfileKey } from '../src/ai/archetype';
import type { DeckReport } from '../src/analysis/analyze';
import { loadLibrary } from './lib-node';

const R = review as { date: string; games: number; bot: string; decks: { name: string; file: string; winRate: number; games: number }[]; matrix: Record<string, Record<string, number>>; firstPlayerWinRate: number };
const A = analysis as unknown as { decks: DeckReport[] };
const M = meta as { title: string; tier: string; power: number }[];
const lib = loadLibrary();
const arch = (name: string) => {
  const d = lib.find((x) => x.deck.name === name);
  return d ? classify(d.deck.main).arch : 'midrange';
};
const pct = (x: number) => `${Math.round(x * 100)}%`;
// In-app deck profile links (the app's Markdown renderer supports [text](#/deck?d=file)); keep links outside **bold**.
const fileOfName = (name: string) => lib.find((x) => x.deck.name === name)?.file;
const link = (name: string) => {
  const f = fileOfName(name);
  return f ? `[${name}](#/deck?d=${encodeURIComponent(f)})` : name;
};
const metaNames = M.map((m) => m.title);

// Score each deck against the expected tournament field: choom.gg meta decks weighted by tier power.
const weights: Record<string, number> = Object.fromEntries(M.map((m) => [m.title, m.power / 100]));
function fieldScore(name: string) {
  let s = 0;
  let w = 0;
  for (const opp of metaNames) {
    if (opp === name) continue;
    const v = R.matrix[name]?.[opp];
    if (v === undefined) continue;
    s += v * weights[opp];
    w += weights[opp];
  }
  return w ? s / w : 0;
}
const ranked = R.decks.map((d) => ({ ...d, field: fieldScore(d.name), worst: Math.min(...metaNames.filter((o) => o !== d.name && R.matrix[d.name]?.[o] !== undefined).map((o) => R.matrix[d.name][o])) }));
ranked.sort((a, b) => b.field - a.field);
// Finals: large-sample `sim test` results (reports/test-<file>-latest.json) override the round-robin estimate.
const finals: Record<string, { overall: number; games: number }> = {};
for (const d of ranked) {
  const f = `reports/test-${d.file.replace(/\.txt$/, '')}-latest.json`;
  if (!fs.existsSync(f) || fs.statSync(f).mtimeMs < Date.parse(R.date)) continue; // missing or stale
  const t = JSON.parse(fs.readFileSync(f, 'utf8'));
  finals[d.name] = { overall: t.overall, games: t.rows.reduce((a: number, r: { games: number }) => a + r.games, 0) };
}
const hasFinals = Object.keys(finals).length >= 3;
if (hasFinals) ranked.sort((a, b) => (finals[b.name]?.overall ?? -1) - (finals[a.name]?.overall ?? -1) || b.field - a.field);
// Among decks statistically tied with the best finals result (within 2 points), prefer robustness:
// the highest worst-meta-matchup, then the best overall result against the whole (strong) field.
const bestFinal = hasFinals ? finals[ranked[0].name]?.overall ?? 0 : 0;
const tied = hasFinals ? ranked.filter((d) => finals[d.name] && bestFinal - finals[d.name].overall <= 0.02) : [ranked[0]];
const pick = [...tied].sort((a, b) => b.worst + b.winRate - (a.worst + a.winRate))[0];
const pickReason =
  hasFinals && tied.length > 1
    ? `Chosen among ${tied.length} decks tied within 2 points in the finals (${tied.map((d) => d.name).join(', ')}) for robustness: worst meta matchup ${pct(pick.worst)}, ${pct(pick.winRate)} against the whole field.`
    : '';
const backup = ranked.find((d) => d.name !== pick.name && arch(d.name) !== arch(pick.name)) ?? ranked[1];
const rep = A.decks.find((d) => d.deck === pick.name);
const opt = fs.existsSync(`reports/optimize-${pick.file.replace(/\.txt$/, '')}-latest.md`) ? fs.readFileSync(`reports/optimize-${pick.file.replace(/\.txt$/, '')}-latest.md`, 'utf8') : '';
const optRows = opt
  .split('\n')
  .filter((l) => /^\| [^|]+ \| [\d.]+% \| [\d.]+% \| [+-][\d.]+ \|$/.test(l))
  .map((l) => l.split('|').map((x) => x.trim()))
  .filter((c) => parseFloat(c[4]) >= 3);

const matchupLines = metaNames
  .filter((o) => o !== pick.name && R.matrix[pick.name]?.[o] !== undefined)
  .map((o) => {
    const v = R.matrix[pick.name][o];
    const plan = PLAN_TEXT[`${arch(pick.name)}>${arch(o)}` as ProfileKey];
    const mr = rep?.matchups.find((m) => m.opp === o);
    const seat = mr && Number.isFinite(mr.wrFirst) && Number.isFinite(mr.wrSecond) ? (mr.wrFirst - mr.wrSecond >= 0.06 ? 'go first' : mr.wrSecond - mr.wrFirst >= 0.06 ? 'go second' : 'either') : '—';
    const keys = mr?.topCards.slice(0, 2).map((c) => c.name).join(', ') ?? '';
    return `| ${link(o)} (${arch(o)}) | **${pct(v)}** | ${seat} | ${keys} | ${plan} |`;
  });

// Problem matchups: large head-to-head runs (reports/vs-<pick>-<opp>-latest.json) and per-matchup optimizer reports.
const pickSlug = pick.file.replace(/\.txt$/, '');
const libFiles = new Map(lib.map((d) => [d.file.replace(/\.txt$/, ''), d.deck.name]));
const problemLines: string[] = [];
for (const f of fs.readdirSync('reports').filter((x) => x.startsWith(`vs-${pickSlug}-`) && x.endsWith('-latest.json'))) {
  const oppSlug = f.slice(`vs-${pickSlug}-`.length, -'-latest.json'.length);
  if (oppSlug === pickSlug) continue;
  const t = JSON.parse(fs.readFileSync(`reports/${f}`, 'utf8'));
  const opp = libFiles.get(oppSlug) ?? oppSlug;
  problemLines.push(
    `### vs ${link(opp)}`,
    `Head-to-head: **${pct((t.aWins + t.ties / 2) / t.games)}** over ${t.games} games (${pct(t.aFirstWins / Math.max(1, t.aFirstGames))} on the play, ${pct(t.aSecondWins / Math.max(1, t.aSecondGames))} on the draw). Plan: ${PLAN_TEXT[`${arch(pick.name)}>${arch(opp)}` as ProfileKey]}`,
  );
  const of = `reports/optimize-${pickSlug}-vs-${oppSlug}-latest.md`;
  if (fs.existsSync(of)) {
    const rows = fs
      .readFileSync(of, 'utf8')
      .split('\n')
      .filter((l) => /^\| [^|]+ \| [\d.]+% \| [\d.]+% \| [+-][\d.]+ \|$/.test(l))
      .map((l) => l.split('|').map((x) => x.trim()))
      .filter((c) => parseFloat(c[4]) >= 2);
    // Legends can't be sideboarded (tournament rules), so report Legend swaps as deck-choice notes.
    const sb = rows.filter((c) => !c[1].startsWith('Legend'));
    const leg = rows.filter((c) => c[1].startsWith('Legend'));
    problemLines.push(
      sb.length
        ? `**Sideboard candidates for this matchup** (paired test, Δ vs stock list): ${sb.map((c) => `${c[1]} (${c[4]})`).join('; ')}.`
        : 'No single-card swap clearly improved this matchup; win it with play, not sideboarding.',
    );
    if (leg.length)
      problemLines.push(
        `*Deck-choice note:* ${leg.map((c) => `${c[1].replace('Legend: ', '')} (${c[4]})`).join('; ')}. Legends can't be sideboarded, so this only matters if you expect a lot of this deck when you register.`,
      );
  }
  problemLines.push('');
}

// Ready-to-register build: <slug>-eor.txt (or the hand-made RRG build for the stock meta list).
const eorFile = pick.file === 'meta-rrg-dexter-midrange.txt' ? 'rrg-eor-build.txt' : pick.file.replace(/\.txt$/, '-eor.txt');
const eorDeck = lib.find((x) => x.file === eorFile);

const today = new Date();
const event = new Date('2026-12-11T09:00:00-06:00');
const days = Math.max(0, Math.round((event.getTime() - today.getTime()) / 86_400_000));

const plan = `
> Generated ${today.toISOString().slice(0, 10)} from ${R.decks.length} decks × ${R.games} games per pairing (${R.bot} bot) plus telemetry. Re-run \`npm run sim -- analyze --field all --bot deep\` and then \`npx tsx scripts/plan.ts\` to refresh.

## Register: ${link(pick.name)}
- **Full stats:** [${pick.name} deck profile](#/deck?d=${encodeURIComponent(pick.file)}) — lineage, finals per opponent, head-to-heads, forge history and the visual decklist.
- ${finals[pick.name] ? `**Finals: ${pct(finals[pick.name].overall)} over ${finals[pick.name].games} deep-bot games vs the meta archetypes.** ` : ''}**Expected-field score: ${pct(pick.field)}**. This is the win rate against choom.gg's meta archetypes, weighted by their tier power. Overall round-robin win rate: ${pct(pick.winRate)}; worst meta matchup: ${pct(pick.worst)}.
${pickReason ? `- **Why this one:** ${pickReason}` : ''}
- **Why (from ${rep ? rep.games : 0} telemetry games):**
${rep ? rep.insights.map((x) => `  - ${x}`).join(String.fromCharCode(10)) : ''}
- **Ready-to-register list:** ${eorDeck ? `${link(eorDeck.deck.name)} (\`${eorFile}\`, Decks page → Tournament builds): the list plus a data-chosen 7-card sideboard.` : 'the list on the Decks page.'}
- **Backup / sideboard partner:** ${link(backup.name)} (${arch(backup.name)}, field score ${pct(backup.field)}). Practise it second, in case the room skews hard against ${arch(pick.name)} decks.

## Expected-field ranking
| # | Deck | Archetype | Finals vs meta (games) | Round-robin vs meta field | Overall | Worst meta matchup |
|---|---|---|---|---|---|---|
${ranked
  .slice(0, 8)
  .map((d, i) => `| ${i + 1} | ${link(d.name)} | ${arch(d.name)} | ${finals[d.name] ? `**${pct(finals[d.name].overall)}** (${finals[d.name].games})` : '—'} | ${pct(d.field)} | ${pct(d.winRate)} | ${pct(d.worst)} |`)
  .join('\n')}

${hasFinals ? 'Ranking uses the **finals**: each contender played 360 deep-bot games against the six meta archetypes on the same seeds. That is more reliable than the round-robin estimate (24 games per pairing).' : ''}

## Matchup plan with ${pick.name}
| Opponent | Sim win % | Seat | Key cards | Plan |
|---|---|---|---|---|
${matchupLines.join('\n')}

${optRows.length ? `## List tuning (optimizer)\nThese single-card changes beat the stock list in confirmation runs (same seeds; ±3 pts is noise):\n${optRows.map((c) => `- ${c[1]}: ${c[3]} (${c[4]} pts)`).join('\n')}\n\nThe full report is in \`reports/optimize-${pick.file.replace(/\.txt$/, '')}-latest.md\`.` : '## List tuning\nThe optimizer found no single-card change that clearly beats the stock list, so register it as-is.'}

${problemLines.length ? `## Problem matchups\n${problemLines.join('\n')}` : ''}

## Bo3 notes (tournament rules)
- The **loser of each game chooses who goes first**. Use the seat column above. Across all sim games, going first won ${pct(R.firstPlayerWinRate)}; choom.gg's human games show 57% for going first.
- Swiss rounds are 50 minutes for a Bo3. When time is called, each player gets one more turn, then the player with 7+ Gigs wins; otherwise the game is a draw. Average sim game length for this deck is ${rep ? rep.avgTurns.toFixed(1) : '?'} turns, so play at a steady pace.
- The sideboard is exactly 7 cards. Build it for your worst matchups first. Then test the post-board list in the Matchup Lab, or with \`npx tsx scripts/optimize.ts <deck> --vs <opponent> --sideboard\`.

## Practice schedule (${days} days to Chicago)
1. **This week:** 10+ games a day in **Play vs Bot** with ${pick.name} on Deep, Coach on. Read every Coach line where you disagreed with it.
2. **Next week:** play the three worst matchups from the table above on both seats, and log the results (the Play page keeps a practice log).
3. **Final week:** best-of-3 sets against the top two meta decks; finalise the 7-card sideboard; refresh the meta data (choom.gg) and re-run the sims.

## Caveats
- The bots are strong heuristic players. Control decks (BBG Econ) gain the most from expert piloting, so treat their sim numbers as a floor.
- choom.gg's tier list is expert opinion. Where it disagrees with the sim (see the Meta page), test that matchup yourself.
`;

const recommendation = `## Recommended deck
**${pick.name}** — ${finals[pick.name] ? `${pct(finals[pick.name].overall)} in the finals (${finals[pick.name].games} deep-bot games vs the meta archetypes)` : `${pct(pick.field)} against the weighted meta field`}, ${pct(pick.winRate)} overall across ${R.decks.length} decks. Backup: **${backup.name}**. ${eorDeck ? `Ready-to-register list with sideboard: ${link(eorDeck.deck.name)}. ` : ''}Full stats: [${pick.name}](#/deck?d=${encodeURIComponent(pick.file)}).

${rep ? rep.insights.slice(0, 2).map((s) => `- ${s}`).join('\n') : ''}
`;

fs.writeFileSync('src/content/tournamentPlan.ts', `// Generated by scripts/plan.ts — do not edit by hand.\nexport const TOURNAMENT_PLAN = ${JSON.stringify(plan)};\n`);
fs.writeFileSync('src/content/recommendation.ts', `// Generated by scripts/plan.ts — do not edit by hand.\nexport const RECOMMENDATION = ${JSON.stringify(recommendation)};\n`);
fs.writeFileSync('docs/TOURNAMENT_PLAN.md', `# Tournament plan — EOR Chicago\n${plan}`);
console.log(plan);
