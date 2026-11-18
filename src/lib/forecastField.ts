// The field a regionals forecast is run on (src/lib/forecast.ts; docs/FORECAST.md "The field"): always an input, never
// a hidden assumption, and always named with its source. Three ways in, all pure:
//   - uniform: every rated library deck the same weight, "no information about what people play";
//   - your list: `deck name: weight` lines (the page's box, or a text or JSON file on the command line); a deck not
//     named weighs 0; a name that is not a rated deck is listed as left out with its weight;
//   - an outside source's shares (src/lib/outsideMeta.ts `outsideFieldShares`, only when src/data/outsideMeta.json is
//     in the build): a Legend trio's share split equally among the library decks of that trio.
// Weight the forecast cannot place (a name we have no rating for, a trio the library does not play, the part of the
// source's field it does not break down by trio) is LEFT OUT, never given to a stand-in deck: we know nothing about the
// strength of decks we have not rated, so the forecast's field is the placed part renormalised, and the page says how
// much was left out. Reading it that way assumes the left-out players do not change who the placed decks meet.
import { outsideFieldShares, sourceTitle, type FieldDeck, type OutsideSource } from './outsideMeta';

export type FieldKind = 'uniform' | 'user' | 'outside';

export interface ForecastFieldInput {
  kind: FieldKind;
  /** what the field is, in a few words */
  label: string;
  /** where its weights come from: 'assumed', 'your list', or the outside source with its date */
  source: string;
  /** one weight per model deck (in the model's order), normalised to sum to 1 */
  weights: number[];
  /** input weight the forecast could not place, with why (in the input's own units, and as a share of its total) */
  leftOut: { name: string; weight: number; share: number; why: string }[];
  /** the share of the input's whole field left out (0–1) */
  leftOutShare: number;
  /** problems with the input that did not stop it (a line that could not be read, a name given twice) */
  problems: string[];
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Every rated deck the same weight. */
export function uniformField(names: readonly string[]): ForecastFieldInput {
  return {
    kind: 'uniform',
    label: `Uniform: each of the ${names.length} rated library decks equally often`,
    source: 'assumed (no information about what people play)',
    weights: names.map(() => 1 / names.length),
    leftOut: [],
    leftOutShare: 0,
    problems: [],
  };
}

/** Build a field from weights by deck name (exact name first, then ignoring case and spacing). */
export function fieldFromWeights(names: readonly string[], given: readonly { name: string; weight: number }[], o: { kind: FieldKind; label: string; source: string; problems?: string[] }): ForecastFieldInput {
  const exact = new Map(names.map((n, k) => [n, k]));
  const loose = new Map(names.map((n, k) => [norm(n), k]));
  const w = names.map(() => 0);
  const problems = [...(o.problems ?? [])];
  const left: { name: string; weight: number; why: string }[] = [];
  const seen = new Set<number>();
  let total = 0;
  for (const g of given) {
    if (!(Number.isFinite(g.weight) && g.weight >= 0)) {
      problems.push(`${g.name}: the weight must be a number of 0 or more`);
      continue;
    }
    total += g.weight;
    const k = exact.get(g.name) ?? loose.get(norm(g.name));
    if (k === undefined) {
      if (g.weight > 0) left.push({ name: g.name, weight: g.weight, why: 'not a rated library deck' });
      continue;
    }
    if (seen.has(k)) problems.push(`${names[k]} is given more than once; the weights are added`);
    seen.add(k);
    w[k]! += g.weight;
  }
  const placed = w.reduce((a, x) => a + x, 0);
  if (!(placed > 0)) throw new FieldError(left.length ? `no deck of the field is a rated library deck (${left.map((x) => x.name).slice(0, 3).join(', ')}…)` : 'the field gives no deck a weight above 0', problems);
  return {
    kind: o.kind,
    label: o.label,
    source: o.source,
    weights: w.map((x) => x / placed),
    leftOut: left.map((x) => ({ ...x, share: total ? x.weight / total : 0 })),
    leftOutShare: total ? (total - placed) / total : 0,
    problems,
  };
}

export class FieldError extends Error {
  problems: string[];
  constructor(message: string, problems: string[] = []) {
    super(message);
    this.problems = problems;
  }
}

/**
 * Read `deck name: weight` lines. The weight is after the LAST colon (deck names may hold one, "Ladder S1 #2: V / …"),
 * an equals sign or a tab; a trailing % is allowed (weights are relative either way). Blank lines and lines starting
 * with # are skipped.
 */
export function parseFieldText(text: string): { given: { name: string; weight: number }[]; problems: string[] } {
  const given: { name: string; weight: number }[] = [];
  const problems: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = /^(.*?)\s*(?::|=|\t)\s*([0-9]*\.?[0-9]+(?:e[-+]?\d+)?)\s*%?$/i.exec(line);
    const name = m?.[1]?.trim();
    if (!m || !name) {
      problems.push(`line ${i + 1}: not read ("${line.slice(0, 60)}"); write it as  deck name: weight`);
      return;
    }
    given.push({ name, weight: Number(m[2]) });
  });
  return { given, problems };
}

