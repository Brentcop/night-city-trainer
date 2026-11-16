// The evidence page's view of the findings files (src/ui/pages/Evidence.tsx, docs/EVIDENCE.md "The page"): routes and
// links, the order of each list, the at-a-glance facts, which section holds a finding a link points at, a shared scale for
// a list's range bars, and card names for the changes. Pure and light: it reads the plain data of public/data/evidence/
// through the types of src/lib/findings.ts and never the engine, the bots or the simulator.
import { STRENGTHS, type ChangeSubject, type DeckEvidence, type EvidenceIndex, type Finding, type FindingKind, type OpenQuestion, type Strength, type ToolHealth } from './findings';
import { TITLE_WORDS } from './findingWords';
import { hash64 } from './stateHash';

export const isListId = (s: string): boolean => /^[0-9a-f]{16}$/.test(s);

/** The 8-hex short id in a pasted text ("F:9f3a2c1d", "[F:9f3a2c1d]", a whole cite line, or the bare 8 or 16 hex digits), or null. */
export function parseCite(text: string): string | null {
  const t = text.trim().toLowerCase();
  const tagged = /\[?f:([0-9a-f]{8})(?![0-9a-f])/.exec(t);
  if (tagged) return tagged[1] ?? null;
  const plain = /^([0-9a-f]{8})(?:[0-9a-f]{8})?$/.exec(t);
  return plain ? (plain[1] ?? null) : null;
}

/** A run's token in its link: stable (a hash of the run's id, never its position in the file). */
export const runToken = (runId: string): string => hash64(`run\u0001${runId}`).slice(0, 8);

export const overviewHref = '#/evidence';
export const deckEvidenceHref = (listId: string): string => `#/evidence/${listId}`;
export const findingHref = (listId: string, short: string): string => `#/evidence/${listId}?f=${short}`;
export const runHref = (listId: string, runId: string): string => `#/evidence/${listId}/run/${runToken(runId)}`;
/** The element id of a finding's row. */
export const rowId = (short: string): string => `f-${short}`;

export type EvidenceRoute =
  | { view: 'overview'; f: string | null; d: string | null }
  | { view: 'deck'; listId: string; f: string | null }
  | { view: 'run'; listId: string; token: string }
  | { view: 'unknown'; listId: string };

/** The route under #/evidence: `sub` is the path after it, `q` its query. */
export function parseEvidenceRoute(sub: string, q: URLSearchParams): EvidenceRoute {
  const parts = sub.split('/').filter(Boolean);
  const f = q.get('f');
  if (!parts.length) return { view: 'overview', f: f || null, d: q.get('d') || null };
  const listId = (parts[0] ?? '').toLowerCase();
  if (!isListId(listId)) return { view: 'unknown', listId: parts[0] ?? '' };
  if (parts.length === 1) return { view: 'deck', listId, f: f || null };
  if (parts[1] === 'run' && parts.length === 3) return { view: 'run', listId, token: (parts[2] ?? '').toLowerCase() };
  return { view: 'unknown', listId };
}

export const STRENGTH_RANK: Readonly<Record<Strength, number>> = Object.fromEntries(STRENGTHS.map((s, i) => [s, i])) as Record<Strength, number>;
/** Strong and moderate may be emphasised, and never when stale. */
export const emphasised = (f: Pick<Finding, 'strength' | 'simVersion'>, current: number): boolean => (f.strength === 'strong' || f.strength === 'moderate') && f.simVersion === current;

/** What a family's rows are, from its key ("<list>:cards" → "cards"; the cross-deck families are "decks"). */
export function familyNoun(key: string): string {
  if (key.startsWith('all:')) return 'decks';
  const tail = key.slice(key.lastIndexOf(':') + 1);
  const nouns: Readonly<Record<string, string>> = { matchups: 'matchups', 'direct-matchups': 'direct matchups', cards: 'cards', packages: 'packages', endings: 'endings' };
  return nouns[tail] ?? 'findings';
}

/** A finding of a deck file by its short id (or whole id). */
export function findByShort(deck: Pick<DeckEvidence, 'findings'>, short: string | null): Finding | null {
  if (!short) return null;
  const s = short.toLowerCase();
  return deck.findings.find((f) => f.short === s || f.id === s) ?? null;
}

// ---------------------------------------------------------------- range bars

/** One shared scale for a list's range bars: every interval and baseline fits, with a little room. */
export function scaleOf(items: readonly { lower: number; upper: number; baseline: number; estimate: number }[], unit: 'rate' | 'points'): [number, number] {
  if (!items.length) return unit === 'rate' ? [0, 1] : [-0.05, 0.05];
  let lo = Math.min(...items.map((x) => Math.min(x.lower, x.baseline, x.estimate)));
  let hi = Math.max(...items.map((x) => Math.max(x.upper, x.baseline, x.estimate)));
  const pad = Math.max((hi - lo) * 0.06, unit === 'rate' ? 0.01 : 0.002);
  lo -= pad;
  hi += pad;
  if (unit === 'rate') {
    lo = Math.max(0, lo);
    hi = Math.min(1, hi);
  }
  return [lo, hi];
}

/** Where a value sits on a scale, in percent of its width (clamped). */
export function placeOf(x: number, [lo, hi]: readonly [number, number]): number {
  if (!(hi > lo)) return 50;
  return Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
}

// ---------------------------------------------------------------- the deck page's lists

export type BlockId = 'strength' | 'matchups' | 'cards' | 'changes' | 'open';
export const BLOCK_OF: Readonly<Record<FindingKind, BlockId>> = {
  'deck-strength': 'strength',
  matchup: 'matchups',
  seat: 'matchups',
  length: 'matchups',
  ending: 'matchups',
  'card-assoc': 'cards',
  'package-assoc': 'cards',
  change: 'changes',
};

/** One opponent: the ratings-based (shrunk) matchup and, for a meta pairing, the direct measurement of the same question. */
export interface Pairing {
  opp: { listId: string; deck: string };
  rated: Finding;
  direct: Finding | null;
}

/** The deck's pairings, worst first (by the ratings-based estimate). */
export function pairingsOf(fs: readonly Finding[]): Pairing[] {
  const direct = new Map(fs.filter((f) => f.kind === 'matchup' && f.method === 'direct-games').map((f) => [f.question, f]));
  return fs
    .filter((f) => f.kind === 'matchup' && f.method !== 'direct-games' && f.subject.opponent)
    .map((rated) => ({ opp: rated.subject.opponent!, rated, direct: direct.get(rated.question) ?? null }))
    .sort((a, b) => a.rated.estimate - b.rated.estimate || a.opp.deck.localeCompare(b.opp.deck));
}

/** How clearly an interval sits away from its baseline: positive when it excludes it, by how far. */
const clearance = (f: Pick<Finding, 'lower' | 'upper' | 'baseline'>) => Math.max(f.lower - f.baseline, f.baseline - f.upper);

/**
 * The `n` clearest pairings, shown before "Show all": half from below even and half from above (the other side fills in
 * when one has too few), each side by how far its range sits from even.
 */
export function clearestPairings(ps: readonly Pairing[], n: number): Set<string> {
  const byClearance = (xs: Pairing[]) => xs.sort((a, b) => clearance(b.rated) - clearance(a.rated) || STRENGTH_RANK[a.rated.strength] - STRENGTH_RANK[b.rated.strength]);
  const below = byClearance(ps.filter((p) => p.rated.estimate < p.rated.baseline));
  const above = byClearance(ps.filter((p) => p.rated.estimate >= p.rated.baseline));
  const half = Math.ceil(n / 2);
  const takeBelow = Math.min(below.length, Math.max(half, n - above.length));
  const best = [...below.slice(0, takeBelow), ...above.slice(0, n - takeBelow)];
  return new Set(best.map((p) => p.rated.question));
}

/** Card or package associations in the order the page lists them: strength first, then the higher reading. */
export const associationOrder = (fs: readonly Finding[]): Finding[] => [...fs].sort((a, b) => STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength] || b.estimate - a.estimate);

