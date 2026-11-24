// The evidence page (#/evidence; src/ui/pages/Evidence.tsx, docs/EVIDENCE.md "The page"), rendered to static markup
// from small fixtures, with fetch stubbed for the loaders: the overview's three lists apart, the tools' record without
// a missing figure, a deck's five blocks in order and the honesty rules of their rows (no causal word in an association
// row, no bold number for "not enough games", stale rows greyed with their version, screening named as screening, a
// change's measurements under one question with the drift line, how many more games an open question needs), a finding
// link (highlight, focus, the collapsed list opened), a pasted cite id, the cite control, the matchup strip, the plain
// sentences for what cannot be shown, the owner's switch, and the import graph. Also a smoke pass over the real files.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  NATURE_OF,
  shortIdDeck,
  type DeckEvidence,
  type DeckRuns,
  type EvidenceIds,
  type EvidenceIndex,
  type Finding,
  type FindingKind,
  type FindingRef,
  type OpenQuestion,
  type RunRecord,
  type Strength,
} from '../src/lib/findings';
import {
  botsWords,
  CAUSAL_WORDS,
  citeOf,
  claimOf,
  confirmationWords,
  driftWords,
  EVIDENCE_PROBLEMS,
  GAP_WORDS,
  healthTitleWords,
  healthWords,
  matchupCellWords,
  MISLEAD,
  changeStatusWords,
  changeVerdictWords,
  soldSourceWords,
  soldWords,
  verdictWords,
  openWords,
  restOf,
  RUN_WORDS,
  runTitleWords,
  screenCurseWords,
  screenWords,
  shortlistWords,
  valueOf,
  VERDICT_WORDS,
  sentenceOf,
  STRENGTH_WORDS,
} from '../src/lib/findingWords';
import {
  assocShown,
  cardNamesIn,
  clearestPairings,
  endingPair,
  focusPlanOf,
  pairingsOf,
  parseChangeKey,
  parseCite,
  parseEvidenceRoute,
  healthKey,
  rowId,
  runHref,
  runToken,
  screenCurseRows,
  shortTitleOf,
  SHOWN_PAIRINGS,
  stripMiddle,
} from '../src/lib/evidenceView';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { defaultSiteConfig, NAV_CATALOG, PAGE_LABEL, pageOn, siteConfigText, visibleNav } from '../src/lib/siteConfig';
import { clearEvidenceCache, loadDeckEvidence, loadDeckRuns, loadEvidenceIndex, type Loaded } from '../src/ui/evidenceData';
import { copyText, revealRow } from '../src/ui/components/evidence/parts';
import { DeckEvidenceView } from '../src/ui/components/evidence/DeckView';
import { EvidenceOverview, resolveCite } from '../src/ui/components/evidence/Overview';
import { RunView } from '../src/ui/components/evidence/RunView';
import { DeckEvidenceSummary } from '../src/ui/components/evidence/DeckEvidencePanel';
import { deckPageProblem, EvidencePage, fileProblem } from '../src/ui/pages/Evidence';
import { DeckProfilePage } from '../src/ui/pages/DeckProfile';
import { previewDraft } from '../src/ui/useSiteConfig';
import { setArtEnabled } from '../src/ui/art';

const ROOT = path.resolve(__dirname, '..');
const CUR = CURRENT_SIM_VERSION;

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
  clearEvidenceCache();
});
afterEach(() => {
  previewDraft(null);
  vi.unstubAllGlobals();
  clearEvidenceCache();
});

// ---------------------------------------------------------------- fixtures

const LIST = 'aaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbb';
const subject = { listId: LIST, deck: 'Test Deck', file: 'test-deck.txt' };
let seq = 0;
const METHOD: Record<FindingKind, Finding['method']> = {
  'deck-strength': 'rating-model',
  matchup: 'shrunk',
  seat: 'model-residual',
  length: 'result-split',
  ending: 'result-split',
  'card-assoc': 'association',
  'package-assoc': 'association',
  change: 'paired',
};
function F(kind: FindingKind, o: Partial<Finding> = {}): Finding {
  seq += 1;
  const short = (0x10000000 + seq).toString(16);
  const f: Finding = {
    id: `${short}00000000`,
    short,
    question: `q${seq}`,
    kind,
    nature: NATURE_OF[kind],
    claim: '',
    subject: { ...subject },
    estimate: 0.02,
    lower: 0.01,
    upper: 0.03,
    level: 0.95,
    baseline: 0,
    games: 300,
    n: 300,
    method: METHOD[kind],
    simVersion: CUR,
    bot: 'hard',
    field: 'recorded-events',
    sources: [{ file: 'src/data/x.json', path: `a[${seq}]` }],
    family: { key: `${LIST}:x`, size: 1, correction: 'bh' },
    corrected: true,
    strength: 'strong',
    flags: [],
    ...o,
  };
  return { ...f, claim: claimOf(f) };
}
const opp = (i: number, deck: string) => ({ listId: `c${String(i).repeat(15)}`.slice(0, 16), deck });
const matchup = (i: number, deck: string, estimate: number, lower: number, upper: number, strength: Strength, o: Partial<Finding> = {}) =>
  F('matchup', { subject: { ...subject, opponent: opp(i, deck) }, question: `pair${i}`, estimate, lower, upper, baseline: 0.5, strength, games: 5, n: 218, detail: { raw: { wins: 3, games: 5 } }, family: { key: `${LIST}:matchups`, size: 8, correction: 'bh' }, ...o });

