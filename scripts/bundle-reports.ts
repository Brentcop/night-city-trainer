// Bundle per-deck report data from reports/ into src/data/deckReports.json for the deck profile page.
//   npx tsx scripts/bundle-reports.ts
// Sources (all optional per deck):
//   reports/test-<slug>-latest.json            finals vs the meta archetypes
//   reports/vs-<a>-<b>-latest.json             large head-to-heads (normalised to each deck's perspective)
//   reports/forge/<slug>.json (or .md)         forge log: generations, swaps tried, adopted changes
//   reports/optimize-<slug>[-vs-<opp>]-latest.json (or .md)  optimizer suggestions (stage-2 table)
// The JSON twins are written by forge.ts / optimize.ts; the Markdown is parsed only for reports made before them.
// Output is deterministic: directory listings are sorted, and a finals date comes from the report itself (older
// reports without one keep the date already bundled; file times are the last resort). Unchanged output is not rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { cli, loadLibrary, writeIfChanged } from './lib-node';

cli(import.meta.url, {});

const R = 'reports';
const lib = loadLibrary();
const bySlug = new Map(lib.map((d) => [d.file.replace(/\.txt$/, ''), d]));
const byName = new Map(lib.map((d) => [d.deck.name, d]));
// longest slugs first so "s2-08-explorer-rrg-eor" wins over "s2-08-explorer-rrg"
const slugs = [...bySlug.keys()].sort((a, b) => b.length - a.length);
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(R, f), 'utf8'));

interface Rec {
  /** games won/played split by seat; w counts ties as half */
  g: number;
  w: number;
  ties: number;
  fw: number;
  fg: number;
  sw: number;
  sg: number;
  turns?: number;
  ot?: number;
}
interface H2H extends Rec {
  opp: string;
  oppFile?: string;
}
interface ForgeGen {
  gen: number;
  baseline: number | null;
  swaps: { swap: string; wr: number; delta: number }[];
  confirm?: string;
  verdict: 'adopted' | 'rejected' | 'kept';
}
interface DeckReports {
  finals?: { overall: number; games: number; date?: string; rows: H2H[] };
  h2h?: H2H[];
  forge?: { field?: string; gens: ForgeGen[]; summary: { gen: number; wr: number | null; change: string }[] };
  optimize?: { vs: string; baseline: number | null; rows: { change: string; s1: number | null; s2: number | null; delta: number }[] }[];
}
const out: Record<string, DeckReports> = {};
const get = (file: string) => (out[file] ??= {});
const fileOf = (name: string) => byName.get(name)?.file;
const num = (s: string | undefined) => {
  const v = parseFloat(s ?? '');
  return Number.isFinite(v) ? v : null;
};

function rec(t: any, flip: boolean): Rec {
  const g = t.games ?? 0;
  const aW = flip ? t.bWins : t.aWins;
  const ties = t.ties ?? 0;
  // seat split for B: its own win counts when the report has them; older reports only have A's, and the complement
  // there also counts ties as B wins
  const fg = flip ? t.aSecondGames : t.aFirstGames;
  const sg = flip ? t.aFirstGames : t.aSecondGames;
  const fw = flip ? t.bFirstWins ?? (t.aSecondGames ?? 0) - (t.aSecondWins ?? 0) : t.aFirstWins;
  const sw = flip ? t.bSecondWins ?? (t.aFirstGames ?? 0) - (t.aFirstWins ?? 0) : t.aSecondWins;
  return { g, w: r3((aW + ties / 2) / Math.max(1, g)), ties, fw: fw ?? 0, fg: fg ?? 0, sw: sw ?? 0, sg: sg ?? 0, turns: t.turns ? r3(t.turns / Math.max(1, g)) : undefined, ot: t.overtime };
}

const files = fs.readdirSync(R).sort();
const OUT = 'src/data/deckReports.json';
const previous: Record<string, DeckReports> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

// ---- finals (test-*-latest.json)
for (const f of files.filter((x) => /^test-.+-latest\.json$/.test(x))) {
  const slug = f.slice(5, -'-latest.json'.length);
  const d = bySlug.get(slug);
  if (!d) continue;
  const t = readJson(f);
  const rows: H2H[] = (t.rows ?? []).map((r: any) => ({ opp: r.b, oppFile: fileOf(r.b), ...rec(r, false) }));
  get(d.file).finals = {
    overall: r3(t.overall),
    games: rows.reduce((a, r) => a + r.g, 0),
    date: (t.date as string | undefined)?.slice(0, 10) ?? previous[d.file]?.finals?.date ?? fs.statSync(path.join(R, f)).mtime.toISOString().slice(0, 10),
    rows,
  };
}

