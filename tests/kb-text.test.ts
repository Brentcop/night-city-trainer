// Knowledge pack word forms (src/lib/kb/text.ts, docs/RAG_PLAN.md step 4.7a): the three stem modes. `s` gives exactly
// the tokens the pack had before the modes existed; `light` folds plurals, "-ing", "-ed" and the irregular forms of the
// game's verbs; `porter` is the published Porter (1980) algorithm after the irregular forms, checked against the worked
// examples of the paper. Short words, numbers and rule numbers are left alone; exact names are never stemmed; on the
// real public records no two different records' names come to meet.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { finishRecord } from '../src/lib/kb/build/record';
import { parseTuning } from '../src/lib/kb/eval';
import { buildIndex, lookup, PHRASE_KINDS, search, SEARCH_TUNING } from '../src/lib/kb/search';
import { IRREGULAR, porterStem, stem, STEM_MODES, tokenize, type StemMode } from '../src/lib/kb/text';
import { kindOfId, type KbRecord } from '../src/lib/kb/types';
import { buildFromSources } from '../scripts/kb-sources';

const ROOT = path.resolve(__dirname, '..');
const FOLDING: readonly StemMode[] = ['light', 'porter'];
const forms = (mode: StemMode, ws: string) => ws.split(' ').map((w) => stem(w, mode));

describe('stem mode s', () => {
  it('is the default and strips a plural "s" only, as the tokenizer always did', () => {
    expect(SEARCH_TUNING.stem).toBe('s');
    const text = 'Gigs Programs class process bus flipping triggered abilities stolen won Judy Álvarez’s rule 1.10.2 x2 7';
    // pinned from the tokenizer before step 4.7a
    expect(tokenize(text)).toEqual(['gig', 'program', 'class', 'process', 'bus', 'flipping', 'triggered', 'abilitie', 'stolen', 'won', 'judy', 'alvarez', 'rule', '1.10.2', 'x2', '7']);
    expect(tokenize(text, 's')).toEqual(tokenize(text));
  });
});

describe('stem modes light and porter', () => {
  it('make the forms of one word meet', () => {
    const groups = [
      'flip flipping flipped flips',
      'trigger triggered triggers triggering',
      'ability abilities',
      'attack attacks attacking attacked',
      'defeat defeated defeats',
      'play played playing plays',
      'steal stole stolen steals',
      'spend spent spends',
      'sell sold selling',
      'draw drew drawn draws',
      'pay paid',
      'choose chose chosen choosing',
      'win won winning',
      'lose lost losing',
      'make making made',
      'equip equipped equipping',
    ];
    for (const mode of FOLDING)
      for (const g of groups) expect(new Set(forms(mode, g)).size, `${mode}: ${g} → ${forms(mode, g).join(' ')}`).toBe(1);
  });

  it('light also folds plurals properly and handles a silent e and a doubled consonant', () => {
    for (const g of ['class classes', 'die dies dying died', 'match matches', 'hero heroes', 'enemy enemies', 'eddie eddies', 'use used using uses', 'shuffle shuffled shuffling', 'copy copied copies', 'reduce reduced', 'take taking taken', 'give giving given'])
      expect(new Set(forms('light', g)).size, `${g} → ${forms('light', g).join(' ')}`).toBe(1);
    // a word that only looks inflected keeps its form: "dice", "need", "add", "call", "pass", "bonus", "analysis"
    expect(forms('light', 'dice need speed add adding call calling pass bonus analysis')).toEqual(['dice', 'need', 'speed', 'add', 'add', 'call', 'call', 'pass', 'bonus', 'analysis']);
  });

  it('keep different words apart', () => {
    const apart: [string, string][] = [
      ['unit', 'unite'],
      ['ring', 'red'],
      ['bring', 'bed'],
      ['unit', 'gear'],
      ['unit', 'program'],
      ['unit', 'legend'],
      ['gear', 'program'],
      ['gear', 'legend'],
      ['program', 'legend'],
      ['dice', 'die'],
    ];
    for (const mode of FOLDING) for (const [a, b] of apart) expect(stem(a, mode), `${mode}: ${a} / ${b}`).not.toBe(stem(b, mode));
    // light touches no suffix but plurals, "-ing" and "-ed" (Porter folds "attacker" into "attack", as it should)
    expect(stem('legend', 'light')).not.toBe(stem('legendary', 'light'));
    expect(stem('attack', 'light')).not.toBe(stem('attacker', 'light'));
    expect(stem('attacker', 'porter')).toBe(stem('attack', 'porter'));
    // "ring" and "red" are not "-ing" and "-ed" forms of "r"
    for (const mode of STEM_MODES) expect(forms(mode, 'ring red bring shed thing')).toEqual(['ring', 'red', 'bring', 'shed', 'thing']);
  });

  it('leave numbers, rule numbers and short words alone in every mode', () => {
    for (const mode of STEM_MODES) {
      expect(tokenize('rule 1.10.2 and 7.3.1, 10 power, x2', mode)).toEqual(['rule', '1.10.2', '7.3.1', '10', 'power', 'x2']);
      expect(forms(mode, 'go up 10 x2')).toEqual(['go', 'up', '10', 'x2']);
    }
    // in s and light words of three letters are left alone too, but for an irregular form; porter stems them as the
    // published algorithm does ("bus" → "bu"), so that "day" and "days" or "use" and "uses" still meet
    expect(forms('light', 'bus gig set won ran met')).toEqual(['bus', 'gig', 'set', 'win', 'run', 'meet']);
    expect(forms('s', 'bus won')).toEqual(['bus', 'won']);
    expect(forms('porter', 'day days use uses')).toEqual(['dai', 'dai', 'us', 'us']);
  });

  it('list each irregular form once, with a plain form that is not itself an irregular form', () => {
    for (const [form, base] of Object.entries(IRREGULAR)) {
      expect(form, form).toMatch(/^[a-z]+$/);
      expect(IRREGULAR[base], `${base} is both a plain and an irregular form`).toBeUndefined();
    }
  });
});

