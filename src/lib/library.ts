// Built-in deck library (data/decks/*.txt), bundled for both the web app (Vite) and Node scripts.
import { deckFingerprint, parseDeck } from '../engine/deck';
import type { DeckList } from '../engine/types';
import type { RunManifest } from './runManifest';

/** Where a list came from and who made it (see scripts/tag-provenance.ts). */
export interface Provenance {
  origin?: string; // e.g. "choom.gg community guide", "Night City Trainer bred deck (season 2, explorer)"
  author?: string;
  source?: string; // URL
  via?: string; // site it was collected from
  credits?: string;
  parents?: string;
  added?: string; // YYYY-MM-DD
  forged?: string;
}

export interface LibraryDeck {
  file: string;
  /** Immutable identity of the current card list; legacy synthetic entries may omit it. */
  deckId?: string;
  deck: DeckList;
  source?: string;
  author?: string;
  tier?: string;
  kind: 'meta' | 'ladder' | 'guide' | 'original' | 'custom';
  idea?: string;
  prov: Provenance;
  /** browser custom decks saved from a Deck Lab run: what that run measured (src/lib/runManifest.ts) */
  manifest?: RunManifest;
}

const field = (text: string, key: string) => text.match(new RegExp(`^// ${key}: (.+)$`, 'm'))?.[1]?.trim();

export function deckFromText(file: string, text: string, kind?: LibraryDeck['kind']): LibraryDeck {
  const { deck } = parseDeck(text, file.replace(/\.txt$/, ''));
  const prov: Provenance = {
    origin: field(text, 'Origin'),
    author: field(text, 'Author'),
    source: field(text, 'Source')?.split(' ')[0],
    via: field(text, 'Via'),
    credits: field(text, 'Credits'),
    parents: field(text, 'Parents'),
    added: field(text, 'Added'),
    forged: field(text, 'Forged'),
  };
  const tier = field(text, 'Tier')?.match(/^\w/)?.[0];
  const idea = field(text, 'Idea');
  deck.source = prov.source;
  return {
    file,
    deckId: deckFingerprint(deck),
    deck,
    source: prov.source,
    author: prov.author,
    tier,
    idea,
    prov,
    kind: /^(nc|s\d+)-/.test(file) && !/-eor\.txt$/.test(file) ? 'original' : kind ?? (file.startsWith('meta-') ? 'meta' : file.startsWith('ladder-') ? 'ladder' : 'guide'),
  };
}

/** Short one-line credit, e.g. "choom.gg guide · Cacheira" or "NC bred S2 explorer". */
export function shortCredit(d: Pick<LibraryDeck, 'prov' | 'kind'>): string {
  const p = d.prov;
  const author = (p.author ?? '').replace(/ \(.*\)$/, '').replace(/ — "The Cyberpunk Primer".*$/, ' (Cyberpunk Primer)');
  const o = p.origin ?? '';
  if (o.startsWith('choom.gg meta')) return `choom.gg meta · ${author}`;
  if (o.startsWith('choom.gg community')) return `choom.gg guide · ${author}`;
  if (o.startsWith('Night City Trainer bred')) return `NC bred ${o.match(/season (\d+), (\w+)/)?.slice(1).join(' ') ?? ''}`.replace(/^NC bred (\d+)/, 'NC bred S$1');
  if (o.startsWith('Night City Trainer original')) return 'NC original';
  if (o.startsWith('Night City Trainer optimizer')) return 'NC optimizer variant';
  if (o.startsWith('Night City Trainer tournament')) return 'NC tournament build';
  return author || o || d.kind;
}
