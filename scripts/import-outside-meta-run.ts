// The command-line step of the outside picture (scripts/import-outside-meta.ts, docs/DECK_IMPORT.md "The outside meta"):
// read the raw file tools/import_outside_meta.py wrote, check it with src/lib/outsideMeta.ts, carry the previous tracked
// file forward (mergeOutside) and write the tracked file. The file system is real; the output and the Legend cards are
// handed in, so the tests run it on a temporary folder.
import fs from 'node:fs';
import path from 'node:path';
import { ArgError, bool, parseArgs, str, usageOf } from './lib-node';
import { cleanText } from '../src/lib/cleanText';
import { mergeOutside, OUTSIDE_FILE, OUTSIDE_KIND, outsideChanges, outsideLink, outsideMetaProblems, readOutsideImport, sourceId, type LegendCard, type OutsideMetaFile } from '../src/lib/outsideMeta';

export interface ImportOutsideIO {
  out: (line: string) => void;
  err: (line: string) => void;
  legends: () => readonly LegendCard[];
}

const FLAGS = { out: str(OUTSIDE_FILE), previous: str(), merge: bool(), fresh: bool(), force: bool(), summary: str() };

class Refusal extends Error {}

/** The tracked file's text: JSON indented by one space, with a final newline (like the other files in src/data). */
export const outsideFileText = (f: OutsideMetaFile): string => `${JSON.stringify(f, null, 1)}\n`;

export function importOutsideCommand(argv: string[], io: ImportOutsideIO): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./import-outside-meta.ts', import.meta.url).href));
    return 0;
  }
  try {
    return run(argv, io);
  } catch (e) {
    if (e instanceof Refusal || e instanceof ArgError) {
      io.err(`error: ${e.message.replace(/\.$/, '')}.`);
      io.err('Run with --help for usage.');
      return 2;
    }
    throw e;
  }
}

/** Why each report of the raw file was not read, by source id: its link's status and note, as the script recorded them. */
function whyNotRead(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const v = JSON.parse(raw) as { links?: unknown };
    for (const l of Array.isArray(v.links) ? v.links.slice(0, 50) : []) {
      if (!l || typeof l !== 'object') continue;
      const { link, status, note } = l as Record<string, unknown>;
      const href = outsideLink(link);
      if (!href || !/\/meta\/[a-z0-9-]+\/?$/.test(new URL(href).pathname)) continue;
      const s = cleanText(status, 20);
      if (s === 'fetched' || s === 'saved') continue;
      out.set(sourceId(href), `${s || 'not read'}${cleanText(note, 160) ? `: ${cleanText(note, 160)}` : ''}`);
    }
  } catch {
    /* the reader has refused this file already */
  }
  return out;
}

const samePath = (a: string, b: string) => (process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));

