// Knowledge pack builders: one record per synergy package (src/content/synergies/) with its resolved members, and the
// vocabularies: glossary terms (src/content/glossary.ts), deck-note signal terms and package condition terms.
import { slug } from '../text';
import type { KbRecord } from '../types';
import type { MentionLinker } from './mentions';
import { finishRecord, linksTo } from './record';

export interface PieceCountInput {
  enabler?: number;
  payoff?: number;
  any?: number;
}

/** A condition tree: only `term` and the nested `of` lists are read. */
export interface ConditionInput {
  term: string;
  of?: readonly ConditionInput[];
}

export interface PackageInput {
  id: string;
  name: string;
  description: string;
  family: string;
  bond: string;
  status: string;
  /** every member, explicit and by class (membersOf in src/content/synergies) */
  members: readonly { id: string; role: string; note?: string }[];
  needs: PieceCountInput;
  builtAround: PieceCountInput;
  online: ConditionInput;
  onlineText: string;
  dormant?: { reason: string };
}

const pieces = (p: PieceCountInput) =>
  [p.enabler ? `${p.enabler} enabler${p.enabler > 1 ? 's' : ''}` : null, p.payoff ? `${p.payoff} payoff${p.payoff > 1 ? 's' : ''}` : null, p.any ? `${p.any} piece${p.any > 1 ? 's' : ''} in all` : null]
    .filter(Boolean)
    .join(', ') || 'no minimum';

export function conditionTerms(c: ConditionInput): string[] {
  return [c.term, ...(c.of ?? []).flatMap(conditionTerms)];
}

export function buildPackages(pkgs: readonly PackageInput[], o: { cardName: (id: string) => string | undefined; linker: MentionLinker; file: string; catalogueVersion: string }): KbRecord[] {
  const name = (id: string) => o.cardName(id) ?? id;
  return pkgs.map((p) => {
    const text = [
      `${p.name}: a synergy package (${p.family}; ${p.bond === 'requires' ? 'the pieces need each other' : 'each piece works alone, better together'}). ${p.description}`,
      `Online when: ${p.onlineText}`,
      `Needs ${pieces(p.needs)}; a list is built around it with ${pieces(p.builtAround)}.`,
      `Members: ${p.members.map((m) => `${name(m.id)} (${m.role}${m.note ? `: ${m.note}` : ''})`).join('; ')}.`,
      p.dormant ? `Dormant: ${p.dormant.reason}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    const members = new Set(p.members.map((m) => m.id));
    const mentioned = o.linker.cardsIn([p.description, p.onlineText, ...p.members.map((m) => m.note ?? '')].join('\n')).filter((id) => !members.has(id));
    return finishRecord({
      id: `pkg:${p.id}`,
      kind: 'package',
      title: p.name,
      aliases: [p.id],
      text,
      fields: { family: p.family, bond: p.bond, members: p.members.length, dormant: !!p.dormant, catalogueVersion: o.catalogueVersion },
      links: [
        ...linksTo('card', p.members.map((m) => `card:${m.id}`)),
        ...linksTo('term', conditionTerms(p.online).map((t) => `term:condition/${t}`)),
        ...linksTo('mentions', mentioned.map((id) => `card:${id}`)),
      ],
      source: { file: o.file, at: p.id },
      origin: 'authored',
      scope: 'public',
      status: p.status === 'owner' ? 'owner' : 'draft',
    });
  });
}

export interface GlossaryInput {
  term: string;
  group: string;
  rule?: string;
  def: string;
  engine?: string;
  bot?: string;
}

export const termId = (term: string): string => `term:${slug(term)}`;

export function buildGlossary(terms: readonly GlossaryInput[], o: { linker: MentionLinker; file: string }): KbRecord[] {
  return terms.map((t) => {
    const short = t.term.replace(/\s*\(.*\)\s*$/, '');
    return finishRecord({
      id: termId(t.term),
      kind: 'term',
      title: t.term,
      aliases: [short],
      text: [`${t.term} (glossary term, ${t.group}${t.rule ? `, ${t.rule}` : ''}): ${t.def}`, t.engine ? `In the engine: ${t.engine}` : null, t.bot ? `How the bots use it: ${t.bot}` : null].filter(Boolean).join('\n'),
      fields: { group: t.group, rule: t.rule },
      links: linksTo('mentions', o.linker.cardsIn([t.def, t.engine ?? '', t.bot ?? ''].join('\n')).map((id) => `card:${id}`)),
      source: { file: o.file, at: t.term },
      origin: 'authored',
      scope: 'public',
    });
  });
}

/** Signal terms (deck notes) or condition terms (synergy packages): `term:<family>/<key>`. */
export function buildVocabulary(vocab: Readonly<Record<string, string>>, o: { family: 'signal' | 'condition'; file: string }): KbRecord[] {
  const what = o.family === 'signal' ? 'a success-signal term of the deck notes' : 'a condition term of the synergy packages';
  return Object.keys(vocab)
    .sort()
    .map((k) =>
      finishRecord({
        id: `term:${o.family}/${k}`,
        kind: 'term',
        title: k,
        aliases: [k.replace(/-/g, ' ')],
        text: `"${k}": ${what}. ${vocab[k]}`,
        fields: { vocabulary: o.family },
        source: { file: o.file, at: k },
        origin: 'authored',
        scope: 'public',
      }),
    );
}
