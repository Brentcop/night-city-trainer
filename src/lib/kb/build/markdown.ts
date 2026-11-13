// Knowledge pack builders: Markdown split by heading (rule M1: files are cut into passages only where no table
// exists), then into passages of at most about MAX_WORDS words. Paragraphs, list items and table rows are kept whole
// where they fit; a longer one is cut at sentence ends, and a sentence longer than that at word boundaries.
import { slug, wordCount } from '../text';

export const MAX_WORDS = 120;

export interface MdSection {
  /** heading text without Markdown marks ('' for the text before the first heading) */
  heading: string;
  /** unique within the file */
  slug: string;
  level: number;
  /** the headings above this one, outermost first */
  path: string[];
  body: string;
  /** 1-based line of the heading (or of the first line) */
  line: number;
  /** 1-based line where the trimmed body starts */
  bodyLine: number;
  endLine: number;
}

/** Inline Markdown marks dropped from a heading or a bold lead: emphasis, code ticks, link targets. */
export const plainInline = (s: string): string =>
  s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Sections at headings of `levels` (default 1 to 4); deeper headings stay in the body. Headings inside fenced code are
 * ignored. With `bulletLeads`, every top-level bullet that opens with a bold lead ("- **Stack:** …") becomes its own
 * section titled by the lead (CLAUDE.md is one heading over a list of long bullets).
 */
export function mdSections(md: string, o: { levels?: readonly number[]; bulletLeads?: boolean } = {}): MdSection[] {
  const levels = o.levels ?? [1, 2, 3, 4];
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: MdSection[] = [];
  const used = new Map<string, number>();
  const uniq = (s: string) => {
    const base = s || 'intro';
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
  const stack: { level: number; heading: string }[] = [];
  let cur: { heading: string; level: number; path: string[]; line: number; body: string[] } = { heading: '', level: 0, path: [], line: 1, body: [] };
  let fence: string | null = null;
  const close = (end: number) => {
    const body = cur.body.join('\n').trim();
    const bodyLine = (cur.heading ? cur.line + 1 : cur.line) + Math.max(0, cur.body.findIndex((l) => l.trim()));
    if (body || cur.heading) out.push({ heading: cur.heading, slug: uniq(slug(cur.heading)), level: cur.level, path: cur.path, body, line: cur.line, bodyLine, endLine: end });
  };
  lines.forEach((l, i) => {
    const f = l.match(/^\s*(```|~~~)/);
    if (f) fence = fence === null ? f[1]! : fence === f[1] ? null : fence;
    const h = fence === null && !f ? l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/) : null;
    if (h && levels.includes(h[1]!.length)) {
      close(i);
      const level = h[1]!.length;
      while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
      const heading = plainInline(h[2]!);
      cur = { heading, level, path: stack.map((s) => s.heading), line: i + 1, body: [] };
      stack.push({ level, heading });
    } else cur.body.push(l);
  });
  close(lines.length);
  return o.bulletLeads ? out.flatMap((s) => splitBulletLeads(s, uniq)) : out;
}

function splitBulletLeads(s: MdSection, uniq: (s: string) => string): MdSection[] {
  const lines = s.body.split('\n');
  const parts: { lead: string | null; at: number; lines: string[] }[] = [{ lead: null, at: 0, lines: [] }];
  lines.forEach((l, i) => {
    const m = l.match(/^[-*]\s+\*\*(.+?)\*\*/);
    if (m) parts.push({ lead: plainInline(m[1]!).replace(/[:.]$/, ''), at: i, lines: [l] });
    else parts[parts.length - 1]!.lines.push(l);
  });
  if (parts.length === 1) return [s];
  const first = s.bodyLine;
  const out: MdSection[] = [];
  const head = parts[0]!.lines.join('\n').trim();
  if (head || s.heading) out.push({ ...s, body: head, endLine: first + (parts[1]?.at ?? 0) - 1 });
  parts.slice(1).forEach((p, j) => {
    const next = parts[j + 2];
    out.push({
      heading: p.lead!,
      slug: uniq(slug(p.lead!)),
      level: s.level + 1,
      path: s.heading ? [...s.path, s.heading] : s.path,
      body: p.lines.join('\n').trim(),
      line: first + p.at,
      bodyLine: first + p.at,
      endLine: next ? first + next.at - 1 : s.endLine,
    });
  });
  return out;
}

/** Units of a block that are kept whole where they fit: list items with their continuation lines, or table rows. */
function units(block: string): string[] {
  const lines = block.split('\n');
  if (lines.length === 1) return lines;
  const out: string[] = [];
  for (const l of lines) {
    const starts = /^([-*+]|\d+\.)\s|^\|/.test(l) || !out.length;
    if (starts) out.push(l);
    else out[out.length - 1] += '\n' + l;
  }
  return out;
}

/** Cut text at sentence ends, then at words, into pieces of at most `max` words. */
function cutLong(text: string, max: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z`*(“"])/);
  const pieces: string[] = [];
  for (const s of sentences) {
    if (wordCount(s) <= max) pieces.push(s);
    else {
      const words = s.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += max) pieces.push(words.slice(i, i + max).join(' '));
    }
  }
  return pack(pieces, max, ' ');
}

function pack(pieces: readonly string[], max: number, sep: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let n = 0;
  for (const p of pieces) {
    const w = wordCount(p);
    if (cur.length && n + w > max) {
      out.push(cur.join(sep));
      cur = [];
      n = 0;
    }
    cur.push(p);
    n += w;
  }
  if (cur.length) out.push(cur.join(sep));
  return out;
}

/** A section body as passages of at most `max` words (code fences are counted like prose). */
export function passages(body: string, max = MAX_WORDS): string[] {
  const blocks: string[] = [];
  let fence = false;
  let cur: string[] = [];
  for (const l of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    if (!fence && !l.trim()) {
      if (cur.length) blocks.push(cur.join('\n'));
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) blocks.push(cur.join('\n'));
  const pieces: string[] = [];
  for (const b of blocks) {
    if (wordCount(b) <= max) {
      pieces.push(b);
      continue;
    }
    const us = units(b).flatMap((u) => (wordCount(u) <= max ? [u] : cutLong(u, max)));
    pieces.push(...pack(us, max, '\n'));
  }
  return pack(pieces, max, '\n\n').filter((p) => p.trim());
}
