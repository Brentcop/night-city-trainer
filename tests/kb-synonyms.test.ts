// Knowledge pack synonym table (src/lib/kb/synonyms.ts, docs/RAG_PLAN.md step 4.6): the table is well formed (no
// duplicate, no word mapped to itself, no chain or cycle), every term it maps to is in a pack built from the real public
// sources, no word it maps from is a game term or card name of its own, `expand` on examples, and with the table off
// (synonymWeight 0, synonymCoverage false) the search returns exactly what it returned before the table existed.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { GLOSSARY } from '../src/content/glossary';
import { CONDITION_TERMS } from '../src/content/synergies/vocabulary';
import { bm25Search, coverage } from '../src/lib/kb/bm25';
import { finishRecord } from '../src/lib/kb/build/record';
import { ANSWERABLE_TYPES, parseTuning } from '../src/lib/kb/eval';
import { buildIndex, search, SEARCH_TUNING } from '../src/lib/kb/search';
import { expand, expandQuestion, SYNONYMS, wordForms } from '../src/lib/kb/synonyms';
import { tokenize } from '../src/lib/kb/text';
import { kindOfId } from '../src/lib/kb/types';
import { EVAL_SPEC, runEval } from '../scripts/kb-eval';
import { buildFromSources } from '../scripts/kb-sources';
import { parseArgs } from '../scripts/lib-node';

const ROOT = path.resolve(__dirname, '..');
const key = (s: string) => tokenize(s).join(' ');

describe('the synonym table', () => {
  it('is well formed: every entry says something, means something and says why, in plain words', () => {
    expect(SYNONYMS.length).toBeGreaterThan(0);
    expect(SYNONYMS.length).toBeLessThanOrEqual(60);
    for (const e of SYNONYMS) {
      expect(e.says.length, e.why).toBeGreaterThan(0);
      expect(e.means.length, e.why).toBeGreaterThan(0);
      expect(e.why.trim().length, e.says.join()).toBeGreaterThan(10);
      // lower case, and no word the tokenizer drops (a stop word or a single letter)
      for (const s of [...e.says, ...e.means]) {
        expect(s, s).toBe(s.toLowerCase().trim());
        expect(tokenize(s).length, s).toBe(s.split(/\s+/).length);
      }
    }
  });

  it('has no duplicate, maps no word to itself and has no chain or cycle', () => {
    const says = SYNONYMS.flatMap((e) => e.says.map(key));
    expect(says.length).toBe(new Set(says).size);
    const sayWords = new Set(SYNONYMS.flatMap((e) => e.says.flatMap((s) => tokenize(s))));
    for (const e of SYNONYMS) {
      const means = e.means.flatMap((m) => tokenize(m));
      expect(new Set(e.means.map(key)).size, e.why).toBe(e.means.length);
      for (const s of e.says) for (const w of tokenize(s)) expect(means, `${s} maps to itself`).not.toContain(w);
      // a chain: a term the table maps to is itself a word the table maps from
      for (const m of means) expect(sayWords.has(m), `${m} is both a "means" and a "says" word`).toBe(false);
    }
  });

  it('maps only to terms that occur in a pack built from the real public sources', async () => {
    const { records } = await buildFromSources(ROOT, { raw: false });
    const ix = buildIndex(records.filter((r) => r.scope === 'public'));
    const stale = SYNONYMS.flatMap((e) => e.means.flatMap((m) => tokenize(m))).filter((t) => !ix.bm25.df.has(t));
    expect(stale).toEqual([]);
  }, 60_000);

  it('maps from no word that is a game term, keyword, card type, tag or card name of its own', () => {
    const game = new Set<string>([
      ...GLOSSARY.flatMap((t) => tokenize(t.term)),
      ...Object.keys(CONDITION_TERMS).flatMap((t) => tokenize(t)),
      ...['blocker', 'adrenaline', 'go solo', 'quick', 'spend', 'play', 'attack', 'call', 'defeated'].flatMap((t) => tokenize(t)),
      ...CARDS.flatMap((c) => [...tokenize(c.type), ...c.tags.flatMap((t) => tokenize(t)), ...tokenize(c.displayName)]),
    ]);
    const clash = SYNONYMS.flatMap((e) => e.says.flatMap((s) => tokenize(s))).filter((w) => game.has(w));
    expect(clash).toEqual([]);
  });
});

