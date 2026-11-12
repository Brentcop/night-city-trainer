// Synergy catalogue: the shared types and the condition vocabulary (docs/ROADMAP2.md §1 steps 1–2, docs/SYNERGIES.md).
//
// A synergy is a package of cards that are worth more together than apart: a shared type, Gig values pushed down or up,
// Street Cred kept low or high, Gear on Units, a full trash, and so on. Each entry names its cards (explicit ids, or a
// plain-data class such as "ARASAKA Units" when the payoff's own text names that class), says which cards make the
// condition happen (enablers) and which reward it (payoffs), whether the pieces need each other, how many pieces a deck
// needs before it is "built around" the package, and what "online" means as a board condition a game record can observe.
// The entries are human-edited, like the deck objectives: they start as `draft` and the owner sets `status: 'owner'`
// after checking one. Keep the condition vocabulary small; add a term only when a condition can't be phrased with the
// existing ones, and give it a definition in CONDITION_TERMS and an evaluator in ./index.ts.
import type { CardType, Keyword } from '../../engine/types';

/**
 * What a card does for the package.
 *   enabler  makes the condition happen (lowers a Gig, puts a Unit of the type on the field, fills the trash, ...)
 *   payoff   is rewarded when the condition holds
 *   both     does both (e.g. lowers a Gig and draws if it became a min Gig): counts as either role, one at a time
 *   piece    a package with no enabler / payoff split (every member is the same kind of card)
 */
export type SynergyRole = 'enabler' | 'payoff' | 'both' | 'piece';
export const SYNERGY_ROLES: readonly SynergyRole[] = ['enabler', 'payoff', 'both', 'piece'];

/**
 * - requires: the payoffs do little or nothing without the enablers (or the reverse).
 * - helps:    every piece works alone; together they work better.
 */
export type SynergyBond = 'requires' | 'helps';

/** The kind of interaction, for grouping on the site. */
export type SynergyFamily = 'gig-value' | 'street-cred' | 'type' | 'gear' | 'program' | 'trash' | 'legends' | 'tempo';

/**
 * A plain-data card class. A card matches when every given field matches. `types` with 'Unit' and `goSoloLegends`
 * also matches Legends with Go Solo (they are Units while on the field).
 */
export interface CardPredicate {
  types?: CardType[];
  goSoloLegends?: boolean;
  /** at least one of these tags (the cards' classifications, e.g. "Arasaka", "Braindance") */
  tagsAny?: string[];
  keyword?: Keyword;
  /** printed power at least this (Units with power 0 don't steal Gigs) */
  minPower?: number;
  /** case-insensitive regular expression over the card text: for proposals only, never for membership */
  text?: string;
}

/** Explicit members: card ids from src/data/cards.json with their role and, where useful, what the card does here. */
export interface SynergyMember {
  id: string;
  role: SynergyRole;
  note?: string;
}

/**
 * A class of members the payoffs' own text names exactly (e.g. "a friendly ARASAKA Unit", "a BRAINDANCE Program"), so
 * every card of the class belongs. `except` drops cards of the class that can't do the job, with the reason.
 */
export interface SynergyGroup {
  role: SynergyRole;
  where: CardPredicate;
  label: string;
  except?: { id: string; why: string }[];
}

/** How many pieces of which roles. `enabler` and `payoff` may be filled by `both` cards; `any` counts every member. */
export interface PieceCount {
  enabler?: number;
  payoff?: number;
  any?: number;
}

/**
 * The condition vocabulary for `online`. Each term is something the synergy observer can see in a game record from the
 * player's own point of view (src/engine/telemetry.ts board snapshots and decision records): what is on their field,
 * their Gigs, both Street Creds, their trash, and the cards they used this turn. Definitions use the Comprehensive
 * Rules' names (min Gig = a Gig die at its lowest value, value-pair = two friendly Gigs with the same value, Street Cred =
 * the sum of your Gig values, Null with no Gigs).
 */
