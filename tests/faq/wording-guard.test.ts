// The repository holds our own paraphrases of the official FAQ and rules, never their wording (CLAUDE.md "Rules FAQ
// conformance"; NOTICE.md; docs/RAG_PLAN.md M6 and step 0.3). The official texts are local-only (data/raw/, gitignored),
// so each source's scan is skipped, not failed, when its file is absent, as in consistency.test.ts.
//
// A tracked text file fails when it shares RUN_WORDS or more consecutive words with a source. Words are compared lower
// case with punctuation dropped. Card rules text legitimately appears on both sides (src/data/cards.json, quoted in
// comments, and in the FAQ's questions), so a word that sits inside a CARD_WORDS-word run of some card's own text does
// not count towards a run's length. Messages name the file, the line and the run length, never the matched text.
//
// Measured on 2026-11-13, before this guard's paraphrases (runs left after the card-text rule, against the FAQ /
// Comprehensive Rules / Tournament Rules / errata): 9 / 13 / 0 / 0 at 8 words, 1 / 2 / 0 / 0 at 10, 1 / 2 / 0 / 0 at 12.
// The 8- and 9-word runs are our one-line paraphrases and glossary definitions using the same plain game terms; every
// run of 10 or more was a copied sentence. Without the card-text rule the 18-word match in src/engine/scripts/blue.ts
// is the card's own 17-word ability (quoted there and in the FAQ) plus one word next to it, so it needs no exception.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { codeFiles } from '../../scripts/game-cache';

/** The shortest shared run that fails. */
export const RUN_WORDS = 10;
/** A word inside a run of this many words from a card's own text counts as card text. */
export const CARD_WORDS = 6;

interface Source {
  name: string;
  file: string;
  /** The separate passages of the source: a run never spans two. */
  passages: (raw: string) => string[];
}

const SOURCES: Source[] = [
  {
    name: 'FAQ',
    file: 'data/raw/official_rules_faq.json',
    passages: (raw) => (JSON.parse(raw) as { items: { question: string; answer: string }[] }).items.flatMap((i) => [i.question, i.answer]),
  },
  { name: 'Comprehensive Rules', file: 'data/raw/official_comprehensive_rules.txt', passages: (raw) => [raw] },
  { name: 'Tournament Rules', file: 'data/raw/official_tournament_rules.txt', passages: (raw) => [raw] },
  { name: 'errata', file: 'data/raw/official_errata.txt', passages: (raw) => [raw] },
];

/**
 * A file allowed to keep a quotation for now: at most `runs` runs, none longer than `longest` words. Only for files the
 * game cache hashes (scripts/game-cache.ts `codeHash`), where editing even a comment discards the cached games.
 */
export interface QuoteException {
  file: string;
  source: string;
  longest: number;
  runs: number;
  reason: string;
}

const AT_NEXT_CACHE_CHANGE = 'paraphrase at the next change that turns the game cache over; docs/RAG_PLAN.md step 0.3';

export const EXCEPTIONS: QuoteException[] = [
  // The doc comment of Game.playLegend and of the function it hands over to copy one sentence of rule 4.5.
  { file: 'src/engine/engine.ts', source: 'Comprehensive Rules', longest: 15, runs: 1, reason: AT_NEXT_CACHE_CHANGE },
  { file: 'src/engine/game/actions.ts', source: 'Comprehensive Rules', longest: 15, runs: 1, reason: AT_NEXT_CACHE_CHANGE },
];

// ---------------------------------------------------------------- matching

export interface Tokens {
  words: string[];
  /** 1-based line of each word */
  lines: number[];
}