describe('expand', () => {
  it('folds the word forms the tokenizer leaves alone', () => {
    expect(wordForms('tapped')).toContain('tap');
    expect(wordForms('killing')).toContain('kill');
    expect(wordForms('attached')).toContain('attach');
    expect(wordForms('enemie')).toContain('enemy');
    expect(wordForms('heroe')).toContain('hero');
    expect(wordForms('tap')).toEqual(['tap']);
  });

  it("adds this game's terms, never a word the question already has", () => {
    expect(expand(tokenize('My creatures tapped the enemies'))).toEqual(['unit', 'spend', 'spent', 'rival']);
    expect(expand(tokenize('which creature taps a unit'))).toEqual(['spend', 'spent']);
    expect(expand(tokenize('equipment for my hero'))).toEqual(['gear', 'legend']);
    expect(expand(tokenize('how many dice do I roll'))).toEqual(['gig']);
    expect(expand(tokenize('what does Lag mean'))).toEqual([]);
  });

  it('matches a phrase only when all of it is there, and every word of it is held by its terms', () => {
    const e = expandQuestion(tokenize('cards in the discard pile'));
    expect(e.terms).toEqual(['trash']);
    expect(e.held.get('discard')).toEqual(['trash']);
    expect(e.held.get('pile')).toEqual(['trash']);
    expect(expand(tokenize('discard a card'))).toEqual([]);
    expect(expand(tokenize('my units have summoning sickness'))).toEqual(['lag']);
  });
});

const rec = (id: string, title: string, text: string) => finishRecord({ id, kind: kindOfId(id)!, title, text, source: { file: 'fixture' }, origin: 'authored', scope: 'public' });
const FIXTURE = [
  rec('card:fx_hound', 'Glass Hound', 'Glass Hound: a Unit. {Play} Spend a rival Unit.'),
  rec('card:fx_saint', 'Rust Saint', 'Rust Saint: a Program. Play a Program from your trash.'),
  rec('card:fx_veil', 'Iron Veil', 'Iron Veil: a Gear. Equip to a friendly Unit. If the Unit would be defeated, defeat this Gear instead.'),
  rec('term:fx-trash', 'Trash', 'Trash: the public discard pile, where played Programs go.'),
  rec('term:fx-spent', 'Spent', 'Spent: a card turned sideways. A spent Unit can be attacked.'),
  rec('doc:fx.md#notes', 'Notes', 'Notes about a creature that taps an enemy in another game.'),
];
const IX = buildIndex(FIXTURE);
const ids = (q: string, tuning = {}) => {
  const r = search(IX, q, { k: 10, tuning });
  return { noMatch: r.noMatch, hits: r.hits.map((h) => h.record.id) };
};