export const CONDITION_TERMS = {
  all: 'Every listed condition holds at the same moment.',
  any: 'At least one listed condition holds.',
  'in-play':
    'At least `min` of the package’s cards (of `role`, if given) are in play for you: Units on the field (Legends there included), Gear equipped to a friendly Unit or Legend, and face-up Legends. Programs are never in play: use `used`.',
  used: 'At least `min` (default 1) of the package’s cards (of `role`, if given) were used by you this turn: played from hand, Called, gone solo, played as a Legend, an ability activated, an attack declared, or a reaction (block, Quick Program, quick ability). Selling is not a use. Cards an effect plays for free are not seen.',
  'min-gig': 'At least `min` friendly Gigs are min Gigs (value 1).',
  'high-gig': 'At least `min` friendly Gigs have a value of `at` or more (8 unless given).',
  'max-gig': 'At least `min` friendly Gigs are max Gigs (value equal to the die’s sides).',
  'value-pair': 'At least `min` friendly value-pairs (two Gigs with the same value; a Gig counts in one pair only).',
  'distinct-values': 'Your Gigs show at least `min` different values.',
  'even-and-odd': 'You control a Gig with an even value and a Gig with an odd value.',
  'cred-even': 'Your Street Cred is an even number (Null is neither).',
  'cred-vs-rival': 'Your Street Cred is less (`cmp: less`) or more (`cmp: more`) than the rival’s; Null counts as the lowest.',
  'cred-at-least': 'Your Street Cred is at least `value`.',
  'gigs-behind': 'The rival controls at least `by` more Gigs than you.',
  equipped: 'At least `min` friendly Units and Legends have Gear equipped.',
  'legends-up': 'At least `min` of your Legends are face-up (in the Legends area or on the field).',
  trash: 'Your trash holds at least `min` cards of card type `type`.',
} as const;

export type ConditionTerm = keyof typeof CONDITION_TERMS;
export const CONDITION_TERM_NAMES = Object.keys(CONDITION_TERMS) as ConditionTerm[];

/** An `online` condition: plain data over the CONDITION_TERMS. */
export type SynergyCondition =
  | { term: 'all'; of: SynergyCondition[] }
  | { term: 'any'; of: SynergyCondition[] }
  | { term: 'in-play'; role?: SynergyRole[]; min: number }
  | { term: 'used'; role?: SynergyRole[]; min?: number }
  | { term: 'min-gig'; min: number }
  | { term: 'high-gig'; min: number; at?: number }
  | { term: 'max-gig'; min: number }
  | { term: 'value-pair'; min: number }
  | { term: 'distinct-values'; min: number }
  | { term: 'even-and-odd' }
  | { term: 'cred-even' }
  | { term: 'cred-vs-rival'; cmp: 'less' | 'more' }
  | { term: 'cred-at-least'; value: number }
  | { term: 'gigs-behind'; by: number }
  | { term: 'equipped'; min: number }
  | { term: 'legends-up'; min: number }
  | { term: 'trash'; type: CardType; min: number };

/**
 * - draft: written from the card text as a starting point; the owner has not checked it.
 * - owner: written or confirmed by the owner. Set this after editing an entry.
 */
export type SynergyStatus = 'draft' | 'owner';

export interface Synergy {
  /** stable id (kebab-case); reports and links use it, so never reuse one for a different package */
  id: string;
  name: string;
  /** one line in plain words: what the package does */
  description: string;
  family: SynergyFamily;
  bond: SynergyBond;
  /** explicit members */
  members: SynergyMember[];
  /** members by class (see SynergyGroup) */
  groups?: SynergyGroup[];
  /**
   * Predicates that PROPOSE members (e.g. "text mentions a min Gig"). Every card one of them matches must be a member or
   * be listed in `rejected` with the reason, so a new card that fits is noticed (tests/synergies.test.ts).
   */
  propose?: CardPredicate[];
  rejected?: { id: string; why: string }[];
  /** the pieces that make the package work at all: what "assembled" and the draw odds count */
  needs: PieceCount;
  /** the minimum a list must hold to count as built around the package (Legends count one each) */
  builtAround: PieceCount;
  /** what "online" means, as a board condition */
  online: SynergyCondition;
  /** the condition in plain words */
  onlineText: string;
  status: SynergyStatus;
}