/** Your field from lines of text. */
export function userField(names: readonly string[], text: string, label = 'Your field'): ForecastFieldInput {
  const { given, problems } = parseFieldText(text);
  if (!given.length) throw new FieldError('the field lists no deck: write one  deck name: weight  per line', problems);
  return fieldFromWeights(names, given, { kind: 'user', label, source: 'your list', problems });
}

/**
 * A field from a JSON document (the command line's --field FILE): `{ "weights": { "<deck>": 3, … } }`, the same object
 * without the wrapper, or a list `[{ "deck": "<deck>", "weight": 3 }, …]`; an optional `label` and `source` say what it
 * is (default: the file's name and "your file").
 */
export function jsonField(names: readonly string[], json: unknown, fallbackLabel: string): ForecastFieldInput {
  const problems: string[] = [];
  let given: { name: string; weight: number }[] = [];
  let label = fallbackLabel;
  let source = 'your file';
  const obj = json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  if (obj && typeof obj.label === 'string') label = obj.label.slice(0, 120);
  if (obj && typeof obj.source === 'string') source = obj.source.slice(0, 160);
  const body = obj && obj.weights !== undefined ? obj.weights : json;
  if (Array.isArray(body))
    given = body.flatMap((x, i) => {
      const r = x as { deck?: unknown; name?: unknown; weight?: unknown };
      const name = typeof r?.deck === 'string' ? r.deck : typeof r?.name === 'string' ? r.name : null;
      if (!name || typeof r.weight !== 'number') {
        problems.push(`entry ${i + 1}: needs a deck (text) and a weight (number)`);
        return [];
      }
      return [{ name, weight: r.weight }];
    });
  else if (body && typeof body === 'object')
    given = Object.entries(body as Record<string, unknown>).flatMap(([name, weight]) => {
      if (name === 'label' || name === 'source') return [];
      if (typeof weight !== 'number') {
        problems.push(`${name}: the weight must be a number`);
        return [];
      }
      return [{ name, weight }];
    });
  else throw new FieldError('the field file must be a JSON object of deck weights or a list of { deck, weight }');
  if (!given.length) throw new FieldError('the field file names no deck', problems);
  return fieldFromWeights(names, given, { kind: 'user', label, source, problems });
}

/**
 * An outside source's field (src/lib/outsideMeta.ts): each library deck weighs its Legend trio's share split equally
 * among the library's decks of that trio; the share of trios the library does not play and of the part the source does
 * not break down by trio is left out, and so is the weight of a library deck without a rating.
 */
export function outsideField(names: readonly string[], library: readonly FieldDeck[], source: OutsideSource): ForecastFieldInput {
  const rated = new Set(names);
  const shares = outsideFieldShares(library, source);
  const given = shares.decks.filter((d) => d.weight > 0).map((d) => ({ name: d.name, weight: d.weight }));
  const left: { name: string; weight: number; share: number; why: string }[] = [];
  for (const d of shares.decks) if (d.weight > 0 && !rated.has(d.name)) left.push({ name: d.name, weight: d.weight, share: d.weight / 100, why: 'a library deck with no rating' });
  for (const u of shares.uncovered) left.push({ name: u.trio.names.join(' / '), weight: u.share, share: u.share / 100, why: 'a Legend trio the library does not play' });
  if (shares.unlisted > 0) left.push({ name: 'Not broken down by trio', weight: shares.unlisted, share: shares.unlisted / 100, why: 'the source does not name these decks' });
  const placed = given.filter((g) => rated.has(g.name));
  if (!placed.length) throw new FieldError('no rated library deck plays a trio this source lists');
  const placedShare = placed.reduce((a, g) => a + g.weight, 0);
  const w = names.map(() => 0);
  for (const g of placed) w[names.indexOf(g.name)] = g.weight / placedShare;
  const title = sourceTitle(source);
  return {
    kind: 'outside',
    label: `${title}: its field by Legend trio, split equally among our decks of each trio`,
    source: `${source.site}, ${title}, collected ${source.collected}`,
    weights: w,
    leftOut: left,
    leftOutShare: Math.max(0, Math.min(1, 1 - placedShare / 100)),
    problems: [],
  };
}

/** The field's weights as text lines (to start editing from, or to save). */
export function fieldText(names: readonly string[], weights: readonly number[], digits = 2): string {
  return names
    .map((n, k) => ({ n, w: weights[k] ?? 0 }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w || a.n.localeCompare(b.n))
    .map((x) => `${x.n}: ${(100 * x.w).toFixed(digits)}`)
    .join('\n');
}