// ---- head-to-heads (vs-*-latest.json), from both decks' perspectives
for (const f of files.filter((x) => /^vs-.+-latest\.json$/.test(x))) {
  const t = readJson(f);
  if (!t.a || !t.b || t.a === t.b) continue; // mirror matches tell us nothing per deck
  for (const [me, opp, flip] of [
    [t.a, t.b, false],
    [t.b, t.a, true],
  ] as const) {
    const file = fileOf(me);
    if (!file) continue;
    const list = (get(file).h2h ??= []);
    list.push({ opp, oppFile: fileOf(opp), ...rec(t, flip) });
  }
}

// ---- forge logs
const pctOf = (s: string) => num(s.replace('%', ''));
const forgeFiles = fs.existsSync(path.join(R, 'forge')) ? fs.readdirSync(path.join(R, 'forge')).sort() : [];
for (const f of forgeFiles.filter((x) => x.endsWith('.json'))) {
  const d = bySlug.get(f.replace(/\.json$/, ''));
  if (!d) continue;
  const j = JSON.parse(fs.readFileSync(path.join(R, 'forge', f), 'utf8'));
  if (j.gens?.length || j.summary?.length) get(d.file).forge = { field: j.field, gens: j.gens ?? [], summary: j.summary ?? [] };
}
for (const f of forgeFiles.filter((x) => x.endsWith('.md'))) {
  const slug = f.replace(/\.md$/, '');
  const d = bySlug.get(slug);
  if (!d || forgeFiles.includes(`${slug}.json`)) continue;
  const text = fs.readFileSync(path.join(R, 'forge', f), 'utf8');
  const field = text.match(/^Field: (.+)$/m)?.[1];
  const gens: ForgeGen[] = [];
  const parts = text.split(/^## /m).slice(1);
  const summary: { gen: number; wr: number | null; change: string }[] = [];
  for (const p of parts) {
    const head = p.split('\n')[0];
    const gm = head.match(/^Generation (\d+) — baseline ([\d.]+)%/);
    if (gm) {
      const swaps = p
        .split('\n')
        .filter((l) => /^\| -\d/.test(l))
        .map((l) => l.split('|').map((x) => x.trim()))
        .map((c) => ({ swap: c[1], wr: num(c[2].replace('%', '')) ?? 0, delta: num(c[3]) ?? 0 }))
        .slice(0, 5);
      const conf = p.match(/^Confirmation (.+?) → \*\*(\w+)\*\*/m);
      const verdict: ForgeGen['verdict'] = conf ? (conf[2] === 'adopted' ? 'adopted' : 'rejected') : 'kept';
      gens.push({ gen: +gm[1], baseline: num(gm[2]), swaps, confirm: conf?.[1], verdict });
    } else if (head.startsWith('Summary')) {
      for (const l of p.split('\n').filter((l) => /^\| \d+ \|/.test(l))) {
        const c = l.split('|').map((x) => x.trim());
        summary.push({ gen: +c[1], wr: pctOf(c[2]), change: c[3] });
      }
    }
  }
  if (gens.length || summary.length) get(d.file).forge = { field, gens, summary };
}

// ---- optimizer reports
for (const f of files.filter((x) => /^optimize-.+-latest\.(md|json)$/.test(x))) {
  const isJson = f.endsWith('.json');
  if (!isJson && files.includes(f.replace(/\.md$/, '.json'))) continue; // the JSON twin wins
  const rest = f.slice('optimize-'.length, isJson ? -'-latest.json'.length : -'-latest.md'.length);
  const slug = slugs.find((s) => rest === s || rest.startsWith(`${s}-vs-`));
  if (!slug) continue;
  const oppSlug = rest.length > slug.length ? rest.slice(slug.length + 4) : '';
  const vs = oppSlug ? bySlug.get(oppSlug)?.deck.name ?? oppSlug : 'meta field';
  if (isJson) {
    const j = JSON.parse(fs.readFileSync(path.join(R, f), 'utf8')) as { baseline: number | null; rows: { change: string; s1: number | null; s2: number | null; delta: number }[] };
    const rows = [...j.rows].sort((a, b) => b.delta - a.delta).slice(0, 6);
    (get(bySlug.get(slug)!.file).optimize ??= []).push({ vs, baseline: j.baseline, rows });
    continue;
  }
  const text = fs.readFileSync(path.join(R, f), 'utf8');
  const baseline = pctOf(text.match(/Baseline win rate \(stage 2\): \*\*([\d.]+)%/)?.[1] ?? '');
  const rows = text
    .split('\n')
    .filter((l) => /^\| [^|]+ \| [\d.]+% \| [\d.]+% \| [+-][\d.]+ \|$/.test(l))
    .map((l) => l.split('|').map((x) => x.trim()))
    .map((c) => ({ change: c[1], s1: pctOf(c[2]), s2: pctOf(c[3]), delta: num(c[4]) ?? 0 }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 6);
  (get(bySlug.get(slug)!.file).optimize ??= []).push({ vs, baseline, rows });
}

const changed = writeIfChanged(OUT, JSON.stringify(out));
console.log(`deckReports.json: ${Object.keys(out).length} decks, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB${changed ? '' : ' (unchanged)'}`);