const METHOD_ORDER: Readonly<Record<string, number>> = { 'paired-staged': 0, 'paired-pooled': 1, paired: 2 };
const BOT_ORDER: Readonly<Record<string, number>> = { medium: 0, hard: 1 };
/**
 * A change's measurements in date order (on one date and simulator version: the Medium ones before the Hard ones, and for
 * one bot a forge confirmation, the held-out games kept across runs, then a re-measurement, fewer games first).
 */
export const measurementOrder = (a: Finding, b: Finding): number =>
  (a.detail?.date ?? '').localeCompare(b.detail?.date ?? '') ||
  a.simVersion - b.simVersion ||
  (BOT_ORDER[a.bot] ?? 9) - (BOT_ORDER[b.bot] ?? 9) ||
  (METHOD_ORDER[a.method] ?? 9) - (METHOD_ORDER[b.method] ?? 9) ||
  a.games - b.games ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** One change and its measurements (one question). */
export interface ChangeGroup {
  question: string;
  change: ChangeSubject;
  items: Finding[];
}

/** The change findings grouped by question: the change that made the list first, then by the best current reading. */
export function changeGroupsOf(fs: readonly Finding[], current: number): ChangeGroup[] {
  const by = new Map<string, Finding[]>();
  for (const f of fs) if (f.kind === 'change' && f.subject.change) by.set(f.question, [...(by.get(f.question) ?? []), f]);
  const groups = [...by.entries()].map(([question, items]) => {
    const sorted = [...items].sort(measurementOrder);
    // the change as its most recent measurement names it (the tools' labels changed over time)
    const change = (sorted[sorted.length - 1] ?? items[0]!).subject.change!;
    return { question, change, items: sorted };
  });
  const rel = (g: ChangeGroup) => (g.change.relation === 'to-this-list' ? 0 : g.change.relation === 'from-this-list' ? 1 : 2);
  const best = (g: ChangeGroup) => Math.max(...g.items.filter((f) => f.simVersion === current).map((f) => f.estimate), -Infinity);
  return groups.sort((a, b) => rel(a) - rel(b) || best(b) - best(a) || a.change.label.localeCompare(b.change.label));
}

