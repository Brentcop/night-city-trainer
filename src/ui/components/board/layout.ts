// Which Play board layout a screen gets, and the phone board's size budget. Pure arithmetic (no DOM), so it can be
// tested; the board turns the budget into CSS variables (phoneVars) and board.css lays the phone board out from them.

/** 'full': desktop and tablets (board.css .pb-full). 'phone' / 'phone-land': the compact board, fixed to the screen. */
export type BoardMode = 'full' | 'phone' | 'phone-land';

/**
 * The compact (phone) layout: a narrow screen, or a short one (a phone in landscape). Short screens up to 1100px wide
 * count even without a touch pointer, because some browsers don't report one in landscape; a short screen with a touch
 * pointer counts at any width. The same test as COMPACT_QUERY (useNarrow.ts), which board.css's compact rules use.
 */
export function compactFor(w: number, h: number, coarse: boolean): boolean {
  return w <= 720 || (h <= 520 && w <= 1100) || (h <= 520 && coarse);
}

/**
 * The layout for a viewport. A phone in landscape (wider than tall) gets its own arrangement: one row per side and the
 * hand down the right. Tablets in portrait (e.g. 768×1024) are not compact: they get the full board's two-rows-per-side
 * variant, which has room for real card sizes there (about 107px field cards), where the phone board would scale for a
 * 375px-wide screen.
 */
export function layoutMode(w: number, h: number, coarse: boolean): BoardMode {
  if (!compactFor(w, h, coarse)) return 'full';
  return w > h ? 'phone-land' : 'phone';
}

/** Size ratios to the player's own field card width (f). The rival's side is compressed more than yours. */
export const PHONE_RATIO = {
  rivalField: 0.72,
  legend: 0.5,
  rivalLegend: 0.4,
  /** hand cards: at least this, more if the height allows (portrait) */
  hand: 1.15,
  handMax: 1.3,
  die: 0.27,
  rivalDie: 0.22,
  /** landscape: Legends a bit larger (the row is the full width) and the hand column narrower */
  landLegend: 0.6,
  landHand: 0.9,
} as const;

/** Fixed parts of the phone board, in px. */
export const PHONE_FIXED = {
  strip: 44,
  /** the banner holds the turn button, so it is a full tap target high */
  banner: 40,
  gap: 4,
  /** mat padding, top + bottom (or left + right) */
  pad: 8,
  /** a field row's padding and border */
  fieldRow: 8,
  /** a back row's padding */
  backRow: 6,
  /** the piles column (one tap target): €$, deck and trash counts, and for the rival their hand size */
  piles: 56,
  rivalPiles: 72,
  pilesW: 60,
  /** room above the hand for the lift of a pressed card, and below it */
  handRow: 14,
  /** kept free so rounding, fonts and browser bars never make the board scroll */
  margin: 24,
} as const;

const H = 88 / 63; // card height per width (1.397)

