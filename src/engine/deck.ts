// Deck lists: parsing (choom.gg / official / sim formats), validation, export.
import { CARD_BY_ID, cardLabel, findCard } from './cards';
import type { CardDef, Color, DeckList } from './types';

export interface ParseResult {
  deck: DeckList;
  errors: string[]; // lines we couldn't resolve
}

/**
 * Parse a deck list. Accepts:
 *  - Official / Cyberpunk TCG Sim / ChoomBattler:  "# Name", "// Legends (3)", "1 Saburo Arasaka: Stubborn Patriarch"
 *  - choom.gg text: "// Name", "// Format: Constructed", "// Legends", "3 Name — Sub (SET)", "// Sideboard"
 *  - loose lists: "3x Card", "Card x3", "3 Card", card ids, choom guide copy-paste "3 copies of X in deck"
 *  - sim JSON: { name, legendIds, cardQuantities, sideboardQuantities }
 * Legends are detected by card type, so section headers are optional.
 */
export function parseDeck(text: string, fallbackName = 'Imported deck'): ParseResult {
  const t = text.trim();
  if (t.startsWith('{')) {
    try {
      return parseSimJson(JSON.parse(t), fallbackName);
    } catch {
      /* fall through to text */
    }
  }
  const deck: DeckList = { name: fallbackName, legends: [], main: [], sideboard: [] };
  const errors: string[] = [];
  let section: 'main' | 'side' | 'ignore' = 'main';
  let inLegends = false;
  let named = false;
  for (const rawLine of t.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    const header = line.match(/^(#{1,3}|\/\/)\s*(.*)$/);
    if (header) {
      const h = header[2].trim();
      const hl = h.toLowerCase();
      inLegends = /^legends?\b/.test(hl);
      if (/^(side ?board|sideboard)/.test(hl)) section = 'side';
      else if (/^pool/.test(hl) || /^maybe/.test(hl)) section = 'ignore';
      else if (/^(legends?|main|main deck|units?|gears?|programs?|other|cards)\s*(\(?[\d/–-]+\)?)?\s*$/.test(hl)) section = 'main';
      else if (/^format\s*:/.test(hl)) {
        /* ignore */
      } else if (!named && h) {
        deck.name = h;
        named = true;
      }
      continue;
    }
    // "Legends (3): A, B, C" one-liner
    const lm = line.match(/^legends?\s*(\(\d+\))?\s*:\s*(.+)$/i);
    if (lm) {
      for (const n of lm[2].split(/,\s*/)) {
        const c = findCard(n, 'Legend');
        if (c && c.type === 'Legend') deck.legends.push(c.id);
        else errors.push(n);
      }
      continue;
    }
    // bare section headers like "Legends", "Units16", "Programs 5"
    if (/^(legends|units|programs|gears|sideboard|cards)\s*(\(?\d+(\/\d+)?\)?)?$/i.test(line)) {
      inLegends = /^legends/i.test(line);
      if (/^sideboard/i.test(line)) section = 'side';
      else section = 'main';
      continue;
    }
    if (section === 'ignore') continue;
    // "3 copies of X in deck" / "1 copy of X in deck"
    let m = line.match(/^(\d+)\s+cop(?:y|ies) of (.+?) in deck/i);
    let qty: number;
    let nameStr: string;
    if (m) {
      qty = +m[1];
      nameStr = m[2];
    } else if ((m = line.match(/^[-*•]?\s*(\d+)\s*[x×]?\s+(.+)$/i))) {
      qty = +m[1];
      nameStr = m[2];
    } else if ((m = line.match(/^(.+?)\s+[x×]\s*(\d+)$/i))) {
      qty = +m[2];
      nameStr = m[1];
    } else {
      qty = 1;
      nameStr = line;
    }
    nameStr = nameStr.replace(/^[-*•]\s*/, '').replace(/\s*\([A-Za-z0-9 _-]{1,24}\)\s*$/, '').trim(); // bullets, trailing (SET) code
    const card = findCard(nameStr) ?? findCard(nameStr, inLegends ? 'Legend' : 'nonLegend');
    if (!card) {
      errors.push(rawLine);
      continue;
    }
    if (card.type === 'Legend') {
      if (!deck.legends.includes(card.id)) deck.legends.push(card.id);
      continue;
    }
    for (let i = 0; i < qty; i++) (section === 'side' ? deck.sideboard : deck.main).push(card.id);
  }
  return { deck, errors };
}

function parseSimJson(j: any, fallbackName: string): ParseResult {
  const deck: DeckList = { name: j.name ?? fallbackName, legends: [], main: [], sideboard: [] };
  const errors: string[] = [];
  for (const id of j.legendIds ?? []) (CARD_BY_ID[id] ? deck.legends.push(id) : errors.push(id));
  for (const [id, n] of Object.entries(j.cardQuantities ?? {})) {
    if (!CARD_BY_ID[id]) errors.push(id);
    else for (let i = 0; i < (n as number); i++) deck.main.push(id);
  }
  for (const [id, n] of Object.entries(j.sideboardQuantities ?? {})) {
    if (!CARD_BY_ID[id]) errors.push(id);
    else for (let i = 0; i < (n as number); i++) deck.sideboard.push(id);
  }
  return { deck, errors };
}

export function counts(ids: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

export function ramLimits(deck: DeckList): Record<Color, number> {
  const r: Record<Color, number> = { Red: 0, Blue: 0, Green: 0, Yellow: 0 };
  for (const id of deck.legends) {
    const c = CARD_BY_ID[id];
    if (c) r[c.color] += c.ram;
  }
  return r;
}

/** Validate against constructed rules (CR 7.3, 3.20; tournament sideboard = 7). */
export function validateDeck(deck: DeckList): string[] {
  const errs: string[] = [];
  if (deck.legends.length !== 3) errs.push(`Needs exactly 3 Legends (has ${deck.legends.length}).`);
  const names = deck.legends.map((id) => CARD_BY_ID[id]?.name);
  if (new Set(names).size !== names.length) errs.push('Legends must have different names.');
  if (deck.main.length < 40 || deck.main.length > 50) errs.push(`Main deck must be 40–50 cards (has ${deck.main.length}).`);
  if (deck.sideboard.length && deck.sideboard.length !== 7) errs.push(`Tournament sideboard must be exactly 7 (has ${deck.sideboard.length}).`);
  const lim = ramLimits(deck);
  const byName = new Map<string, number>();
  for (const id of [...deck.main]) {
    const c = CARD_BY_ID[id];
    byName.set(cardLabel(c), (byName.get(cardLabel(c)) ?? 0) + 1);
  }
  for (const [n, k] of byName) if (k > 3) errs.push(`Max 3 copies: ${n} ×${k}.`);
  for (const id of new Set([...deck.main, ...deck.sideboard])) {
    const c = CARD_BY_ID[id];
    if (c.type === 'Legend') errs.push(`${cardLabel(c)} is a Legend and can't be in the main deck.`);
    else if (c.ram > lim[c.color]) errs.push(`${cardLabel(c)} needs ${c.ram} ${c.color} RAM (deck has ${lim[c.color]}).`);
  }
  return errs;
}

const TYPE_ORDER: CardDef['type'][] = ['Unit', 'Gear', 'Program'];

/** Official format (cyberpunktcg.com / ChoomBattler / Cyberpunk TCG Sim import). */
export function exportOfficial(deck: DeckList): string {
  const lines = [`# ${deck.name}`, '', `// Legends (${deck.legends.length})`];
  for (const id of deck.legends) lines.push(`1 ${cardLabel(CARD_BY_ID[id])}`);
  const cs = counts(deck.main);
  for (const type of TYPE_ORDER) {
    const ids = [...cs.keys()].filter((id) => CARD_BY_ID[id].type === type);
    if (!ids.length) continue;
    const n = ids.reduce((a, id) => a + cs.get(id)!, 0);
    lines.push('', `// ${type}s (${n})`);
    ids.sort((a, b) => (CARD_BY_ID[a].cost ?? 0) - (CARD_BY_ID[b].cost ?? 0) || CARD_BY_ID[a].name.localeCompare(CARD_BY_ID[b].name));
    for (const id of ids) lines.push(`${cs.get(id)} ${cardLabel(CARD_BY_ID[id])}`);
  }
  return lines.join('\n');
}

/** choom.gg text format (includes sideboard). */
export function exportChoom(deck: DeckList): string {
  const lines = [`// ${deck.name}`, '// Format: Constructed', '', '// Legends'];
  for (const id of deck.legends) lines.push(`1 ${cardLabel(CARD_BY_ID[id])}`);
  lines.push('', '// Main Deck');
  for (const [id, n] of counts(deck.main)) lines.push(`${n} ${cardLabel(CARD_BY_ID[id])}`);
  if (deck.sideboard.length) {
    lines.push('', '// Sideboard');
    for (const [id, n] of counts(deck.sideboard)) lines.push(`${n} ${cardLabel(CARD_BY_ID[id])}`);
  }
  return lines.join('\n');
}

/** cyberpunk-tcg-sim.online deck JSON shape. */
export function exportSimJson(deck: DeckList) {
  return {
    name: deck.name,
    format: 'constructed',
    legendIds: deck.legends,
    cardQuantities: Object.fromEntries(counts(deck.main)),
    sideboardQuantities: Object.fromEntries(counts(deck.sideboard)),
  };
}

export function deckColors(deck: DeckList): string {
  const letters = deck.legends.map((id) => CARD_BY_ID[id]?.color[0] ?? '?');
  const order = 'RBGY';
  return letters.sort((a, b) => order.indexOf(a) - order.indexOf(b)).join('');
}

/** Swap sideboard cards in/out (same count). */
export function applySideboard(deck: DeckList, outIds: string[], inIds: string[]): DeckList {
  const main = [...deck.main];
  const side = [...deck.sideboard];
  for (const id of outIds) {
    const i = main.indexOf(id);
    if (i >= 0) side.push(...main.splice(i, 1));
  }
  for (const id of inIds) {
    const i = side.indexOf(id);
    if (i >= 0) main.push(...side.splice(i, 1));
  }
  return { ...deck, main, sideboard: side };
}