/** A change settled by a current measurement (strong or moderate on its own corrected interval, or a verdict either way). */
export const settledChange = (g: ChangeGroup, current: number): boolean =>
  g.items.some((f) => f.simVersion === current && (f.detail?.verdict === 'adopt' || f.detail?.verdict === 'reject' || ((f.strength === 'strong' || f.strength === 'moderate') && f.corrected)));

/** Open questions in the order the page lists them: held-out games first, then the higher reading. */
export const openOrder = (os: readonly OpenQuestion[]): OpenQuestion[] => [...os].sort((a, b) => Number(b.heldout > 0) - Number(a.heldout > 0) || b.pooled.mean - a.pooled.mean);

// ---------------------------------------------------------------- card names of a change

/** A card id as the catalogue spells it, from a name ("Royce: Don't Call Me Simon" → "royce_don_t_call_me_simon"). */
export const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** Card names written in the tools' labels ("-1 Name → +2 Name", "+3 Name, +1 Name / -2 Name"), by the id their spelling gives. */
export function cardNamesIn(texts: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of texts)
    for (const m of t.matchAll(/(?:^|[\s:(])[+\-−]\d+ ([^,/→()+]+?)(?=\s*(?:,|\/|→|\(|$|\s[+\-−]\d))/g)) {
      const name = (m[1] ?? '').trim();
      if (name && !out.has(slugOf(name))) out.set(slugOf(name), name);
    }
  return out;
}

/** A card's name from the names found, else its id written as words. */
export const nameOf = (id: string, names: ReadonlyMap<string, string>): string =>
  names.get(id) ??
  id
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** One side of a change: a card id, its count, and whether it is a Legend. */
export interface ChangePart {
  id: string;
  n: number;
  legend: boolean;
}

/** A change's cuts and adds by card id, repeats counted, in first-seen order. */
export function changeParts(c: Pick<ChangeSubject, 'cuts' | 'adds' | 'legendCuts' | 'legendAdds'>): { cuts: ChangePart[]; adds: ChangePart[] } {
  const count = (ids: readonly string[], legend: boolean): ChangePart[] => {
    const m = new Map<string, number>();
    for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m.entries()].map(([id, n]) => ({ id, n, legend }));
  };
  return { cuts: [...count(c.legendCuts ?? [], true), ...count(c.cuts, false)], adds: [...count(c.legendAdds ?? [], true), ...count(c.adds, false)] };
}

/** A recorded trial's change key ("<list> -main:a,a +main:b") as cuts and adds, or null when it is not one. */
export function parseChangeKey(key: string | undefined): Pick<ChangeSubject, 'cuts' | 'adds' | 'legendCuts' | 'legendAdds'> | null {
  if (!key) return null;
  const out = { cuts: [] as string[], adds: [] as string[], legendCuts: [] as string[], legendAdds: [] as string[] };
  let any = false;
  for (const seg of key.split(' ').slice(1)) {
    const m = /^([+-])([a-z]+):(.*)$/.exec(seg);
    if (!m) return null;
    const ids = (m[3] ?? '').split(',').filter(Boolean);
    const legend = m[2] === 'legend';
    if (m[1] === '-') (legend ? out.legendCuts : out.cuts).push(...ids);
    else (legend ? out.legendAdds : out.adds).push(...ids);
    any = true;
  }
  return any ? out : null;
}

