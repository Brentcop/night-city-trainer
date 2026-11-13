// Knowledge pack builders for the local-only sources in data/raw (rule M6): the Comprehensive Rules by numbered rule,
// the official FAQ wording linked to our ruling, the tournament rules by section and the errata page by entry. Every
// record here is `local` and `official`, and is written only to .cache/kb/. Public records never link to these; these
// link to public ones (a rule to the glossary terms that cite it, an FAQ item to its ruling and card).
import { slug } from '../text';
import { type KbLink, type KbRecord } from '../types';
import { plainInline } from './markdown';
import type { MentionLinker } from './mentions';
import { finishRecord, linksTo } from './record';

const LOCAL = { origin: 'official' as const, scope: 'local' as const };
const RULE_NUMBER = /^(\d+(?:\.\d+)+)$/;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "Title case" for an upper-case heading, without locale rules. */
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
const isHeading = (l: string) => l.length <= 70 && /\p{Lu}/u.test(l) && !/\p{Ll}/u.test(l) && !/^EXAMPLE/.test(l) && !/^\(.*\)$/.test(l);

/** The rules' "last updated" date as YYYY-MM-DD, when the text shows one. */
export function rulesDate(text: string): string | null {
  const m = text.match(/LAST UPDATED\s*\n\s*([A-Z]{3})[A-Z]*\.? (\d{1,2}), (\d{4})/);
  const month = m ? MONTHS.indexOf(m[1]!) + 1 : 0;
  return m && month ? `${m[3]}-${String(month).padStart(2, '0')}-${m[2]!.padStart(2, '0')}` : null;
}

/** Rule ids a citation such as "CR 9.7–9.14, 11.5" names (a range is expanded on its last number). */
export function citedRules(cite: string, known: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const part of cite.split(',')) {
    const nums = part.match(/\d+(?:\.\d+)+/g) ?? [];
    const [a, b] = nums;
    if (!a) continue;
    const pa = a.split('.');
    const pb = b?.split('.');
    if (pb && pa.length === pb.length && pa.slice(0, -1).join('.') === pb.slice(0, -1).join('.')) {
      const head = pa.slice(0, -1).join('.');
      for (let k = Number(pa[pa.length - 1]); k <= Number(pb[pb.length - 1]); k++) out.push(`${head}.${k}`);
    } else out.push(...nums);
  }
  return [...new Set(out)].filter((n) => known.has(n)).map((n) => `rule:${n}`);
}

/**
 * The Comprehensive Rules text, one record per numbered rule (its examples included), titled by the section heading
 * above it. Rule a.b.c links to a.b as `parent`; `citations` (glossary terms and their "CR …" references) add links
 * from each cited rule to the term.
 */
export function buildRules(text: string, o: { file: string; citations: readonly { id: string; cite: string }[] }): KbRecord[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const version = rulesDate(text);
  const first = lines.findIndex((l) => l.trim() === '1.1');
  if (first < 0) return [];
  // start at the chapter number just above rule 1.1, so its chapter and section headings are read
  let startAt = first;
  for (let k = first - 1; k >= Math.max(0, first - 5); k--)
    if (/^\d{2}$/.test(lines[k]!.trim())) {
      startAt = k;
      break;
    }
  const rules: { n: string; chapter: string; section: string; line: number; body: string[]; changed: boolean }[] = [];
  let chapter = '';
  let section = '';
  let expectChapter = false;
  for (let i = startAt; i < lines.length; i++) {
    const l = lines[i]!.trim();
    if (l === 'CREDITS') break;
    if (RULE_NUMBER.test(l)) {
      rules.push({ n: l, chapter, section, line: i + 1, body: [], changed: false });
      continue;
    }
    if (/^\d{2}$/.test(l)) {
      expectChapter = true;
      continue;
    }
    if (/^\((RECENTLY CHANGED|UPDATED[^)]*)\)$/.test(l)) {
      const last = rules[rules.length - 1];
      if (last && !last.body.length) last.changed = true;
      continue;
    }
    if (isHeading(l)) {
      if (expectChapter) chapter = titleCase(l);
      section = titleCase(l);
      expectChapter = false;
      continue;
    }
    expectChapter = false;
    if (l) rules[rules.length - 1]?.body.push(l);
  }
  const known = new Set(rules.map((r) => r.n));
  const citing = new Map<string, string[]>();
  for (const c of o.citations) for (const r of citedRules(c.cite, known)) citing.set(r, [...(citing.get(r) ?? []), c.id]);
  return rules.map((r) => {
    const parent = r.n.split('.').slice(0, -1).join('.');
    const id = `rule:${r.n}`;
    return finishRecord({
      id,
      kind: 'rule',
      title: `Rule ${r.n}${r.section ? ` (${r.section})` : ''}`,
      aliases: [r.n, `CR ${r.n}`, `rule ${r.n}`],
      text: `Comprehensive Rules ${r.n}${r.section ? `, ${r.section}` : ''}: ${r.body.join('\n')}`,
      fields: { chapter: r.chapter || undefined, section: r.section || undefined, changed: r.changed || undefined },
      links: [...(known.has(parent) ? [{ rel: 'parent' as const, to: `rule:${parent}` }] : []), ...linksTo('term', citing.get(id) ?? [])],
      source: { file: o.file, at: `L${r.line}` },
      ...LOCAL,
      stamps: { rulesVersion: version },
    });
  });
}