const strengthF = F('deck-strength', { estimate: 0.575, lower: 0.524, upper: 0.624, level: 0.9, p95: [0.514, 0.633], baseline: 0.5, games: 238, n: 238 });
const mA = matchup(1, 'Opp Alpha', 0.3, 0.2, 0.42, 'strong');
const mB = matchup(2, 'Opp Bravo', 0.35, 0.25, 0.46, 'strong');
const mC = matchup(3, 'Opp Charlie', 0.62, 0.52, 0.71, 'strong');
const mD = matchup(4, 'Opp Delta', 0.7, 0.6, 0.8, 'strong');
const mE = matchup(5, 'Opp Echo', 0.8, 0.7, 0.88, 'strong');
const mF = matchup(6, 'Opp Foxtrot', 0.45, 0.3, 0.6, 'weak');
const mG = matchup(7, 'Opp Golf', 0.505, 0.49, 0.52, 'no-difference');
const mH = matchup(8, 'Opp Hotel', 0.58, 0.4, 0.74, 'not-enough', { n: 10 });
const direct = F('matchup', {
  subject: { ...subject, opponent: opp(3, 'Opp Charlie') },
  question: 'pair3',
  method: 'direct-games',
  estimate: 0.64,
  lower: 0.57,
  upper: 0.7,
  baseline: 0.5,
  games: 200,
  n: 200,
  bot: 'deep',
  field: 'pairing',
  detail: { raw: { wins: 128, games: 200 } },
});
const seat = F('seat', { estimate: 0.09, lower: -0.02, upper: 0.21, strength: 'weak', detail: { residual: { first: 0.05, second: -0.04, firstGames: 114, secondGames: 124 } } });
const length = F('length', {
  estimate: -0.25,
  lower: -0.39,
  upper: -0.08,
  strength: 'moderate',
  detail: {
    thirds: [
      { label: 'short', maxTurns: 12, minTurns: null, games: 49, rate: 0.347, lower: 0.229, upper: 0.487 },
      { label: 'middle', maxTurns: 13, minTurns: 13, games: 61, rate: 0.557, lower: 0.433, upper: 0.675 },
      { label: 'long', maxTurns: null, minTurns: 14, games: 128, rate: 0.594, lower: 0.507, upper: 0.675 },
    ],
  },
});
const ending = F('ending', { subject: { ...subject, ending: 'reached 7 Gigs in overtime' }, estimate: 0.3, lower: 0.25, upper: 0.36, baseline: 0.42, strength: 'moderate' });
const card = F('card-assoc', {
  subject: { ...subject, card: { id: 'some_card', name: 'Some Card' } },
  estimate: 0.08,
  lower: 0.02,
  upper: 0.14,
  strength: 'moderate',
  bot: 'deep',
  family: { key: `${LIST}:cards`, size: 34, correction: 'bh' },
  detail: {
    rates: { a: 0.6, aGames: 400, b: 0.52, bGames: 300, aLabel: 'drawn', bLabel: 'not drawn' },
    sold: { n: 960, of: 1000, bot: 'deep', simVersion: 9, run: 'analysis:2026-11-14T15:47:12.017Z:1', date: '2026-11-14T15:47:12.017Z' },
  },
});
const thinCard = F('card-assoc', {
  subject: { ...subject, card: { id: 'thin_card', name: 'Thin Card' } },
  estimate: 0.011,
  lower: -0.05,
  upper: 0.07,
  n: 10,
  strength: 'not-enough',
  bot: 'deep',
  family: { key: `${LIST}:cards`, size: 34, correction: 'bh' },
  detail: { rates: { a: 0.55, aGames: 590, b: 0.54, bGames: 10, aLabel: 'drawn', bLabel: 'not drawn' } },
});
const pkg = F('package-assoc', { subject: { ...subject, package: { id: 'p', name: 'Some Package' } }, estimate: -0.14, lower: -0.33, upper: 0.06, strength: 'weak', bot: 'deep', family: { key: `${LIST}:packages`, size: 6, correction: 'bh' } });
const change = {
  key: `${LIST} -main:we_gotta_live_together +main:yorinobu_arasaka_steel_dragon`,
  base: LIST,
  cuts: ['we_gotta_live_together'],
  adds: ['yorinobu_arasaka_steel_dragon'],
  label: '-1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon',
  relation: 'from-this-list' as const,
};
const chg = (o: Partial<Finding>) => F('change', { subject: { ...subject, change }, question: 'qchange', bot: 'medium', field: 'f', flags: ['medium-only'], baseline: 0, ...o });
const staged = chg({
  method: 'paired-staged',
  simVersion: 5,
  sequential: 'bonferroni',
  estimate: 0.0145,
  lower: -0.0033,
  upper: 0.0323,
  p95: [0.0005, 0.0285],
  games: 896,
  n: 896,
  corrected: false,
  strength: 'moderate',
  flags: ['stale', 'medium-only'],
  detail: { screen: { games: 112, mean: 0.0536, lower: 0.0117, upper: 0.0955, flag: 'screening' }, verdict: 'inconclusive', looks: 4, date: '2026-11-12' },
});
const pooledF = chg({
  method: 'paired-pooled',
  sequential: 'always-valid',
  estimate: 0.0277,
  lower: 0.012,
  upper: 0.043,
  p95: [0.018, 0.038],
  games: 2240,
  n: 2240,
  detail: {
    screen: { games: 560, mean: 0.05, lower: 0.03, upper: 0.07, flag: 'screening' },
    verdict: 'adopt',
    status: 'live',
    runs: 5,
    date: '2026-11-15',
    byOpp: [{ opp: OTHER, games: 320, mean: 0.03, se: 0.01 }],
  },
});
const remeasured = chg({ method: 'paired', estimate: 0.0243, lower: 0.014, upper: 0.034, games: 2800, n: 2800, detail: { date: '2026-11-15' } });
const open: OpenQuestion[] = [
  { change: { ...change, key: 'k2', cuts: ['gunpoint_diplomacy'], label: '-1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon' }, simVersion: CUR, bot: 'medium', field: 'f', heldout: 672, screen: 336, pooled: { games: 1008, mean: 0.0437, se: 0.0078 }, toSettle: 895, more: 223, runs: 3 },
  { change: { ...change, key: 'k3', cuts: ['peace_offering'], label: '-1 Peace Offering → +1 Yorinobu Arasaka: Steel Dragon' }, simVersion: CUR, bot: 'medium', field: 'f', heldout: 0, screen: 112, pooled: { games: 112, mean: 0.02, se: 0.03 }, toSettle: null, more: null, runs: 1 },
];
const DECK: DeckEvidence = {
  kind: 'nct-evidence',
  schema: 1,
  simVersion: CUR,
  listId: LIST,
  deck: 'Test Deck',
  file: 'test-deck.txt',
  findings: [strengthF, mA, mB, mC, mD, mE, mF, mG, mH, direct, seat, length, ending, card, thinCard, pkg, staged, pooledF, remeasured],
  open,
  gaps: [{ code: 'no-hard-changes' }],
};
const counts = (fs: readonly Finding[]) => Object.fromEntries((['strong', 'moderate', 'weak', 'no-difference', 'not-enough'] as const).map((s) => [s, fs.filter((f) => f.strength === s).length])) as Record<Strength, number>;
const ref = (f: Finding, others = 0): FindingRef => ({
  id: f.id,
  short: f.short,
  question: f.question,
  kind: f.kind,
  nature: f.nature,
  claim: f.claim,
  estimate: f.estimate,
  lower: f.lower,
  upper: f.upper,
  level: f.level,
  ...(f.sequential ? { sequential: f.sequential } : {}),
  baseline: f.baseline,
  games: f.games,
  method: f.method,
  corrected: f.corrected,
  strength: f.strength,
  bot: f.bot,
  simVersion: f.simVersion,
  flags: f.flags,
  listId: f.subject.listId,
  deck: f.subject.deck,
  poolCorrected: true,
  others,
});
const INDEX: EvidenceIndex = {
  kind: 'nct-evidence-index',
  schema: 1,
  simVersion: CUR,
  decks: [
    { file: 'test-deck.txt', deck: 'Test Deck', listId: LIST, path: `evidence/${LIST}.json`, findings: DECK.findings.length, strength: ref(strengthF), counts: counts(DECK.findings), stale: 1, runs: 1, runsPath: `evidence/${LIST}.runs.json` },
    { file: 'other-deck.txt', deck: 'Other Deck', listId: OTHER, path: `evidence/${OTHER}.json`, findings: 3, strength: null, counts: { strong: 1, moderate: 0, weak: 2, 'no-difference': 0, 'not-enough': 0 }, stale: 0, runs: 0, runsPath: null },
  ],
  top: [
    { key: 'effects', family: { size: 25, correction: 'bh' }, items: [ref(remeasured, 2)] },
    { key: 'results', family: { size: 1337, correction: 'bh' }, items: [ref(strengthF), ref(mE)] },
    { key: 'patterns', family: { size: 359, correction: 'bh' }, items: [ref(card)] },
  ],
  health: [
    { tool: 'forge', nominees: 7, adopted: 3, rejected: 0, couldNotTell: 4, screenMinusHeldOut: { mean: 0.034571, n: 7 }, adoptedMinusLater: { mean: 0.053281, n: 3 }, repeatNominated: null },
    { tool: 'ledger runs', nominees: 11, adopted: null, rejected: null, couldNotTell: null, screenMinusHeldOut: { mean: 0.032456, n: 11 }, adoptedMinusLater: null, repeatNominated: { share: 0.3, runs: 10 } },
  ],
  rules: {
    strength: { minimum: { paired: 200, model: 20, split: 20, association: 20 }, strong: { paired: 1000, model: 200, split: 200, association: 200 }, minEffect: 0.01, noDifferenceHalfWidth: 0.02, bhQ: 0.1 },
    length: { shortMax: 12, longMin: 14, shares: [0.2, 0.233, 0.567] },
    matchup: {
      spreadSd: 0.063509,
      spreadMeasured: true,
      spreadPairings: 21,
      spreadGames: 4200,
      chi2: 65.6,
      df: 14,
      heldOutMatches: 2399,
      heldOutGames: 6014,
      slope: 0.916,
      slopeSe: 0.041,
      favouredWins: 3753,
      favouredExpected: 3812.2,
      squaredDistance: 0.0072,
      squaredDistanceSe: 0.0047,
      claimedVariance: 0.0058,
      claimedWithoutSpread: 0.0018,
    },
  },
  gaps: [{ code: 'no-ablations' }],
  inputs: [],
  manifest: {} as EvidenceIndex['manifest'],
};
const IDS: EvidenceIds = { kind: 'nct-evidence-ids', schema: 1, decks: { [LIST]: DECK.findings.map((f) => f.short).join(''), [OTHER]: 'deadbeef' } };
const RUN: RunRecord = {
  id: 'forge:2026-11-12T09:38:05.490Z:1',
  tool: 'forge',
  date: '2026-11-12',
  bot: 'medium',
  simVersion: 5,
  rule: 'evidence: stages of 224 fresh paired games up to 896',
  games: 2800,
  detect: { card: 0.0423, package: 0.06918, firstStage: 224, nominees: 1, sdCard: 0.3, sdPackage: 0.55 },
  source: { file: 'reports/forge/test.json', path: 'gens' },
  stale: true,
  trials: [
    {
      label: '-1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon',
      kind: 'card',
      key: change.key,
      screen: { games: 112, mean: 0.0536, lower: 0.0117, upper: 0.0955 },
      heldOut: { games: 896, mean: 0.0145, lower: -0.0033, upper: 0.0323, z: 2.5, looks: 4 },
      outcome: 'could not tell',
      pooled: { games: 2240, mean: 0.0277, se: 0.0078 },
    },
    { label: 'Complete Units: +3 All is Lost / -3 Valentino Street Racer', kind: 'package', screen: { games: 112, mean: 0.027, lower: null, upper: null }, heldOut: null, outcome: 'not nominated' },
  ],
};
const RUNS: DeckRuns = { kind: 'nct-evidence-runs', schema: 1, simVersion: CUR, listId: LIST, deck: 'Test Deck', file: 'test-deck.txt', runs: [RUN] };

// ---------------------------------------------------------------- helpers

const deckHtml = (target: string | null = null) => renderToStaticMarkup(<DeckEvidenceView deck={DECK} index={INDEX} target={target} onReveal={() => {}} />);
const overviewHtml = () => renderToStaticMarkup(<EvidenceOverview index={INDEX} />);
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html: string) => unescape(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
/** The markup of one element that starts at `at` (an `<li`, `<section` or `<article`), up to its matching close tag. */
function elementAt(html: string, at: number): string {
  const tag = /^<(\w+)/.exec(html.slice(at))![1]!;
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
  re.lastIndex = at;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(at, m.index + m[0].length);
  }
  throw new Error('unclosed');
}
const rowHtml = (html: string, short: string) => elementAt(html, html.indexOf(`<li id="${rowId(short)}"`));
const sectionHtml = (html: string, headingId: string) => elementAt(html, html.lastIndexOf('<section', html.indexOf(`id="${headingId}"`)));
const hasCausal = (t: string) => CAUSAL_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(t));
const fetchStub = (files: Record<string, unknown>) => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const hit = Object.entries(files).find(([k]) => url.endsWith(k));
      return hit ? { ok: true, json: async () => hit[1] } : { ok: false, json: async () => null };
    }),
  );
  return calls;
};

// ---------------------------------------------------------------- the overview

