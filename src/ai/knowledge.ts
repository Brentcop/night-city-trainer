// Card knowledge the bots use: roles, ratings, gig plans.
// Ratings marked "choom" come from choom.gg's hand-rated card power rankings (Nov 2026).
import { CARD_BY_ID, CARDS } from '../engine/cards';
import type { CardDef } from '../engine/types';

export type Role =
  | 'removal'
  | 'sweeper'
  | 'draw'
  | 'tutor'
  | 'blocker'
  | 'finisher'
  | 'ramp'
  | 'gigFix'
  | 'stun'
  | 'protection'
  | 'recursion'
  | 'pump'
  | 'disruption'
  | 'combatTrick';

/** choom.gg card power rankings (0-100). */
export const CHOOM_RATINGS: Record<string, number> = {
  three_mouths_one_desire: 96,
  towerfall: 90,
  adam_smasher_ender_of_legends: 88,
  carnage_at_the_colosseum: 84,
  gunpoint_diplomacy: 78,
  valentino_street_racer: 74,
  jacked_in_voodoo_boy: 72,
  meredith_stout_stone_cold_corpo: 70,
  placide_voodoo_sentinel: 60,
};

const ROLE_PATTERNS: [Role, RegExp][] = [
  ['sweeper', /all rival Units|Defeat all other Units|Each player defeats/i],
  ['removal', /Defeat (a|2) (rival|spent)? ?Unit|Bottom-deck (a|all) rival|bottom-deck a spent rival|Defeat a Unit with|Defeat a spent|Bottom-deck a Rival's/i],
  ['stun', /can't attack until|Spend a rival Unit|Spend all rival Units|can't ready/i],
  ['draw', /Draw \d|draw \d/],
  ['tutor', /Search the top|Add .* to your hand|add it to your hand/i],
  ['gigFix', /(Increase|Decrease|Adjust|Set|Swap) a .*Gig|set a Gig's value/i],
  ['ramp', /ready \d Edd|Eddies|for -\d €\$/i],
  ['protection', /can't be defeated|doesn't defeat|defeat .* instead|isn't stolen|steals 1 fewer/i],
  ['recursion', /from your trash/i],
  ['pump', /\+\d power/i],
  ['disruption', /Rival discards|must attack/i],
  ['combatTrick', /\{Quick\}/],
];

function rolesOf(c: CardDef): Role[] {
  const roles = new Set<Role>();
  for (const [r, re] of ROLE_PATTERNS) if (re.test(c.text)) roles.add(r);
  if (c.keywords.includes('blocker') || /\{Blocker\}/.test(c.text)) roles.add('blocker');
  if ((c.power ?? 0) >= 10 || c.id === 'adam_smasher_ender_of_legends') roles.add('finisher');
  return [...roles];
}

export const ROLES: Record<string, Role[]> = Object.fromEntries(CARDS.map((c) => [c.id, rolesOf(c)]));

const VALUE_CACHE = new Map<string, number>();
/** Static card value used for sell/discard/search ordering (memoized: it depends on the card only). */
export function cardValue(id: string): number {
  let v = VALUE_CACHE.get(id);
  if (v === undefined) VALUE_CACHE.set(id, (v = computeCardValue(id)));
  return v;
}

function computeCardValue(id: string): number {
  const c = CARD_BY_ID[id];
  if (!c) return 0;
  let v = 0;
  const cost = c.cost ?? 0;
  if (c.type === 'Unit') v = (c.power ?? 0) * 1.3 + cost * 0.6 + 2;
  else if (c.type === 'Program') v = cost * 1.1 + 3;
  else if (c.type === 'Gear') v = (c.power ?? 0) * 1.2 + cost * 0.5 + 2;
  else v = 6;
  const roles = ROLES[id] ?? [];
  if (roles.includes('removal')) v += 4;
  if (roles.includes('sweeper')) v += 5;
  if (roles.includes('draw')) v += 2;
  if (roles.includes('finisher')) v += 3;
  if (roles.includes('blocker')) v += 1;
  if (CHOOM_RATINGS[id]) v += (CHOOM_RATINGS[id] - 50) / 6;
  if (!c.sellable && c.type === 'Unit') v += 0.5;
  return v;
}

export type GigPlan = { high: number; low: number; pairs: number; diverse: number; parity: number; d20: number };

const PLAN_PATTERNS: [keyof GigPlan, RegExp][] = [
  ['high', /8\+|Increase a Gig|max Gig/i],
  ['low', /min Gig|Decrease a Gig/i],
  ['pairs', /value-pair/i],
  ['diverse', /different values|not shared by a friendly Gig/i],
  ['parity', /even value|odd value|even number|is an even/i],
  ['d20', /d20/i],
];

const PLAN_KEYS = PLAN_PATTERNS.map(([k]) => k);
/** Per card: which Gig patterns its text mentions (computed once, so lookahead clones never re-run the regexes). */
const PLAN_VEC: Record<string, (keyof GigPlan)[]> = Object.fromEntries(
  CARDS.map((c) => [c.id, PLAN_PATTERNS.filter(([, re]) => re.test(c.text)).map(([k]) => k)]),
);

/** How much a list of cards cares about each Gig pattern (normalized to ~0-1). */
export function gigPlanOf(ids: string[]): GigPlan {
  const plan: GigPlan = { high: 0, low: 0, pairs: 0, diverse: 0, parity: 0, d20: 0 };
  for (const id of ids) for (const k of PLAN_VEC[id] ?? []) plan[k] += 1;
  const n = Math.max(1, ids.length) / 10;
  for (const k of PLAN_KEYS) plan[k] = Math.min(1.5, plan[k] / n);
  return plan;
}

/** Gear whose bottom text triggers "when this Unit or Legend is spent" — best on a face-up Legend (spent to pay every turn). */
export function isSpendTriggerGear(id: string): boolean {
  return SPEND_TRIGGER.has(id);
}
const SPEND_TRIGGER = new Set(CARDS.filter((c) => /When this Unit or Legend is spent/i.test(c.text)).map((c) => c.id));