export interface PhoneLayout {
  mode: Exclude<BoardMode, 'full'>;
  w: number;
  h: number;
  /** card widths, px */
  cards: { field: number; rivalField: number; legend: number; rivalLegend: number; hand: number; die: number; rivalDie: number };
  /** row heights top to bottom, px (portrait: rival back, rival field, banner, own field, own back, hand; landscape: rival, banner, own) */
  rows: Record<string, number>;
  /** landscape: the hand column's width */
  handCol: number;
  /** the prompt panel (right edge): its width and greatest height */
  panel: { w: number; maxH: number };
  /** height the board uses, and what is left over (spread between the rows) */
  used: number;
  spare: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
/** card widths round down, so rounding never adds height */
const fl = (v: number) => Math.floor(v * 10) / 10;

/**
 * The phone board's budget for a viewport (CSS px; the board uses the dynamic viewport height, so browser bars are
 * already taken off). Portrait stacks, top to bottom: the strip, the rival's Legends | Gigs | piles row, the rival
 * field, the banner (with the turn button), your field, your Legends | Gigs | piles row, and your hand. The card width
 * is the largest that fits both the height (with a margin) and the width (3.5 field cards, and your back row).
 * Landscape: the strip, then one row per side (Legends | field | Gigs over piles) with the banner between, and the
 * hand down a column on the right.
 */
export function phoneLayout(w: number, h: number): PhoneLayout {
  const R = PHONE_RATIO;
  const F = PHONE_FIXED;
  if (w > h) {
    // landscape: rows are the rival row (rival field cards), the banner and your row (field cards)
    const fixedH = F.strip + F.banner + 2 * F.gap + F.pad + 2 * F.fieldRow + F.margin;
    const byHeight = (h - fixedH) / (H * (1 + R.rivalField));
    // width: Legends (3, room for two turned sideways) + 3.5 field cards + the Gigs/piles column + the hand column
    const byWidth = (w - 2 * F.pad - 4 * 8 - F.pilesW - 20) / (3 * R.landLegend + 0.29 + 3.5 + 3 * R.die + R.landHand);
    let field = clamp(Math.min(byHeight, byWidth), 44, 150);
    // the hand column shows every card: ~26px of each, so 7 cards fit the column's height
    const colH = h - F.strip - F.pad;
    const hand = clamp(Math.min(field * R.landHand, (colH - 6 * 26) / H), 40, 140);
    field = fl(field);
    const rows = { rival: r1(field * R.rivalField * H + F.fieldRow), banner: F.banner, own: r1(field * H + F.fieldRow) };
    const used = r1(F.strip + F.pad + rows.rival + rows.banner + rows.own + 2 * F.gap);
    return {
      mode: 'phone-land',
      w,
      h,
      cards: { field, rivalField: r1(field * R.rivalField), legend: r1(field * R.landLegend), rivalLegend: r1(field * R.rivalLegend), hand: fl(hand), die: r1(field * R.die), rivalDie: r1(field * R.rivalDie) },
      rows,
      handCol: r1(hand + 12),
      panel: { w: Math.round(Math.min(230, w * 0.28)), maxH: Math.round(h * 0.6) },
      used,
      spare: r1(h - used),
    };
  }
  // portrait
  const backOwn = (f: number) => Math.max(f * R.legend * H + F.backRow, 14 + 2 * (f * R.die + 2) + F.backRow, F.piles);
  const backRival = (f: number) => Math.max(f * R.rivalLegend * H + F.backRow, 14 + 2 * (f * R.rivalDie + 2) + F.backRow, F.rivalPiles);
  const rowsFor = (f: number, hand: number) => ({
    rivalBack: backRival(f),
    rivalField: f * R.rivalField * H + F.fieldRow,
    banner: F.banner,
    ownField: f * H + F.fieldRow,
    ownBack: backOwn(f),
    hand: hand * H + F.handRow,
  });
  const total = (rows: Record<string, number>) => F.strip + F.pad + 5 * F.gap + Object.values(rows).reduce((a, b) => a + b, 0);
  // the largest f whose rows (with the margin) fit the height: total() grows with f, so search it
  let lo = 30;
  let hi = 160;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (total(rowsFor(mid, mid * R.hand)) + F.margin <= h) lo = mid;
    else hi = mid;
  }
  // width: 3.5 field cards, and your back row: three Legends (two may lie sideways), three dice a row, the piles
  const byWidth = Math.min((w - F.pad - F.fieldRow - 3 * 4) / 3.5, (w - F.pad - F.pilesW - 2 * 6 - 8 - 17) / (3 * R.legend + 0.36 + 3 * R.die));
  const field = fl(clamp(Math.min(lo, byWidth), 44, 150));
  // the hand takes what height is left, up to handMax
  const rest = total(rowsFor(field, 0)) - F.handRow;
  const hand = fl(clamp((h - F.margin - rest - F.handRow) / H, field * R.hand, field * R.handMax));
  const rows = Object.fromEntries(Object.entries(rowsFor(field, hand)).map(([k, v]) => [k, r1(v)]));
  const used = r1(total(rows));
  return {
    mode: 'phone',
    w,
    h,
    cards: { field, rivalField: r1(field * R.rivalField), legend: r1(field * R.legend), rivalLegend: r1(field * R.rivalLegend), hand, die: r1(field * R.die), rivalDie: r1(field * R.rivalDie) },
    rows,
    handCol: 0,
    panel: { w: Math.round(Math.min(190, w * 0.46)), maxH: Math.round(h * 0.3) },
    used,
    spare: r1(h - used),
  };
}

/** The budget as CSS variables for the board's root element. */
export function phoneVars(L: PhoneLayout): Record<string, string> {
  const px = (n: number) => `${n}px`;
  return {
    '--pb-strip-h': px(PHONE_FIXED.strip),
    '--pf': px(L.cards.field),
    '--prf': px(L.cards.rivalField),
    '--pl': px(L.cards.legend),
    '--prl': px(L.cards.rivalLegend),
    '--ph': px(L.cards.hand),
    '--pd': px(L.cards.die),
    '--prd': px(L.cards.rivalDie),
    '--phcol': px(L.handCol),
    /** how far from the right edge the prompt panel and its stand-ins sit (landscape: left of the hand column) */
    '--pb-side-right': px(L.handCol),
    '--pp-w': px(L.panel.w),
    '--pp-h': px(L.panel.maxH),
  };
}
