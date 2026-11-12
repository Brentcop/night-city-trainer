// INFO-7: check the hand-written card value (cardValue, src/ai/knowledge.ts: regexes on roles plus a few choom.gg
// ratings), which decides which card the bots sell, against what bot games measure. Per deck of the chosen set: Spearman
// rank correlation of cardValue against (1) the plain IWD in an impact file (default src/data/impact.json, the numbers
// the Hard bot reads; cards drawn in IMPACT_MIN_DECK_GAMES+ games), and, when --adjusted names the JSON written by
// `npm run sim -- analyze --impact-adjusted --out DIR` (DIR/impact-adjusted-latest.json), (2) the adjusted estimate
// (shrunk) and (3) kept against sold at sell decisions (shrunk); then the largest disagreements by percentile rank in
// the deck, with sample sizes. Decks are matched by list fingerprint. Reads only; plays no game. Maths in
// src/analysis/cardValueCheck.ts.
//   npx tsx scripts/card-value-check.ts [--decks meta|all|<file prefix>] [--impact FILE] [--adjusted FILE] [--top 4]
//     [--out DIR] [--force]
// --out: also write DIR/card-value-check-<decks>.json and .md (refuses to overwrite them without --force).
import fs from 'node:fs';
import path from 'node:path';
import { bool, cli, int, loadLibrary, Refusal, runMain, str } from './lib-node';
import { listFingerprint } from '../src/engine/deck';
import { CARD_BY_ID, cardLabel } from '../src/engine/cards';
import { cardValue } from '../src/ai/knowledge';
import { findImpactDeck, IMPACT_MIN_DECK_GAMES, type ImpactData } from '../src/analysis/impactData';
import type { AdjustedDeck } from '../src/analysis/impactAdjusted';
import { checkValues, type MeasuredCard, type ValueCheck } from '../src/analysis/cardValueCheck';

const { values: V } = cli(import.meta.url, {
  decks: str('meta', (v) => (/^[\w.-]+$/.test(v) ? undefined : 'a deck set: meta, all, or a file-name prefix')),
  impact: str('src/data/impact.json'),
  adjusted: str(),
  top: int(4, { min: 1, max: 20 }),
  out: str(undefined, (v) => (v.trim() ? undefined : 'needs a directory')),
  force: bool(),
});

