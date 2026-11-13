// Knowledge pack builders for prose: guide sections (split at second-level headings), doc passages (CLAUDE.md,
// README.md and docs/*.md, split by heading into passages of at most about 120 words) and code headers (the opening
// comment block of a source file, one record per file).
import { slug } from '../text';
import type { KbLink, KbRecord } from '../types';
import { MAX_WORDS, mdSections, passages, plainInline } from './markdown';
import type { MentionLinker } from './mentions';
import { finishRecord, linksTo } from './record';

const mentionLinks = (ids: readonly string[]): KbLink[] => linksTo('mentions', ids.map((id) => `card:${id}`));

export interface GuideInput {
  slug: string;
  title: string;
  badge?: string;
  deckFile?: string;
  summary?: string;
  md: string;
  /** the module the guide is written in */
  file: string;
}

/**
 * One record per section: the text before the first "## " (with the summary) is the guide's own record
 * (`guide:<slug>#intro`), and each section links to it. A guide tied to a library deck links to the deck, and a card
 * name several cards share is resolved against that deck's list.
 */
export function buildGuides(guides: readonly GuideInput[], o: { decks: ReadonlyMap<string, { id: string; cards: readonly string[] }>; linker: MentionLinker; skipped: Record<string, number> }): KbRecord[] {
  const out: KbRecord[] = [];
  for (const g of guides) {
    const deck = g.deckFile ? o.decks.get(g.deckFile) : undefined;
    if (g.deckFile && !deck) o.skipped['guide: deck not in the library'] = (o.skipped['guide: deck not in the library'] ?? 0) + 1;
    const sections = mdSections(g.md, { levels: [2] });
    const intro = sections.find((s) => !s.heading);
    const introId = `guide:${g.slug}#intro`;
    const introText = [g.summary, intro?.body].filter(Boolean).join('\n\n') || g.title;
    const base = { kind: 'guide' as const, origin: 'authored' as const, scope: 'public' as const, source: { file: g.file, at: g.slug } };
    out.push(
      finishRecord({
        ...base,
        id: introId,
        title: g.title,
        aliases: [g.slug],
        text: introText,
        fields: { guide: g.slug, badge: g.badge, deckFile: g.deckFile },
        links: [...(deck ? [{ rel: 'deck' as const, to: deck.id }] : []), ...mentionLinks(o.linker.cardsIn(introText, deck?.cards))],
      }),
    );
    for (const s of sections.filter((x) => x.heading)) {
      out.push(
        finishRecord({
          ...base,
          id: `guide:${g.slug}#${s.slug}`,
          title: `${g.title}: ${s.heading}`,
          text: s.body || s.heading,
          fields: { guide: g.slug, section: s.heading, deckFile: g.deckFile },
          links: [{ rel: 'parent', to: introId }, ...(deck ? [{ rel: 'deck' as const, to: deck.id }] : []), ...mentionLinks(o.linker.cardsIn(s.body, deck?.cards))],
        }),
      );
    }
  }
  return out;
}

/**
 * A Markdown file as doc passages: `doc:<path>#<heading slug>`, a long section adding `~2`, `~3` for later passages
 * (which link to the first as `parent`). `bulletLeads` splits a list of bold-lead bullets into one section per bullet
 * (CLAUDE.md). Empty sections are skipped.
 */
export function buildDocPassages(path: string, md: string, o: { linker: MentionLinker; bulletLeads?: boolean; maxWords?: number }): KbRecord[] {
  const out: KbRecord[] = [];
  const sections = mdSections(md, { bulletLeads: o.bulletLeads });
  const fileTitle = sections.find((s) => s.level === 1)?.heading || path;
  for (const s of sections) {
    const parts = passages(s.body, o.maxWords ?? MAX_WORDS);
    const heading = s.heading || fileTitle;
    const first = `doc:${path}#${s.slug}`;
    parts.forEach((text, i) => {
      out.push(
        finishRecord({
          id: i ? `${first}~${i + 1}` : first,
          kind: 'doc',
          title: i ? `${heading} (part ${i + 1})` : heading,
          text,
          fields: { file: path, section: [...s.path, s.heading].filter(Boolean).join(' > ') || undefined, part: parts.length > 1 ? i + 1 : undefined },
          links: [...(i ? [{ rel: 'parent' as const, to: first }] : []), ...mentionLinks(o.linker.cardsIn(text))],
          source: { file: path, at: `L${s.line}-${s.endLine}` },
          origin: 'authored',
          scope: 'public',
        }),
      );
    });
  }
  return out;
}

/** The opening comment block of a source file: leading `//` lines, or a leading block comment. Null when there is none. */
export function headerComment(src: string): { text: string; from: number; to: number } | null {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  if (lines[0]?.startsWith('#!')) i++;
  while (i < lines.length && !lines[i]!.trim()) i++;
  const start = i;
  const out: string[] = [];
  if (lines[i]?.trimStart().startsWith('//')) {
    for (; i < lines.length && lines[i]!.trimStart().startsWith('//'); i++) out.push(lines[i]!.trimStart().replace(/^\/\/\/? ?/, ''));
  } else if (lines[i]?.trimStart().startsWith('/*')) {
    for (; i < lines.length; i++) {
      const l = lines[i]!;
      out.push(l.replace(/^\s*\/\*\*?\s?/, '').replace(/\s*\*\/\s*$/, '').replace(/^\s*\*\s?/, ''));
      if (l.includes('*/')) {
        i++;
        break;
      }
    }
  }
  const text = out.join('\n').trim();
  if (!text || /^(eslint|@ts-|prettier)/.test(text) || text.split(/\s+/).length < 3) return null;
  return { text, from: start + 1, to: i };
}

export function buildCodeHeader(path: string, src: string, o: { linker: MentionLinker }): KbRecord | null {
  const h = headerComment(src);
  if (!h) return null;
  const base = path.slice(path.lastIndexOf('/') + 1);
  return finishRecord({
    id: `code:${path}`,
    kind: 'code',
    title: path,
    aliases: [base, path.replace(/\.tsx?$/, '')],
    text: h.text,
    fields: { file: path },
    links: mentionLinks(o.linker.cardsIn(h.text)),
    source: { file: path, at: `L${h.from}-${h.to}` },
    origin: 'authored',
    scope: 'public',
  });
}

/** Ids the doc builder would give a heading in a file (for tests and cross-links). */
export const docId = (path: string, heading: string): string => `doc:${path}#${slug(plainInline(heading)) || 'intro'}`;
