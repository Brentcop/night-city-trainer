/**
 * Normalize the raw sim catalog into src/data/cards.json used by the engine and UI.
 *
 * Source: https://cyberpunk-tcg-sim.online/api/cards/catalog (saved to data/raw/sim_catalog.json,
 * which is gitignored and local-only).
 * Run: npm run build:data
 *
 * Port of the former tools/build_data.py; the output is byte-identical to it.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

interface RawCard {
  id: string;
  name: string;
  subname: string | null;
  display_name: string;
  color: string;
  card_type: string;
  cost: number | null;
  power: number | null;
  ram: number | null;
  rarity: string;
  classifications: string[];
  rules_text: string | null;
  is_eddiable: unknown;
  set_code: string;
  print_number: string | number;
  source?: { external_id?: string; card_page_url?: string } | null;
}

const raw = JSON.parse(readFileSync(join(ROOT, 'data/raw/sim_catalog.json'), 'utf8')) as { cards: RawCard[] };

const KW: Record<string, string> = {
  blocker: '\\{Blocker\\}',
  adrenaline: '\\{Adrenaline\\}',
  goSolo: '\\{Go Solo\\}',
  quick: '\\{Quick\\}',
};

/** Drop parenthetical reminder text, keep effect text. */
function stripReminder(text: string): string {
  return text.replace(/\s*\([^()]*\)/g, '').trim();
}

const cards = raw.cards.map((c) => {
  const text = c.rules_text || '';
  const eff = stripReminder(text);
  // only count a keyword when it starts a line (intrinsic), not when other text mentions it
  const kws = Object.keys(KW).filter((k) => new RegExp('^\\s*' + KW[k], 'm').test(eff));
  return {
    id: c.id,
    name: c.name,
    subname: c.subname,
    displayName: c.display_name,
    color: c.color,
    type: c.card_type,
    cost: c.cost,
    power: c.power,
    ram: c.ram,
    rarity: c.rarity,
    tags: c.classifications,
    text,
    keywords: kws,
    sellable: Boolean(c.is_eddiable),
    set: c.set_code,
    number: c.print_number,
    // netdeck.gg external id: the site fetches fresh (short-lived, signed) art URLs for it at runtime
    eid: c.source?.external_id ?? null,
    image: null,
    url: c.source?.card_page_url ?? null,
  };
});

const cmp = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);
cards.sort(
  (x, y) =>
    cmp(Number(x.type !== 'Legend'), Number(y.type !== 'Legend')) ||
    cmp(x.color, y.color) ||
    cmp(x.cost || 0, y.cost || 0) ||
    cmp(x.name, y.name),
);

const out = join(ROOT, 'src/data/cards.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(cards, null, 1), 'utf8');
console.log(`wrote ${cards.length} cards -> ${out}`);