// ---------------------------------------------------------------- at a glance, and where a link points

/** A fact of the at-a-glance strip, each a finding (or the open questions). */
export type GlanceFact = { kind: 'strength' | 'good' | 'bad' | 'change'; finding: Finding } | { kind: 'open'; count: number; heldout: number };

/** Three to five facts from the deck's own findings. */
export function glanceOf(deck: Pick<DeckEvidence, 'findings' | 'open'>, current: number): GlanceFact[] {
  const out: GlanceFact[] = [];
  const strength = deck.findings.find((f) => f.kind === 'deck-strength');
  if (strength) out.push({ kind: 'strength', finding: strength });
  const rated = pairingsOf(deck.findings).map((p) => p.rated);
  const sure = rated.filter((f) => f.strength === 'strong' || f.strength === 'moderate');
  const good = sure.filter((f) => f.lower > f.baseline).sort((a, b) => b.lower - a.lower)[0];
  const bad = sure.filter((f) => f.upper < f.baseline).sort((a, b) => a.upper - b.upper)[0];
  if (good) out.push({ kind: 'good', finding: good });
  if (bad) out.push({ kind: 'bad', finding: bad });
  const adds = deck.findings
    .filter((f) => f.kind === 'change' && f.simVersion === current && f.corrected && f.estimate > 0 && (f.strength === 'strong' || f.strength === 'moderate'))
    .sort((a, b) => STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength] || (b.p95 ?? [b.lower])[0] - (a.p95 ?? [a.lower])[0])[0];
  if (adds) out.push({ kind: 'change', finding: adds });
  if (deck.open.length) out.push({ kind: 'open', count: deck.open.length, heldout: deck.open.filter((o) => o.heldout > 0).length });
  return out;
}

/** How many pairings the deck page shows before "Show all"; how many rows a short list opens with. */
export const SHOWN_PAIRINGS = 6;
export const SHOWN_SHORT = 5;
/** On a phone the matchup strip opens with this many of the worst and of the best. */
export const STRIP_ENDS = 6;

/** The interval excludes "no difference". */
export const excludesBaseline = (f: Pick<Finding, 'lower' | 'upper' | 'baseline'>): boolean => f.lower > f.baseline || f.upper < f.baseline;

/** How many of an association list (in associationOrder) open shown: every one whose interval excludes no difference, and at least 5. */
export const assocShown = (fs: readonly Finding[]): number => Math.max(SHOWN_SHORT, fs.filter(excludesBaseline).length);

/** A deck with exactly two endings tells one fact twice: the one above the field's share is shown, the other sits in its Details. */
export function endingPair(fs: readonly Finding[]): { shown: Finding; inner: Finding } | null {
  const endings = fs.filter((f) => f.kind === 'ending');
  if (endings.length !== 2) return null;
  const [a, b] = endings as [Finding, Finding];
  return b.estimate - b.baseline > a.estimate - a.baseline ? { shown: b, inner: a } : { shown: a, inner: b };
}

/** What has to be opened to show a finding: its block, the collapsed list that holds it, or the row whose Details hold it. */
export interface FocusPlan {
  finding: Finding | null;
  block: BlockId | null;
  allPairings: boolean;
  allCards: boolean;
  allPackages: boolean;
  /** the short id of the row whose Details hold the finding */
  inDetailsOf: string | null;
}

export function focusPlanOf(deck: Pick<DeckEvidence, 'findings'>, short: string | null): FocusPlan {
  const finding = findByShort(deck, short);
  const none: FocusPlan = { finding: null, block: null, allPairings: false, allCards: false, allPackages: false, inDetailsOf: null };
  if (!finding) return none;
  const plan: FocusPlan = { ...none, finding, block: BLOCK_OF[finding.kind] };
  if (finding.kind === 'matchup') plan.allPairings = !clearestPairings(pairingsOf(deck.findings), SHOWN_PAIRINGS).has(finding.question);
  if (finding.kind === 'card-assoc' || finding.kind === 'package-assoc') {
    const list = associationOrder(deck.findings.filter((f) => f.kind === finding.kind));
    const hidden = !list.slice(0, assocShown(list)).includes(finding);
    if (finding.kind === 'card-assoc') plan.allCards = hidden;
    else plan.allPackages = hidden;
  }
  const pair = endingPair(deck.findings);
  if (pair && pair.inner === finding) plan.inDetailsOf = pair.shown.short;
  return plan;
}