/** Lower case, accents and punctuation dropped (apostrophes and hyphens join a word; anything else separates). */
export function tokenize(text: string): Tokens {
  const words: string[] = [];
  const lines: number[] = [];
  text.split('\n').forEach((line, i) => {
    const flat = line
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['‘’-]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (!flat) return;
    for (const w of flat.split(' ')) {
      words.push(w);
      lines.push(i + 1);
    }
  });
  return { words, lines };
}

/** Every n-word shingle of the passages, plus their opening word pairs for a cheap first test. */
export interface Shingles {
  n: number;
  all: Set<string>;
  pairs: Set<string>;
}

export function shingles(passages: string[], n: number): Shingles {
  const all = new Set<string>();
  const pairs = new Set<string>();
  for (const p of passages) {
    const { words } = tokenize(p);
    for (let i = 0; i + n <= words.length; i++) {
      all.add(words.slice(i, i + n).join(' '));
      pairs.add(`${words[i]} ${words[i + 1]}`);
    }
  }
  return { n, all, pairs };
}

/** Which words of `words` are covered by some shingle of `set`. */
export function covered(words: string[], set: Shingles): Uint8Array {
  const out = new Uint8Array(words.length);
  for (let i = 0; i + set.n <= words.length; i++) {
    if (!set.pairs.has(`${words[i]} ${words[i + 1]}`)) continue;
    if (set.all.has(words.slice(i, i + set.n).join(' '))) out.fill(1, i, i + set.n);
  }
  return out;
}

export interface Run {
  /** line of the run's first word */
  line: number;
  /** words in the run that are not card text */
  length: number;
}

/** Shared runs of at least `source.n` words, each measured without its card-text words. */
export function sharedRuns(tokens: Tokens, source: Shingles, cardText: Uint8Array): Run[] {
  const hit = covered(tokens.words, source);
  const runs: Run[] = [];
  for (let i = 0; i < hit.length; ) {
    if (!hit[i]) {
      i++;
      continue;
    }
    let j = i;
    let length = 0;
    for (; j < hit.length && hit[j]; j++) if (!cardText[j]) length++;
    if (length >= source.n) runs.push({ line: tokens.lines[i]!, length });
    i = j;
  }
  return runs;
}

/** What is wrong with one file's runs against one source. Never includes the matched text. */
export function problems(file: string, sourceName: string, runs: Run[], exception?: QuoteException): string[] {
  const where = (r: Run) => `${file}:${r.line} (${r.length} words)`;
  if (!exception) return runs.map((r) => `${where(r)} matches the ${sourceName}: paraphrase it`);
  if (!runs.length) return [`${file}: its exception for the ${sourceName} is no longer needed: remove it from EXCEPTIONS`];
  const over = runs.length > exception.runs || runs.some((r) => r.length > exception.longest);
  if (!over) return [];
  return [
    `${file} may keep ${exception.runs} run(s) of at most ${exception.longest} words from the ${sourceName} ` +
      `(${exception.reason}), but has ${runs.map(where).join(', ')}: paraphrase the new or longer one`,
  ];
}

// ---------------------------------------------------------------- the repository

interface Doc {
  file: string;
  tokens: Tokens;
  cardText: Uint8Array;
}

let docsMemo: Doc[] | null = null;
function trackedDocs(): Doc[] {
  if (docsMemo) return docsMemo;
  const cards = JSON.parse(fs.readFileSync('src/data/cards.json', 'utf8')) as { text?: string }[];
  const cardSet = shingles(
    cards.map((c) => c.text ?? ''),
    CARD_WORDS,
  );
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  docsMemo = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue; // deleted in the working tree
    const buf = fs.readFileSync(file);
    if (buf.includes(0)) continue; // binary
    const tokens = tokenize(buf.toString('utf8'));
    docsMemo.push({ file, tokens, cardText: covered(tokens.words, cardSet) });
  }
  return docsMemo;
}