const readJson = <T>(f: string, what: string): T => {
  if (!fs.existsSync(f)) throw new Refusal(`${what} ${f} does not exist`);
  return JSON.parse(fs.readFileSync(f, 'utf8')) as T;
};
const nameOf = (id: string) => (CARD_BY_ID[id] ? cardLabel(CARD_BY_ID[id]!) : id);
const pts = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)}`;

runMain(async () => {
  const lib = loadLibrary();
  const base = (f: string) => f.slice(f.lastIndexOf('/') + 1);
  const field = V.decks === 'meta' ? lib.filter((d) => d.kind === 'meta') : V.decks === 'all' ? lib : lib.filter((d) => base(d.file).startsWith(V.decks));
  if (!field.length) throw new Refusal(`--decks ${V.decks} matches no deck`);
  const outBase = V.out ? path.join(V.out, `card-value-check-${V.decks}`) : null;
  if (outBase && !V.force && ['.json', '.md'].some((x) => fs.existsSync(outBase + x))) throw new Refusal(`${outBase}.json or .md exists; pass --force to overwrite`);
  const impact = readJson<ImpactData>(V.impact, 'impact file');
  const adjusted = V.adjusted ? readJson<{ kind?: string; decks: AdjustedDeck[] }>(V.adjusted, 'adjusted file') : null;
  if (adjusted && adjusted.kind !== 'impact-adjusted') throw new Refusal(`${V.adjusted} is not an impact-adjusted report (sim analyze --impact-adjusted)`);

  const sources = ['plain IWD', ...(adjusted ? ['adjusted (shrunk)', 'kept vs sold (shrunk)'] : [])];
  const rows: { deck: string; file: string; checks: Record<string, ValueCheck | null> }[] = [];
  for (const d of field) {
    const ref = { name: d.deck.name, listId: listFingerprint(d.deck) };
    const ids = new Set(d.deck.main);
    const checks: Record<string, ValueCheck | null> = {};
    const entry = findImpactDeck(impact.decks, ref);
    checks['plain IWD'] = entry
      ? checkValues(
          entry.cards
            .filter(([id, iwd, n]) => ids.has(id) && typeof iwd === 'number' && n >= IMPACT_MIN_DECK_GAMES)
            .map(([id, iwd, n]): MeasuredCard => ({ id, name: nameOf(id), value: cardValue(id), measured: iwd!, n })),
          V.top,
        )
      : null;
    if (adjusted) {
      const a = adjusted.decks.find((x) => x.id === ref.listId);
      const cards = a?.cards.filter((c) => ids.has(c.id)) ?? [];
      checks['adjusted (shrunk)'] = a ? checkValues(cards.map((c) => ({ id: c.id, name: c.name, value: cardValue(c.id), measured: c.shrunk, n: c.n1 })), V.top) : null;
      checks['kept vs sold (shrunk)'] = a
        ? checkValues(cards.filter((c) => c.keptVsSold).map((c) => ({ id: c.id, name: c.name, value: cardValue(c.id), measured: c.keptVsSold!.shrunk, n: c.keptVsSold!.kept + c.keptVsSold!.sold })), V.top)
        : null;
    }
    rows.push({ deck: d.deck.name, file: d.file, checks });
  }

  const L: string[] = ['# Hand-written card value against measured impact (INFO-7)', ''];
  L.push(`cardValue (src/ai/knowledge.ts) rank-correlated per deck with: ${sources.join('; ')}. Impact file ${V.impact}${V.adjusted ? `, adjusted file ${V.adjusted}` : ''}.`, '');
  L.push(`| Deck | ${sources.map((s) => `rho ${s} (cards)`).join(' | ')} |`, `|---|${sources.map(() => '---|').join('')}`);
  for (const r of rows) L.push(`| ${r.deck} | ${sources.map((s) => (r.checks[s] ? `${r.checks[s]!.rho.toFixed(2)} (${r.checks[s]!.cards})` : 'no data')).join(' | ')} |`);
  const mean = (s: string) => {
    const xs = rows.map((r) => r.checks[s]?.rho).filter((x): x is number => x !== undefined && Number.isFinite(x));
    return xs.length ? `${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)} over ${xs.length} decks` : 'no data';
  };
  L.push('', `Mean rho: ${sources.map((s) => `${s} ${mean(s)}`).join('; ')}.`, '');
  const fmt = (c: ValueCheck['overrated'][number]) => `${c.name} (value ${c.value.toFixed(1)}, percentile ${Math.round(100 * c.pValue)}; measured ${pts(c.measured)} pts, percentile ${Math.round(100 * c.pMeasured)}; n ${c.n})`;
  for (const r of rows) {
    L.push(`## ${r.deck}`, '');
    for (const s of sources) {
      const c = r.checks[s];
      if (!c) {
        L.push(`- ${s}: no data for this list.`);
        continue;
      }
      L.push(`- ${s}, rho ${c.rho.toFixed(2)} over ${c.cards} cards.`);
      if (c.overrated.length) L.push(`  - Formula high, measured low: ${c.overrated.map(fmt).join('; ')}.`);
      if (c.underrated.length) L.push(`  - Formula low, measured high: ${c.underrated.map(fmt).join('; ')}.`);
    }
    L.push('');
  }
  const md = L.join('\n');
  console.log(md);
  if (outBase) {
    fs.mkdirSync(path.dirname(outBase), { recursive: true });
    fs.writeFileSync(`${outBase}.json`, JSON.stringify({ kind: 'card-value-check', date: new Date().toISOString(), impact: V.impact, adjusted: V.adjusted ?? null, decks: rows }, null, 1));
    fs.writeFileSync(`${outBase}.md`, md);
    console.log(`Saved ${outBase}.json and .md`);
  }
});
