// Knowledge pack builders: one `finding` record per evidence finding (docs/EVIDENCE.md, ROADMAP2 §11 D27). Each finding
// is a statistical result, effect or association about a library deck, built from the evidence files in
// public/data/evidence/. The sentence comes from src/lib/findingWords.ts; the record links to the deck, the opponent
// (for a matchup), the card (for a card association or a one-card change) and the package (for a package association).
// Pure: no DOM, no `node:` imports.
import type { EvidenceIndex, Finding, Strength } from '../../findings';
import { STRENGTH_WORDS, NATURE_WORDS, sentenceOf, botVersionWords } from '../../findingWords';
import type { KbLink, KbRecord } from '../types';
import { deckRecordId } from './decks';
import { finishRecord } from './record';

export const findingRecordId = (short: string): string => `finding:${short}`;

/** A deck evidence file as the builder reads it (the JSON files under public/data/evidence/). */
export interface DeckEvidenceInput {
  listId: string;
  deck: string;
  file: string;
  findings: Finding[];
}

function strengthField(s: Strength): string {
  return STRENGTH_WORDS[s];
}

function findingLinks(f: Finding, o: { hasDeck: (file: string) => boolean; hasCard: (id: string) => boolean; hasPackage: (id: string) => boolean }): KbLink[] {
  const links: KbLink[] = [];
  if (o.hasDeck(f.subject.file)) links.push({ rel: 'deck', to: deckRecordId(f.subject.file) });
  if (f.subject.card && o.hasCard(f.subject.card.id)) links.push({ rel: 'card', to: `card:${f.subject.card.id}` });
  if (f.subject.package && o.hasPackage(f.subject.package.id)) links.push({ rel: 'package', to: `pkg:${f.subject.package.id}` });
  if (f.subject.change) {
    for (const id of [...f.subject.change.cuts, ...f.subject.change.adds]) {
      if (o.hasCard(id)) links.push({ rel: 'card', to: `card:${id}` });
    }
  }
  return links;
}

function findingTitle(f: Finding): string {
  return f.claim;
}

function findingText(f: Finding): string {
  const sentence = sentenceOf(f);
  const nature = NATURE_WORDS[f.nature];
  const strength = STRENGTH_WORDS[f.strength];
  const bot = botVersionWords(f);
  const lines = [`${f.claim}: ${sentence}`, `Nature: ${nature}. Strength: ${strength}. Measured by ${bot}.`];
  if (f.nature === 'association') lines.push("An association in the bot's own games, not the value of the card and not advice.");
  return lines.join('\n');
}

/**
 * Build finding records from the evidence index and each deck's evidence file. `readDeck(listId)` reads the deck's
 * evidence JSON (null when missing). Only findings of strength 'strong', 'moderate' or 'weak' are included (not
 * 'not-enough' or 'no-difference'); this keeps the record count manageable and the records informative.
 */
export function buildFindings(
  index: EvidenceIndex,
  readDeck: (listId: string) => DeckEvidenceInput | null,
  o: {
    hasDeck: (file: string) => boolean;
    hasCard: (id: string) => boolean;
    hasPackage: (id: string) => boolean;
    skipped: Record<string, number>;
    opponentFile: (listId: string) => string | undefined;
  },
): KbRecord[] {
  const skip = (why: string, n = 1) => (o.skipped[why] = (o.skipped[why] ?? 0) + n);
  const INCLUDED_STRENGTHS: readonly Strength[] = ['strong', 'moderate', 'weak'];
  const out: KbRecord[] = [];

  for (const entry of index.decks) {
    const evidence = readDeck(entry.listId);
    if (!evidence) {
      skip('finding: deck evidence file missing');
      continue;
    }
    for (const f of evidence.findings) {
      if (!INCLUDED_STRENGTHS.includes(f.strength)) {
        skip('finding: strength below threshold');
        continue;
      }
      const links = findingLinks(f, {
        hasDeck: o.hasDeck,
        hasCard: o.hasCard,
        hasPackage: o.hasPackage,
      });
      // link to the opponent deck if we can resolve the file
      if (f.subject.opponent) {
        const oppFile = o.opponentFile(f.subject.opponent.listId);
        if (oppFile && o.hasDeck(oppFile)) {
          const oppDeckId = deckRecordId(oppFile);
          if (!links.some((l) => l.to === oppDeckId)) links.push({ rel: 'deck', to: oppDeckId });
        }
      }

      out.push(
        finishRecord({
          id: findingRecordId(f.short),
          kind: 'finding',
          title: findingTitle(f),
          aliases: [],
          text: findingText(f),
          fields: {
            deck: f.subject.deck,
            deckFile: f.subject.file,
            listId: f.subject.listId,
            findingKind: f.kind,
            nature: f.nature,
            strength: strengthField(f.strength),
            estimate: Math.round(f.estimate * 1e4) / 1e4,
            games: f.games,
            stale: f.simVersion !== index.simVersion,
          },
          links,
          source: { file: `public/data/evidence/${entry.listId}.json`, at: `/${f.short}` },
          origin: 'measured',
          scope: 'public',
          stamps: { simVersion: f.simVersion, bot: f.bot },
        }),
      );
    }
  }
  return out;
}