describe('FAQ and rules wording guard: the matcher (invented text, no local files needed)', () => {
  const SOURCE = [
    'Whenever the lantern keeper hums at dusk, every pigeon on the old bridge must fly twice around the clock tower.',
    'A second passage about marmalade.',
  ];
  const CARDS = ['Gain 2 widgets, then each friendly gadget wiggles once.'];
  const runsIn = (text: string, cards = CARDS) => {
    const tokens = tokenize(text);
    return sharedRuns(tokens, shingles(SOURCE, RUN_WORDS), covered(tokens.words, shingles(cards, CARD_WORDS)));
  };

  it('finds a quotation, ignoring case and punctuation, and reports its line and length', () => {
    const text = 'const a = 1;\n// Note:\n// "every PIGEON on the old-bridge" -- must fly twice around the clock... tower!\n';
    // "old-bridge" joins into one word, so this side reads "oldbridge"; the source has "old bridge"
    expect(runsIn(text)).toEqual([]);
    const quoted = 'const a = 1;\n// Note: when the lantern keeper hums at dusk, EVERY pigeon on the old\n// bridge must fly twice.\n';
    expect(runsIn(quoted)).toEqual([{ line: 2, length: 15 }]); // "the lantern ... fly twice", over two lines
  });

  it('lets a run shorter than RUN_WORDS through', () => {
    expect(runsIn('// every pigeon on the old bridge must fly twice')).toEqual([]); // 9 words
    expect(runsIn('// every pigeon on the old bridge must fly twice around')).toEqual([{ line: 1, length: 10 }]);
  });

  it('does not count words that are card text', () => {
    const cards = ['every pigeon on the old bridge must fly'];
    // 13 shared words, 8 of them a card's own text: 5 left
    expect(runsIn('when the lantern keeper hums at dusk, every pigeon on the old bridge must fly', cards)).toEqual([]);
    const longer = 'whenever the lantern keeper hums at dusk every pigeon on the old bridge must fly twice around the clock tower';
    expect(runsIn(longer, cards)).toEqual([{ line: 1, length: 12 }]); // 20 shared, 8 of them card text
  });

  it('never joins two passages into one run', () => {
    expect(runsIn('around the clock tower. A second passage about marmalade and more words here')).toEqual([]);
  });

  it('names file, line and length in its message, never the text', () => {
    const msgs = problems('docs/x.md', 'FAQ', runsIn('// when the lantern keeper hums at dusk, every pigeon on the old bridge'));
    expect(msgs).toEqual(['docs/x.md:1 (12 words) matches the FAQ: paraphrase it']);
    for (const w of ['lantern', 'pigeon', 'bridge']) expect(msgs.join(' ')).not.toContain(w);
  });

  it('an exception allows only its own runs: not a longer one, not a new one, and it goes when the quotation does', () => {
    const ex: QuoteException = { file: 'src/x.ts', source: 'FAQ', longest: 12, runs: 1, reason: 'why' };
    expect(problems('src/x.ts', 'FAQ', [{ line: 4, length: 12 }], ex)).toEqual([]);
    expect(problems('src/x.ts', 'FAQ', [{ line: 4, length: 13 }], ex)).toHaveLength(1);
    expect(problems('src/x.ts', 'FAQ', [{ line: 4, length: 12 }, { line: 40, length: 10 }], ex)).toHaveLength(1);
    expect(problems('src/x.ts', 'FAQ', [], ex)[0]).toMatch(/no longer needed/);
  });
});

for (const source of SOURCES) {
  const present = fs.existsSync(source.file);
  describe.skipIf(!present)(`FAQ and rules wording guard: tracked files against the ${source.name} (${source.file})`, () => {
    it(
      `no tracked file shares ${RUN_WORDS} or more words in a row with it, card text aside`,
      () => {
        const set = shingles(source.passages(fs.readFileSync(source.file, 'utf8')), RUN_WORDS);
        const bad: string[] = [];
        for (const doc of trackedDocs()) {
          const exception = EXCEPTIONS.find((e) => e.file === doc.file && e.source === source.name);
          bad.push(...problems(doc.file, source.name, sharedRuns(doc.tokens, set, doc.cardText), exception));
        }
        expect(bad).toEqual([]);
      },
      120_000,
    );
  });
}

describe('FAQ and rules wording guard: exceptions', () => {
  it('each names a known source, a reason and a file the game cache hashes (others are paraphrased now)', () => {
    const cacheFiles = codeFiles();
    for (const e of EXCEPTIONS) {
      expect(SOURCES.map((s) => s.name)).toContain(e.source);
      expect(e.reason).toMatch(/game cache/);
      expect(e.longest).toBeGreaterThanOrEqual(RUN_WORDS);
      expect(e.runs).toBeGreaterThanOrEqual(1);
      expect(cacheFiles).toContain(e.file);
    }
  });
});