describe('the search with the table', () => {
  it('returns exactly what it returned before the table when the table is off', () => {
    // pinned from the search as it was before step 4.6 (the same fixture and questions)
    const BEFORE: Record<string, { noMatch: boolean; hits: string[] }> = {
      'creature that taps an enemy': { noMatch: false, hits: ['doc:fx.md#notes'] },
      'replay a spell from the graveyard': { noMatch: true, hits: [] },
      'equipment destroyed instead of the unit': { noMatch: false, hits: ['card:fx_veil', 'card:fx_hound', 'term:fx-spent'] },
      'tap the enemy unit': { noMatch: false, hits: ['doc:fx.md#notes', 'card:fx_hound', 'card:fx_veil', 'term:fx-spent'] },
      'iron veil': { noMatch: false, hits: ['card:fx_veil'] },
      'nothing like this at all': { noMatch: true, hits: [] },
    };
    for (const [q, want] of Object.entries(BEFORE)) {
      expect(ids(q, { synonymWeight: 0, synonymCoverage: false }), q).toEqual(want);
      const off = search(IX, q, { k: 10, tuning: { synonymWeight: 0, synonymCoverage: false } });
      const plain = search(IX, q, { k: 10, tuning: { ...SEARCH_TUNING, synonymWeight: 0, synonymCoverage: false } });
      expect(off).toEqual(plain);
    }
  });

  it('counts the added terms in the keyword ranker only, at the given weight', () => {
    const q = 'replay a spell from the graveyard';
    const added = expand(tokenize(q));
    expect(added).toEqual(['program', 'trash']);
    expect(bm25Search(IX.bm25, q, { terms: added, weight: 0 })).toEqual(bm25Search(IX.bm25, q));
    const half = bm25Search(IX.bm25, q, { terms: added, weight: 0.5 });
    const full = bm25Search(IX.bm25, q, { terms: added, weight: 1 });
    const score = (rs: { id: string; score: number }[], id: string) => rs.find((r) => r.id === id)?.score ?? 0;
    expect(score(half, 'card:fx_saint')).toBeGreaterThan(0);
    expect(score(full, 'card:fx_saint')).toBeCloseTo(2 * score(half, 'card:fx_saint'), 10);
    // the floor: "spell" and "graveyard" are held by the hit's "program" and "trash" only with synonymCoverage
    expect(coverage(IX.bm25, 'card:fx_saint', q)).toBe(0);
    expect(coverage(IX.bm25, 'card:fx_saint', q, expandQuestion(tokenize(q)).held)).toBeCloseTo(2 / 3, 10);
    expect(ids(q, { synonymWeight: 1, synonymCoverage: false }).noMatch).toBe(true);
    expect(ids(q, { synonymWeight: 1, synonymCoverage: true }).hits).toContain('card:fx_saint');
    // the default since step 4.6 (kept after the held-out test): the table on, with coverage
    expect(SEARCH_TUNING.synonymWeight).toBe(1);
    expect(SEARCH_TUNING.synonymCoverage).toBe(true);
    expect(ids(q)).toEqual(ids(q, { synonymWeight: 1, synonymCoverage: true }));
  });

  it('takes its two settings from kb:eval --tune', () => {
    expect(parseTuning('synonymWeight=0.5,synonymCoverage=true')).toEqual({ synonymWeight: 0.5, synonymCoverage: true });
    for (const bad of ['synonymWeight=11', 'synonymWeight=-1', 'synonymCoverage=yes']) expect(typeof parseTuning(bad), bad).toBe('string');
  });

  it('leaves the exact names alone', () => {
    const r = search(IX, 'iron veil', { k: 10, tuning: { synonymWeight: 1, synonymCoverage: true } });
    expect(r.hits[0]?.record.id).toBe('card:fx_veil');
    expect(r.hits[0]?.ranks.exact).toBe(1);
  });
});

describe('kb:eval --by-type', () => {
  it('adds one paired comparison per answerable question type, and nothing without the flag', async () => {
    const run = async (...extra: string[]) => {
      const v = parseArgs(EVAL_SPEC, ['--split', 'dev', '--scope', 'public', '--config', 'exact+linked+keyword', '--compare', 'exact+keyword,exact+linked+keyword', '--json', ...extra]).values;
      return JSON.parse((await runEval(v)).stdout) as { comparisons: { type?: string }[] };
    };
    const plain = await run();
    expect(plain.comparisons.map((c) => c.type)).toEqual([undefined]);
    const typed = await run('--by-type');
    expect(typed.comparisons[0]!.type).toBeUndefined();
    expect(typed.comparisons.slice(1).map((c) => c.type)).toEqual(ANSWERABLE_TYPES.filter((t) => typed.comparisons.some((c) => c.type === t)));
    expect(typed.comparisons.length).toBeGreaterThan(2);
  }, 120_000);
});
