// Knowledge pack: the synonym table (docs/RAG_PLAN.md step 4.6). Players ask in everyday words, or in the words of other
// card games ("tap", "graveyard", "creature", "opponent"), where the records use this game's own terms (spend, trash,
// Unit, rival). Each entry says which words or short phrases a player may use (`says`), which of this game's terms they
// stand for (`means`) and why. `expand` gives the terms a tokenized question adds: the keyword ranker counts them at
// SearchTuning.synonymWeight (0: off), and with SearchTuning.synonymCoverage a question word counts as held for the
// "no match" floor when a hit holds one of its expansions. The exact-name and linked rankers never read the table. Word
// forms the `s` tokenizer does not fold (past tenses, "-ing", "-ies") are matched here, on the question's `s` tokens in
// every stem mode; the terms it adds are stemmed in the index's mode (step 4.7a). An entry must be a general fact
// about vocabulary that would hold without the question set, never a fix for one question; tests/kb-synonyms.test.ts
// checks that every `means` term is in the pack and that no `says` word is a game term or card name of its own.
import { tokenize, type StemMode } from './text';

export interface Synonym {
  /** words or short phrases a player may use, in their plain form ("tap", "discard pile") */
  says: readonly string[];
  /** this game's terms they stand for, as the cards, rules and glossary write them */
  means: readonly string[];
  /** the reason, in one line */
  why: string;
}

export const SYNONYMS: readonly Synonym[] = [
  // ---- words from other card games
  { says: ['tap', 'exhaust', 'exert', 'sideways'], means: ['spend', 'spent'], why: 'Turning a card sideways is spending it (glossary Spent / Ready); Magic says tap, other games exhaust or exert.' },
  { says: ['untap'], means: ['ready'], why: "Magic's untap is this game's ready: spent cards ready at the start of your turn." },
  { says: ['graveyard', 'discard pile'], means: ['trash'], why: 'The trash is the public discard pile (glossary Trash); Magic and Yu-Gi-Oh! call it the graveyard.' },
  { says: ['mill'], means: ['trash'], why: 'Putting cards from the top of the deck into the trash is milling in other games (glossary: Trash X = mill X).' },
  { says: ['creature', 'minion', 'monster', 'follower', 'character', 'ally'], means: ['unit'], why: 'Units are the cards that fight on the field: creatures in Magic, minions in Hearthstone, monsters in Yu-Gi-Oh!, characters in Lorcana and One Piece.' },
  { says: ['spell', 'instant', 'sorcery'], means: ['program'], why: 'Programs are the one-shot cards played from hand: the spells, instants and sorceries of other games.' },
  { says: ['equipment', 'attachment'], means: ['gear'], why: 'Gear is equipped to a Unit or face-up Legend (glossary Gear); other games call such cards equipment or attachments.' },
  { says: ['attach'], means: ['equip'], why: 'Attaching a card to a Unit is equipping it in this game.' },
  { says: ['mana', 'resource', 'currency', 'cash'], means: ['eddie'], why: "Eddies are the game's mana, the resource that pays costs (glossary Eddies: 'your permanent mana')." },
  { says: ['ink', 'inkwell', 'pitch'], means: ['sell'], why: "Putting a card from hand into the resource area is Sell for Turn: Lorcana's inkwell, Flesh and Blood's pitch." },
  { says: ['opponent', 'enemy', 'foe'], means: ['rival'], why: 'The cards and rules call the other player the rival.' },
  { says: ['kill', 'destroy', 'slay'], means: ['defeat'], why: 'A Unit that loses a fight is defeated (CR 11.4), not killed or destroyed.' },
  { says: ['wipe', 'sweeper'], means: ['defeat'], why: 'A board wipe or sweeper defeats every Unit (or many) at once; the cards write "defeat all".' },
  { says: ['cast', 'summon'], means: ['play'], why: 'Cards are played here: Magic casts spells and Yu-Gi-Oh! summons monsters.' },
  { says: ['indestructible'], means: ['defeated'], why: "What other games call indestructible is written \"can't be defeated\" here." },
  { says: ['banish'], means: ['remove', 'removed'], why: "Yu-Gi-Oh!'s banish (Magic's exile) is \"removed from the game\" here." },
  { says: ['battlefield', 'board'], means: ['field'], why: "Cards in play are on the field (\"leaves the field\"); Magic says battlefield and players say board." },
  { says: ['hero', 'commander', 'leader'], means: ['legend'], why: "A deck's three Legends lead it, as a Hearthstone hero, a Magic commander or a One Piece leader does." },
  { says: ['haste', 'rush'], means: ['adrenaline'], why: "Adrenaline lets a Unit attack the turn it is played (CR 11.27): Magic's haste, Hearthstone's rush." },
  { says: ['flash'], means: ['quick'], why: "Quick lets a card be played during the rival's attack (CR 11.30), as Magic's flash lets a card be cast at any time." },
  { says: ['summoning sickness', 'summoning sick'], means: ['lag'], why: "Lag is Magic's summoning sickness: a Unit can't attack or use {Spend} the turn it enters (CR 11.3)." },
  { says: ['tutor'], means: ['search'], why: 'A tutor in Magic finds a card in the deck; this game says search.' },
  { says: ['scry', 'peek'], means: ['look'], why: 'Looking at hidden cards (the top of a deck, a face-down Legend) is scrying in Magic, peeking in plain words.' },
  { says: ['bounce'], means: ['return', 'hand'], why: "Bouncing a card is returning it from the field to its owner's hand." },
  { says: ['library'], means: ['deck'], why: "Magic's library is the deck." },
  { says: ['buff', 'pump', 'toughness'], means: ['power'], why: "Power is a Unit's one combat number; a buff or pump raises it, and other games split it into attack and toughness." },
  { says: ['swing'], means: ['attack'], why: 'Swinging at a player or a creature is attacking.' },
  { says: ['respond', 'response'], means: ['react', 'reaction'], why: "Answering an attack is a reaction in the React Step (CR 9.7); Magic says \"in response\"." },
  { says: ['stack'], means: ['pending'], why: "Triggers wait as pending effects (CR 10.11), where Magic puts them on the stack." },
  { says: ['unblockable'], means: ['blocked'], why: "What other games call unblockable is written \"can't be blocked\" here." },
  { says: ['fatigue', 'decking'], means: ['deck out'], why: 'Having to draw from an empty deck is a deck out (CR 1.14); Hearthstone calls it fatigue.' },
  { says: ['etb'], means: ['play'], why: "Magic's ETB (enters the battlefield) trigger is a {Play} trigger here." },
  { says: ['upkeep'], means: ['start phase'], why: "Magic's upkeep is the Start Phase, when start-of-turn effects happen." },
  { says: ['victory point'], means: ['gig'], why: 'The game is won on 7 Gigs: they are its victory points.' },
  // ---- this game's own vocabulary
  { says: ['dice'], means: ['gig'], why: 'A Gig is one die (glossary Gig). ("die" is left out: the tokenizer folds "dies" into it.)' },
  { says: ['reputation'], means: ['street cred'], why: 'Street Cred is the reputation score, the sum of your Gig values (glossary Street Cred).' },
  { says: ['eurodollar', 'euro'], means: ['eddie'], why: "Eddies are Cyberpunk's eurodollars (€$)." },
  { says: ['facedown'], means: ['face down'], why: 'Written as one word, face-down does not match the records, which split it in two.' },
  { says: ['faceup'], means: ['face up'], why: 'Written as one word, face-up does not match the records, which split it in two.' },
  { says: ['flip'], means: ['call'], why: 'Flipping a face-down Legend face-up is a Call (CR 8.12).' },
  { says: ['cheaper'], means: ['cost'], why: 'A card that gets cheaper has its cost reduced (glossary Cost reductions).' },
];