describe('the overview', () => {
  it('opens with what the page is and the key, then the three lists apart, the tools, the decks, the gaps and how to read it', () => {
    const html = overviewHtml();
    const order = ['Open a finding', 'Measured effects', 'Results that stand out', 'Patterns worth testing (association)', 'How the tuning tools have done', 'All decks', 'Not measured yet', 'How to read this page'].map((h) => html.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const w of Object.values(STRENGTH_WORDS)) expect(html).toContain(w);
    for (const n of ['recorded result', 'measured effect', 'association']) expect(html).toContain(n);
  });

  it('keeps the three natures in separate lists; the association list carries the chip on every row and the reason once', () => {
    const html = overviewHtml();
    const effects = sectionHtml(html, 'ev-top-effects-h');
    const results = sectionHtml(html, 'ev-top-results-h');
    const patterns = sectionHtml(html, 'ev-top-patterns-h');
    expect(effects).toContain(rowId(remeasured.short));
    expect(effects).not.toContain(rowId(card.short));
    expect(results).toContain(rowId(strengthF.short));
    expect(results).toContain(rowId(mE.short));
    expect(results).not.toContain(rowId(card.short));
    expect(patterns).toContain(rowId(card.short));
    expect(patterns).not.toContain(rowId(remeasured.short));
    expect(patterns.split(MISLEAD['card-assoc'].replace(/'/g, '&#x27;')).length - 1).toBe(1);
    expect(effects).not.toContain('Association, not value');
    expect(rowHtml(patterns, card.short)).toContain('ev-n-association');
    expect(text(effects)).toContain('also measured 2 other times');
    expect(hasCausal(text(rowHtml(patterns, card.short)))).toEqual([]);
  });

  it('says each tool’s record in sentences, leaving out a figure the record does not hold', () => {
    const forge = healthWords(INDEX.health[0]!);
    expect(forge).toEqual([
      '7 nominees confirmed on held-out games: 3 adopted, 0 rejected, 4 could not tell.',
      'Screening read 3.5 points higher than the held-out games, on average over 7 nominees.',
      'The held-out figure at adoption read 5.3 points higher than a later re-measurement on fresh games, on average over 3 adopted changes.',
    ]);
    const ledger = healthWords(INDEX.health[1]!);
    expect(ledger[0]).toBe('11 nominees confirmed on held-out games.');
    expect(ledger.join(' ')).not.toMatch(/adopted|rejected|could not tell|null|re-measurement/);
    expect(ledger).toContain('3 of the 10 runs after the first on a list nominated a change an earlier run had tested.');
    const html = text(overviewHtml());
    for (const t of [...forge, ...ledger]) expect(html).toContain(t);
  });

  it('lists every deck with its counts and a link to its evidence page', () => {
    const html = overviewHtml();
    for (const d of INDEX.decks) expect(html).toContain(`href="#/evidence/${d.listId}"`);
    expect(html).toContain('href="#/deck?d=other-deck.txt"');
    expect(text(html)).toContain('allows for an even pairing sitting about 6.4 points from the ratings’ prediction');
  });
});

// ---------------------------------------------------------------- a deck's page

describe('a deck’s page', () => {
  it('has the five blocks in order, then the runs and the gaps', () => {
    const html = deckHtml();
    const heads = ['ev-strength-h', 'ev-matchups-h', 'ev-cards-h', 'ev-changes-h', 'ev-open-h', 'ev-runs-h', 'ev-gaps-h'];
    const order = heads.map((h) => html.indexOf(`id="${h}"`));
    const titles = ['How good is it, and how sure are we?', 'Where does it win and lose?', 'Cards and packages', 'What changed it, and did it hold?', 'Open questions', 'Runs', 'Not measured for this list'];
    titles.forEach((t, i) => expect(html.slice(order[i]!, order[i]! + 80)).toContain(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('href="#/deck?d=test-deck.txt"');
    expect(html).not.toMatch(/dead weight|what carries it/i);
  });

  it('an association row never uses a causal word; the reason it may mislead and the family line are above the cards', () => {
    const html = deckHtml();
    for (const f of [card, thinCard, pkg]) {
      const row = text(rowHtml(html, f.short));
      expect(hasCausal(row), row).toEqual([]);
    }
    const block = text(sectionHtml(html, 'ev-cards-h'));
    expect(block).toContain(MISLEAD['card-assoc']);
    expect(block).toContain('Ranked from 34 cards; about 2 of the ones whose interval excludes "no difference" are expected by chance');
    expect(text(rowHtml(html, card.short))).toContain('drawn 60.0% (400 games) · not drawn 52.0% (300 games)');
  });

  it('a card row shows how often the bot sold it, and from 85% on says the bot sells this, naming the bot and run (A.12)', () => {
    const html = deckHtml();
    const row = text(rowHtml(html, card.short));
    expect(row).toContain('drawn 60.0% (400 games) · not drawn 52.0% (300 games) · sold in 96.0% of 1,000 uses from hand: the bot sells this');
    expect(row).toContain('Sells: from the decision telemetry of the Deep bot’s run of 2026-11-14 (simulator version 9)');
    // a card with no sells recorded says nothing about them
    expect(text(rowHtml(html, thinCard.short))).not.toContain('uses from hand');
    const sold = (n: number, of: number) => ({ n, of, bot: 'deep', simVersion: 9, run: null, date: null });
    expect(soldWords(sold(84, 100))).toBe('sold in 84.0% of 100 uses from hand');
    expect(soldWords(sold(85, 100))).toBe('sold in 85.0% of 100 uses from hand: the bot sells this');
    // under the minimum uses: the count alone, never flagged
    expect(soldWords(sold(19, 19))).toBe('sold 19 of 19 uses from hand');
    expect(soldSourceWords(sold(1, 2))).toContain('the Deep bot’s run (simulator version 9)');
    expect(hasCausal(soldSourceWords(sold(1, 2)))).toEqual([]);
  });

  it('a "not enough games" row shows the chip first and no emphasised number; strong rows are emphasised', () => {
    const html = deckHtml();
    const thin = rowHtml(html, thinCard.short);
    expect(thin).not.toMatch(/is-em|<strong|<b>/);
    expect(thin.indexOf('not enough games')).toBeLessThan(thin.indexOf('Not enough games: reads'));
    expect(rowHtml(html, strengthF.short)).toContain('<strong>57.5%</strong>');
  });

  it('a stale measurement is greyed, names its version and is never emphasised; screening is labelled as screening', () => {
    const html = deckHtml();
    const row = rowHtml(html, staged.short);
    expect(row).toMatch(/class="ev-row [^"]*is-stale/);
    expect(text(row)).toContain('Measured under simulator version 5; the site now plays version 9');
    expect(row).toContain('version 5');
    expect(row).not.toMatch(/is-em|<strong/);
    expect(text(row)).toContain('Screening read +5.4 pts over 112 games: not the result.');
    expect(row).toMatch(/class="ev-screen small">Screening read/);
    expect(text(rowHtml(html, pooledF.short))).toContain('Screening read +5.0 pts over 560 games: not the result.');
    expect(rowHtml(html, remeasured.short)).not.toContain('Screening');
    // how much higher screening has read than held-out games is said once, above the changes, from the tools' record
    const block = text(sectionHtml(html, 'ev-changes-h'));
    const curse = 'Against the held-out games, screening has read on average 3.5 points above for the forge (7 nominees); 3.2 points above for forge runs with held-out games kept across runs (11 nominees).';
    expect(block.split(curse).length - 1).toBe(1);
  });

  it('groups a change’s measurements under one question, in date order, with the drift line and the verdicts in words', () => {
    const html = deckHtml();
    const at = html.indexOf('<article');
    const art = elementAt(html, at);
    const ids = [staged, pooledF, remeasured].map((f) => art.indexOf(rowId(f.short)));
    expect(ids.every((i) => i > 0)).toBe(true);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
    expect(text(art)).toContain(
      'Measured 3 times, in points, in date order: +1.5 in a forge confirmation (896 games, version 5); +2.8 over held-out games kept across runs (2,240 games, version 9); +2.4 on fresh games (2,800 games, version 9).',
    );
    expect(text(art)).toContain('Tried on this list and not applied: the list on this site does not contain it.');
    expect(text(art)).not.toContain('A change to this list.');
    // each verdict names the rule that gave it (docs/EVIDENCE.md "Two rules, two verdicts")
    expect(text(art)).toContain('Adopted by the pooled always-valid rule.');
    expect(text(art)).toContain('The run’s staged rule could not tell.');
    // each row names how it was measured; its bot and version once, on its second line
    const re = rowHtml(art, remeasured.short);
    expect(text(re)).toContain('A re-measurement on fresh games');
    expect(text(re).split('Medium bot, version 9').length - 1).toBe(1);
    expect(text(rowHtml(art, pooledF.short))).toContain('Held-out games kept across runs');
    // the cards of the change are named by id
    expect(art).toContain('Yorinobu Arasaka: Steel Dragon');
    expect(html.split('<article').length - 1).toBe(1);
  });

  it('an open question says what its games read and about how many more held-out games would settle it', () => {
    const html = text(deckHtml());
    expect(html).toContain('672 held-out games and 336 screening games over 3 runs read +4.4 pts together (95% range +2.8 pts to +5.9 pts).');
    expect(html).toContain('About 223 more held-out games would settle it (895 in all).');
    expect(html).toContain('No held-out games yet: it has only been screened.');
    expect(openWords({ ...open[0]!, more: null, toSettle: null }).settle).toBe('No estimate of the games that would settle it: its held-out reading is not above the bar.');
  });

  it('a change screened by one bot and confirmed by another never reads the two bots’ games together', () => {
    // the open question: the confirming bot's held-out games alone, the screening bot and its games named apart
    const two = openWords({ ...open[0]!, bot: 'hard', screenBot: 'medium', heldout: 224, screen: 28, pooled: { games: 224, mean: 0.018, se: 0.02 }, runs: 1 });
    expect(two.reads).toBe('224 held-out games with Hard over 1 run read +1.8 pts (95% range −2.1 pts to +5.7 pts); it was screened with Medium on 28 games.');
    expect(two.reads).not.toContain('together');
    expect(two.settle).toBe(openWords(open[0]!).settle);
    // one bot throughout: the sentence is the one it was
    expect(openWords({ ...open[0]!, bot: 'hard' }).reads).toBe(openWords(open[0]!).reads);
    // the screening figure on a finding names its bot only when it is another bot than the finding's
    const scr = { games: 28, mean: 0.071, lower: -0.05, upper: 0.19, flag: 'screening' as const };
    expect(screenWords(scr)).toBe('Screening read +7.1 pts over 28 games: not the result.');
    expect(screenWords({ ...scr, bot: 'medium' })).toBe('Screening with Medium read +7.1 pts over 28 games: not the result.');
    // and the page shows both
    const hardF = chg({ method: 'paired-pooled', bot: 'hard', estimate: 0.018, lower: -0.03, upper: 0.066, games: 224, n: 224, detail: { date: '2026-11-15', verdict: 'undecided', screen: { ...scr, bot: 'medium' } } });
    const html = text(renderToStaticMarkup(<DeckEvidenceView deck={{ ...DECK, findings: [...DECK.findings, hardF], open: [{ ...open[0]!, bot: 'hard', screenBot: 'medium', heldout: 224, screen: 28, pooled: { games: 224, mean: 0.018, se: 0.02 }, runs: 1 }] }} index={INDEX} target={null} onReveal={() => {}} />));
    expect(html).toContain('Screening with Medium read +7.1 pts over 28 games: not the result.');
    expect(html).toContain(two.reads);
  });

  it('a pairing with a direct measurement shows both; the game length shows its three groups', () => {
    const html = deckHtml();
    const row = rowHtml(html, mC.short);
    expect(row).toContain(rowId(direct.short));
    expect(text(row)).toContain('Measured over its 200 direct games');
    expect(text(row)).toContain(sentenceOf(direct));
    expect(text(rowHtml(html, length.short))).toContain('Short games (12 turns or fewer): won 34.7% (95% range 22.9% to 48.7%, 49 games)');
  });

  it('the at-a-glance strip links to the deck’s own findings', () => {
    const html = deckHtml();
    const glance = elementAt(html, html.indexOf('<nav class="ev-glance"'));
    for (const f of [strengthF, mE, mA, pooledF]) expect(glance).toContain(`href="#/evidence/${LIST}?f=${f.short}"`);
    expect(text(glance)).toContain('2 open questions, 1 with held-out games');
  });
});

// ---------------------------------------------------------------- the matchup strip

describe('the matchup strip', () => {
  it('has one button per opponent, named by opponent, win rate and strength word, worst first', () => {
    const html = deckHtml();
    const strip = elementAt(html, html.indexOf('<ul class="ev-strip"'));
    const labels = [...strip.matchAll(/<button type="button" class="ev-cell[^"]*" aria-label="([^"]+)"/g)].map((m) => unescape(m[1]!));
    const worstFirst = [mA, mB, mF, mG, mH, mC, mD, mE];
    expect(labels).toEqual(worstFirst.map((f) => matchupCellWords(f.subject.opponent!.deck, f)));
    expect(labels[0]).toBe('Opp Alpha: 30.0%, strong');
    expect(labels).toContain('Opp Hotel: 58.0%, not enough games');
  });
});

// ---------------------------------------------------------------- finding links

describe('a link to a finding', () => {
  it('?f= highlights the finding and opens the collapsed list that held it', () => {
    expect(clearestPairings(pairingsOf(DECK.findings), SHOWN_PAIRINGS).has(mH.question)).toBe(false);
    expect(focusPlanOf(DECK, mH.short)).toMatchObject({ block: 'matchups', allPairings: true });
    const closed = deckHtml();
    expect(closed).not.toContain(`id="${rowId(mH.short)}"`);
    expect(closed).toContain('aria-expanded="false"');
    const html = deckHtml(mH.short);
    expect(rowHtml(html, mH.short)).toMatch(/class="ev-row [^"]*is-target/);
    expect(rowHtml(html, mH.short)).toContain('tabindex="-1"');
    expect(html).toContain('Show the clearest 6 only');
    // the whole id and upper case work too
    expect(deckHtml(mH.id.toUpperCase())).toMatch(new RegExp(`id="${rowId(mH.short)}" class="ev-row [^"]*is-target`));
  });

  it('moves focus to the row and scrolls it into view (smoothly only with full motion)', () => {
    const calls: string[] = [];
    const el = { scrollIntoView: (o: ScrollIntoViewOptions) => calls.push(`scroll ${o.behavior}`), focus: (o: FocusOptions) => calls.push(`focus ${o.preventScroll}`) };
    const doc = (motion: string) => ({ getElementById: (id: string) => (id === rowId(mH.short) ? el : null), documentElement: { getAttribute: () => motion } }) as unknown as Document;
    expect(revealRow(doc('full'), rowId(mH.short))).toBe(true);
    expect(revealRow(doc('off'), rowId(mH.short))).toBe(true);
    expect(calls).toEqual(['scroll smooth', 'focus true', 'scroll auto', 'focus true']);
    expect(revealRow(doc('full'), 'f-00000000')).toBe(false);
  });

  it('an unknown finding on a deck says so in one sentence', () => {
    expect(text(deckHtml('ffffffff'))).toContain(EVIDENCE_PROBLEMS.unknownFinding('ffffffff'));
  });

  it('the routes and links', () => {
    expect(parseEvidenceRoute('', new URLSearchParams('f=F:9f3a2c1d'))).toEqual({ view: 'overview', f: 'F:9f3a2c1d', d: null });
    expect(parseEvidenceRoute('', new URLSearchParams('d=meta-x.txt'))).toEqual({ view: 'overview', f: null, d: 'meta-x.txt' });
    expect(parseEvidenceRoute(LIST, new URLSearchParams('f=10000003'))).toEqual({ view: 'deck', listId: LIST, f: '10000003' });
    expect(parseEvidenceRoute(`${LIST}/run/${runToken(RUN.id)}`, new URLSearchParams())).toEqual({ view: 'run', listId: LIST, token: runToken(RUN.id) });
    expect(parseEvidenceRoute('nope', new URLSearchParams())).toEqual({ view: 'unknown', listId: 'nope' });
    expect(runHref(LIST, RUN.id)).toBe(`#/evidence/${LIST}/run/${runToken(RUN.id)}`);
    expect(runToken(RUN.id)).toMatch(/^[0-9a-f]{8}$/);
    for (const t of ['F:9f3a2c1d', '[F:9f3a2c1d]', ' f:9F3A2C1D ', '9f3a2c1d', '9f3a2c1d00000000', '[F:9f3a2c1d] claim (+1.2 pts [−0.1, +2.5], 6,112 games, Medium v8)']) expect(parseCite(t), t).toBe('9f3a2c1d');
    for (const t of ['', 'F:9f3a', 'hello', '9f3a2c1d0']) expect(parseCite(t), t).toBeNull();
  });
});

describe('a pasted cite id', () => {
  it('resolves through ids.json (fetched only then, once) to its deck and finding', async () => {
    const calls = fetchStub({ 'data/evidence/ids.json': IDS });
    expect(await resolveCite(`[F:${pkg.short}]`)).toEqual({ listId: LIST, short: pkg.short });
    expect(await resolveCite('F:deadbeef')).toEqual({ listId: OTHER, short: 'deadbeef' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/data\/evidence\/ids\.json$/);
    expect(shortIdDeck(IDS, pkg.short)).toBe(LIST);
  });

  it('an unknown or malformed id says so in one sentence', async () => {
    fetchStub({ 'data/evidence/ids.json': IDS });
    expect(await resolveCite('F:12345678')).toEqual({ problem: EVIDENCE_PROBLEMS.unknownCite('12345678') });
    expect(await resolveCite('not an id')).toEqual({ problem: EVIDENCE_PROBLEMS.badCite });
    clearEvidenceCache();
    fetchStub({});
    expect(await resolveCite('F:12345678')).toEqual({ problem: EVIDENCE_PROBLEMS.missingIds });
  });
});

// ---------------------------------------------------------------- cite

describe('the cite control', () => {
  it('copies exactly citeOf(f)', async () => {
    const html = deckHtml();
    for (const f of [strengthF, card, staged, direct]) {
      const row = rowHtml(html, f.short);
      const carried = unescape(/data-cite="([^"]*)"/.exec(row)![1]!);
      expect(carried).toBe(citeOf(f));
      const got: string[] = [];
      expect(await copyText(carried, { clipboard: { writeText: async (t) => void got.push(t) } })).toBe(true);
      expect(got).toEqual([citeOf(f)]);
    }
    expect(rowHtml(html, card.short)).toContain(`href="#/evidence/${LIST}?f=${card.short}"`);
  });

  it('falls back to the copy command without the clipboard API, and says when neither works', async () => {
    const made: { value: string; selected: boolean }[] = [];
    const doc = {
      createElement: () => {
        const ta = { value: '', selected: false, style: {}, setAttribute: () => {}, select: () => void (ta.selected = true) };
        made.push(ta);
        return ta;
      },
      execCommand: () => made.at(-1)!.selected,
      body: { appendChild: () => {}, removeChild: () => {} },
    } as unknown as NonNullable<Parameters<typeof copyText>[1]>['doc'];
    expect(await copyText('line', { clipboard: undefined, doc })).toBe(true);
    expect(made[0]!.value).toBe('line');
    expect(await copyText('line', { clipboard: { writeText: () => Promise.reject(new Error('denied')) }, doc: undefined })).toBe(false);
  });
});

// ---------------------------------------------------------------- the run view

describe('a recorded run', () => {
  it('names its tool, bot and version (greyed when stale), its rule, what it could detect, and its trials with screening labelled', () => {
    const html = renderToStaticMarkup(<RunView deck={DECK} run={RUN} />);
    const t = text(html);
    expect(t).toContain('The forge, 2026-11-12');
    expect(html).toMatch(/class="panel ev-block is-stale"/);
    expect(t).toContain('Measured under simulator version 5');
    expect(t).toContain('evidence: stages of 224 fresh paired games up to 896');
    expect(t).toContain('a one-card change worth +4.2 pts or more is adopted 8 times in 10');
    expect(html).toContain('<th scope="col">Screening (not the result)</th>');
    expect(t).toContain('+5.4 pts (95% range +1.2 pts to +9.6 pts, 112 games)');
    expect(t).not.toContain('Screening: +');
    expect(t).toContain('+2.7 pts (no range recorded, 112 games)');
    expect(html).toContain('data-label="Screening (not the result)"');
    expect(html).toContain('All its games, every run (screening included)');
    expect(html).toMatch(/class="ev-col-kind">package</);
    expect(html).toMatch(/class="ev-col-pooled">s*—/);
    expect(t).toContain('+1.5 pts (range −0.3 pts to +3.2 pts, 896 games, 4 looks)');
    expect(t).toContain('not confirmed on held-out games');
    expect(t).toContain('+2.8 pts (95% range +1.2 pts to +4.3 pts, 2,240 games)');
    expect(html).toContain(`href="#/evidence/${LIST}"`);
  });

  it('reads a trial’s change key and the card names in the tools’ labels', () => {
    expect(parseChangeKey(`${LIST} -main:a,a +main:b`)).toEqual({ cuts: ['a', 'a'], adds: ['b'], legendCuts: [], legendAdds: [] });
    expect(parseChangeKey(undefined)).toBeNull();
    expect(runTitleWords({ id: 'forge 2026-11-15T06:12:00.751Z seed 3', tool: 'forge', date: '2026-11-15' })).toBe('The forge, 2026-11-15, seed 3');
    expect(runTitleWords(RUN)).toBe('The forge, 2026-11-12');
    const names = cardNamesIn(['Swap X → Y: +3 Field Operator, +2 Hanako Arasaka: In a Gilded Cage / -2 Mantis Blades', '-1 Rockn\' Rockerboy → +1 T-Bug: Amateur Philosopher', 'S2-05 -1 We Gotta Live Together +1 Yorinobu: Steel Dragon (not adopted)']);
    expect(names.get('field_operator')).toBe('Field Operator');
    expect(names.get('hanako_arasaka_in_a_gilded_cage')).toBe('Hanako Arasaka: In a Gilded Cage');
    expect(names.get('mantis_blades')).toBe('Mantis Blades');
    expect(names.get('rockn_rockerboy')).toBe("Rockn' Rockerboy");
    expect(names.get('t_bug_amateur_philosopher')).toBe('T-Bug: Amateur Philosopher');
    expect(names.get('we_gotta_live_together')).toBe('We Gotta Live Together');
  });
});

// ---------------------------------------------------------------- what cannot be shown

describe('what cannot be shown is one plain sentence', () => {
  it('an unknown list id, a missing file and a newer schema', async () => {
    expect(text(renderToStaticMarkup(<EvidencePage sub="not-a-list" q={new URLSearchParams()} />))).toContain(EVIDENCE_PROBLEMS.unknownList('not-a-list'));
    const ready = { state: 'ready', data: INDEX } as const;
    const missing = { state: 'missing' } as const;
    expect(deckPageProblem(OTHER, missing, ready)).toBe(EVIDENCE_PROBLEMS.missingDeckFile);
    expect(deckPageProblem('cccccccccccccccc', missing, ready)).toBe(EVIDENCE_PROBLEMS.unknownList('cccccccccccccccc'));
    expect(deckPageProblem(LIST, { state: 'newer' }, ready)).toBe(EVIDENCE_PROBLEMS.newer);
    expect(deckPageProblem(LIST, { state: 'loading' }, ready)).toBe('loading');
    expect(deckPageProblem(LIST, { state: 'ready', data: DECK }, missing)).toBeNull();
    expect(fileProblem(missing, EVIDENCE_PROBLEMS.missingIndex)).toBe(EVIDENCE_PROBLEMS.missingIndex);
    expect(fileProblem({ state: 'newer' }, EVIDENCE_PROBLEMS.missingIndex)).toBe(EVIDENCE_PROBLEMS.newer);
    // the loaders: a 404 is missing, another kind is missing, a newer schema is newer
    fetchStub({ [`data/evidence/${LIST}.json`]: { ...DECK, schema: 2 }, 'data/evidence/index.json': { kind: 'other', schema: 1 } });
    expect(await loadDeckEvidence(LIST)).toEqual({ state: 'newer' });
    expect(await loadDeckEvidence(OTHER)).toEqual({ state: 'missing' });
    expect(await loadDeckEvidence('../../etc')).toEqual({ state: 'missing' });
    expect(await loadEvidenceIndex()).toEqual({ state: 'missing' });
    clearEvidenceCache();
    const calls = fetchStub({ 'data/evidence/index.json': INDEX, [`data/evidence/${LIST}.runs.json`]: RUNS });
    expect(((await loadEvidenceIndex()) as Loaded<EvidenceIndex> & { state: 'ready' }).data.decks).toHaveLength(2);
    const runs = await loadDeckRuns(LIST);
    expect(runs.state === 'ready' && runs.data.runs.map((r) => runToken(r.id))).toEqual([runToken(RUN.id)]);
    expect(await loadDeckRuns(OTHER)).toEqual({ state: 'missing' });
    // one request per file, however often it is asked for
    await loadEvidenceIndex();
    expect(calls.filter((u) => u.endsWith('index.json'))).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- the owner's switch

describe('the owner’s switch', () => {
  const off = () => {
    const c = defaultSiteConfig();
    c.nav.sections.find((s) => s.id === 'decks')!.pages.find((p) => p.path === 'evidence')!.hidden = true;
    return c;
  };

  it('Decks → Evidence is on by default, listed like any page, and off when the owner hides it', () => {
    expect(NAV_CATALOG.find((s) => s.id === 'decks')!.pages).toContain('evidence');
    expect(PAGE_LABEL.evidence).toBe('Evidence');
    const d = defaultSiteConfig();
    expect(pageOn(d, 'evidence')).toBe(true);
    expect(visibleNav(d).find((s) => s.id === 'decks')!.pages).toContainEqual({ path: 'evidence', label: 'Evidence' });
    expect(pageOn(off(), 'evidence')).toBe(false);
    expect(visibleNav(off()).find((s) => s.id === 'decks')!.pages.map((p) => p.path)).not.toContain('evidence');
    const app = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
    expect(app).toContain("lazy(() => import('./ui/pages/Evidence')");
    expect(app).toMatch(/NESTED = new Set\(\[[^\]]*'evidence'/);
  });

  it('the deck profile links to a library deck’s evidence only while the page is on', () => {
    const file = 'meta-rrg-dexter-midrange.txt';
    expect(renderToStaticMarkup(<DeckProfilePage file={file} />)).toContain(`href="#/evidence?d=${file}"`);
    previewDraft(siteConfigText(off()));
    expect(renderToStaticMarkup(<DeckProfilePage file={file} />)).not.toContain('#/evidence');
  });

  it('the profile panel counts the deck’s findings by strength word and links to its page', () => {
    const html = renderToStaticMarkup(<DeckEvidenceSummary entry={INDEX.decks[1]!} />);
    expect(text(html)).toContain('3 findings: 1 strong, 2 weak.');
    expect(html).toContain(`href="#/evidence/${OTHER}"`);
  });
});

// ---------------------------------------------------------------- the import graph

const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
function staticGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) return;
    for (const m of fs.readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const spec = m[1]!;
      if (!spec.startsWith('.')) continue;
      const base = path.resolve(path.dirname(file), spec.replace(/\?.*$/, ''));
      const hit = EXTS.map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (hit) walk(hit);
    }
  };
  walk(path.join(ROOT, entry));
  return new Set([...seen].map((f) => path.relative(ROOT, f).split(path.sep).join('/')));
}
const HEAVY = /^src\/(engine|ai|sim)\/|^src\/lib\/kb\//;

describe('the import graph', () => {
  const entry = staticGraph('src/main.tsx');

  it('the page brings in no engine, bot, simulator or knowledge pack beyond what the entry chunk already holds', () => {
    const page = staticGraph('src/ui/pages/Evidence.tsx');
    expect([...page].filter((f) => HEAVY.test(f) && !entry.has(f))).toEqual([]);
    expect(page).toContain('src/ui/evidence.css');
    // its own modules reach none at all
    for (const f of ['src/ui/evidenceData.ts', 'src/lib/evidenceView.ts', 'src/lib/findingWords.ts', 'src/ui/components/evidence/FindingRow.tsx', 'src/ui/components/evidence/parts.tsx'])
      expect([...staticGraph(f)].filter((x) => HEAVY.test(x)), f).toEqual([]);
  });

  it('nothing in the entry chunk imports the page, its components, its data module or its styles', () => {
    expect(entry.has('src/ui/pages/Home.tsx')).toBe(true);
    expect([...entry].filter((f) => /^src\/ui\/(pages\/Evidence\.tsx|components\/evidence\/|evidenceData\.ts|evidence\.css)|^src\/lib\/(evidenceView|findings|findingWords)\.ts$/.test(f))).toEqual([]);
  });
});

// ---------------------------------------------------------------- the real files

describe('the real evidence files', () => {
  const dir = path.join(ROOT, 'public/data/evidence');
  const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;
  const index = read<EvidenceIndex>('index.json');
  const ids = read<EvidenceIds>('ids.json');

  it('render: the overview, and the two decks with changes, runs and open questions, and a meta deck with cards', () => {
    expect(index.simVersion).toBe(CUR);
    const html = renderToStaticMarkup(<EvidenceOverview index={index} />);
    for (const d of index.decks) expect(html).toContain(`href="#/evidence/${d.listId}"`);
    for (const file of ['s2-05-counter-rrg.txt', 'meta-bbg-cunningham-econ.txt']) {
      const entry = index.decks.find((d) => d.file === file)!;
      const deck = read<DeckEvidence>(`${entry.listId}.json`);
      const page = renderToStaticMarkup(<DeckEvidenceView deck={deck} index={index} target={null} onReveal={() => {}} />);
      const shown = (x: Finding) => page.includes(`id="${rowId(x.short)}"`);
      expect(deck.findings.filter((x) => x.nature === 'association' && shown(x)).length).toBeGreaterThan(0);
      for (const f of deck.findings.filter((x) => x.nature === 'association' && shown(x))) expect(hasCausal(text(rowHtml(page, f.short))), f.claim).toEqual([]);
      for (const f of deck.findings.filter((x) => x.strength === 'not-enough' && shown(x))) expect(rowHtml(page, f.short)).not.toMatch(/is-em|<strong/);
    }
  });

  it('every overview row resolves through ids.json, and run tokens are unique within a deck', () => {
    for (const t of index.top) for (const f of t.items) expect(shortIdDeck(ids, f.short)).toBe(f.listId);
    for (const d of index.decks.filter((x) => x.runsPath)) {
      const runs = read<DeckRuns>(path.basename(d.runsPath!));
      const tokens = runs.runs.map((r) => runToken(r.id));
      expect(new Set(tokens).size).toBe(tokens.length);
    }
  });

  it('the drift line words a forge adoption as "at adoption"', () => {
    expect(driftWords([{ estimate: 0.156, games: 224, simVersion: 5, method: 'paired-staged', verdict: 'adopt' }, { estimate: 0.064, games: 2800, simVersion: 8, method: 'paired' }])).toBe(
      'Measured 2 times, in points, in date order: +15.6 at adoption (224 games, version 5); +6.4 on fresh games (2,800 games, version 8).',
    );
  });
});

// ---------------------------------------------------------------- compact rows and short lists (the browser pass)

/** A row without its Details (the part a reader sees before opening them). */
const visible = (row: string) => row.replace(/<div id="f-[0-9a-f]{8}-d"[\s\S]*$/, '');

describe('a row is two lines: the number said once', () => {
  it('the second line is the rest of the sentence, built from the same pieces', () => {
    const eff = { kind: 'change', nature: 'effect', level: 0.95, baseline: 0, method: 'paired', corrected: true, games: 2000 } as const;
    expect(restOf({ ...eff, estimate: 0.015, lower: -0.005, upper: 0.035, strength: 'weak' })).toBe('95% range −0.5 pts to +3.5 pts, 2,000 paired games; the interval still includes no difference');
    expect(restOf({ ...eff, method: 'paired-staged', sequential: 'obrien-fleming', estimate: 0.015, lower: -0.003, upper: 0.032, corrected: false, strength: 'moderate', games: 896 })).toBe(
      'corrected 95% range −0.3 pts to +3.2 pts, 896 paired games; only the uncorrected interval excludes no difference',
    );
    expect(restOf(mA)).toBe('95% range 20.0% to 42.0%, from the ratings; 3–2 in 5 direct games');
    expect(restOf(strengthF)).toBe('against the field; 90% range 52.4% to 62.4%, 238 games');
    expect(restOf(mG)).toBe('no difference of a point or more; 95% range 49.0% to 52.0%, from the ratings; 3–2 in 5 direct games');
    expect(valueOf(thinCard)).toBe('reads +1.1 pts so far');
    expect(valueOf(card)).toBe('+8.0 pts');
    const lead = /^(against the field|no difference of a point or more|of its wins, against [0-9.]+% across the field); /;
    for (const f of DECK.findings.filter((x) => x.strength !== 'not-enough')) expect(sentenceOf(f).replace(/[()]/g, ''), f.claim).toContain(restOf(f).replace(lead, ''));
  });

  it('shows the value once, the bot and version once, Cite on the first line and Link only in Details', () => {
    const html = deckHtml();
    for (const f of [strengthF, mC, card, remeasured]) {
      const row = visible(rowHtml(html, f.short));
      expect(text(row).split(valueOf(f)).length - 1, f.claim).toBe(1);
      // a matchup row holds its direct measurement's row, with its own line
      expect(text(row).split('bot, version').length - 1).toBe(f === mC ? 2 : 1);
      expect(row).toContain('data-cite=');
      expect(row).not.toContain('Link to this finding');
      expect(rowHtml(html, f.short)).toContain('Link to this finding');
      expect(row).toMatch(/aria-expanded="false"[^>]*>Details/);
    }
    expect(text(visible(rowHtml(html, card.short)))).toContain('drawn 60.0% (400 games) · not drawn 52.0% (300 games) · sold in 96.0% of 1,000 uses from hand: the bot sells this · Deep bot, version 9');
  });
});

describe('short titles', () => {
  it('a row is named by what it is about; the full claim stays in the cite line and Details', () => {
    for (const f of [strengthF, mA, direct, seat, length, ending, card, pkg, staged]) expect(shortTitleOf(ref(f)), f.claim).toBe(shortTitleOf(f));
    expect(shortTitleOf(ref(mA))).toBe('against Opp Alpha');
    expect(shortTitleOf(ref(direct))).toBe('against Opp Charlie (direct games)');
    expect(shortTitleOf(ref(card))).toBe('Some Card');
    expect(shortTitleOf(ref(pkg))).toBe('Some Package');
    expect(shortTitleOf(ref(staged))).toBe(change.label);
    expect(shortTitleOf(ref(ending))).toBe('Wins that ended “reached 7 Gigs in overtime”');
    const html = overviewHtml();
    const row = visible(rowHtml(html, remeasured.short));
    expect(text(row)).toContain(`${change.label} · Test Deck`);
    expect(text(row)).not.toContain('paired win-rate difference');
    expect(row).toContain(`href="#/evidence/${LIST}"`);
  });
});

describe('lists open short', () => {
  it('an overview list shows its first 5, then "Show all N"', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...ref(mE), id: `a${i}`.padEnd(16, '0'), short: `a${i}`.padEnd(8, '0') }));
    const ix = { ...INDEX, top: INDEX.top.map((t) => (t.key === 'results' ? { ...t, items: many } : t)) };
    const html = renderToStaticMarkup(<EvidenceOverview index={ix} />);
    const results = sectionHtml(html, 'ev-top-results-h');
    expect(results.match(/<li id="f-/g)).toHaveLength(5);
    expect(results).toContain('Show all 7');
    expect(results).toContain('aria-expanded="false"');
  });

  it('cards and packages show every one whose interval excludes no difference, at least 5; a link opens a hidden one', () => {
    const cards = Array.from({ length: 8 }, (_, i) =>
      F('card-assoc', {
        subject: { ...subject, card: { id: `c${i}`, name: `Card ${i}` } },
        estimate: i < 2 ? 0.1 - i * 0.01 : 0.02 - i * 0.001,
        lower: i < 2 ? 0.03 : -0.05,
        upper: i < 2 ? 0.17 : 0.08,
        strength: i < 2 ? 'moderate' : 'weak',
        family: { key: `${LIST}:cards`, size: 8, correction: 'bh' },
      }),
    );
    expect(assocShown(cards)).toBe(5);
    expect(assocShown(cards.map((c) => ({ ...c, lower: 0.01, upper: 0.2 })))).toBe(8);
    const deck = { ...DECK, findings: [...DECK.findings.filter((f) => f.kind !== 'card-assoc'), ...cards] };
    const closed = renderToStaticMarkup(<DeckEvidenceView deck={deck} index={INDEX} target={null} onReveal={() => {}} />);
    expect(elementAt(closed, closed.indexOf('<ul class="ev-rows" id="ev-card-rows"')).match(/<li id="f-/g)).toHaveLength(5);
    expect(closed).toContain('Show all 8 cards');
    const last = cards[7]!;
    expect(closed).not.toContain(`id="${rowId(last.short)}"`);
    expect(focusPlanOf(deck, last.short).allCards).toBe(true);
    const open = renderToStaticMarkup(<DeckEvidenceView deck={deck} index={INDEX} target={last.short} onReveal={() => {}} />);
    expect(rowHtml(open, last.short)).toMatch(/is-target/);
  });

  it('on a phone the matchup strip opens with the 6 worst and the 6 best', () => {
    expect(Array.from({ length: 46 }, (_, i) => stripMiddle(i, 46)).filter(Boolean)).toHaveLength(34);
    expect(Array.from({ length: 12 }, (_, i) => stripMiddle(i, 12)).some(Boolean)).toBe(false);
    expect(deckHtml()).not.toContain('ev-cell-mid');
  });
});

describe('the decks list states each deck’s strength', () => {
  it('value, range and strength word beside the Sim tier; "no rating" without one', () => {
    const html = overviewHtml();
    const at = html.indexOf('<li class="ev-deck"');
    const rows = [elementAt(html, at), elementAt(html, html.indexOf('<li class="ev-deck"', at + 1))];
    const test = rows.find((r) => r.includes('Test Deck'))!;
    const other = rows.find((r) => r.includes('Other Deck'))!;
    expect(text(test)).toContain('57.5% 90% range 52.4% to 62.4%');
    expect(test).toContain('ev-s-strong');
    expect(text(other)).toContain('no rating');
    expect(text(html)).not.toContain('is the first block of its page');
  });
});

describe('endings and words', () => {
  const above = F('ending', { subject: { ...subject, ending: 'controls 7+ Gigs at start of turn' }, estimate: 0.7, lower: 0.64, upper: 0.75, baseline: 0.58, strength: 'moderate' });
  const deck2 = { ...DECK, findings: [...DECK.findings, above] };
  const closedDetails = /<div id="f-[0-9a-f]{8}-d" class="ev-details-body small" hidden="">/;

  it('two endings are one fact: the one above the field’s share is shown, the other in its Details', () => {
    expect(endingPair(deck2.findings)).toEqual({ shown: above, inner: ending });
    const html = renderToStaticMarkup(<DeckEvidenceView deck={deck2} index={INDEX} target={null} onReveal={() => {}} />);
    const row = rowHtml(html, above.short);
    expect(visible(row)).not.toContain(rowId(ending.short));
    expect(row).toContain(`id="${rowId(ending.short)}"`);
    expect(row).toMatch(closedDetails);
    // a link to the inner one opens the Details that hold it
    expect(focusPlanOf(deck2, ending.short).inDetailsOf).toBe(above.short);
    const linked = rowHtml(renderToStaticMarkup(<DeckEvidenceView deck={deck2} index={INDEX} target={ending.short} onReveal={() => {}} />), above.short);
    expect(linked.match(/<div id="f-[0-9a-f]{8}-d"[^>]*>/)![0]).not.toContain('hidden');
    expect(rowHtml(linked, ending.short)).toMatch(/is-target/);
  });

  it('a change says one status sentence; the tools are named for a visitor', () => {
    expect(changeStatusWords('from-this-list', true, 'Still open: later tuning runs test it first.')).toBe('Tried on this list and not applied: the list on this site does not contain it.');
    expect(changeStatusWords('from-this-list', false, null)).toBe('A change to this list.');
    expect(changeStatusWords('from-this-list', false, shortlistWords({ status: 'live' }))).toBe('Still open: later tuning runs test it first.');
    expect(changeStatusWords('to-this-list', true, null)).toBe('The change that made this list.');
    expect(shortlistWords({ status: 'dropped', dropped: 'below-bar' })).toBe('Set aside: its games so far read under the bar for a confirmation.');
    expect(shortlistWords({ status: 'dropped', dropped: 'rejected' })).toBe('Set aside: its held-out games reject it.');
    expect(shortlistWords({ status: 'dropped', dropped: 'out-of-reach' })).toBe('Set aside: settling it would take more held-out games than a run may spend.');
    expect(shortlistWords({ status: 'dropped' })).toBe('Set aside.');
    expect(VERDICT_WORDS.adopt).toBe('The tuning tools’ rule would adopt it.');
    expect(VERDICT_WORDS.reject).toBe('The tuning tools’ rule would reject it.');
    for (const t of [...Object.values(VERDICT_WORDS), shortlistWords({ status: 'live' })!]) expect(t).not.toMatch(/shortlist/);
  });

  it('a change measured with two bots names each bot, and says what Hard shows about Medium', () => {
    // Medium (the fixture's three measurements) and a Hard re-measurement of the same question
    const hardF = chg({ method: 'paired', bot: 'hard', flags: [], estimate: 0.014, lower: -0.002, upper: 0.03, games: 560, n: 560, strength: 'weak', corrected: false, detail: { date: '2026-11-16' } });
    const deck2: DeckEvidence = { ...DECK, findings: [...DECK.findings, hardF] };
    const html = renderToStaticMarkup(<DeckEvidenceView deck={deck2} index={INDEX} target={null} onReveal={() => {}} />);
    const group = text(elementAt(html, html.indexOf('<article')));
    expect(group).toContain(
      'Measured 4 times, in points, in date order: +1.5 in a forge confirmation with Medium (896 games, version 5); +2.8 over held-out games kept across runs with Medium (2,240 games, version 9); +2.4 on fresh games with Medium (2,800 games, version 9); +1.4 on fresh games with Hard (560 games, version 9).',
    );
    expect(group).toContain('Hard’s range still includes no difference (+1.4 pts, 95% range −0.2 pts to +3.0 pts), so it neither confirms nor contradicts Medium’s +2.4 pts (95% range +1.4 pts to +3.4 pts).');
    // one bot only: the line is as before, and no such sentence
    expect(text(elementAt(deckHtml(), deckHtml().indexOf('<article')))).not.toMatch(/with Medium|Hard’s range|Hard agrees/);
  });

  it('the two-bot sentence follows the strength words and ranges, and never claims cause', () => {
    const r = (bot: string, estimate: number, lower: number, upper: number, strength: Strength, games = 2800, simVersion = CUR) => ({ bot, estimate, lower, upper, strength, games, simVersion });
    const M = r('medium', 0.029, 0.019, 0.039, 'strong');
    const cases: [ReturnType<typeof r>[], string | null][] = [
      [[M], null],
      [[r('hard', 0.02, 0.01, 0.03, 'moderate')], null],
      [[M, r('hard', 0.024, 0.012, 0.036, 'moderate', 560)], 'Hard agrees with Medium on the direction: both ranges exclude no difference (Medium +2.9 pts, Hard +2.4 pts), and the two ranges overlap, so they do not show a different size.'],
      [[M, r('hard', 0.08, 0.06, 0.1, 'strong')], 'Hard agrees with Medium on the direction: both ranges exclude no difference (Medium +2.9 pts, Hard +8.0 pts). Hard reads it higher than Medium, and the two ranges do not overlap.'],
      [[M, r('hard', -0.03, -0.05, -0.01, 'moderate')], 'Hard and Medium disagree on the direction: Medium reads +2.9 pts and Hard −3.0 pts, and each range excludes no difference.'],
      [[M, r('hard', 0.002, -0.008, 0.012, 'no-difference')], 'Hard finds no difference of a point or more (+0.2 pts, 95% range −0.8 pts to +1.2 pts), so it does not confirm Medium’s +2.9 pts (95% range +1.9 pts to +3.9 pts). Hard reads it lower than Medium, and the two ranges do not overlap.'],
      [[r('medium', 0.012, -0.004, 0.028, 'weak'), r('hard', 0.03, 0.01, 0.05, 'moderate')], 'Hard’s range excludes no difference (+3.0 pts, 95% range +1.0 pts to +5.0 pts), where Medium’s did not (+1.2 pts, 95% range −0.4 pts to +2.8 pts).'],
      [[M, r('hard', 0.05, -0.1, 0.2, 'not-enough', 28)], 'With Hard there are not enough games yet to say whether it agrees with Medium (28 paired games with Hard, reading +5.0 pts).'],
      [[r('medium', 0.029, 0.019, 0.039, 'moderate', 2800, CUR - 1), r('hard', 0.024, 0.012, 0.036, 'moderate', 560)], `Hard agrees with Medium on the direction: both ranges exclude no difference (Medium +2.9 pts, Hard +2.4 pts), and the two ranges overlap, so they do not show a different size. The two were measured under different simulator versions (${CUR - 1} and ${CUR}), so the bots are not the only difference.`],
    ];
    for (const [rs, want] of cases) {
      const got = botsWords(rs);
      expect(got).toBe(want);
      if (got) expect(hasCausal(got)).toEqual([]);
    }
  });

  it('the notes on what is not measured name the re-measurement command with real flags', () => {
    expect(GAP_WORDS['no-hard-changes']!.measure).toBe('A Hard re-measurement of the change: npm run remeasure -- <deck> --change "<label>" --bot hard (1,120 paired games against the meta decks), then npm run evidence.');
    expect(GAP_WORDS['no-changes']!.measure).toContain('npm run remeasure -- <deck> --cut <card> --add <card>');
    expect(GAP_WORDS['season1-no-interval']!.measure).toContain('npm run remeasure -- <deck> --before data/decks/custom/history/<file>');
    for (const g of Object.values(GAP_WORDS)) expect(g.measure).not.toMatch(/data\/evidence\/\)/);
  });

  it('a run that recorded neither its rule nor what it could detect says so once', () => {
    const t = text(renderToStaticMarkup(<RunView deck={DECK} run={{ ...RUN, rule: null, detect: null, stale: false, simVersion: CUR }} />));
    expect(t).toContain('The run recorded neither its adoption rule nor what it could detect.');
    expect(t).not.toContain('The run recorded no adoption rule.');
  });
});

// ---------------------------------------------------------------- a recorded run kept across runs; the tools' records

describe('a forge run whose games are kept across runs, and the tools’ records by version and bots', () => {
  const s3change = {
    key: `${OTHER} -main:royce_don_t_call_me_simon +main:johnny_silverhand_never_stop_fighting`,
    base: OTHER,
    cuts: ['royce_don_t_call_me_simon'],
    adds: ['johnny_silverhand_never_stop_fighting'],
    label: "-1 Royce: Don't Call Me Simon → +1 Johnny Silverhand: Never Stop Fighting",
    relation: 'from-this-list' as const,
  };
  const s3subject = { listId: OTHER, deck: 'S3 Deck', file: 's3-deck.txt' };
  const confirmation = { outcome: 'inconclusive' as const, looks: 4, cap: 4, lower: 0.0001, upper: 0.0379, sequential: 'obrien-fleming' as const, run: 'forge:2026-11-16T05:32:01.059Z:1' };
  // S3-08's one change finding as the builder writes it: the ledger's held-out games with the forge run's own verdict
  const kept = F('change', {
    subject: { ...s3subject, change: s3change },
    question: 'qs3',
    method: 'paired-pooled',
    sequential: 'always-valid',
    bot: 'hard',
    field: 'f',
    estimate: 0.019,
    lower: -0.010573,
    upper: 0.048466,
    p95: [0.000115, 0.037885],
    games: 896,
    n: 896,
    corrected: false,
    strength: 'moderate',
    flags: [],
    detail: {
      screen: { games: 112, mean: 0.053571, lower: -0.006502, upper: 0.113645, flag: 'screening', bot: 'medium' },
      verdict: 'undecided',
      confirmation,
      runs: 1,
      status: 'dropped',
      dropped: 'out-of-reach',
      toSettle: 10029,
      date: '2026-11-16',
    },
  });
  const S3: DeckEvidence = { kind: 'nct-evidence', schema: 1, simVersion: CUR, listId: OTHER, deck: 'S3 Deck', file: 's3-deck.txt', findings: [kept], open: [], gaps: [] };
  const H_CROSS = { tool: 'forge', simVersion: CUR, bot: 'medium', confirmBot: 'hard', nominees: 5, adopted: 2, rejected: 0, couldNotTell: 3, screenMinusHeldOut: { mean: 0.04012, n: 5 }, adoptedMinusLater: null, repeatNominated: null };
  const H_OLD = { tool: 'forge', simVersion: 5, bot: 'medium', nominees: 7, adopted: 3, rejected: 0, couldNotTell: 4, screenMinusHeldOut: { mean: 0.034571, n: 7 }, adoptedMinusLater: { mean: 0.050424, n: 3 }, repeatNominated: null };
  const H_LEDGER = { tool: 'ledger runs', simVersion: CUR, bot: 'medium', nominees: 11, adopted: null, rejected: null, couldNotTell: null, screenMinusHeldOut: { mean: 0.032456, n: 11 }, adoptedMinusLater: null, repeatNominated: { share: 0.3, runs: 10 } };
  const IX: EvidenceIndex = { ...INDEX, health: [H_CROSS, H_OLD, H_LEDGER] };

  it('the run’s own verdict and look, and why the row’s range is wider', () => {
    expect(confirmationWords(confirmation)).toBe(
      'These held-out games all come from one forge run, which by the run’s staged rule could not tell at look 4 of 4 (its corrected range +0.0 pts to +3.8 pts). The range above is the pooled always-valid rule’s, wider because it stays valid as later runs add games.',
    );
    expect(confirmationWords({ ...confirmation, looks: 2, stopped: 'futility', lower: -0.0439, upper: 0.0439 })).toBe(
      'These held-out games all come from one forge run, which by the run’s staged rule stopped at look 2 of 4 with no gain, so could not tell (its corrected range −4.4 pts to +4.4 pts). The range above is the pooled always-valid rule’s, wider because it stays valid as later runs add games.',
    );
    expect(confirmationWords({ ...confirmation, outcome: 'adopt', looks: 1, lower: 0.02, upper: 0.09 })).toContain('adopted it at its first look of 4 (its corrected range +2.0 pts to +9.0 pts)');
    expect(confirmationWords({ ...confirmation, looks: 6 })).toContain('could not tell after 6 looks (4 within its cap, then until settled)');
  });

  it('each verdict names its rule, and the same games adopted by the staged rule and undecided by the pooled one say both are right (T5)', () => {
    expect(verdictWords('paired-staged', 'adopt')).toBe('Adopted by the run’s staged rule.');
    expect(verdictWords('paired-pooled', 'undecided')).toBe('Undecided by the pooled always-valid rule: its held-out games do not settle it yet.');
    expect(verdictWords('paired-pooled', 'reject')).toBe('Rejected by the pooled always-valid rule.');
    expect(verdictWords('paired-staged', 'inconclusive')).toBe('The run’s staged rule could not tell.');
    // a method that names no rule keeps the older words
    expect(verdictWords('association', 'adopt')).toBe(VERDICT_WORDS.adopt);
    expect(changeVerdictWords({ method: 'paired-pooled' })).toBeNull();
    // S3-06: adopted at +3.1 [+1.1, +5.2] by the run's staged rule on 896 Hard games, undecided by the pooled rule
    const s306 = { ...confirmation, outcome: 'adopt' as const, lower: 0.0107, upper: 0.0518 };
    const t = changeVerdictWords({ method: 'paired-pooled', detail: { verdict: 'undecided', confirmation: s306 } })!;
    expect(t).toContain('Undecided by the pooled always-valid rule');
    expect(t).toContain('which by the run’s staged rule adopted it at look 4 of 4 (its corrected range +1.1 pts to +5.2 pts)');
    expect(t).toContain('The two verdicts differ on the same games and both are right under their own rules');
    for (const w of [t, verdictWords('paired-pooled', 'adopt'), RUN_WORDS.trialsIntro]) expect(w).not.toMatch(/ledger|shortlist/i);
  });

  it('a change set aside as out of reach says how many games adopting it would take, or that its reading is not above the bar', () => {
    expect(shortlistWords({ status: 'dropped', dropped: 'out-of-reach', toSettle: 10029 }, 896)).toBe(
      'Set aside: at its present reading, adopting it would take about 9,133 more held-out games (10,029 in all), more than later tuning runs give one change.',
    );
    expect(shortlistWords({ status: 'dropped', dropped: 'out-of-reach', toSettle: null }, 448)).toBe('Set aside: its held-out games do not read above the bar, so more of them are not expected to adopt it.');
  });

  it('the deck page shows the one finding: what was measured, by which bot, that screening was Medium’s, what the run concluded and how far it is from settled', () => {
    const html = renderToStaticMarkup(<DeckEvidenceView deck={S3} index={IX} target={null} onReveal={() => {}} />);
    const group = elementAt(html, html.indexOf('<article'));
    expect(group.match(/<li id="f-/g)).toHaveLength(1);
    const t = text(group);
    expect(t).toContain('Held-out games kept across runs');
    expect(t).toContain('+1.9 pts');
    expect(t).toContain(`Hard bot, version ${CUR}`);
    expect(t).toContain('Screening with Medium read +5.4 pts over 112 games: not the result.');
    expect(t).toContain(`${verdictWords('paired-pooled', 'undecided')} ${confirmationWords(confirmation)}`);
    // the run could not tell and the pooled games are undecided: the two rules agree, so no "both are right" sentence
    expect(t).not.toContain('both are right');
    expect(t).toContain('adopting it would take about 9,133 more held-out games (10,029 in all)');
    expect(t).not.toMatch(/ledger|shortlist/i);
    // the screening line above the changes names the one record that speaks to it: this version, Medium screening, Hard held-out
    expect(text(html)).toContain(
      `Against the held-out games, screening has read on average 4.0 points above for the forge (version ${CUR}, Medium screening, Hard held-out; 5 nominees). Where one bot screened and another played the held-out games, that gap also holds how the two bots differ.`,
    );
  });

  it('the screening line takes the records of the deck’s own contexts; an index without contexts gives them all', () => {
    expect(screenCurseRows(IX.health, [kept])).toEqual([H_CROSS]);
    // the fixture deck: a version-5 forge confirmation and Medium held-out games kept across runs
    expect(screenCurseRows(IX.health, DECK.findings)).toEqual([H_OLD, H_LEDGER]);
    expect(screenCurseRows(INDEX.health, [kept])).toEqual(INDEX.health);
    expect(screenCurseWords([H_LEDGER])).toContain(`3.2 points above for forge runs with held-out games kept across runs (version ${CUR}, Medium; 11 nominees).`);
    expect(screenCurseWords([H_LEDGER])).not.toContain('two bots');
  });

  it('each record is named by its version and bots, a cross-bot gap is said to mix the two, and the overview lists them apart', () => {
    expect(healthTitleWords(H_CROSS, CUR)).toBe(`The forge, simulator version ${CUR}: Medium bot screening, Hard bot confirming`);
    expect(healthTitleWords(H_OLD, CUR)).toBe('The forge, simulator version 5 (an older version): Medium bot');
    expect(healthTitleWords({ tool: 'forge' }, CUR)).toBe('The forge');
    expect(healthWords(H_CROSS)).toEqual([
      '5 nominees confirmed on held-out games: 2 adopted, 0 rejected, 3 could not tell.',
      'Screening with Medium read 4.0 points higher than the held-out games with Hard, on average over 5 nominees. That gap holds screening’s optimism and how the two bots differ together, so it measures neither alone.',
    ]);
    expect(healthWords(H_OLD)[2]).toBe('The held-out figure at adoption read 5.0 points higher than a later re-measurement on fresh games with the same bot under the current simulator version, on average over 3 adopted changes.');
    expect(new Set(IX.health.map(healthKey)).size).toBe(3);
    const html = text(renderToStaticMarkup(<EvidenceOverview index={IX} />));
    for (const h of IX.health) {
      expect(html).toContain(healthTitleWords(h, CUR));
      for (const line of healthWords(h)) expect(html).toContain(line);
    }
  });

  it('a recorded run kept across runs says so on its page', () => {
    expect(text(renderToStaticMarkup(<RunView deck={S3} run={{ ...RUN, ledgerRun: 'forge 2026-11-16T05:19:02.886Z seed 1' }} />))).toContain(RUN_WORDS.keptAcross);
    expect(text(renderToStaticMarkup(<RunView deck={S3} run={RUN} />))).not.toContain(RUN_WORDS.keptAcross);
  });
});