describe('porterStem', () => {
  it("gives the published algorithm's outputs for the worked examples in Porter (1980)", () => {
    // every example of the paper, through the whole algorithm (the paper shows some at the step that changes them;
    // those are given here as the full algorithm ends them, e.g. "agreed" → "agree" in step 1b → "agre" in step 5a)
    const EX: Record<string, string> = {
      caresses: 'caress', ponies: 'poni', ties: 'ti', caress: 'caress', cats: 'cat',
      feed: 'feed', agreed: 'agre', plastered: 'plaster', bled: 'bled', motoring: 'motor', sing: 'sing',
      conflated: 'conflat', troubled: 'troubl', sized: 'size', hopping: 'hop', tanned: 'tan', falling: 'fall', hissing: 'hiss', fizzed: 'fizz', failing: 'fail', filing: 'file',
      happy: 'happi', sky: 'sky',
      relational: 'relat', conditional: 'condit', rational: 'ration', valenci: 'valenc', hesitanci: 'hesit', digitizer: 'digit', conformabli: 'conform', radicalli: 'radic',
      differentli: 'differ', vileli: 'vile', analogousli: 'analog', vietnamization: 'vietnam', predication: 'predic', operator: 'oper', feudalism: 'feudal', decisiveness: 'decis',
      hopefulness: 'hope', callousness: 'callous', formaliti: 'formal', sensitiviti: 'sensit', sensibiliti: 'sensibl',
      triplicate: 'triplic', formative: 'form', formalize: 'formal', electriciti: 'electr', electrical: 'electr', hopeful: 'hope', goodness: 'good',
      revival: 'reviv', allowance: 'allow', inference: 'infer', airliner: 'airlin', gyroscopic: 'gyroscop', adjustable: 'adjust', defensible: 'defens', irritant: 'irrit',
      replacement: 'replac', adjustment: 'adjust', dependent: 'depend', adoption: 'adopt', homologou: 'homolog', communism: 'commun', activate: 'activ', angulariti: 'angular',
      homologous: 'homolog', effective: 'effect', bowdlerize: 'bowdler',
      probate: 'probat', rate: 'rate', cease: 'ceas', controll: 'control', roll: 'roll',
      generalizations: 'gener', oscillators: 'oscil',
    };
    for (const [w, s] of Object.entries(EX)) expect(porterStem(w), w).toBe(s);
  });
});