/** One item of data/raw/official_rules_faq.json (only these fields are read). */
export interface FaqItemInput {
  id: string;
  scope: string;
  question: string;
  answer: string;
  card?: { name?: string } | null;
}

/** The official FAQ wording, one record per item, linked to our ruling (same 8-character id) and its card. */
export function buildFaq(items: readonly FaqItemInput[], o: { file: string; version: string | null; rulingCard: ReadonlyMap<string, string | null> }): KbRecord[] {
  const seen = new Map<string, number>();
  return items.map((it, i) => {
    const key = it.id.slice(0, 8);
    const about = it.card?.name ?? 'game rules';
    const n = (seen.get(about) ?? 0) + 1;
    seen.set(about, n);
    const ruling = `ruling:${key}`;
    const card = o.rulingCard.get(ruling);
    const links: KbLink[] = [...(o.rulingCard.has(ruling) ? [{ rel: 'ruling' as const, to: ruling }] : []), ...(card ? [{ rel: 'card' as const, to: `card:${card}` }] : [])];
    return finishRecord({
      id: `faq:${key}`,
      kind: 'faq',
      title: `Official FAQ: ${about} #${n}`,
      aliases: [it.id],
      text: `Official FAQ item on ${about}.\nQ: ${it.question.trim()}\nA: ${it.answer.trim()}`,
      fields: { scope: it.scope, card: it.card?.name },
      links,
      source: { file: o.file, at: `/items/${i}` },
      ...LOCAL,
      stamps: { faqVersion: o.version },
    });
  });
}

/** A short title from the start of a rule: Markdown marks dropped, cut at the first sentence end or 60 characters. */
function shortTitle(s: string): string {
  const t = plainInline(s.replace(/#+\s*/g, ''));
  const sentence = t.split(/(?<=\.)\s/)[0] ?? t;
  if (sentence.length <= 60) return sentence.replace(/\.$/, '');
  const cut = sentence.slice(0, 60);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)) + '…';
}

/**
 * The tournament rules, one record per second-level entry (1.2, A.1) with everything under it; a chapter with no
 * such entries is one record. Lines read "<number> <text>", indented by depth.
 */
export function buildTournamentRules(text: string, o: { file: string }): KbRecord[] {
  const entries: { n: string; text: string; line: number }[] = [];
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((l, i) => {
      const m = l.match(/^\s*(\d+(?:\.\d+)*|[A-Z](?:\.\d+)*)\s+(.*)$/);
      if (m) entries.push({ n: m[1]!, text: m[2]!.trim(), line: i + 1 });
    });
  const depth = (n: string) => n.split('.').length;
  const chapters = new Map(entries.filter((e) => depth(e.n) === 1).map((e) => [e.n, e]));
  const groups: { head: (typeof entries)[number]; body: string[] }[] = [];
  for (const e of entries) {
    const top = e.n.split('.')[0]!;
    if (depth(e.n) === 1) {
      if (!entries.some((x) => depth(x.n) === 2 && x.n.startsWith(`${top}.`))) groups.push({ head: e, body: [e.text] });
    } else if (depth(e.n) === 2) groups.push({ head: e, body: [e.text] });
    else groups[groups.length - 1]?.body.push(`${e.n} ${e.text}`);
  }
  return groups.map((g) => {
    const top = g.head.n.split('.')[0]!;
    const chapter = chapters.get(top);
    const chapterTitle = chapter ? shortTitle(chapter.text) : '';
    return finishRecord({
      id: `trule:${g.head.n}`,
      kind: 'trule',
      title: `Tournament rules ${g.head.n}: ${shortTitle(g.head.text)}`,
      aliases: [`TR ${g.head.n}`],
      text: `Tournament rules ${g.head.n}${chapterTitle && depth(g.head.n) > 1 ? ` (${chapterTitle})` : ''}: ${g.body.join('\n')}`,
      fields: { chapter: chapterTitle || undefined },
      source: { file: o.file, at: `L${g.head.line}` },
      ...LOCAL,
    });
  });
}

/** The errata page, one record per "### " entry, linked to the cards its heading and text name. Stops at the page footer. */
export function buildErrata(text: string, o: { file: string; linker: MentionLinker }): KbRecord[] {
  const out: KbRecord[] = [];
  let set = '';
  let cur: { heading: string; line: number; body: string[] } | null = null;
  const used = new Set<string>();
  const flush = () => {
    if (!cur) return;
    let key = slug(cur.heading);
    for (let k = 2; used.has(key); k++) key = `${slug(cur.heading)}-${k}`;
    used.add(key);
    const body = cur.body.join('\n').trim();
    out.push(
      finishRecord({
        id: `errata:${key}`,
        kind: 'errata',
        title: `Errata: ${cur.heading}`,
        text: `Card errata or clarification for ${cur.heading}${set ? ` (${set})` : ''}: ${body}`,
        fields: { set: set || undefined },
        links: linksTo('card', o.linker.cardsIn(`${cur.heading}\n${body}`).map((id) => `card:${id}`)),
        source: { file: o.file, at: `L${cur.line}` },
        ...LOCAL,
      }),
    );
    cur = null;
  };
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (const [i, l] of lines.entries()) {
    const h = l.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      flush();
      const heading = plainInline(h[2]!);
      if (!/\p{Ll}/u.test(heading)) break;
      if (h[1] === '##') set = heading;
      else cur = { heading, line: i + 1, body: [] };
      continue;
    }
    cur?.body.push(l);
  }
  flush();
  return out;
}
