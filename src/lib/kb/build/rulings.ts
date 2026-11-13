// Knowledge pack builders: one record per official FAQ ruling, from the conformance matrix (tests/faq/entries/): our
// one-line paraphrase, never the FAQ's wording, with the engine's status and the test that checks it. The id is the
// same 8-character prefix the FAQ tests use in `faq:<prefix>`; the local `faq:` record holds the official wording.
import type { KbRecord } from '../types';
import type { MentionLinker } from './mentions';
import { finishRecord, linksTo } from './record';

export interface RulingInput {
  /** the FAQ item's id */
  id: string;
  scope: 'game' | 'card';
  cardId: string | null;
  paraphrase: string;
  status: string;
  test: string | null;
  note?: string;
  /** where the entry is written */
  file: string;
  line?: number;
}

export const rulingId = (faqId: string): string => `ruling:${faqId.slice(0, 8)}`;

export function buildRulings(entries: readonly RulingInput[], o: { cardName: (id: string) => string | undefined; linker: MentionLinker; faqVersion: string | null; rulesVersion: string | null }): KbRecord[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const card = e.cardId ? o.cardName(e.cardId) : undefined;
    const key = e.scope === 'card' ? e.cardId ?? '?' : 'game';
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    const title = e.scope === 'card' ? `${card ?? e.cardId} ruling ${n}` : `Game rules ruling ${n}`;
    const about = e.scope === 'card' ? `on ${card ?? e.cardId}` : 'on the game rules';
    const text = [
      `FAQ ruling ${about}, in our words: ${e.paraphrase}`,
      `Engine: ${e.status}${e.test ? `, checked by ${e.test}` : ''}.`,
      e.note ? `Note: ${e.note}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    const mentioned = o.linker.cardsIn([e.paraphrase, e.note ?? ''].join('\n')).filter((id) => id !== e.cardId);
    return finishRecord({
      id: rulingId(e.id),
      kind: 'ruling',
      title,
      aliases: [e.id],
      text,
      fields: { scope: e.scope, cardId: e.cardId, status: e.status, test: e.test, faqId: e.id },
      links: [...linksTo('card', e.cardId ? [`card:${e.cardId}`] : []), ...linksTo('mentions', mentioned.map((id) => `card:${id}`))],
      source: { file: e.file, ...(e.line ? { at: `L${e.line}` } : {}) },
      origin: 'authored',
      scope: 'public',
      stamps: { faqVersion: o.faqVersion, rulesVersion: o.rulesVersion },
    });
  });
}