const rec = (id: string, title: string, text: string): KbRecord => finishRecord({ id, kind: kindOfId(id)!, title, text, source: { file: 'fixture' }, origin: 'authored', scope: 'public' });
const FIXTURE = [
  rec('card:fx_flipper', 'Mirror Flipper', 'Mirror Flipper: a Unit. When you flip a Legend, draw a card.'),
  rec('card:fx_thief', 'Night Thief', 'Night Thief: a Unit. When it attacks, steal a Gig.'),
  rec('term:fx-ability', 'Ability', 'Ability: the text of a card that does something.'),
  rec('term:fx-trash', 'Trash', 'Trash: the public discard pile.'),
];

describe('the stem mode belongs to the index', () => {
  it('stems records and question alike, and leaves exact names alone', () => {
    const plain = buildIndex(FIXTURE);
    expect(plain.bm25.stem).toBe('s');
    expect(search(plain, 'flipping', { k: 10 }).noMatch).toBe(true);
    for (const mode of FOLDING) {
      const ix = buildIndex(FIXTURE, { stem: mode });
      expect(ix.bm25.stem).toBe(mode);
      expect(search(ix, 'flipping', { k: 10 }).hits[0]?.record.id, mode).toBe('card:fx_flipper');
      expect(search(ix, 'which unit stole gigs', { k: 10 }).hits[0]?.record.id, mode).toBe('card:fx_thief');
      expect(search(ix, 'abilities', { k: 10 }).hits[0]?.record.id, mode).toBe('term:fx-ability');
      // names: by nameKey, never by stems
      expect(lookup(ix, 'Mirror Flipper').map((r) => r.id)).toEqual(['card:fx_flipper']);
      expect(lookup(ix, 'Mirror Flip')).toEqual([]);
      expect(search(ix, 'night thief', { k: 10 }).hits[0]?.ranks.exact).toBe(1);
      // the synonym table still works: "graveyard" means trash
      expect(search(ix, 'graveyard', { k: 10 }).hits[0]?.record.id, mode).toBe('term:fx-trash');
    }
  });

  it('refuses a search whose tuning names another mode than its index, and takes the mode from kb:eval --tune', () => {
    const ix = buildIndex(FIXTURE, { stem: 'light' });
    expect(() => search(ix, 'flip', { tuning: { stem: 'porter' } })).toThrow(/stem mode light/);
    expect(search(ix, 'flip', { tuning: { stem: 'light' } })).toEqual(search(ix, 'flip'));
    expect(parseTuning('stem=porter')).toEqual({ stem: 'porter' });
    expect(parseTuning('stem=light,synonymWeight=1')).toEqual({ stem: 'light', synonymWeight: 1 });
    expect(typeof parseTuning('stem=snowball')).toBe('string');
  });
});

describe('on the real public records', () => {
  it('no two records with different names come to meet, and mode s searches exactly as the default index', async () => {
    const { records } = await buildFromSources(ROOT, { raw: false });
    const pub = records.filter((r) => r.scope === 'public');
    // the title of each record a question may name (PHRASE_KINDS; doc and code titles are headings and paths) as the
    // keyword ranker sees it: two different records whose titles meet in a mode must already have met under s. (Paths
    // do meet: "scripts/tune.ts" and "scripts/tuning.ts" in light and porter.)
    const meets = (mode: StemMode) => {
      const by = new Map<string, Set<string>>();
      for (const r of pub.filter((x) => PHRASE_KINDS.includes(x.kind))) {
        const k = tokenize(r.title, mode).join(' ');
        if (!k) continue;
        by.set(k, (by.get(k) ?? new Set()).add(r.title.toLowerCase()));
      }
      return new Set([...by.values()].filter((s) => s.size > 1).flatMap((s) => [...s].sort().map((t, i, all) => (i ? `${all[0]} = ${t}` : '')).filter(Boolean)));
    };
    const before = meets('s');
    for (const mode of FOLDING) {
      const fresh = [...meets(mode)].filter((p) => !before.has(p));
      expect(fresh, mode).toEqual([]);
    }
    const def = buildIndex(pub);
    const s = buildIndex(pub, { stem: 's' });
    for (const q of ['flipping legends early', 'rulings on chrome fang', 'how many gigs does a 10 power attacker steal', 'rule 1.10', 'which decks use the relic'])
      expect(search(s, q, { k: 10 }), q).toEqual(search(def, q, { k: 10 }));
  }, 120_000);
});