function run(argv: string[], io: ImportOutsideIO): number {
  const { values: V, positionals } = parseArgs(FLAGS, argv, { minPositionals: 1, maxPositionals: 1 });
  if (V.merge && V.fresh) throw new Refusal('--merge carries the previous file forward and --fresh does not; give one');
  const input = positionals[0]!;
  let raw: string;
  try {
    raw = fs.readFileSync(input, 'utf8');
  } catch {
    throw new Refusal(`cannot read ${input}`);
  }
  const legends = io.legends();
  const legendIds = new Set(legends.map((l) => l.id));
  const isLegend = (id: string) => legendIds.has(id);
  const read = readOutsideImport(raw, legends);
  if (!read.ok) throw new Refusal(read.why);

  // the previous tracked file: carried forward unless --fresh; it must pass the check:data rules itself
  const prevPath = V.previous ?? V.out;
  let previous: OutsideMetaFile | null = null;
  if (V.previous !== undefined && !fs.existsSync(V.previous)) throw new Refusal(`--previous ${V.previous} does not exist`);
  if (fs.existsSync(prevPath)) {
    let v: unknown;
    try {
      v = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
    } catch {
      v = undefined;
    }
    const problems = v === undefined ? ['it is not JSON'] : outsideMetaProblems(v, isLegend);
    if (problems.length && !(V.fresh && V.force)) throw new Refusal(`the previous file ${prevPath} is not a sound outside-meta file (${problems.slice(0, 3).join('; ')}); fix it, or pass --fresh --force to replace it without carrying it forward`);
    if (!problems.length) previous = v as OutsideMetaFile;
  }
  const merged = V.fresh ? { file: mergeOutside(null, read.file).file, notes: [] } : mergeOutside(previous, read.file, whyNotRead(raw));
  const file = merged.file;
  const text = outsideFileText(file);
  // never write a file the site's own check would refuse
  const problems = outsideMetaProblems(JSON.parse(text), isLegend);
  if (problems.length) throw new Refusal(`the result would not pass check:data (${problems.slice(0, 3).join('; ')}); nothing was written`);

  io.out(`${input}: ${read.file.sources.length} report${read.file.sources.length === 1 ? '' : 's'} read.`);
  for (const s of read.file.sources) {
    const rows = s.kind === 'season' ? `${s.tiers.length} ranked decks, ${s.matchups.length} matchup cells` : `${s.topCut.length} top-cut places`;
    io.out(`  ${s.title} (${s.link}): ${s.field.length} trios in the field (${s.field.reduce((a, r) => a + r.share, 0).toFixed(1)}% of ${s.shareOf}), ${rows}; collected ${s.collected}${s.published ? `, published ${s.published}` : ''}.`);
  }
  for (const w of read.warnings) io.out(`  ${w}`);
  if (merged.notes.length) {
    io.out(previous ? `Carried forward from ${prevPath}:` : 'Kept:');
    for (const n of merged.notes) io.out(`  ${n}`);
  }

  const exists = fs.existsSync(V.out);
  let before: OutsideMetaFile | null = null;
  let beforeText = '';
  if (exists) {
    beforeText = fs.readFileSync(V.out, 'utf8');
    try {
      const b = JSON.parse(beforeText) as Partial<OutsideMetaFile>;
      before = b && b.kind === OUTSIDE_KIND && Array.isArray(b.sources) ? (b as OutsideMetaFile) : null;
    } catch {
      before = null;
    }
  }
  const changes = outsideChanges(before, file);
  const summary = (lines: string[]) => {
    if (V.summary) fs.appendFileSync(V.summary, `${lines.join('\n')}\n\n`);
  };
  const noteLines = merged.notes.map((n) => `- ${md(n)}`);
  io.out('');
  if (exists && beforeText === text) {
    io.out(`${V.out} already holds these figures; nothing to write.`);
    summary(['### Outside meta: no change', '', `The reports read hold the same figures as ${md(V.out)}; nothing to commit.`, ...(noteLines.length ? ['', ...noteLines] : [])]);
    return 0;
  }
  io.out(changes.length ? `What changed${exists ? ` against ${V.out}` : ''}:` : 'No figure changed.');
  for (const c of changes) io.out(`  ${c}`);
  // replacing a file: --force, or --merge onto the very file it carried forward (it only ever takes newer readings)
  const mayReplace = V.force || (V.merge && samePath(V.out, prevPath) && previous !== null);
  if (exists && !mayReplace) {
    io.out('');
    io.err(`error: ${V.out} exists already; pass --merge to carry it forward and replace it, or --force to replace it.`);
    return 2;
  }
  fs.mkdirSync(path.dirname(path.resolve(V.out)), { recursive: true });
  const tmp = `${V.out}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, V.out);
  io.out('');
  io.out(`Wrote ${V.out}. Next: npm run check:data, then look at a deck page and Power ratings → The outside picture.`);
  summary(['### Outside meta: what changed', '', ...(changes.length ? changes.map((c) => `- ${md(c)}`) : ['- No figure changed (the file was rewritten).']), ...(noteLines.length ? ['', 'Carried forward:', '', ...noteLines] : [])]);
  return 0;
}

/** Text for a Markdown summary: no markup, no control characters, capped (the figures and titles come from another site). */
function md(s: string): string {
  return cleanText(s, 300)
    .replace(/[<>`|*_[\]\\#!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