/** The forms a question token may be the inflection of, itself first: "tapped" → tap, "killing" → kill, "enemie" → enemy. */
export function wordForms(t: string): string[] {
  const out = [t];
  const add = (x: string) => x.length > 2 && !out.includes(x) && out.push(x);
  const undouble = (x: string) => (/([b-df-hj-np-tv-z])\1$/.test(x) ? x.slice(0, -1) : x);
  for (const suffix of ['ed', 'ing']) {
    if (!t.endsWith(suffix) || t.length <= suffix.length + 2) continue;
    const base = t.slice(0, -suffix.length);
    add(base);
    add(undouble(base));
    add(`${base}e`);
  }
  // the tokenizer strips a plural "s" only: "enemies" → "enemie", "heroes" → "heroe"
  if (t.endsWith('ie') && t.length > 4) add(`${t.slice(0, -2)}y`);
  if (t.endsWith('oe') && t.length > 4) add(t.slice(0, -1));
  return out;
}

interface Phrase {
  words: string[];
  means: string[];
}

/**
 * Each `says` phrase as plain (`s` mode) tokens, with the tokens of its `means` in the index's stem mode, longest phrase
 * first; built once per mode.
 */
const phrases = new Map<StemMode, Phrase[]>();
function table(mode: StemMode): Phrase[] {
  let t = phrases.get(mode);
  if (!t) {
    t = SYNONYMS.flatMap((e) => {
      const means = [...new Set(e.means.flatMap((m) => tokenize(m, mode)))];
      return e.says.map((s) => ({ words: tokenize(s), means }));
    }).sort((a, b) => b.words.length - a.words.length);
    phrases.set(mode, t);
  }
  return t;
}

export interface Expansion {
  /** the added terms, in the order the question first reaches them, none of them a token of the question */
  terms: string[];
  /** question token → this game's terms that hold it (every token of a matched phrase gets the phrase's terms) */
  held: Map<string, string[]>;
}

/**
 * The synonym table applied to a tokenized question (tokens from text.ts `tokenize`, mode `s`). The longest phrase
 * wins: a word inside a matched phrase ("summoning" in "summoning sickness") is not matched again on its own. For an
 * index stemmed in another mode, pass the mode and the same words' tokens in it (`modeTokens`, one per token): the
 * phrases are still matched on the plain tokens, and the added terms and the `held` keys are in that mode.
 */
export function expandQuestion(tokens: readonly string[], mode: StemMode = 's', modeTokens: readonly string[] = tokens): Expansion {
  if (modeTokens.length !== tokens.length) throw new Error(`expandQuestion needs one mode token per token, got ${modeTokens.length} and ${tokens.length}`);
  const forms = tokens.map(wordForms);
  const held = new Map<string, string[]>();
  const terms: string[] = [];
  const used = new Set<number>();
  for (let i = 0; i < tokens.length; i++)
    for (const p of table(mode)) {
      if (i + p.words.length > tokens.length) continue;
      if (!p.words.every((w, j) => !used.has(i + j) && forms[i + j]!.includes(w))) continue;
      for (let j = 0; j < p.words.length; j++) {
        if (p.words.length > 1) used.add(i + j);
        const tok = modeTokens[i + j]!;
        const list = held.get(tok) ?? [];
        for (const m of p.means) if (!list.includes(m)) list.push(m);
        held.set(tok, list);
      }
      for (const m of p.means) if (!terms.includes(m) && !modeTokens.includes(m)) terms.push(m);
    }
  return { terms, held };
}

/** The terms the synonym table adds to a tokenized question. */
export const expand = (tokens: readonly string[]): string[] => expandQuestion(tokens).terms;