/** Which cells of the matchup strip a phone hides until "Show all": all but the `STRIP_ENDS` worst and best. */
export const stripMiddle = (i: number, n: number): boolean => n > 2 * STRIP_ENDS && i >= STRIP_ENDS && i < n - STRIP_ENDS;

/**
 * A finding's short title (the full claim stays in its cite line and Details): "Against the field", "against <deck>",
 * the card or package, the change, the ending. Read from the subject when the finding has one, else from its claim.
 */
export function shortTitleOf(f: Pick<Finding, 'kind' | 'claim' | 'method'> & { subject?: Finding['subject']; deck?: string }): string {
  const s = f.subject;
  const deck = s?.deck ?? f.deck ?? '';
  const claimAfterDeck = f.claim.startsWith(`${deck}: `) ? f.claim.slice(deck.length + 2) : f.claim;
  switch (f.kind) {
    case 'deck-strength':
      return TITLE_WORDS.strength;
    case 'seat':
      return TITLE_WORDS.seat;
    case 'length':
      return TITLE_WORDS.length;
    case 'matchup': {
      let opp = s?.opponent?.deck;
      if (!opp && f.claim.startsWith(`${deck} against `)) {
        const rest = f.claim.slice(deck.length + ' against '.length);
        opp = rest.slice(0, rest.lastIndexOf(': '));
      }
      return opp ? TITLE_WORDS.against(opp, f.method === 'direct-games') : f.claim;
    }
    case 'ending': {
      const e = s?.ending ?? /ended "(.*)", against/.exec(f.claim)?.[1];
      return e ? TITLE_WORDS.ending(e) : f.claim;
    }
    case 'card-assoc':
      return s?.card?.name ?? /^games where (.*) was drawn were won/.exec(claimAfterDeck)?.[1] ?? f.claim;
    case 'package-assoc':
      return s?.package?.name ?? /^games where (.*) came online were won/.exec(claimAfterDeck)?.[1] ?? f.claim;
    case 'change':
      return s?.change?.label ?? /^(.*) \((?:a change to this list|the change that made this list|a change to an earlier list)\): /.exec(f.claim)?.[1] ?? f.claim;
  }
}

// ---------------------------------------------------------------- the index

/** The index's decks by list id. */
export const decksById = (ix: Pick<EvidenceIndex, 'decks'> | null): Map<string, EvidenceIndex['decks'][number]> => new Map((ix?.decks ?? []).map((d) => [d.listId, d]));

/** How much higher screening has read than held-out games, for a change measured this way: the ledger's runs for a ledger change, the forge's for a forge confirmation. */
export function screenCurseOf(health: readonly ToolHealth[], method: Finding['method']): { mean: number; n: number } | null {
  const tool = method === 'paired-pooled' ? 'ledger runs' : 'forge';
  const h = health.find((x) => x.tool === tool && x.screenMinusHeldOut) ?? health.find((x) => x.screenMinusHeldOut);
  return h?.screenMinusHeldOut ?? null;
}

/** A tool record's key: its tool, simulator version and bots (one record each, docs/EVIDENCE.md "The index"). */
export const healthKey = (h: Pick<ToolHealth, 'tool' | 'simVersion' | 'bot' | 'confirmBot'>): string => [h.tool, h.simVersion ?? '', h.bot ?? '', h.confirmBot ?? ''].join('\u0001');

/**
 * The tool records that speak to this deck's screening figures: those of the same simulator version, screening bot
 * and held-out bot as a change finding of the deck that shows one (its `detail.screen`, whose `bot` is the screening
 * bot when another bot played the held-out games). An index built before records had a context: every record with a
 * figure.
 */
export function screenCurseRows(health: readonly ToolHealth[], findings: readonly Finding[]): ToolHealth[] {
  const rows = health.filter((h) => h.screenMinusHeldOut);
  if (!rows.some((h) => h.simVersion !== undefined)) return rows;
  const ctx = new Set(findings.flatMap((f) => (f.kind === 'change' && f.detail?.screen ? [[f.simVersion, f.detail.screen.bot ?? f.bot, f.bot].join('\u0001')] : [])));
  return rows.filter((h) => h.bot !== undefined && ctx.has([h.simVersion, h.bot, h.confirmBot ?? h.bot].join('\u0001')));
}

/** An opponent named by list id (per-opponent figures) as a deck name, through the index; the id itself otherwise. */
export const oppName = (opp: string, byId: ReadonlyMap<string, { deck: string }>): string => byId.get(opp)?.deck ?? opp;
