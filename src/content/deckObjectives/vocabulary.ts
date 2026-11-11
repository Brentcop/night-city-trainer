// Deck objectives: the shared types and the signal vocabulary (docs/ROADMAP.md §5 and §7).
//
// Every library deck gets a short, human-authored strategy note: what the deck is trying to do, how, with which cards,
// and the observable signals that say the plan is working. The success signals name the terms below so that telemetry
// (src/engine/telemetry.ts, src/analysis/decisions.ts) can later check them; keep the vocabulary small and add a term
// only when a signal can't be phrased with the existing ones. The entries live next to this file, one table per group.

/**
 * The shared vocabulary for success signals. Each term is something a game record can observe. Definitions use the
 * Comprehensive Rules' names; "round" follows the telemetry report (round = ceil(global turn / 2)).
 */
export const VOCABULARY = {
  round: 'A pair of turns: round N holds each player’s Nth turn (round = ceil(global turn / 2), as in src/analysis/decisions.ts). “By round N” means by the end of your own Nth turn.',
  'gig-steal': 'A Gig taken from the rival by an attack on their Gig area (one attack can steal more than one).',
  'first-steal': 'This deck’s first Gig steal of the game.',
  'double-steal': 'One attack that steals two or more Gigs, i.e. an attacker with 10 or more power when the steal resolves.',
  'gig-lead': 'Holding more Gigs than the rival (the telemetry `lead` feature above 0).',
  'gig-count': 'The number of Gigs you hold; starting your turn with 7 wins.',
  'legend-face-up': 'A friendly Legend that is face-up, whether by a Call, Go Solo or an ordinary Legend play.',
  'go-solo': 'A Legend played to the field with Go Solo (enters ready and may attack that turn).',
  'call-in-react': 'A Legend Called during the rival’s turn, in the React Step of one of their attacks.',
  'units-on-field': 'The number of friendly Units on the field.',
  'unit-on-curve': 'A Unit played on the turn its cost first fits your available €$ (for example a 4-cost Unit on your second turn).',
  'ready-blocker': 'A ready friendly Unit with Blocker at the start of the rival’s turn.',
  'defence-held': 'A rival attack on your Gig area or Units that ends with no Gig stolen and your defender still on the field.',
  'fight-won': 'A fight (attack on a Unit, or a block) in which the rival Unit is defeated and yours survives.',
  removal: 'A rival Unit defeated, bottom-decked or otherwise moved off the field by a card effect rather than a fight.',
  sweep: 'One effect that removes two or more rival Units.',
  'ten-power': 'A friendly Unit with 10 or more power when it attacks.',
  'gear-equipped': 'The number of friendly Units and Legends with Gear equipped.',
  'high-gig': 'A friendly Gig showing 8 or more.',
  'min-gig': 'A friendly Gig at its minimum value (the cards’ “min Gig”).',
  'value-pair': 'Two friendly Gigs showing the same value.',
  eddies: 'The number of Eddies (€$) in your Eddie area, ready or spent.',
  'cards-drawn': 'Cards drawn beyond the normal draw for the turn.',
  'trash-size': 'The number of cards in your own trash.',
  'program-played': 'A Program played from hand or trash.',
  'same-turn-attack': 'A Unit attacking on the turn it entered the field (Go Solo, Adrenaline and similar effects ignore Lag).',
  overtime: 'The stretch after both players have played their 7th turn, when 7 or more Gigs wins at once.',
} as const;

export type SignalTerm = keyof typeof VOCABULARY;
export const SIGNAL_TERMS = Object.keys(VOCABULARY) as SignalTerm[];

/** Where the note's content comes from, in order of authority. */
export type ObjectiveSource =
  /** a strategy guide for this deck: a choom.gg community guide or the site's Strategy page */
  | 'guide'
  /** the list itself: Legends, curve, card text, Gig plan and archetype */
  | 'list'
  /** the parent deck's notes plus what changed (bred, forged, optimizer and tournament builds) */
  | 'parent';

/**
 * - draft: written from the source as a starting point; the owner has not checked it.
 * - needs-owner: a deck the owner brought in; only a placeholder from the list until the owner writes the note.
 * - owner: written or confirmed by the owner. Set this after editing an entry.
 */
export type ObjectiveStatus = 'draft' | 'needs-owner' | 'owner';

export type PlanPhase = 'early' | 'mid' | 'closing';

export interface GuideCredit {
  /** the guide's title */
  title: string;
  /** who wrote it */
  author: string;
  /** where it is published */
  site: 'choom.gg' | 'Strategy page';
  url?: string;
}

export interface SuccessSignal {
  /** the signal in plain words, e.g. "first Gig stolen by round 3" */
  text: string;
  /** the vocabulary terms the signal is built from (every one must be in VOCABULARY) */
  terms: SignalTerm[];
}

export interface DeckObjective {
  /** listFingerprint (src/engine/deck.ts) of the list the note was written for: Legends + main deck */
  listId: string;
  /** one sentence: what the deck is trying to do */
  objective: string;
  /** the plan in 2–4 short steps */
  plan: { phase: PlanPhase; text: string }[];
  /** 3–6 key cards (card ids from src/data/cards.json) and what each is for */
  keyCards: { id: string; role: string }[];
  /** 2–4 observable success signals */
  signals: SuccessSignal[];
  /** main risks and bad matchups, only where the source supports them (else empty) */
  risks: string[];
  source: ObjectiveSource;
  status: ObjectiveStatus;
  /** credit for guide-sourced notes */
  guide?: GuideCredit;
  /** library files of the parent decks a 'parent' note builds on */
  basedOn?: string[];
  /** true for a minimal list-derived placeholder awaiting the owner's note */
  placeholder?: boolean;
}

/** Entries keyed by deck file name (e.g. "meta-rrg-dexter-midrange.txt"). */
export type ObjectiveTable = Record<string, DeckObjective>;
